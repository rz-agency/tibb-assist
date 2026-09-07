const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- FollowUp controller tests (mocked prisma) ----------
//
// Tests for the LHW follow-up queue: the access-filter pattern (WOMAN scoped
// through her patient profile, LHW through her Lhw row, ADMIN denied), the
// PENDING-by-default listing, and completing a follow-up with ownership
// enforcement. Prisma is mocked via require cache manipulation (same
// technique as profileController.test.js and homeVisitController.test.js).

// Mutable mock state — reset before each test.
let lhwFindUniqueResult = null
let followUpFindManyResult = []
let followUpFindFirstResult = null
let followUpFindUniqueResult = null
let followUpFindManyArgs = null
let followUpFindFirstArgs = null
let followUpUpdateArgs = null
let followUpUpdateCalled = false

const mockPrisma = {
  lhw: {
    findUnique: async () => lhwFindUniqueResult,
  },
  followUp: {
    findMany: async (args) => {
      followUpFindManyArgs = args
      return followUpFindManyResult
    },
    findFirst: async (args) => {
      followUpFindFirstArgs = args
      return followUpFindFirstResult
    },
    findUnique: async () => followUpFindUniqueResult,
    update: async (args) => {
      followUpUpdateCalled = true
      followUpUpdateArgs = args
      return { id: args.where.id, ...args.data }
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

const { listFollowUps, completeFollowUp } = require('../controllers/followUpController')

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

function mockReq(user, params = {}, query = {}, body = {}) {
  return { user, params, query, body }
}

function resetMocks() {
  lhwFindUniqueResult = null
  followUpFindManyResult = []
  followUpFindFirstResult = null
  followUpFindUniqueResult = null
  followUpFindManyArgs = null
  followUpFindFirstArgs = null
  followUpUpdateArgs = null
  followUpUpdateCalled = false
}

// ---------- GET /api/follow-ups (list) ----------

test('listFollowUps: LHW sees only her own PENDING follow-ups', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 7 }
  followUpFindManyResult = [{ id: 1, dueDate: new Date(), patient: { id: 10, fullName: 'A' } }]
  const res = mockRes()

  await listFollowUps(mockReq({ id: 2, role: 'LHW' }), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.followUps.length, 1)
  assert.equal(followUpFindManyArgs.where.lhwId, 7, 'scoped to the LHW row')
  assert.equal(followUpFindManyArgs.where.status, 'PENDING', 'PENDING by default')
})

test('listFollowUps: includeCompleted=true drops the status filter', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 7 }
  const res = mockRes()

  await listFollowUps(mockReq({ id: 2, role: 'LHW' }, {}, { includeCompleted: 'true' }), res)

  assert.equal(res.statusCode, null)
  assert.equal(followUpFindManyArgs.where.status, undefined, 'no status filter when including completed')
})

test('listFollowUps: WOMAN is scoped through her patient profile', async () => {
  resetMocks()
  const res = mockRes()

  await listFollowUps(mockReq({ id: 5, role: 'WOMAN' }), res)

  assert.equal(res.statusCode, null)
  assert.deepEqual(followUpFindManyArgs.where.patient, { userId: 5 })
})

test('listFollowUps: ADMIN is denied → 403', async () => {
  resetMocks()
  const res = mockRes()

  await listFollowUps(mockReq({ id: 1, role: 'ADMIN' }), res)

  assert.equal(res.statusCode, 403)
  assert.equal(followUpFindManyArgs, null, 'no query should run')
})

test('listFollowUps: LHW without an Lhw record is denied → 403', async () => {
  resetMocks()
  lhwFindUniqueResult = null
  const res = mockRes()

  await listFollowUps(mockReq({ id: 2, role: 'LHW' }), res)

  assert.equal(res.statusCode, 403)
})

// ---------- POST /api/follow-ups/:id/complete ----------

test('completeFollowUp: LHW completes her own follow-up → status COMPLETED with completedAt', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 7 }
  followUpFindFirstResult = { id: 30, status: 'PENDING' }
  const res = mockRes()

  await completeFollowUp(mockReq({ id: 2, role: 'LHW' }, { id: '30' }, {}, {}), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.changed, true)
  assert.equal(res.body.followUp.status, 'COMPLETED')
  assert.ok(res.body.followUp.completedAt instanceof Date)
  assert.deepEqual(followUpFindFirstArgs.where, { id: 30, lhwId: 7 }, 'ownership enforced in the lookup')
})

test('completeFollowUp: notes are trimmed and stored', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 7 }
  followUpFindFirstResult = { id: 31, status: 'PENDING' }
  const res = mockRes()

  await completeFollowUp(mockReq({ id: 2, role: 'LHW' }, { id: '31' }, {}, { notes: '  Patient doing well  ' }), res)

  assert.equal(res.statusCode, null)
  assert.equal(followUpUpdateArgs.data.notes, 'Patient doing well')
})

test('completeFollowUp: whitespace-only notes are ignored', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 7 }
  followUpFindFirstResult = { id: 32, status: 'PENDING' }
  const res = mockRes()

  await completeFollowUp(mockReq({ id: 2, role: 'LHW' }, { id: '32' }, {}, { notes: '   ' }), res)

  assert.equal(res.statusCode, null)
  assert.equal(followUpUpdateArgs.data.notes, undefined, 'no notes key when blank')
})

test('completeFollowUp: non-string notes → 400', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 7 }
  const res = mockRes()

  await completeFollowUp(mockReq({ id: 2, role: 'LHW' }, { id: '33' }, {}, { notes: 42 }), res)

  assert.equal(res.statusCode, 400)
  assert.equal(followUpUpdateCalled, false)
})

test('completeFollowUp: invalid id → 400', async () => {
  resetMocks()
  const res = mockRes()

  await completeFollowUp(mockReq({ id: 2, role: 'LHW' }, { id: 'abc' }, {}, {}), res)

  assert.equal(res.statusCode, 400)
})

test('completeFollowUp: follow-up owned by another LHW → 404', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 7 }
  followUpFindFirstResult = null // lookup with lhwId 7 finds nothing
  const res = mockRes()

  await completeFollowUp(mockReq({ id: 2, role: 'LHW' }, { id: '34' }, {}, {}), res)

  assert.equal(res.statusCode, 404)
  assert.equal(followUpUpdateCalled, false, 'no update should run')
})

test('completeFollowUp: user without an Lhw record → 403', async () => {
  resetMocks()
  lhwFindUniqueResult = null
  const res = mockRes()

  await completeFollowUp(mockReq({ id: 5, role: 'WOMAN' }, { id: '35' }, {}, {}), res)

  assert.equal(res.statusCode, 403)
  assert.equal(followUpUpdateCalled, false)
})

test('completeFollowUp: already completed is idempotent → changed false, no update', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 7 }
  followUpFindFirstResult = { id: 36, status: 'COMPLETED' }
  followUpFindUniqueResult = { id: 36, status: 'COMPLETED', completedAt: new Date() }
  const res = mockRes()

  await completeFollowUp(mockReq({ id: 2, role: 'LHW' }, { id: '36' }, {}, {}), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.changed, false)
  assert.equal(res.body.followUp.id, 36)
  assert.equal(followUpUpdateCalled, false, 'no second update')
})
