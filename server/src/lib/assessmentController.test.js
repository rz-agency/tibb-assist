const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Assessment controller tests (mocked prisma) ----------
//
// Tests for createAssessment validation, specifically the PRESENT-requires-severity
// rule added to validateSymptoms(). Prisma is mocked via require cache manipulation
// (same technique as profileController.test.js and checkInController.test.js).

// Mutable mock state — reset before each test.
let patientProfileResult = null
let symptomFindManyResult = null
let pregnancyFindFirstResult = null

const mockPrisma = {
  lhw: {
    findUnique: async () => null,
  },
  patientProfile: {
    findFirst: async () => patientProfileResult,
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
        create: async (args) => ({
          id: 999,
          patientId: args.data.patientId,
          riskLevel: 'GREEN',
          resultCode: 'ALL_CLEAR',
          assessmentDate: new Date(),
          assessmentSymptoms: [],
          pregnancy: null,
          patient: patientProfileResult,
        }),
      },
      careMission: mockPrisma.careMission,
      careMissionTimelineEntry: mockPrisma.careMissionTimelineEntry,
      careMissionChecklistItem: mockPrisma.careMissionChecklistItem,
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

const { createAssessment } = require('../controllers/assessmentController')

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

function mockReq(body) {
  return { user: { id: 1, role: 'WOMAN' }, body }
}

function resetMocks() {
  patientProfileResult = {
    id: 1,
    userId: 1,
    fullName: 'Demo Woman',
    assignedLhwId: null,
    dateOfBirth: null,
  }
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
