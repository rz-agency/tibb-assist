const prisma = require('../lib/prisma')
const qwenService = require('../lib/qwenService')
const { SUPPLEMENTARY_SYMPTOMS } = require('../lib/qwenService')
const { createAssessmentFromExtractedSymptoms } = require('../lib/aiAssessmentFlow')

function parsePositiveInteger(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

async function getPatientForUser(userId) {
  return prisma.patientProfile.findUnique({
    where: { userId },
    select: { id: true, assignedLhwId: true, dateOfBirth: true, pregnancies: { where: { pregnancyStatus: 'ACTIVE' }, select: { id: true } } },
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

    // Shared pipeline (also used by the weekly check-in flow): validation,
    // rule-engine scoring, assessment + Care Mission creation, explanation.
    const result = await createAssessmentFromExtractedSymptoms({
      patient,
      userId: req.user.id,
      extractedSymptoms,
    })
    if (result.error === 'NO_VALID_SYMPTOMS') {
      return res.status(400).json({ error: 'No valid symptoms could be extracted. Please try the standard assessment.' })
    }

    return res.json({ phase: 'result', ...result })
  } catch (error) {
    console.error('AI assistant confirm error:', error.message)
    return res.status(500).json({ error: 'Assessment creation failed. Please try the standard assessment.' })
  }
}

module.exports = {
  message,
  confirm,
}
