/**
 * Shared AI assessment pipeline.
 *
 * This module owns the single code path that turns LLM-extracted symptoms into
 * a scored assessment (risk engine + assessment record + Care Mission +
 * explanation + facilities). It is used by both POST /ai-assistant/confirm and
 * the weekly check-in flow, so the two can never drift apart.
 *
 * Risk scoring happens exclusively in riskAssessment.js — nothing in this
 * module decides or influences GREEN/YELLOW/RED.
 */

const prisma = require('./prisma')
const qwenService = require('./qwenService')
const { SUPPLEMENTARY_SYMPTOMS } = require('./qwenService')
const { calculateRiskAssessment } = require('./riskAssessment')
const { createCareMissionForAssessment } = require('./careMissionService')

const answerStatuses = ['PRESENT', 'ABSENT', 'UNKNOWN']
const severityLevels = ['MILD', 'MODERATE', 'SEVERE']

/** DB symptoms merged with supplementary pregnancy symptoms (extraction catalog). */
async function getSymptomCatalog() {
  const dbSymptoms = await prisma.symptom.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, category: true },
  })
  return [...dbSymptoms, ...SUPPLEMENTARY_SYMPTOMS]
}

/**
 * Create an assessment from a list of raw LLM-extracted symptoms.
 * Extracted verbatim from the former aiAssistantController.confirm body so
 * every caller gets identical behavior.
 *
 * @param {object} params
 * @param {{ id: number, assignedLhwId: number|null, pregnancies: Array<{ id: number }> }} params.patient
 * @param {number} params.userId
 * @param {Array} params.extractedSymptoms
 * @returns {Promise<{ error: 'NO_VALID_SYMPTOMS' } |
 *   { assessment: object, riskLevel: string, riskResultCode: string, aiExplanation: string, notedSymptoms: Array, facilities: Array }>}
 */
async function createAssessmentFromExtractedSymptoms({ patient, userId, extractedSymptoms }) {
  const dbSymptoms = await prisma.symptom.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, category: true },
  })

  // Merge DB symptoms with supplementary pregnancy symptoms so the AI
  // can recognize common complaints beyond the database catalog.
  const combinedCatalog = [...dbSymptoms, ...SUPPLEMENTARY_SYMPTOMS]

  const catalogByCode = new Map(combinedCatalog.map((s) => [s.code, s]))

  const validatedSymptoms = []
  for (const extracted of extractedSymptoms) {
    const catalogEntry = catalogByCode.get(extracted.code)
    if (!catalogEntry) continue

    const answerStatus = typeof extracted.answerStatus === 'string' && answerStatuses.includes(extracted.answerStatus)
      ? extracted.answerStatus
      : 'UNKNOWN'

    const severity = typeof extracted.severity === 'string' && severityLevels.includes(extracted.severity)
      ? extracted.severity
      : null

    validatedSymptoms.push({
      symptomId: catalogEntry.id,
      code: catalogEntry.code,
      category: catalogEntry.category,
      answerStatus,
      severity,
      notes: typeof extracted.notes === 'string' ? extracted.notes.slice(0, 500) : null,
    })
  }

  if (validatedSymptoms.length === 0) {
    return { error: 'NO_VALID_SYMPTOMS' }
  }

  // Only use DB-backed symptom IDs for the unknowns fill-in and risk
  // assessment. Supplementary symptoms (no DB record) are acknowledged
  // by the AI in conversation but excluded from the formal assessment.
  const dbValidatedIds = new Set(
    validatedSymptoms.filter((s) => typeof s.symptomId === 'number').map((s) => s.symptomId),
  )

  for (const catalogSymptom of dbSymptoms) {
    if (!dbValidatedIds.has(catalogSymptom.id)) {
      validatedSymptoms.push({
        symptomId: catalogSymptom.id,
        code: catalogSymptom.code,
        category: catalogSymptom.category,
        answerStatus: 'UNKNOWN',
        severity: null,
        notes: null,
      })
    }
  }

  const riskResult = calculateRiskAssessment(validatedSymptoms
    .filter((s) => typeof s.symptomId === 'number')
    .map((s) => ({
      code: s.code,
      category: s.category,
      answerStatus: s.answerStatus,
      severity: s.severity || null,
    })))

  const activePregnancyId = patient.pregnancies.length > 0 ? patient.pregnancies[0].id : null

  const assessment = await prisma.$transaction(async (tx) => {
    const created = await tx.assessment.create({
      data: {
        patientId: patient.id,
        pregnancyId: activePregnancyId,
        assessedByUserId: userId,
        assessmentDate: new Date(),
        inputMethod: 'AI',
        riskLevel: riskResult.riskLevel,
        triageNotes: `AI-assisted assessment. Rule engine result: ${riskResult.resultCode}`,
        assessmentSymptoms: {
          create: validatedSymptoms
            .filter((s) => typeof s.symptomId === 'number')
            .map((s) => ({
              symptomId: s.symptomId,
              answerStatus: s.answerStatus,
              severity: s.severity,
              notes: s.notes,
            })),
        },
      },
      include: {
        patient: { select: { id: true, userId: true, fullName: true } },
        pregnancy: true,
        assessmentSymptoms: {
          select: {
            id: true,
            answerStatus: true,
            severity: true,
            notes: true,
            symptom: { select: { id: true, code: true, name: true, category: true } },
          },
        },
      },
    })

    await createCareMissionForAssessment(tx, {
      assessmentId: created.id,
      riskLevel: riskResult.riskLevel,
      assignedLhwId: patient.assignedLhwId ?? null,
      createdByUserId: userId,
    })

    return created
  })

  const presentSymptoms = assessment.assessmentSymptoms
    .filter((s) => s.answerStatus === 'PRESENT')
    .map((s) => `${qwenService.cleanSymptomLabel(s.symptom.name)} (${s.severity || 'unspecified severity'})`)

  const symptomSummary = presentSymptoms.length > 0
    ? presentSymptoms.join(', ')
    : 'No symptoms reported as present'

  // Supplementary symptoms are acknowledged in conversation but not scored
  const supplementaryMap = new Map(
    SUPPLEMENTARY_SYMPTOMS.map((s) => [s.code, s]),
  )
  const notedSymptoms = validatedSymptoms
    .filter((s) => typeof s.symptomId !== 'number' && supplementaryMap.has(s.code))
    .map((s) => {
      const supplementarySymptom = supplementaryMap.get(s.code)
      return {
        name: supplementarySymptom.name,
        code: s.code,
        severity: s.severity,
        answerStatus: s.answerStatus,
      }
    })

  const notedSummary = notedSymptoms
    .filter((s) => s.answerStatus === 'PRESENT')
    .map((s) => `${s.name} (${s.severity || 'unspecified severity'})`)
    .join(', ') || ''

  let aiExplanation = ''
  try {
    aiExplanation = await qwenService.explainResult(
      assessment.riskLevel,
      assessment,
      symptomSummary,
      notedSummary,
    )
  } catch {
    aiExplanation = ''
  }

  const facilities = await prisma.healthcareFacility.findMany({
    select: {
      id: true,
      name: true,
      facilityType: true,
      address: true,
      city: true,
      phone: true,
    },
    orderBy: { name: 'asc' },
  })

  return {
    assessment,
    riskLevel: assessment.riskLevel,
    riskResultCode: riskResult.resultCode,
    aiExplanation,
    notedSymptoms,
    facilities,
  }
}

/**
 * Run the full pipeline on a free-text description: extract symptoms with the
 * existing LLM extraction call, then create the assessment exactly as the
 * AI assistant confirm flow does.
 *
 * @param {object} params
 * @param {object} params.patient - as required by createAssessmentFromExtractedSymptoms
 * @param {number} params.userId
 * @param {string} params.text - the described concern
 */
async function createAssessmentFromText({ patient, userId, text }) {
  const symptomCatalog = await getSymptomCatalog()
  const extraction = await qwenService.extractSymptoms(text, [], symptomCatalog)
  return createAssessmentFromExtractedSymptoms({
    patient,
    userId,
    extractedSymptoms: extraction.extractedSymptoms,
  })
}

module.exports = {
  getSymptomCatalog,
  createAssessmentFromExtractedSymptoms,
  createAssessmentFromText,
}
