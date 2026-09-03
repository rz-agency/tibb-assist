const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Weekly check-in controller tests (mocked prisma + aiAssessmentFlow) ----------
//
// The check-in flow must ROUTE concerning answers into the EXISTING AI
// assessment pipeline (aiAssessmentFlow.createAssessmentFromText) instead of
// scoring anything itself. We mock prisma and aiAssessmentFlow via require
// cache manipulation (same technique as aiAssistantController.test.js and
// patientController.test.js) so these tests stay fast, deterministic and
// network-free while still exercising the real controller logic.

const MS_PER_DAY = 86_400_000

// Mutable mock state — reset before each test.
let patientProfileResult = null
let dueCheckInResult = null
let createdCheckInArgs = null
let flowResult = null
let flowError = null
let flowCalls = []

const mockPrisma = {
  patientProfile: {
    findUnique: async () => patientProfileResult,
  },
  weeklyCheckIn: {
    findFirst: async () => dueCheckInResult,
    create: async (args) => {
      createdCheckInArgs = args
      return {
        id: 501,
        gestationalWeekAtCheckIn: args.data.gestationalWeekAtCheckIn,
        answers: args.data.answers,
        freeTextNote: args.data.freeTextNote,
        routedToAssessmentId: args.data.routedToAssessmentId,
        createdAt: new Date('2026-09-03T10:00:00Z'),
      }
    },
  },
}

// The controller destructures createAssessmentFromText at require time, so the
// mock delegates to mutable state instead of being replaced per test.
const mockFlow = {
  createAssessmentFromText: async (params) => {
    flowCalls.push(params)
    if (flowError) throw flowError
    return flowResult
  },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: mockPrisma,
}

const flowPath = require.resolve('../lib/aiAssessmentFlow')
require.cache[flowPath] = {
  id: flowPath,
  filename: flowPath,
  loaded: true,
  exports: mockFlow,
}

const { getCurrentQuestions, getDueStatus, submitCheckIn } = require('../controllers/checkInController')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
}

function mockReq(body = {}) {
  return { user: { id: 1, role: 'WOMAN' }, body }
}

function resetMocks() {
  patientProfileResult = null
  dueCheckInResult = null
  createdCheckInArgs = null
  flowResult = null
  flowError = null
  flowCalls = []
}

/** Patient at the given completed gestational week (weeks * 7 + 1 days ago). */
function patientAtWeek(weeks) {
  return {
    id: 9,
    assignedLhwId: null,
    pregnancies: [{ id: 3, lmpDate: new Date(Date.now() - (weeks * 7 + 1) * MS_PER_DAY) }],
  }
}

const FLOW_RESULT = {
  assessment: { id: 77, riskLevel: 'RED', assessmentSymptoms: [] },
  riskLevel: 'RED',
  riskResultCode: 'EMERGENCY_WARNING_SIGN',
  aiExplanation: 'Please seek care immediately.',
  notedSymptoms: [],
  facilities: [{ id: 4, name: 'City Hospital' }],
}

/** Complete, all-benign set of answers for the week 20 question set. */
const WEEK_20_CALM_ANSWERS = [
  { questionId: 'wellbeing', optionId: 'wellbeing_good' },
  { questionId: 'swelling', optionId: 'swelling_none' },
  { questionId: 'headaches', optionId: 'headache_none' },
  { questionId: 'fatigue', optionId: 'fatigue_normal' },
  { questionId: 'baby_movement', optionId: 'movement_as_usual' },
  { questionId: 'first_movement', optionId: 'first_movement_felt' },
]

// ---------- Auth / role guards ----------

test('guard: unauthenticated request is rejected with 401', async () => {
  const res = mockRes()
  let nextCalled = false
  await requireAuth({ session: {} }, res, () => { nextCalled = true })
  assert.equal(res.statusCode, 401)
  assert.equal(nextCalled, false)
})

test('guard: LHW caller is rejected with 403 (check-ins are woman-only)', async () => {
  const [, womanGuard] = requireRole('WOMAN')
  const res = mockRes()
  let nextCalled = false
  await womanGuard({ user: { id: 2, role: 'LHW' } }, res, () => { nextCalled = true })
  assert.equal(res.statusCode, 403)
  assert.equal(nextCalled, false)
})

test('guard: WOMAN caller passes through', async () => {
  const [, womanGuard] = requireRole('WOMAN')
  const res = mockRes()
  let nextCalled = false
  await womanGuard({ user: { id: 1, role: 'WOMAN' } }, res, () => { nextCalled = true })
  assert.equal(res.statusCode, null)
  assert.equal(nextCalled, true)
})

// ---------- GET /api/checkins/current-questions ----------

test('current-questions: no patient profile → 404 with clear error', async () => {
  resetMocks()
  const res = mockRes()
  await getCurrentQuestions(mockReq(), res)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'Patient profile not found.')
})

test('current-questions: no active pregnancy → 404 with clear error', async () => {
  resetMocks()
  patientProfileResult = { id: 9, assignedLhwId: null, pregnancies: [] }
  const res = mockRes()
  await getCurrentQuestions(mockReq(), res)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'No active pregnancy found. Please add your pregnancy details first.')
})

test('current-questions: missing LMP date → 404 with clear error', async () => {
  resetMocks()
  patientProfileResult = { id: 9, assignedLhwId: null, pregnancies: [{ id: 3, lmpDate: null }] }
  const res = mockRes()
  await getCurrentQuestions(mockReq(), res)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'Your gestational week cannot be determined. Please add your last menstrual period date in the pregnancy page.')
})

test('current-questions: week 20 → T2 core + movement + first-movement milestone, tags only, no routingText leak', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(20)
  const res = mockRes()
  await getCurrentQuestions(mockReq(), res)

  assert.equal(res.body.gestationalWeek, 20)
  assert.equal(res.body.trimester, 2)
  assert.deepEqual(res.body.milestones, ['FIRST_MOVEMENT'])
  assert.deepEqual(
    res.body.questions.map((question) => question.id),
    ['wellbeing', 'swelling', 'headaches', 'fatigue', 'baby_movement', 'first_movement'],
  )
  for (const question of res.body.questions) {
    for (const option of question.options) {
      assert.ok(['NORMAL', 'MENTION_AT_VISIT', 'ROUTE_TO_ASSESSMENT'].includes(option.tag))
      assert.equal('routingText' in option, false, `${option.id} leaked routingText`)
    }
  }
  // No pipeline routing content anywhere in the payload.
  assert.equal(JSON.stringify(res.body).includes('routingText'), false)
})

test('current-questions: week 36 → term-prep milestone questions layered on the T3 core', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(36)
  const res = mockRes()
  await getCurrentQuestions(mockReq(), res)

  assert.equal(res.body.trimester, 3)
  assert.deepEqual(res.body.milestones, ['TERM_PREP'])
  const ids = res.body.questions.map((question) => question.id)
  for (const expected of ['wellbeing', 'swelling', 'headaches', 'baby_movement', 'contractions', 'vision_changes', 'baby_position', 'contraction_frequency']) {
    assert.ok(ids.includes(expected), `${expected} missing at week 36`)
  }
})

// ---------- GET /api/checkins/due ----------

test('due: no patient profile → plain not-due response', async () => {
  resetMocks()
  const res = mockRes()
  await getDueStatus(mockReq(), res)
  assert.deepEqual(res.body, { due: false })
})

test('due: no active pregnancy → plain not-due response', async () => {
  resetMocks()
  patientProfileResult = { id: 9, assignedLhwId: null, pregnancies: [] }
  const res = mockRes()
  await getDueStatus(mockReq(), res)
  assert.deepEqual(res.body, { due: false })
})

test('due: missing LMP date → plain not-due response', async () => {
  resetMocks()
  patientProfileResult = { id: 9, assignedLhwId: null, pregnancies: [{ id: 3, lmpDate: null }] }
  const res = mockRes()
  await getDueStatus(mockReq(), res)
  assert.deepEqual(res.body, { due: false })
})

test('due: no check-in yet this gestational week → due true with week', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(20)
  dueCheckInResult = null
  const res = mockRes()
  await getDueStatus(mockReq(), res)
  assert.deepEqual(res.body, { due: true, gestationalWeek: 20 })
})

test('due: check-in already recorded this week → due false', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(20)
  dueCheckInResult = { id: 12 }
  const res = mockRes()
  await getDueStatus(mockReq(), res)
  assert.deepEqual(res.body, { due: false, gestationalWeek: 20 })
})

// ---------- POST /api/checkins — validation ----------

test('submit: answers not an array → 400', async () => {
  resetMocks()
  const res = mockRes()
  await submitCheckIn(mockReq({ answers: 'nope' }), res)
  assert.equal(res.statusCode, 400)
})

test('submit: empty answers array → 400', async () => {
  resetMocks()
  const res = mockRes()
  await submitCheckIn(mockReq({ answers: [] }), res)
  assert.equal(res.statusCode, 400)
})

test('submit: non-string freeTextNote → 400', async () => {
  resetMocks()
  const res = mockRes()
  await submitCheckIn(mockReq({ answers: WEEK_20_CALM_ANSWERS, freeTextNote: 42 }), res)
  assert.equal(res.statusCode, 400)
})

test('submit: freeTextNote longer than 2000 characters → 400', async () => {
  resetMocks()
  const res = mockRes()
  await submitCheckIn(mockReq({ answers: WEEK_20_CALM_ANSWERS, freeTextNote: 'x'.repeat(2001) }), res)
  assert.equal(res.statusCode, 400)
})

test('submit: no active pregnancy → 404 with clear error', async () => {
  resetMocks()
  patientProfileResult = { id: 9, assignedLhwId: null, pregnancies: [] }
  const res = mockRes()
  await submitCheckIn(mockReq({ answers: WEEK_20_CALM_ANSWERS }), res)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'No active pregnancy found. Please add your pregnancy details first.')
})

test('submit: unknown question id → 400', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(20)
  const res = mockRes()
  await submitCheckIn(mockReq({ answers: [{ questionId: 'contraction_frequency', optionId: 'freq_regular_10min' }] }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'Invalid check-in answers for the current gestational week.')
})

test('submit: invalid option id → 400', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(20)
  const res = mockRes()
  await submitCheckIn(mockReq({ answers: [{ questionId: 'headaches', optionId: 'headache_extreme' }] }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'Invalid check-in answers for the current gestational week.')
})

test('submit: duplicate question → 400', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(20)
  const res = mockRes()
  await submitCheckIn(mockReq({
    answers: [
      { questionId: 'wellbeing', optionId: 'wellbeing_good' },
      { questionId: 'wellbeing', optionId: 'wellbeing_okay' },
    ],
  }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'Each question may only be answered once.')
})

// ---------- POST /api/checkins — routing vs advisory (static tags) ----------

test('submit: NORMAL / MENTION_AT_VISIT answers never invoke the assessment pipeline', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(20)
  const res = mockRes()
  await submitCheckIn(mockReq({
    answers: [
      { questionId: 'wellbeing', optionId: 'wellbeing_not_well' },       // MENTION_AT_VISIT
      { questionId: 'swelling', optionId: 'swelling_none' },             // NORMAL
      { questionId: 'headaches', optionId: 'headache_none' },             // NORMAL
      { questionId: 'fatigue', optionId: 'fatigue_exhausted' },           // MENTION_AT_VISIT
      { questionId: 'baby_movement', optionId: 'movement_as_usual' },    // NORMAL
      { questionId: 'first_movement', optionId: 'first_movement_felt' },  // NORMAL
    ],
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(res.body.routed, false)
  assert.equal(res.body.routingFailed, false)
  assert.equal('assessment' in res.body, false)
  assert.equal('riskLevel' in res.body, false)
  assert.equal(flowCalls.length, 0)
  assert.equal(createdCheckInArgs.data.routedToAssessmentId, null)
  // The stored snapshot keeps each answer's static tag.
  assert.deepEqual(
    createdCheckInArgs.data.answers.map((answer) => answer.tag),
    ['MENTION_AT_VISIT', 'NORMAL', 'NORMAL', 'MENTION_AT_VISIT', 'NORMAL', 'NORMAL'],
  )
  assert.equal(res.body.checkIn.routedToAssessmentId, null)
})

test('submit: ROUTE_TO_ASSESSMENT answer routes into the existing pipeline and links the assessment', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(20)
  flowResult = FLOW_RESULT
  const res = mockRes()
  await submitCheckIn(mockReq({
    answers: [
      { questionId: 'wellbeing', optionId: 'wellbeing_good' },
      { questionId: 'swelling', optionId: 'swelling_none' },
      { questionId: 'headaches', optionId: 'headache_severe' },           // ROUTE_TO_ASSESSMENT
      { questionId: 'fatigue', optionId: 'fatigue_normal' },
      { questionId: 'baby_movement', optionId: 'movement_as_usual' },
      { questionId: 'first_movement', optionId: 'first_movement_felt' },
    ],
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(flowCalls.length, 1)
  assert.equal(flowCalls[0].text, 'I have a severe headache.')
  assert.equal(flowCalls[0].userId, 1)
  assert.equal(flowCalls[0].patient.id, 9)
  assert.equal(createdCheckInArgs.data.routedToAssessmentId, 77)
  assert.equal(res.body.routed, true)
  assert.equal(res.body.routingFailed, false)
  assert.equal(res.body.assessment.id, 77)
  assert.equal(res.body.riskLevel, 'RED')
  assert.equal(res.body.riskResultCode, 'EMERGENCY_WARNING_SIGN')
  assert.equal(res.body.checkIn.routedToAssessmentId, 77)
})

test('submit: filled free-text alone routes into the pipeline (trimmed)', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(20)
  flowResult = FLOW_RESULT
  const res = mockRes()
  await submitCheckIn(mockReq({
    answers: WEEK_20_CALM_ANSWERS,
    freeTextNote: '  Bohat chakkar aata hai jab main khari hoti hoon  ',
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(flowCalls.length, 1)
  assert.equal(flowCalls[0].text, 'Bohat chakkar aata hai jab main khari hoti hoon')
  assert.equal(res.body.routed, true)
  assert.equal(createdCheckInArgs.data.freeTextNote, 'Bohat chakkar aata hai jab main khari hoti hoon')
})

test('submit: ROUTE_TO_ASSESSMENT answer plus free-text combine into one pipeline call', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(20)
  flowResult = FLOW_RESULT
  const res = mockRes()
  await submitCheckIn(mockReq({
    answers: [
      { questionId: 'wellbeing', optionId: 'wellbeing_good' },
      { questionId: 'swelling', optionId: 'swelling_none' },
      { questionId: 'headaches', optionId: 'headache_none' },
      { questionId: 'fatigue', optionId: 'fatigue_normal' },
      { questionId: 'baby_movement', optionId: 'movement_less' },          // ROUTE_TO_ASSESSMENT
      { questionId: 'first_movement', optionId: 'first_movement_felt' },
    ],
    freeTextNote: 'Aur bukhar bhi hai',
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(flowCalls.length, 1)
  assert.equal(flowCalls[0].text, 'My baby is moving less than usual. Aur bukhar bhi hai')
  assert.equal(res.body.routed, true)
})

test('submit: whitespace-only free-text does not route', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(20)
  const res = mockRes()
  await submitCheckIn(mockReq({ answers: WEEK_20_CALM_ANSWERS, freeTextNote: '   ' }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(flowCalls.length, 0)
  assert.equal(res.body.routed, false)
  assert.equal(createdCheckInArgs.data.freeTextNote, null)
})

test('submit: pipeline returns NO_VALID_SYMPTOMS → check-in stored, routingFailed true', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(20)
  flowResult = { error: 'NO_VALID_SYMPTOMS' }
  const res = mockRes()
  await submitCheckIn(mockReq({
    answers: WEEK_20_CALM_ANSWERS.map((answer) =>
      answer.questionId === 'headaches' ? { questionId: 'headaches', optionId: 'headache_severe' } : answer),
    freeTextNote: 'Ajeeb sa ehsas hai',
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(flowCalls.length, 1)
  assert.equal(res.body.routed, true)
  assert.equal(res.body.routingFailed, true)
  assert.equal('assessment' in res.body, false)
  assert.equal(createdCheckInArgs.data.routedToAssessmentId, null)
  assert.equal(createdCheckInArgs.data.freeTextNote, 'Ajeeb sa ehsas hai')
})

test('submit: pipeline throws → check-in still stored, routingFailed true', async () => {
  resetMocks()
  patientProfileResult = patientAtWeek(20)
  flowError = new Error('LLM unavailable')
  const res = mockRes()
  await submitCheckIn(mockReq({
    answers: WEEK_20_CALM_ANSWERS.map((answer) =>
      answer.questionId === 'swelling' ? { questionId: 'swelling', optionId: 'swelling_face_hands' } : answer),
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(flowCalls.length, 1)
  assert.equal(res.body.routed, true)
  assert.equal(res.body.routingFailed, true)
  assert.equal(createdCheckInArgs.data.routedToAssessmentId, null)
  assert.equal(createdCheckInArgs.data.gestationalWeekAtCheckIn, 20)
})
