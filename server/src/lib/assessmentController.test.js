const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Assessment controller tests (mocked prisma) ----------
//
// Tests for createAssessment validation (the PRESENT-requires-severity rule in
// validateSymptoms()) and LHW-assisted assessments — an LHW may only create
// assessments for patients actually assigned to her, and assessedByUserId
// must be recorded as the LHW's user id. Prisma is mocked via require cache
// manipulation (same technique as profileController.test.js and
// checkInController.test.js).

// Mutable mock state — reset before each test.
let assessmentFindFirstResult = null
let patientProfileResult = null
let lhwFindUniqueResult = null
let symptomFindManyResult = null
let pregnancyFindFirstResult = null
let assessmentCreateArgs = null

const mockPrisma = {
  assessment: {
    findFirst: async () => assessmentFindFirstResult,
  },
  lhw: {
    findUnique: async () => lhwFindUniqueResult,
  },
  patientProfile: {
    // Where-aware lookup so patient-assignment checks behave like real Prisma:
    // a row is returned only when every where condition matches it.
    findFirst: async (args) => {
      if (!patientProfileResult) return null
      for (const [key, value] of Object.entries(args.where)) {
        if (patientProfileResult[key] !== value) return null
      }
      return patientProfileResult
    },
    findUnique: async () => patientProfileResult,
  },
  pregnancy: {
    findFirst: async () => pregnancyFindFirstResult,
  },
  symptom: {
    findMany: async () => symptomFindManyResult,
  },
  careMission: {
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (args) => ({
      id: 1,
      assessmentId: args.data.assessmentId,
      riskLevel: args.data.riskLevel,
      status: 'OPEN',
      assignedLhwId: args.data.assignedLhwId,
      createdByUserId: args.data.createdByUserId,
      createdAt: new Date(),
    }),
  },
  careMissionTimelineEntry: {
    create: async () => ({ id: 1 }),
  },
  careMissionChecklistItem: {
    createMany: async () => ({ count: 0 }),
  },
  $transaction: async (fn) => {
    // Mock transaction — just call the function with a mock tx object
    const mockTx = {
      assessment: {
        create: async (args) => {
          assessmentCreateArgs = args
          return {
            id: 999,
            patientId: args.data.patientId,
            assessedByUserId: args.data.assessedByUserId,
            riskLevel: 'GREEN',
            resultCode: 'ALL_CLEAR',
            assessmentDate: new Date(),
            assessmentSymptoms: [],
            pregnancy: null,
            patient: patientProfileResult,
          }
        },
      },
      careMission: mockPrisma.careMission,
      careMissionTimelineEntry: mockPrisma.careMissionTimelineEntry,
      careMissionChecklistItem: mockPrisma.careMissionChecklistItem,
      followUp: {
        // createCareMissionForAssessment schedules an LHW follow-up when the
        // patient has an assigned LHW — stub the tx model it needs.
        findUnique: async () => null,
        create: async () => ({ id: 77 }),
      },
    }
    return fn(mockTx)
  },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: mockPrisma,
}

const { createAssessment, getAssessment } = require('../controllers/assessmentController')

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

function mockReq(body, user = { id: 1, role: 'WOMAN' }) {
  return { user, body }
}

function resetMocks() {
  assessmentFindFirstResult = null
  patientProfileResult = {
    id: 1,
    userId: 1,
    fullName: 'Demo Woman',
    assignedLhwId: null,
    dateOfBirth: null,
  }
  lhwFindUniqueResult = null
  assessmentCreateArgs = null
  symptomFindManyResult = [
    { id: 1, code: 'severe_headache', category: 'WARNING_SIGN' },
  ]
  pregnancyFindFirstResult = null
}

// ---------- PRESENT-requires-severity validation ----------

test('createAssessment: PRESENT symptom with null severity → 400', async () => {
  resetMocks()
  const res = mockRes()

  await createAssessment(mockReq({
    patientId: 1,
    inputMethod: 'VISUAL',
    symptoms: [
      { symptomId: 1, answerStatus: 'PRESENT', severity: null },
    ],
  }), res)

  assert.equal(res.statusCode, 400)
  assert.ok(res.body.error.toLowerCase().includes('severity'), 'Error should mention severity')
})

test('createAssessment: PRESENT symptom with missing severity field → 400', async () => {
  resetMocks()
  const res = mockRes()

  await createAssessment(mockReq({
    patientId: 1,
    inputMethod: 'VISUAL',
    symptoms: [
      { symptomId: 1, answerStatus: 'PRESENT' }, // severity omitted
    ],
  }), res)

  assert.equal(res.statusCode, 400)
  assert.ok(res.body.error.toLowerCase().includes('severity'), 'Error should mention severity')
})

test('createAssessment: PRESENT symptom with empty string severity → 400', async () => {
  resetMocks()
  const res = mockRes()

  await createAssessment(mockReq({
    patientId: 1,
    inputMethod: 'VISUAL',
    symptoms: [
      { symptomId: 1, answerStatus: 'PRESENT', severity: '' },
    ],
  }), res)

  assert.equal(res.statusCode, 400)
  assert.ok(res.body.error.toLowerCase().includes('severity'), 'Error should mention severity')
})

test('createAssessment: PRESENT symptom with valid severity → 201', async () => {
  resetMocks()
  const res = mockRes()

  await createAssessment(mockReq({
    patientId: 1,
    inputMethod: 'VISUAL',
    symptoms: [
      { symptomId: 1, answerStatus: 'PRESENT', severity: 'MODERATE' },
    ],
  }), res)

  assert.equal(res.statusCode, 201)
  assert.ok(res.body.assessment, 'Should return assessment object')
})

test('createAssessment: ABSENT symptom without severity → 201 (severity optional)', async () => {
  resetMocks()
  const res = mockRes()

  await createAssessment(mockReq({
    patientId: 1,
    inputMethod: 'VISUAL',
    symptoms: [
      { symptomId: 1, answerStatus: 'ABSENT' }, // no severity needed
    ],
  }), res)

  assert.equal(res.statusCode, 201)
  assert.ok(res.body.assessment, 'Should return assessment object')
})

test('createAssessment: UNKNOWN symptom without severity → 201 (severity optional)', async () => {
  resetMocks()
  const res = mockRes()

  await createAssessment(mockReq({
    patientId: 1,
    inputMethod: 'VISUAL',
    symptoms: [
      { symptomId: 1, answerStatus: 'UNKNOWN' }, // no severity needed
    ],
  }), res)

  assert.equal(res.statusCode, 201)
  assert.ok(res.body.assessment, 'Should return assessment object')
})

// ---------- LHW-assisted assessments (assignment enforcement) ----------

test('createAssessment: LHW can create an assessment for her assigned patient → 201 with assessedByUserId set to the LHW user id', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 7 } // Lhw row belonging to req.user.id = 2
  patientProfileResult = {
    id: 10,
    userId: 99,
    fullName: 'Assigned Woman',
    assignedLhwId: 7, // assigned to this LHW
    dateOfBirth: null,
  }
  const res = mockRes()

  await createAssessment(mockReq({
    patientId: 10,
    inputMethod: 'VISUAL',
    symptoms: [
      { symptomId: 1, answerStatus: 'PRESENT', severity: 'MODERATE' },
    ],
  }, { id: 2, role: 'LHW' }), res)

  assert.equal(res.statusCode, 201)
  assert.ok(res.body.assessment, 'Should return assessment object')
  assert.equal(assessmentCreateArgs.data.patientId, 10)
  assert.equal(assessmentCreateArgs.data.assessedByUserId, 2, 'assessedByUserId must be the LHW user id')
})

test('createAssessment: LHW cannot create an assessment for a patient assigned to another LHW → 403', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 7 }
  patientProfileResult = {
    id: 10,
    userId: 99,
    fullName: 'Another LHWs Patient',
    assignedLhwId: 42, // assigned to a different LHW
    dateOfBirth: null,
  }
  const res = mockRes()

  await createAssessment(mockReq({
    patientId: 10,
    inputMethod: 'VISUAL',
    symptoms: [
      { symptomId: 1, answerStatus: 'ABSENT' },
    ],
  }, { id: 2, role: 'LHW' }), res)

  assert.equal(res.statusCode, 403)
  assert.equal(assessmentCreateArgs, null, 'No assessment should be created')
})

test('createAssessment: LHW cannot create an assessment for an unassigned patient → 403', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 7 }
  patientProfileResult = {
    id: 10,
    userId: 99,
    fullName: 'Unassigned Woman',
    assignedLhwId: null, // no LHW at all
    dateOfBirth: null,
  }
  const res = mockRes()

  await createAssessment(mockReq({
    patientId: 10,
    inputMethod: 'VISUAL',
    symptoms: [
      { symptomId: 1, answerStatus: 'ABSENT' },
    ],
  }, { id: 2, role: 'LHW' }), res)

  assert.equal(res.statusCode, 403)
  assert.equal(assessmentCreateArgs, null, 'No assessment should be created')
})

test('createAssessment: LHW without an Lhw record → 403', async () => {
  resetMocks()
  lhwFindUniqueResult = null // user has the LHW role but no Lhw profile
  const res = mockRes()

  await createAssessment(mockReq({
    patientId: 1,
    inputMethod: 'VISUAL',
    symptoms: [
      { symptomId: 1, answerStatus: 'ABSENT' },
    ],
  }, { id: 2, role: 'LHW' }), res)

  assert.equal(res.statusCode, 403)
  assert.equal(assessmentCreateArgs, null, 'No assessment should be created')
})

// ---------- GET /api/assessments/:id — access regression ----------
//
// A user who doesn't own the assessment (or isn't the assigned LHW) must
// get 404 — the same response as if the assessment didn't exist — so we
// never leak whether a specific record is present.

function mockGetReq(params, user = { id: 1, role: 'WOMAN' }) {
  return { user, params }
}

test('getAssessment: WOMAN who does not own the patient gets 404', async () => {
  resetMocks()
  // The access-filtered findFirst returns null because this WOMAN (userId 99)
  // doesn't match the assessment's patient (userId 1).
  assessmentFindFirstResult = null
  const res = mockRes()

  await getAssessment(mockGetReq({ id: '42' }, { id: 99, role: 'WOMAN' }), res)

  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'Assessment not found.')
})

test('getAssessment: assessment exists and belongs to the requesting WOMAN → 200', async () => {
  resetMocks()
  assessmentFindFirstResult = {
    id: 42,
    patientId: 1,
    riskLevel: 'GREEN',
    resultCode: 'ALL_CLEAR',
    assessmentDate: new Date(),
    inputMethod: 'VISUAL',
    triageNotes: null,
    patient: { id: 1, userId: 1, fullName: 'Demo Woman' },
    pregnancy: null,
    assessedByUser: { id: 1, role: 'WOMAN' },
    assessmentSymptoms: [],
  }
  const res = mockRes()

  await getAssessment(mockGetReq({ id: '42' }, { id: 1, role: 'WOMAN' }), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.assessment.id, 42)
})

test('getAssessment: ADMIN role gets 404 (no access policy)', async () => {
  resetMocks()
  assessmentFindFirstResult = null
  const res = mockRes()

  await getAssessment(mockGetReq({ id: '42' }, { id: 1, role: 'ADMIN' }), res)

  assert.equal(res.statusCode, 404)
})
