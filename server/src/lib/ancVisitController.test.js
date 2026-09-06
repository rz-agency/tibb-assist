const test = require('node:test')
const assert = require('node:assert/strict')

// ─── Mock setup ──────────────────────────────────────────────────
// Mock prisma via require.cache (same pattern as checkInController.test.js).
// Mutable state — reset before each test.

let findManyResult = []
let pregnancyResult = null
let findFirstResult = null
let createResult = null
let findUniqueAncResult = null
let updateResult = null
let lhwResult = null
let ancFindUniqueResult = null

const mockPrisma = {
  ancVisit: {
    findMany: async () => findManyResult,
    findFirst: async () => findFirstResult,
    findUnique: async (args) => {
      // Distinguish calls: controller uses findUnique on ancVisit
      // both in updateAncVisit (to get pregnancy.lmpDate) and for access check.
      if (args.select?.pregnancy) return ancFindUniqueResult
      return findUniqueAncResult
    },
    create: async (args) => {
      createResult._args = args
      return createResult
    },
    update: async (args) => {
      updateResult._args = args
      return updateResult
    },
  },
  pregnancy: {
    findUnique: async () => pregnancyResult,
    findFirst: async () => findFirstResult,
  },
  lhw: {
    findUnique: async () => lhwResult,
  },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: mockPrisma,
}

const { listAncVisits, createAncVisit, updateAncVisit } = require('../controllers/ancVisitController')

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
  }
}

function mockReq(overrides = {}) {
  return {
    user: overrides.user || { id: 1, role: 'WOMAN' },
    query: overrides.query || {},
    params: overrides.params || {},
    body: overrides.body || {},
  }
}

function resetMocks() {
  findManyResult = []
  pregnancyResult = null
  findFirstResult = null
  createResult = null
  findUniqueAncResult = null
  updateResult = null
  lhwResult = null
  ancFindUniqueResult = null
}

// ─── listAncVisits: validation ────────────────────────────────────

test('list: missing pregnancyId → 400', async () => {
  resetMocks()
  const res = mockRes()
  await listAncVisits(mockReq({ query: {} }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /pregnancyId/)
})

test('list: non-numeric pregnancyId → 400', async () => {
  resetMocks()
  const res = mockRes()
  await listAncVisits(mockReq({ query: { pregnancyId: 'abc' } }), res)
  assert.equal(res.statusCode, 400)
})

test('list: negative pregnancyId → 400', async () => {
  resetMocks()
  const res = mockRes()
  await listAncVisits(mockReq({ query: { pregnancyId: '-1' } }), res)
  assert.equal(res.statusCode, 400)
})

// ─── listAncVisits: access control ───────────────────────────────

test('list: ADMIN role → 403', async () => {
  resetMocks()
  const res = mockRes()
  await listAncVisits(mockReq({ user: { id: 1, role: 'ADMIN' }, query: { pregnancyId: '5' } }), res)
  assert.equal(res.statusCode, 403)
})

test('list: LHW without Lhw row → 403', async () => {
  resetMocks()
  lhwResult = null
  const res = mockRes()
  await listAncVisits(mockReq({ user: { id: 2, role: 'LHW' }, query: { pregnancyId: '5' } }), res)
  assert.equal(res.statusCode, 403)
})

// ─── listAncVisits: success ──────────────────────────────────────

test('list: WOMAN sees her own visits with schedule', async () => {
  resetMocks()
  findManyResult = [
    { id: 1, visitNumber: 1, gestationalWeekAtVisit: 12, visitDate: '2026-03-26' },
  ]
  pregnancyResult = { id: 5, lmpDate: new Date('2026-01-01'), pregnancyStatus: 'ACTIVE' }
  const res = mockRes()
  await listAncVisits(mockReq({ query: { pregnancyId: '5' } }), res)
  assert.equal(res.statusCode, null) // 200 (default)
  assert.ok(Array.isArray(res.body.visits))
  assert.equal(res.body.visits.length, 1)
  assert.ok(Array.isArray(res.body.schedule))
  assert.equal(res.body.schedule.length, 8)
  assert.ok(res.body.summary)
  assert.equal(res.body.summary.total, 8)
})

test('list: pregnancy not found → 404', async () => {
  resetMocks()
  findManyResult = []
  pregnancyResult = null
  const res = mockRes()
  await listAncVisits(mockReq({ query: { pregnancyId: '999' } }), res)
  assert.equal(res.statusCode, 404)
  assert.match(res.body.error, /not found/i)
})

test('list: LHW with valid Lhw row sees visits', async () => {
  resetMocks()
  lhwResult = { id: 10 }
  findManyResult = []
  pregnancyResult = { id: 5, lmpDate: new Date(Date.now() - 10 * 7 * 86400000), pregnancyStatus: 'ACTIVE' }
  const res = mockRes()
  await listAncVisits(mockReq({ user: { id: 2, role: 'LHW' }, query: { pregnancyId: '5' } }), res)
  assert.equal(res.statusCode, null)
  assert.ok(res.body.visits)
  assert.ok(res.body.schedule)
})

// ─── createAncVisit: validation ──────────────────────────────────

test('create: missing pregnancyId → 400', async () => {
  resetMocks()
  const res = mockRes()
  await createAncVisit(mockReq({ body: { visitNumber: 1, visitDate: '2026-04-01' } }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /pregnancyId/)
})

test('create: missing visitNumber → 400', async () => {
  resetMocks()
  const res = mockRes()
  await createAncVisit(mockReq({ body: { pregnancyId: 5, visitDate: '2026-04-01' } }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /visitNumber/)
})

test('create: missing visitDate → 400', async () => {
  resetMocks()
  const res = mockRes()
  await createAncVisit(mockReq({ body: { pregnancyId: 5, visitNumber: 1 } }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /visitDate/)
})

test('create: visitNumber 0 → 400', async () => {
  resetMocks()
  const res = mockRes()
  await createAncVisit(mockReq({ body: { pregnancyId: 5, visitNumber: 0, visitDate: '2026-04-01' } }), res)
  assert.equal(res.statusCode, 400)
})

// ─── createAncVisit: access control ──────────────────────────────

test('create: ADMIN → 403', async () => {
  resetMocks()
  const res = mockRes()
  await createAncVisit(mockReq({
    user: { id: 1, role: 'ADMIN' },
    body: { pregnancyId: 5, visitNumber: 1, visitDate: '2026-04-01' },
  }), res)
  assert.equal(res.statusCode, 403)
})

test('create: pregnancy not found → 404', async () => {
  resetMocks()
  findFirstResult = null
  const res = mockRes()
  await createAncVisit(mockReq({ body: { pregnancyId: 999, visitNumber: 1, visitDate: '2026-04-01' } }), res)
  assert.equal(res.statusCode, 404)
})

// ─── createAncVisit: success ─────────────────────────────────────

test('create: WOMAN creates visit with computed gestationalWeekAtVisit', async () => {
  resetMocks()
  const lmpDate = new Date(Date.UTC(2026, 0, 1)) // Jan 1 2026
  findFirstResult = { id: 5, lmpDate }
  createResult = {
    id: 1,
    pregnancyId: 5,
    loggedByUserId: 1,
    visitNumber: 1,
    visitDate: new Date('2026-03-26'),
    gestationalWeekAtVisit: 12,
    bloodPressure: '120/80',
    weightKg: 65,
    dangerSignsChecked: false,
    notes: 'All good',
    nextVisitDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const res = mockRes()
  await createAncVisit(mockReq({
    body: {
      pregnancyId: 5,
      visitNumber: 1,
      visitDate: '2026-03-26',
      bloodPressure: '120/80',
      weightKg: 65,
      dangerSignsChecked: false,
      notes: 'All good',
    },
  }), res)
  assert.equal(res.statusCode, 201)
  assert.ok(res.body.visit)
  assert.equal(res.body.visit.id, 1)
  // Verify gestationalWeekAtVisit was computed (Jan 1 → Mar 26 = 12 weeks).
  assert.equal(createResult._args.data.gestationalWeekAtVisit, 12)
})

test('create: optional fields sanitized — empty strings become null', async () => {
  resetMocks()
  findFirstResult = { id: 5, lmpDate: new Date(Date.UTC(2026, 0, 1)) }
  createResult = {
    id: 2, pregnancyId: 5, loggedByUserId: 1, visitNumber: 2,
    visitDate: new Date('2026-05-14'), gestationalWeekAtVisit: 19,
    bloodPressure: null, weightKg: null, dangerSignsChecked: false,
    notes: null, nextVisitDate: null, createdAt: new Date(), updatedAt: new Date(),
  }
  const res = mockRes()
  await createAncVisit(mockReq({
    body: {
      pregnancyId: 5,
      visitNumber: 2,
      visitDate: '2026-05-14',
      bloodPressure: '  ',
      weightKg: '',
      notes: '',
    },
  }), res)
  assert.equal(res.statusCode, 201)
  assert.equal(createResult._args.data.bloodPressure, null)
  assert.equal(createResult._args.data.weightKg, null)
  assert.equal(createResult._args.data.notes, null)
})

test('create: dangerSignsChecked coerced to boolean', async () => {
  resetMocks()
  findFirstResult = { id: 5, lmpDate: null }
  createResult = {
    id: 3, pregnancyId: 5, loggedByUserId: 1, visitNumber: 1,
    visitDate: new Date('2026-04-01'), gestationalWeekAtVisit: null,
    bloodPressure: null, weightKg: null, dangerSignsChecked: true,
    notes: null, nextVisitDate: null, createdAt: new Date(), updatedAt: new Date(),
  }
  const res = mockRes()
  await createAncVisit(mockReq({
    body: { pregnancyId: 5, visitNumber: 1, visitDate: '2026-04-01', dangerSignsChecked: true },
  }), res)
  assert.equal(res.statusCode, 201)
  assert.equal(createResult._args.data.dangerSignsChecked, true)
})

// ─── createAncVisit: database errors ────────────────────────────

test('create: P2002 duplicate → 409', async () => {
  resetMocks()
  // Override create to throw.
  mockPrisma.ancVisit.create = async () => {
    const err = new Error('Unique constraint')
    err.code = 'P2002'
    throw err
  }
  findFirstResult = { id: 5, lmpDate: null }
  const res = mockRes()
  await createAncVisit(mockReq({
    body: { pregnancyId: 5, visitNumber: 1, visitDate: '2026-04-01' },
  }), res)
  assert.equal(res.statusCode, 409)
  assert.match(res.body.error, /duplicate/i)
  // Restore mock.
  mockPrisma.ancVisit.create = async (args) => { createResult._args = args; return createResult }
})

// ─── updateAncVisit: validation ──────────────────────────────────

test('update: non-numeric id → 400', async () => {
  resetMocks()
  const res = mockRes()
  await updateAncVisit(mockReq({ params: { id: 'abc' }, body: { bloodPressure: '130/85' } }), res)
  assert.equal(res.statusCode, 400)
})

test('update: ADMIN → 403', async () => {
  resetMocks()
  const res = mockRes()
  await updateAncVisit(mockReq({
    user: { id: 1, role: 'ADMIN' },
    params: { id: '1' },
    body: { bloodPressure: '130/85' },
  }), res)
  assert.equal(res.statusCode, 403)
})

test('update: visit not found → 404', async () => {
  resetMocks()
  findFirstResult = null
  const res = mockRes()
  await updateAncVisit(mockReq({ params: { id: '999' }, body: { bloodPressure: '130/85' } }), res)
  assert.equal(res.statusCode, 404)
})

// ─── updateAncVisit: success ─────────────────────────────────────

test('update: partial update without visitDate change', async () => {
  resetMocks()
  findFirstResult = { id: 1 } // Access check passes.
  updateResult = {
    id: 1, pregnancyId: 5, loggedByUserId: 1, visitNumber: 1,
    visitDate: new Date('2026-04-01'), gestationalWeekAtVisit: 13,
    bloodPressure: '130/85', weightKg: 68, dangerSignsChecked: true,
    notes: 'Updated', nextVisitDate: null, createdAt: new Date(), updatedAt: new Date(),
  }
  const res = mockRes()
  await updateAncVisit(mockReq({
    params: { id: '1' },
    body: { bloodPressure: '130/85', weightKg: 68, dangerSignsChecked: true, notes: 'Updated' },
  }), res)
  assert.equal(res.statusCode, null) // 200
  assert.equal(res.body.visit.id, 1)
  assert.equal(updateResult._args.data.bloodPressure, '130/85')
  assert.equal(updateResult._args.data.weightKg, 68)
})

test('update: visitDate change recomputes gestationalWeekAtVisit', async () => {
  resetMocks()
  findFirstResult = { id: 1 } // Access check.
  ancFindUniqueResult = {
    pregnancy: { lmpDate: new Date(Date.UTC(2026, 0, 1)) }, // Jan 1 2026
  }
  updateResult = {
    id: 1, pregnancyId: 5, loggedByUserId: 1, visitNumber: 1,
    visitDate: new Date('2026-04-15'), gestationalWeekAtVisit: 15,
    bloodPressure: null, weightKg: null, dangerSignsChecked: false,
    notes: null, nextVisitDate: null, createdAt: new Date(), updatedAt: new Date(),
  }
  const res = mockRes()
  await updateAncVisit(mockReq({
    params: { id: '1' },
    body: { visitDate: '2026-04-15' },
  }), res)
  assert.equal(res.statusCode, null)
  // Jan 1 → Apr 15 = 104 days = 14.85 weeks → 14
  assert.equal(updateResult._args.data.gestationalWeekAtVisit, 14)
  assert.ok(updateResult._args.data.visitDate instanceof Date)
})

// ─── updateAncVisit: database errors ────────────────────────────

test('update: P2025 record not found → 404', async () => {
  resetMocks()
  mockPrisma.ancVisit.update = async () => {
    const err = new Error('Record not found')
    err.code = 'P2025'
    throw err
  }
  findFirstResult = { id: 1 }
  const res = mockRes()
  await updateAncVisit(mockReq({ params: { id: '1' }, body: { bloodPressure: '130/85' } }), res)
  assert.equal(res.statusCode, 404)
  // Restore mock.
  mockPrisma.ancVisit.update = async (args) => { updateResult._args = args; return updateResult }
})

test('update: generic database error → 500', async () => {
  resetMocks()
  mockPrisma.ancVisit.update = async () => {
    const err = new Error('Connection lost')
    err.code = 'P9999'
    throw err
  }
  findFirstResult = { id: 1 }
  const res = mockRes()
  await updateAncVisit(mockReq({ params: { id: '1' }, body: { notes: 'test' } }), res)
  assert.equal(res.statusCode, 500)
  // Restore mock.
  mockPrisma.ancVisit.update = async (args) => { updateResult._args = args; return updateResult }
})
