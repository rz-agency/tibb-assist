const prisma = require('../lib/prisma')
const { calculateRiskAssessment } = require('../lib/riskAssessment')
const qwenService = require('../lib/qwenService')
const { SUPPLEMENTARY_SYMPTOMS } = require('../lib/qwenService')
const { createCareMissionForAssessment } = require('../lib/careMissionService')

const answerStatuses = ['PRESENT', 'ABSENT', 'UNKNOWN']
const severityLevels = ['MILD', 'MODERATE', 'SEVERE']

function parsePositiveInteger(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

async function getPatientForUser(userId) {
  return prisma.patientProfile.findUnique({
    where: { userId },
    select: { id: true, assignedLhwId: true, pregnancies: { where: { pregnancyStatus: 'ACTIVE' }, select: { id: true } } },
  })
}

async function message(req, res) {
  const { message: messageText, audio, conversationHistory = [] } = req.body

  if (!messageText && !audio) {
    return res.status(400).json({ error: 'message or audio is required.' })
  }

  try {
    let transcribedText = null

    if (audio && !messageText) {
      if (typeof audio !== 'string' || audio.length < 10) {
        return res.status(400).json({ error: 'Audio data is invalid or empty.' })
      }
      transcribedText = await qwenService.transcribeAudio(audio)
      if (!transcribedText.trim()) {
        return res.status(422).json({ error: 'Could not transcribe the audio. Please try again or type your message.' })
      }
    }

    const userText = messageText || transcribedText
    if (!userText || !userText.trim()) {
      return res.status(400).json({ error: 'No text could be determined from the input.' })
    }

    const dbSymptoms = await prisma.symptom.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, category: true },
      orderBy: { name: 'asc' },
    })

    // Merge DB symptoms with supplementary pregnancy symptoms so the LLM
    // can recognize common complaints (e.g. stomachache, nausea) even when
    // they are not yet in the database.
    const symptomCatalog = [...dbSymptoms, ...SUPPLEMENTARY_SYMPTOMS]

    const extractionResult = await qwenService.extractSymptoms(
      userText,
      Array.isArray(conversationHistory) ? conversationHistory : [],
      symptomCatalog,
    )

    // ── Backend severity normalization ──────────────────────────────
    // Collect ALL user messages (current + history) to cross-check the
    // LLM's severity assignment. If the user explicitly said "medium" but
    // the LLM returned SEVERE because the catalog name is "Severe headache",
    // we override with the user's actual words.
    const allUserText = [
      userText,
      ...(Array.isArray(conversationHistory)
        ? conversationHistory.filter((m) => m.role === 'user').map((m) => m.content)
        : []),
    ].join(' ').toLowerCase()

    const SEVERE_CODE_RE = /severe|heavy/i
    if (Array.isArray(extractionResult.extractedSymptoms)) {
      for (const symptom of extractionResult.extractedSymptoms) {
        if (!symptom.severity) continue
        // Only intervene when the code/name contains a severity word
        // (e.g. severe_headache, heavy_bleeding) — those are the codes
        // where the LLM is most likely to "borrow" severity from the name.
        const codeSuggestsSeverity = SEVERE_CODE_RE.test(symptom.code || '')
        if (!codeSuggestsSeverity) continue

        const userStatedSeverity = qwenService.normalizeSeverityFromText(allUserText)
        if (userStatedSeverity && userStatedSeverity !== symptom.severity) {
          symptom.severity = userStatedSeverity
        }
      }
    }

    if (extractionResult.needsClarification) {
      return res.json({
        phase: 'conversation',
        userInput: userText,
        transcribedText,
        assistantReply: extractionResult.chatReply,
        needsClarification: true,
        clarificationQuestion: extractionResult.clarificationQuestion,
        extractedSymptoms: extractionResult.extractedSymptoms,
        readyForAssessment: false,
        urgentIntentDetected: extractionResult.urgentIntentDetected === true,
      })
    }

    if (extractionResult.readyForAssessment) {
      return res.json({
        phase: 'ready',
        userInput: userText,
        transcribedText,
        assistantReply: extractionResult.chatReply,
        needsClarification: false,
        extractedSymptoms: extractionResult.extractedSymptoms,
        readyForAssessment: true,
        urgentIntentDetected: extractionResult.urgentIntentDetected === true,
      })
    }

    return res.json({
      phase: 'conversation',
      userInput: userText,
      transcribedText,
      assistantReply: extractionResult.chatReply,
      needsClarification: false,
      extractedSymptoms: extractionResult.extractedSymptoms,
      readyForAssessment: false,
      urgentIntentDetected: extractionResult.urgentIntentDetected === true,
    })
  } catch (error) {
    console.error('AI assistant message error:', error.message)
    return res.status(503).json({
      error: 'AI service is temporarily unavailable. You can use the standard symptom assessment instead.',
      fallback: true,
    })
  }
}

async function confirm(req, res) {
  const { extractedSymptoms } = req.body

  if (!Array.isArray(extractedSymptoms) || extractedSymptoms.length === 0) {
    return res.status(400).json({ error: 'extractedSymptoms must be a non-empty array.' })
  }

  try {
    const patient = await getPatientForUser(req.user.id)
    if (!patient) {
      return res.status(403).json({ error: 'Patient profile not found.' })
    }

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
      return res.status(400).json({ error: 'No valid symptoms could be extracted. Please try the standard assessment.' })
    }

    // Only use DB-backed symptom IDs for the unknowns fill-in and risk
    // assessment. Supplementary symptoms (no DB record) are acknowledged
    // by the AI in conversation but excluded from the formal assessment.
    const dbValidatedIds = new Set(
      validatedSymptoms.filter((s) => typeof s.symptomId === 'number').map((s) => s.symptomId),
    )
    const allDbSymptomIds = dbSymptoms.map((s) => s.id)

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
          assessedByUserId: req.user.id,
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
        createdByUserId: req.user.id,
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

    return res.json({
      phase: 'result',
      assessment,
      riskLevel: assessment.riskLevel,
      riskResultCode: riskResult.resultCode,
      aiExplanation,
      notedSymptoms,
      facilities,
    })
  } catch (error) {
    console.error('AI assistant confirm error:', error.message)
    return res.status(500).json({ error: 'Assessment creation failed. Please try the standard assessment.' })
  }
}

module.exports = {
  message,
  confirm,
}
