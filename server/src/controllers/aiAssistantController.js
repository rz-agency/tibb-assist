const prisma = require('../lib/prisma')
const { calculateRiskAssessment } = require('../lib/riskAssessment')
const qwenService = require('../lib/qwenService')

const answerStatuses = ['PRESENT', 'ABSENT', 'UNKNOWN']
const severityLevels = ['MILD', 'MODERATE', 'SEVERE']

function parsePositiveInteger(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

async function getPatientForUser(userId) {
  return prisma.patientProfile.findUnique({
    where: { userId },
    select: { id: true, pregnancies: { where: { pregnancyStatus: 'ACTIVE' }, select: { id: true } } },
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

    const symptomCatalog = await prisma.symptom.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, category: true },
      orderBy: { name: 'asc' },
    })

    const extractionResult = await qwenService.extractSymptoms(
      userText,
      Array.isArray(conversationHistory) ? conversationHistory : [],
      symptomCatalog,
    )

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

    const symptomCatalog = await prisma.symptom.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, category: true },
    })

    const catalogByCode = new Map(symptomCatalog.map((s) => [s.code, s]))

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

    const allSymptomIds = symptomCatalog.map((s) => s.id)
    const extractedIds = new Set(validatedSymptoms.map((s) => s.symptomId))

    for (const catalogSymptom of symptomCatalog) {
      if (!extractedIds.has(catalogSymptom.id)) {
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

    const riskResult = calculateRiskAssessment(validatedSymptoms.map((s) => ({
      code: s.code,
      category: s.category,
      answerStatus: s.answerStatus,
    })))

    const activePregnancyId = patient.pregnancies.length > 0 ? patient.pregnancies[0].id : null

    const assessment = await prisma.assessment.create({
      data: {
        patientId: patient.id,
        pregnancyId: activePregnancyId,
        assessedByUserId: req.user.id,
        assessmentDate: new Date(),
        inputMethod: 'VOICE',
        riskLevel: riskResult.riskLevel,
        triageNotes: `AI-assisted assessment. Rule engine result: ${riskResult.resultCode}`,
        assessmentSymptoms: {
          create: validatedSymptoms.map((s) => ({
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

    const presentSymptoms = assessment.assessmentSymptoms
      .filter((s) => s.answerStatus === 'PRESENT')
      .map((s) => `${s.symptom.name} (${s.severity || 'unspecified severity'})`)

    const symptomSummary = presentSymptoms.length > 0
      ? presentSymptoms.join(', ')
      : 'No symptoms reported as present'

    let aiExplanation = ''
    try {
      aiExplanation = await qwenService.explainResult(
        assessment.riskLevel,
        assessment,
        symptomSummary,
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
