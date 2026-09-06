const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Home visit controller tests (mocked prisma) ----------
//
// Home visits are LHW-authored records of field visits to assigned patients.
// WOMAN role can read her own visits; LHW role can read and create visits for
// assigned patients. Prisma is mocked via require-cache manipulation (same
// technique as checkInController.test.js and patientController.test.js).

// Mutable mock state — reset before each test.
let lhwFindUniqueResult = null
let patientFindFirstResult = null
let homeVisitFindManyResult = []
let homeVisitCreateResult = null
let homeVisitCreateArgs = null
let findManyWhere = null

const mockPrisma = {
  lhw: {
    findUnique: async () => lhwFindUniqueResult,
  },
  patientProfile: {
    findFirst: async () => patientFindFirstResult,
  },
  homeVisit: {
    findMany: async (args) => {
      findManyWhere = args.where
      return homeVisitFindManyResult
    },
    create: async (args) => {
      homeVisitCreateArgs = args
      return homeVisitCreateResult
    },
  },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: mockPrisma,
}

const { listHomeVisits, createHomeVisit } = require('../controllers/homeVisitController')

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

function mockReq(overrides = {}) {
  return {
    user: overrides.user || { id: 1, role: 'WOMAN' },
    query: overrides.query || {},
    body: overrides.body || {},
  }
}

function resetMocks() {
  lhwFindUniqueResult = null
  patientFindFirstResult = null
  homeVisitFindManyResult = []
  homeVisitCreateResult = null
  homeVisitCreateArgs = null
  findManyWhere = null
}

const SAMPLE_VISIT = {
  id: 1,
  patientId: 10,
  lhwId: 5,
  visitDate: new Date('2026-09-01'),
  visitType: 'ROUTINE',
  topicsDiscussed: ['Nutrition', 'Supplements'],
  bloodPressureChecked: true,
  notes: 'All good',
  nextVisitDate: new Date('2026-09-15'),
  createdByUserId: 2,
  createdAt: new Date('2026-09-01T10:00:00Z'),
  updatedAt: new Date('2026-09-01T10:00:00Z'),
}

// ---------- GET /api/home-visits — validation ----------

test('listHomeVisits: missing patientId → 400', async () => {
  resetMocks()
  const res = mockRes()
  await listHomeVisits(mockReq({ query: {} }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /patientId/)
})

test('listHomeVisits: non-numeric patientId → 400', async () => {
  resetMocks()
  const res = mockRes()
  await listHomeVisits(mockReq({ query: { patientId: 'abc' } }), res)
  assert.equal(res.statusCode, 400)
})

test('listHomeVisits: zero patientId → 400', async () => {
  resetMocks()
  const res = mockRes()
  await listHomeVisits(mockReq({ query: { patientId: '0' } }), res)
  assert.equal(res.statusCode, 400)
})

// ---------- GET /api/home-visits — access control ----------

test('listHomeVisits: WOMAN sees her own visits scoped by userId', async () => {
  resetMocks()
  homeVisitFindManyResult = [SAMPLE_VISIT]
  const res = mockRes()
  await listHomeVisits(mockReq({ user: { id: 1, role: 'WOMAN' }, query: { patientId: '10' } }), res)

  assert.equal(res.statusCode, null) // 200 (no status call)
  assert.equal(res.body.visits.length, 1)
  assert.equal(res.body.visits[0].id, 1)
  assert.deepEqual(findManyWhere, { patientId: 10, patient: { userId: 1 } })
})

test('listHomeVisits: LHW sees visits scoped by assignedLhwId', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  homeVisitFindManyResult = [SAMPLE_VISIT]
  const res = mockRes()
  await listHomeVisits(mockReq({ user: { id: 2, role: 'LHW' }, query: { patientId: '10' } }), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.visits.length, 1)
  assert.deepEqual(findManyWhere, { patientId: 10, patient: { assignedLhwId: 5 } })
})

test('listHomeVisits: LHW without lhw record → 403', async () => {
  resetMocks()
  lhwFindUniqueResult = null
  const res = mockRes()
  await listHomeVisits(mockReq({ user: { id: 99, role: 'LHW' }, query: { patientId: '10' } }), res)

  assert.equal(res.statusCode, 403)
  assert.match(res.body.error, /permission/i)
})

test('listHomeVisits: ADMIN role → 403 (no access)', async () => {
  resetMocks()
  const res = mockRes()
  await listHomeVisits(mockReq({ user: { id: 1, role: 'ADMIN' }, query: { patientId: '10' } }), res)

  assert.equal(res.statusCode, 403)
})

// ---------- POST /api/home-visits — validation ----------

test('createHomeVisit: missing patientId → 400', async () => {
  resetMocks()
  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { visitDate: '2026-09-01', visitType: 'ROUTINE' },
  }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /patientId/)
})

test('createHomeVisit: missing visitDate → 400', async () => {
  resetMocks()
  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitType: 'ROUTINE' },
  }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /visitDate/)
})

test('createHomeVisit: invalid visitType → 400', async () => {
  resetMocks()
  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01', visitType: 'INVALID' },
  }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /visitType/)
})

test('createHomeVisit: missing visitType → 400', async () => {
  resetMocks()
  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01' },
  }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /visitType/)
})

// ---------- POST /api/home-visits — access control ----------

test('createHomeVisit: LHW without lhw record → 403', async () => {
  resetMocks()
  lhwFindUniqueResult = null
  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 99, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01', visitType: 'ROUTINE' },
  }), res)
  assert.equal(res.statusCode, 403)
  assert.match(res.body.error, /LHW/i)
})

test('createHomeVisit: patient not assigned to LHW → 404', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = null
  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01', visitType: 'ROUTINE' },
  }), res)
  assert.equal(res.statusCode, 404)
  assert.match(res.body.error, /not found|not assigned/i)
})

// ---------- POST /api/home-visits — successful creation ----------

test('createHomeVisit: valid ROUTINE visit → 201 with correct data', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  homeVisitCreateResult = { ...SAMPLE_VISIT }

  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: {
      patientId: 10,
      visitDate: '2026-09-01',
      visitType: 'ROUTINE',
      topicsDiscussed: ['Nutrition', 'Hygiene'],
      bloodPressureChecked: true,
      notes: 'All well',
      nextVisitDate: '2026-09-15',
    },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(res.body.visit.id, 1)
  assert.equal(homeVisitCreateArgs.data.patientId, 10)
  assert.equal(homeVisitCreateArgs.data.lhwId, 5)
  assert.equal(homeVisitCreateArgs.data.visitType, 'ROUTINE')
  assert.deepEqual(homeVisitCreateArgs.data.topicsDiscussed, ['Nutrition', 'Hygiene'])
  assert.equal(homeVisitCreateArgs.data.bloodPressureChecked, true)
  assert.equal(homeVisitCreateArgs.data.notes, 'All well')
  assert.equal(homeVisitCreateArgs.data.createdByUserId, 2)
  assert.ok(homeVisitCreateArgs.data.visitDate instanceof Date)
  assert.ok(homeVisitCreateArgs.data.nextVisitDate instanceof Date)
})

test('createHomeVisit: all valid visit types accepted', async () => {
  for (const visitType of ['ROUTINE', 'FOLLOW_UP', 'POSTNATAL', 'EMERGENCY_FOLLOW_UP']) {
    resetMocks()
    lhwFindUniqueResult = { id: 5 }
    patientFindFirstResult = { id: 10 }
    homeVisitCreateResult = { ...SAMPLE_VISIT, visitType }

    const res = mockRes()
    await createHomeVisit(mockReq({
      user: { id: 2, role: 'LHW' },
      body: { patientId: 10, visitDate: '2026-09-01', visitType },
    }), res)

    assert.equal(res.statusCode, 201, `${visitType} should succeed`)
    assert.equal(homeVisitCreateArgs.data.visitType, visitType)
  }
})

// ---------- POST /api/home-visits — topics sanitization ----------

test('createHomeVisit: topicsDiscussed not an array → 400', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01', visitType: 'ROUTINE', topicsDiscussed: 'Nutrition' },
  }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /topicsDiscussed/)
})

test('createHomeVisit: empty topics array → stored as null', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  homeVisitCreateResult = { ...SAMPLE_VISIT, topicsDiscussed: null }

  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01', visitType: 'ROUTINE', topicsDiscussed: [] },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(homeVisitCreateArgs.data.topicsDiscussed, null)
})

test('createHomeVisit: topics with empty strings / whitespace filtered out', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  homeVisitCreateResult = { ...SAMPLE_VISIT, topicsDiscussed: ['Nutrition'] }

  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01', visitType: 'ROUTINE', topicsDiscussed: ['Nutrition', '', '  ', 42] },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.deepEqual(homeVisitCreateArgs.data.topicsDiscussed, ['Nutrition'])
})

test('createHomeVisit: null topicsDiscussed → stored as null', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  homeVisitCreateResult = { ...SAMPLE_VISIT, topicsDiscussed: null }

  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01', visitType: 'ROUTINE', topicsDiscussed: null },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(homeVisitCreateArgs.data.topicsDiscussed, null)
})

// ---------- POST /api/home-visits — notes / optional fields ----------

test('createHomeVisit: whitespace-only notes → null', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  homeVisitCreateResult = { ...SAMPLE_VISIT, notes: null }

  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01', visitType: 'ROUTINE', notes: '   ' },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(homeVisitCreateArgs.data.notes, null)
})

test('createHomeVisit: notes trimmed', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  homeVisitCreateResult = { ...SAMPLE_VISIT, notes: 'Patient doing well' }

  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01', visitType: 'ROUTINE', notes: '  Patient doing well  ' },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(homeVisitCreateArgs.data.notes, 'Patient doing well')
})

test('createHomeVisit: bloodPressureChecked defaults to false when not provided', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  homeVisitCreateResult = { ...SAMPLE_VISIT, bloodPressureChecked: false }

  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01', visitType: 'ROUTINE' },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(homeVisitCreateArgs.data.bloodPressureChecked, false)
})

test('createHomeVisit: nextVisitDate null when not provided', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  homeVisitCreateResult = { ...SAMPLE_VISIT, nextVisitDate: null }

  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01', visitType: 'ROUTINE' },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(homeVisitCreateArgs.data.nextVisitDate, null)
})

// ---------- POST /api/home-visits — database errors ----------

test('createHomeVisit: P2002 duplicate → 409', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }

  // Override create to throw
  const origCreate = mockPrisma.homeVisit.create
  mockPrisma.homeVisit.create = async () => {
    const err = new Error('Unique constraint failed')
    err.code = 'P2002'
    throw err
  }

  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01', visitType: 'ROUTINE' },
  }), res)

  assert.equal(res.statusCode, 409)
  assert.match(res.body.error, /duplicate/i)
  mockPrisma.homeVisit.create = origCreate
})

test('createHomeVisit: P2025 record not found → 404', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }

  const origCreate = mockPrisma.homeVisit.create
  mockPrisma.homeVisit.create = async () => {
    const err = new Error('Record not found')
    err.code = 'P2025'
    throw err
  }

  const res = mockRes()
  await createHomeVisit(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, visitDate: '2026-09-01', visitType: 'ROUTINE' },
  }), res)

  assert.equal(res.statusCode, 404)
  assert.match(res.body.error, /not found/i)
  mockPrisma.homeVisit.create = origCreate
})

test('listHomeVisits: database error → 500', async () => {
  resetMocks()
  const origFindMany = mockPrisma.homeVisit.findMany
  mockPrisma.homeVisit.findMany = async () => {
    const err = new Error('Connection lost')
    err.code = 'P1001'
    throw err
  }

  const res = mockRes()
  await listHomeVisits(mockReq({ user: { id: 1, role: 'WOMAN' }, query: { patientId: '10' } }), res)

  assert.equal(res.statusCode, 500)
  assert.match(res.body.error, /database/i)
  mockPrisma.homeVisit.findMany = origFindMany
})
