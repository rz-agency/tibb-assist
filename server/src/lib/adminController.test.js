const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Admin controller tests (mocked prisma) ----------
//
// Tests for getLhwOverview and getMonthlyReport — both ADMIN-only
// endpoints that reuse the same Prisma count queries as the
// LHW stats endpoint.  Prisma is mocked via require.cache
// manipulation (same technique as assessmentController.test.js).

// Mutable mock state
let lhwFindManyResult = []
let lhwFindUniqueResult = null
let patientCount = 0
let careMissionCount = 0
let followUpCount = 0
let homeVisitCount = 0
let referralHistoryCount = 0
let homeVisitFindManyResult = []
let assessmentFindManyResult = []
let referralFindManyResult = []
let followUpFindManyResult = []

const mockPrisma = {
  lhw: {
    findMany: async () => lhwFindManyResult,
    findUnique: async () => lhwFindUniqueResult,
  },
  patientProfile: {
    count: async () => patientCount,
  },
  careMission: {
    count: async () => careMissionCount,
  },
  followUp: {
    count: async () => followUpCount,
    findMany: async () => followUpFindManyResult,
  },
  homeVisit: {
    count: async () => homeVisitCount,
    findMany: async () => homeVisitFindManyResult,
  },
  referralStatusHistory: {
    count: async () => referralHistoryCount,
  },
  assessment: {
    findMany: async () => assessmentFindManyResult,
  },
  referral: {
    findMany: async () => referralFindManyResult,
  },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: mockPrisma,
}

const { getLhwOverview, getMonthlyReport, computeLhwStats } = require('../controllers/adminController')

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
  }
}

function mockReq(params = {}, user = { id: 1, role: 'ADMIN' }) {
  return { user, params, body: {} }
}

function resetMocks() {
  lhwFindManyResult = []
  lhwFindUniqueResult = null
  patientCount = 0
  careMissionCount = 0
  followUpCount = 0
  homeVisitCount = 0
  referralHistoryCount = 0
  homeVisitFindManyResult = []
  assessmentFindManyResult = []
  referralFindManyResult = []
  followUpFindManyResult = []
}

// ── computeLhwStats ───────────────────────────────────────────────────────

test('computeLhwStats returns all five aggregate counts', async () => {
  resetMocks()
  patientCount = 12
  careMissionCount = 3
  followUpCount = 2
  homeVisitCount = 8
  referralHistoryCount = 1

  const stats = await computeLhwStats(5)

  assert.equal(stats.assignedPatients, 12)
  assert.equal(stats.openRedCareMissions, 3)
  assert.equal(stats.overdueFollowUps, 2)
  assert.equal(stats.homeVisitsThisMonth, 8)
  assert.equal(stats.referralsClosedThisMonth, 1)
})

test('computeLhwStats returns zeros when no data exists', async () => {
  resetMocks()

  const stats = await computeLhwStats(999)

  assert.equal(stats.assignedPatients, 0)
  assert.equal(stats.openRedCareMissions, 0)
  assert.equal(stats.overdueFollowUps, 0)
  assert.equal(stats.homeVisitsThisMonth, 0)
  assert.equal(stats.referralsClosedThisMonth, 0)
})

// ── getLhwOverview ────────────────────────────────────────────────────────

test('getLhwOverview returns all LHWs with stats', async () => {
  resetMocks()
  lhwFindManyResult = [
    { id: 1, userId: 10, fullName: 'LHW A', phone: '03001', region: 'PUNJAB', createdAt: new Date(), user: { email: 'a@test.com', isActive: true } },
    { id: 2, userId: 20, fullName: 'LHW B', phone: '03002', region: 'SINDH', createdAt: new Date(), user: { email: 'b@test.com', isActive: true } },
  ]
  patientCount = 5
  careMissionCount = 1

  const res = mockRes()
  await getLhwOverview(mockReq(), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.lhws.length, 2)
  assert.equal(res.body.lhws[0].fullName, 'LHW A')
  assert.equal(res.body.lhws[0].email, 'a@test.com')
  assert.equal(res.body.lhws[0].assignedPatients, 5)
  assert.equal(res.body.lhws[0].openRedCareMissions, 1)
  assert.equal(res.body.lhws[1].fullName, 'LHW B')
})

test('getLhwOverview returns empty array when no LHWs exist', async () => {
  resetMocks()
  lhwFindManyResult = []

  const res = mockRes()
  await getLhwOverview(mockReq(), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.lhws.length, 0)
})

// ── getMonthlyReport ──────────────────────────────────────────────────────

test('getMonthlyReport returns LHW info with monthly records', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5, fullName: 'LHW A', phone: '03001', region: 'PUNJAB' }
  patientCount = 10
  homeVisitCount = 4
  careMissionCount = 0
  followUpCount = 1
  referralHistoryCount = 2
  homeVisitFindManyResult = [
    { id: 1, visitDate: new Date(), visitType: 'ROUTINE', patient: { id: 1, fullName: 'Patient A' } },
  ]
  assessmentFindManyResult = [
    { id: 10, assessmentDate: new Date(), riskLevel: 'YELLOW', resultCode: 'REQUIRES_EVALUATION', patient: { id: 1, fullName: 'Patient A' } },
  ]
  referralFindManyResult = [
    { id: 20, referralDate: new Date(), status: 'RECOMMENDED', facility: { id: 1, name: 'DHQ', city: 'Rwp' }, patient: { id: 1, fullName: 'Patient A' } },
  ]
  followUpFindManyResult = [
    { id: 30, type: 'HOME_VISIT', dueDate: new Date(), completedAt: new Date(), patient: { id: 1, fullName: 'Patient A' } },
  ]

  const res = mockRes()
  await getMonthlyReport(mockReq({ userId: '10' }), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.lhw.fullName, 'LHW A')
  assert.ok(res.body.month, 'month label must be present')
  assert.equal(res.body.stats.assignedPatients, 10)
  assert.equal(res.body.stats.homeVisitsThisMonth, 4)
  assert.equal(res.body.homeVisits.length, 1)
  assert.equal(res.body.assessments.length, 1)
  assert.equal(res.body.referrals.length, 1)
  assert.equal(res.body.completedFollowUps.length, 1)
})

test('getMonthlyReport returns 404 when LHW not found', async () => {
  resetMocks()
  lhwFindUniqueResult = null

  const res = mockRes()
  await getMonthlyReport(mockReq({ userId: '999' }), res)

  assert.equal(res.statusCode, 404)
})

test('getMonthlyReport returns 400 for invalid userId', async () => {
  resetMocks()

  const res = mockRes()
  await getMonthlyReport(mockReq({ userId: 'abc' }), res)

  assert.equal(res.statusCode, 400)
})
