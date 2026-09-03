const prisma = require('../lib/prisma')
const { getGestationalWeeks } = require('../lib/gestationalAge')
const { getCheckInQuestionSet } = require('../lib/checkInQuestions')
const { createAssessmentFromText } = require('../lib/aiAssessmentFlow')

const FREE_TEXT_MAX_LENGTH = 2000

/**
 * Patient + most recent ACTIVE pregnancy (with LMP date) for check-in context.
 * The shape matches what aiAssessmentFlow needs (id, assignedLhwId,
 * pregnancies[].id).
 */
async function getCheckInContext(userId) {
  return prisma.patientProfile.findUnique({
    where: { userId },
    select: {
      id: true,
      assignedLhwId: true,
      pregnancies: {
        where: { pregnancyStatus: 'ACTIVE' },
        select: { id: true, lmpDate: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

/** GET /api/checkins/current-questions */
async function getCurrentQuestions(req, res) {
  try {
    const patient = await getCheckInContext(req.user.id)
    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found.' })
    }

    const pregnancy = patient.pregnancies[0]
    if (!pregnancy) {
      return res.status(404).json({ error: 'No active pregnancy found. Please add your pregnancy details first.' })
    }

    const gestationalWeek = getGestationalWeeks(pregnancy.lmpDate)
    if (gestationalWeek == null) {
      return res.status(404).json({ error: 'Your gestational week cannot be determined. Please add your last menstrual period date in the pregnancy page.' })
    }

    const { trimester, questions, milestones } = getCheckInQuestionSet(gestationalWeek)

    return res.json({
      gestationalWeek,
      trimester,
      milestones,
      // routingText is internal pipeline content — never sent to the client.
      questions: questions.map((question) => ({
        id: question.id,
        options: question.options.map((option) => ({ id: option.id, tag: option.tag })),
      })),
    })
  } catch (error) {
    console.error('Check-in questions error:', error.message)
    return res.status(500).json({ error: 'A database error occurred.' })
  }
}

/** GET /api/checkins/due */
async function getDueStatus(req, res) {
  try {
    const patient = await getCheckInContext(req.user.id)
    // A woman without a profile / active pregnancy / LMP date has nothing to
    // be reminded about — respond with a plain "not due" instead of an error
    // so the dashboard banner call stays simple.
    if (!patient || patient.pregnancies.length === 0) {
      return res.json({ due: false })
    }

    const gestationalWeek = getGestationalWeeks(patient.pregnancies[0].lmpDate)
    if (gestationalWeek == null) {
      return res.json({ due: false })
    }

    const existing = await prisma.weeklyCheckIn.findFirst({
      where: { patientProfileId: patient.id, gestationalWeekAtCheckIn: gestationalWeek },
      select: { id: true },
    })

    return res.json({ due: !existing, gestationalWeek })
  } catch (error) {
    console.error('Check-in due error:', error.message)
    return res.status(500).json({ error: 'A database error occurred.' })
  }
}

/** POST /api/checkins */
async function submitCheckIn(req, res) {
  const { answers, freeTextNote } = req.body

  if (!Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: 'answers must be a non-empty array.' })
  }
  if (freeTextNote !== undefined && freeTextNote !== null && typeof freeTextNote !== 'string') {
    return res.status(400).json({ error: 'freeTextNote must be a string.' })
  }
  const trimmedNote = typeof freeTextNote === 'string' ? freeTextNote.trim() : ''
  if (trimmedNote.length > FREE_TEXT_MAX_LENGTH) {
    return res.status(400).json({ error: `freeTextNote must be at most ${FREE_TEXT_MAX_LENGTH} characters.` })
  }

  try {
    const patient = await getCheckInContext(req.user.id)
    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found.' })
    }

    const pregnancy = patient.pregnancies[0]
    if (!pregnancy) {
      return res.status(404).json({ error: 'No active pregnancy found. Please add your pregnancy details first.' })
    }

    const gestationalWeek = getGestationalWeeks(pregnancy.lmpDate)
    if (gestationalWeek == null) {
      return res.status(404).json({ error: 'Your gestational week cannot be determined. Please add your last menstrual period date in the pregnancy page.' })
    }

    // Validate every answer against the current week's question set.
    const { questions } = getCheckInQuestionSet(gestationalWeek)
    const questionById = new Map(questions.map((question) => [question.id, question]))
    const seenQuestionIds = new Set()
    const selectedOptions = []

    for (const answer of answers) {
      if (!answer || typeof answer.questionId !== 'string' || typeof answer.optionId !== 'string') {
        return res.status(400).json({ error: 'Each answer must include questionId and optionId.' })
      }
      const question = questionById.get(answer.questionId)
      if (!question) {
        return res.status(400).json({ error: 'Invalid check-in answers for the current gestational week.' })
      }
      if (seenQuestionIds.has(answer.questionId)) {
        return res.status(400).json({ error: 'Each question may only be answered once.' })
      }
      const option = question.options.find((candidate) => candidate.id === answer.optionId)
      if (!option) {
        return res.status(400).json({ error: 'Invalid check-in answers for the current gestational week.' })
      }
      seenQuestionIds.add(answer.questionId)
      selectedOptions.push({ question, option })
    }

    // Static severity tags decide which existing path each answer takes:
    // advisory-only (NORMAL / MENTION_AT_VISIT) or routing into the EXISTING
    // AI assessment pipeline (ROUTE_TO_ASSESSMENT). Tags are static content
    // properties, not risk calculations — riskAssessment.js alone decides
    // GREEN/YELLOW/RED, and only after the content reaches that pipeline.
    const routingOptions = selectedOptions.filter((selected) => selected.option.tag === 'ROUTE_TO_ASSESSMENT')
    const routed = routingOptions.length > 0 || trimmedNote !== ''

    let assessmentPayload = null
    if (routed) {
      const routingTextParts = routingOptions.map((selected) => selected.option.routingText)
      if (trimmedNote) routingTextParts.push(trimmedNote)
      const routingText = routingTextParts.join(' ')

      try {
        const result = await createAssessmentFromText({
          patient,
          userId: req.user.id,
          text: routingText,
        })
        if (!result.error) {
          assessmentPayload = result
        }
      } catch (flowError) {
        // AI pipeline unavailable — the check-in is still stored. The client
        // shows a prompt to use the standard assessment instead of a result.
        console.error('Check-in routing error:', flowError.message)
      }
    }

    const checkIn = await prisma.weeklyCheckIn.create({
      data: {
        patientProfileId: patient.id,
        gestationalWeekAtCheckIn: gestationalWeek,
        answers: selectedOptions.map((selected) => ({
          questionId: selected.question.id,
          optionId: selected.option.id,
          tag: selected.option.tag,
        })),
        freeTextNote: trimmedNote || null,
        routedToAssessmentId: assessmentPayload ? assessmentPayload.assessment.id : null,
      },
      select: {
        id: true,
        gestationalWeekAtCheckIn: true,
        answers: true,
        freeTextNote: true,
        routedToAssessmentId: true,
        createdAt: true,
      },
    })

    return res.status(201).json({
      checkIn,
      routed,
      routingFailed: routed && !assessmentPayload,
      ...(assessmentPayload || {}),
    })
  } catch (error) {
    console.error('Check-in submit error:', error.message)
    return res.status(500).json({ error: 'A database error occurred.' })
  }
}

module.exports = {
  getCurrentQuestions,
  getDueStatus,
  submitCheckIn,
}
