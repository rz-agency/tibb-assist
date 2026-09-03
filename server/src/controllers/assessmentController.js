const prisma = require('../lib/prisma')
const { calculateRiskAssessment } = require('../lib/riskAssessment')
const { createCareMissionForAssessment } = require('../lib/careMissionService')
const { getGestationalWeeks } = require('../lib/gestationalAge')
const { computeAgeRiskNote } = require('./profileController')

const inputMethods = ['VISUAL', 'VOICE', 'OTHER']
const answerStatuses = ['PRESENT', 'ABSENT', 'UNKNOWN']
const severityLevels = ['MILD', 'MODERATE', 'SEVERE']

const symptomSelect = {
  id: true,
  code: true,
  name: true,
  category: true,
}

const assessmentInclude = {
  patient: {
    select: {
      id: true,
      userId: true,
      fullName: true,
    },
  },
  pregnancy: true,
  assessmentSymptoms: {
    select: {
      id: true,
      answerStatus: true,
      severity: true,
      notes: true,
      createdAt: true,
      symptom: { select: symptomSelect },
    },
  },
}

function parsePositiveInteger(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function isOneOf(value, values) {
  return typeof value === 'string' && values.includes(value)
}

function handleDatabaseError(error, res) {
  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'A duplicate assessment symptom was submitted.' })
  }

  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'A related record was not found.' })
  }

  console.error(error)
  return res.status(500).json({ error: 'A database error occurred.' })
}

async function getAccessiblePatientFilter(user) {
  if (user.role === 'WOMAN') {
    return { userId: user.id }
  }

  if (user.role === 'LHW') {
    const lhw = await prisma.lhw.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    return lhw ? { assignedLhwId: lhw.id } : null
  }

  return null
}

async function getAssessmentAccessFilter(user) {
  const patientFilter = await getAccessiblePatientFilter(user)
  return patientFilter ? { patient: patientFilter } : null
}

async function listSymptoms(req, res) {
  try {
    const symptoms = await prisma.symptom.findMany({
      where: { isActive: true },
      select: symptomSelect,
      orderBy: { name: 'asc' },
    })

    return res.json({ symptoms })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function listAssessments(req, res) {
  try {
    const accessFilter = await getAssessmentAccessFilter(req.user)

    if (!accessFilter) {
      return res.status(403).json({ error: 'You do not have permission to view assessments.' })
    }

    const assessments = await prisma.assessment.findMany({
      where: accessFilter,
      orderBy: { assessmentDate: 'desc' },
      include: assessmentInclude,
    })

    return res.json({ assessments })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

function validateSymptoms(symptoms) {
  if (!Array.isArray(symptoms) || symptoms.length === 0) {
    return 'symptoms must be a non-empty array.'
  }

  const symptomIds = new Set()

  for (const symptom of symptoms) {
    const symptomId = parsePositiveInteger(symptom?.symptomId)

    if (!symptomId) return 'Each symptom must have a valid symptomId.'
    if (symptomIds.has(symptomId)) return 'The same symptom cannot be submitted twice.'
    if (!isOneOf(symptom.answerStatus, answerStatuses)) {
      return 'Each symptom must have a valid answerStatus.'
    }
    // PRESENT symptoms must have severity specified (safety net for frontend validation)
    if (symptom.answerStatus === 'PRESENT' && (symptom.severity === undefined || symptom.severity === null || symptom.severity === '')) {
      return 'Symptoms marked as PRESENT must have a severity level (MILD, MODERATE, or SEVERE).'
    }
    if (symptom.severity !== undefined && symptom.severity !== null && symptom.severity !== '' && !isOneOf(symptom.severity, severityLevels)) {
      return 'Each symptom severity must be MILD, MODERATE, or SEVERE.'
    }
    if (symptom.notes !== undefined && symptom.notes !== null && typeof symptom.notes !== 'string') {
      return 'Symptom notes must be text.'
    }

    symptomIds.add(symptomId)
  }

  return null
}

async function createAssessment(req, res) {
  const patientId = parsePositiveInteger(req.body.patientId)
  const pregnancyId = req.body.pregnancyId === undefined || req.body.pregnancyId === null
    ? null
    : parsePositiveInteger(req.body.pregnancyId)
  const { inputMethod, triageNotes, symptoms } = req.body

  if (!patientId) return res.status(400).json({ error: 'patientId must be a positive integer.' })
  if (req.body.pregnancyId !== undefined && req.body.pregnancyId !== null && !pregnancyId) {
    return res.status(400).json({ error: 'pregnancyId must be a positive integer when provided.' })
  }
  if (!isOneOf(inputMethod, inputMethods)) {
    return res.status(400).json({ error: 'inputMethod must be VISUAL, VOICE, or OTHER.' })
  }
  if (triageNotes !== undefined && triageNotes !== null && typeof triageNotes !== 'string') {
    return res.status(400).json({ error: 'triageNotes must be text.' })
  }

  const symptomError = validateSymptoms(symptoms)
  if (symptomError) return res.status(400).json({ error: symptomError })

  try {
    const accessFilter = await getAccessiblePatientFilter(req.user)
    if (!accessFilter) {
      return res.status(403).json({ error: 'You do not have permission to create assessments.' })
    }

    const patient = await prisma.patientProfile.findFirst({
      where: { id: patientId, ...accessFilter },
      select: { id: true, assignedLhwId: true, dateOfBirth: true },
    })

    if (!patient) {
      return res.status(403).json({ error: 'You can only create assessments for an allowed patient.' })
    }

    if (pregnancyId) {
      const pregnancy = await prisma.pregnancy.findFirst({
        where: { id: pregnancyId, patientId },
        select: { id: true },
      })

      if (!pregnancy) return res.status(400).json({ error: 'pregnancyId does not belong to patientId.' })
    }

    // Resolve gestational age from the linked (or active) pregnancy.
    // This is needed for preterm/postterm risk escalation in the engine.
    const activePregnancy = await prisma.pregnancy.findFirst({
      where: {
        patientId,
        ...(pregnancyId ? { id: pregnancyId } : { pregnancyStatus: 'ACTIVE' }),
      },
      select: { id: true, lmpDate: true },
    })

    const gestationalWeeks = activePregnancy
      ? getGestationalWeeks(activePregnancy.lmpDate)
      : null

    const symptomIds = symptoms.map((symptom) => parsePositiveInteger(symptom.symptomId))
    const activeSymptoms = await prisma.symptom.findMany({
      where: { id: { in: symptomIds }, isActive: true },
      select: { id: true, code: true, category: true },
    })

    if (activeSymptoms.length !== symptomIds.length) {
      return res.status(400).json({ error: 'Every submitted symptom must exist and be active.' })
    }

    const activeSymptomsById = new Map(activeSymptoms.map((symptom) => [symptom.id, symptom]))
    const riskAssessment = calculateRiskAssessment(symptoms.map((symptom) => ({
      ...activeSymptomsById.get(parsePositiveInteger(symptom.symptomId)),
      answerStatus: symptom.answerStatus,
      severity: symptom.severity || null,
    })), gestationalWeeks)

    const assessment = await prisma.$transaction(async (tx) => {
      const created = await tx.assessment.create({
        data: {
          patientId,
          pregnancyId,
          assessedByUserId: req.user.id,
          assessmentDate: new Date(),
          inputMethod,
          riskLevel: riskAssessment.riskLevel,
          resultCode: riskAssessment.resultCode,
          triageNotes: triageNotes ?? null,
          assessmentSymptoms: {
            create: symptoms.map((symptom) => ({
              symptomId: parsePositiveInteger(symptom.symptomId),
              answerStatus: symptom.answerStatus,
              severity: symptom.severity ?? null,
              notes: symptom.notes ?? null,
            })),
          },
        },
        include: assessmentInclude,
      })

      await createCareMissionForAssessment(tx, {
        assessmentId: created.id,
        riskLevel: riskAssessment.riskLevel,
        assignedLhwId: patient.assignedLhwId ?? null,
        createdByUserId: req.user.id,
      })

      return created
    })

    const ageRiskNote = computeAgeRiskNote(patient.dateOfBirth)

    return res.status(201).json({ assessment, ageRiskNote })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function getAssessment(req, res) {
  const assessmentId = parsePositiveInteger(req.params.id)
  if (!assessmentId) return res.status(400).json({ error: 'Assessment id must be a positive integer.' })

  try {
    const accessFilter = await getAssessmentAccessFilter(req.user)
    if (!accessFilter) {
      return res.status(403).json({ error: 'You do not have permission to view assessments.' })
    }

    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, ...accessFilter },
      include: assessmentInclude,
    })

    if (!assessment) return res.status(404).json({ error: 'Assessment not found.' })
    return res.json({ assessment })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  listSymptoms,
  listAssessments,
  createAssessment,
  getAssessment,
}
