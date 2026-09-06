const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Profile controller tests (mocked prisma) ----------
//
// The Dashboard hero reads pregnancy.gestationalWeeks from the patient
// profile response, so this endpoint must decorate pregnancies with the same
// live-computed gestational-age fields as GET /api/pregnancies. The stored
// gestationalWeek column may be null or stale and must never be the display
// source. Prisma is mocked via require cache manipulation (same technique as
// checkInController.test.js and patientController.test.js).

const MS_PER_DAY = 86_400_000

// Mutable mock state — reset before each test.
let patientProfileResult = null
let upsertArgs = null
let lhwFindUniqueResult = null
let homeVisitFindFirstResults = {}
let immunizationFindManyResult = []
// getLhwStats aggregates — count where-args captured for assertions.
let countResults = {}
let countArgs = {}

const mockPrisma = {
  patientProfile: {
    findUnique: async () => patientProfileResult,
    upsert: async (args) => {
      upsertArgs = args
      return patientProfileResult
    },
    count: async (args) => {
      countArgs.patientProfile = args
      return countResults.patientProfile ?? 0
    },
  },
  lhw: {
    findUnique: async () => lhwFindUniqueResult,
  },
  homeVisit: {
    findFirst: async (args) => homeVisitFindFirstResults[args.where.patientId] ?? null,
    count: async (args) => {
      countArgs.homeVisit = args
      return countResults.homeVisit ?? 0
    },
  },
  immunization: {
    findMany: async () => immunizationFindManyResult,
  },
  careMission: {
    count: async (args) => {
      countArgs.careMission = args
      return countResults.careMission ?? 0
    },
  },
  followUp: {
    count: async (args) => {
      countArgs.followUp = args
      return countResults.followUp ?? 0
    },
  },
  referralStatusHistory: {
    count: async (args) => {
      countArgs.referralStatusHistory = args
      return countResults.referralStatusHistory ?? 0
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

const { getPatientProfile, savePatientProfile, getLhwProfile, getLhwStats } = require('../controllers/profileController')

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

function mockReq(body = {}, params = {}) {
  return { user: { id: 1, role: 'WOMAN' }, body, params }
}

function resetMocks() {
  patientProfileResult = null
  upsertArgs = null
  lhwFindUniqueResult = null
  homeVisitFindFirstResults = {}
  immunizationFindManyResult = []
  countResults = {}
  countArgs = {}
}

/** Profile with a single pregnancy at the given completed gestational week. */
function profileWithPregnancyAtWeek(weeks, pregnancyOverrides = {}) {
  const lmpDate = new Date(Date.now() - (weeks * 7 + 1) * MS_PER_DAY)
  return {
    id: 7,
    userId: 1,
    fullName: 'Demo Woman',
    phone: '+923004445566',
    dateOfBirth: new Date(1998, 0, 1),
    villageOrArea: 'Demo Village',
    district: 'Rawalpindi',
    province: 'Punjab',
    assignedLhwId: 3,
    createdAt: new Date('2026-08-25T21:51:36.641Z'),
    updatedAt: new Date('2026-08-25T21:51:36.641Z'),
    pregnancies: [{
      id: 7,
      patientId: 7,
      pregnancyStatus: 'ACTIVE',
      lmpDate,
      dueDate: new Date(lmpDate.getTime() + 280 * MS_PER_DAY),
      gestationalWeek: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...pregnancyOverrides,
    }],
    assignedLhw: { id: 3, fullName: 'Demo LHW Ayesha', phone: '+923001112233', region: 'PUNJAB' },
    emergencyContacts: [],
  }
}

// ---------- GET /api/patients/:userId/profile ----------

test('getPatientProfile: pregnancies decorated with live gestationalWeeks (Dashboard hero data source)', async () => {
  resetMocks()
  patientProfileResult = profileWithPregnancyAtWeek(20)
  const res = mockRes()
  await getPatientProfile(mockReq({}, { userId: '1' }), res)

  const pregnancy = res.body.pregnancies[0]
  assert.equal(pregnancy.gestationalWeeks, 20)
  assert.equal(pregnancy.isPostterm, false)
  assert.equal(pregnancy.trimester, 2)
  assert.equal(pregnancy.gestationalWeek, null)
  // Profile fields survive serialization untouched.
  assert.equal(res.body.fullName, 'Demo Woman')
  assert.equal(res.body.assignedLhw.fullName, 'Demo LHW Ayesha')
  // The stored record object itself is not mutated.
  assert.equal('gestationalWeeks' in patientProfileResult.pregnancies[0], false)
  assert.equal('trimester' in patientProfileResult.pregnancies[0], false)
})

test('getPatientProfile: pregnancy without LMP → gestationalWeeks null, isPostterm null, trimester null', async () => {
  resetMocks()
  patientProfileResult = profileWithPregnancyAtWeek(12, { lmpDate: null, gestationalWeek: 12 })
  const res = mockRes()
  await getPatientProfile(mockReq({}, { userId: '1' }), res)

  const pregnancy = res.body.pregnancies[0]
  assert.equal(pregnancy.gestationalWeeks, null)
  assert.equal(pregnancy.isPostterm, null)
  assert.equal(pregnancy.trimester, null)
  assert.equal(pregnancy.gestationalWeek, 12)
})

test('getPatientProfile: no profile → 404', async () => {
  resetMocks()
  const res = mockRes()
  await getPatientProfile(mockReq({}, { userId: '1' }), res)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'Patient profile not found.')
})

// ---------- PUT /api/patients/:userId/profile ----------

test('savePatientProfile: response pregnancies decorated with live gestationalWeeks and trimester', async () => {
  resetMocks()
  patientProfileResult = profileWithPregnancyAtWeek(20)
  const res = mockRes()
  await savePatientProfile(mockReq({ fullName: 'Demo Woman Updated' }, { userId: '1' }), res)

  assert.equal(res.body.pregnancies[0].gestationalWeeks, 20)
  assert.equal(res.body.pregnancies[0].trimester, 2)
  assert.equal(upsertArgs.where.userId, 1)
})

test('getPatientProfile: trimester boundaries — all three trimesters computed correctly', async () => {
  for (const [weeks, expectedTrimester] of [[8, 1], [20, 2], [32, 3]]) {
    resetMocks()
    patientProfileResult = profileWithPregnancyAtWeek(weeks)
    const res = mockRes()
    await getPatientProfile(mockReq({}, { userId: '1' }), res)

    const pregnancy = res.body.pregnancies[0]
    assert.equal(pregnancy.gestationalWeeks, weeks)
    assert.equal(pregnancy.trimester, expectedTrimester, `week ${weeks} should be trimester ${expectedTrimester}`)
  }
})

test('savePatientProfile: blank fullName → 400', async () => {
  resetMocks()
  const res = mockRes()
  await savePatientProfile(mockReq({ fullName: '   ' }, { userId: '1' }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'fullName is required.')
})

// ---------- GET /api/lhws/:userId/profile — lastHomeVisitDate enrichment ----------

test('getLhwProfile: assigned patients enriched with lastHomeVisitDate', async () => {
  resetMocks()
  const recentVisit = new Date('2026-09-03')
  lhwFindUniqueResult = {
    id: 5,
    userId: 2,
    fullName: 'LHW Ayesha',
    phone: '03001112233',
    region: 'PUNJAB',
    createdAt: new Date('2026-08-25T10:00:00Z'),
    updatedAt: new Date('2026-08-25T10:00:00Z'),
    assignedPatients: [
      { id: 10, userId: 3, fullName: 'Patient A', phone: null, dateOfBirth: new Date(2001, 0, 1), villageOrArea: 'Village A', district: 'Lahore', province: 'Punjab' },
      { id: 11, userId: 4, fullName: 'Patient B', phone: null, dateOfBirth: new Date(1996, 0, 1), villageOrArea: 'Village B', district: 'Lahore', province: 'Punjab' },
    ],
  }
  homeVisitFindFirstResults = {
    10: { visitDate: recentVisit },
    11: null,
  }

  const res = mockRes()
  await getLhwProfile(mockReq({}, { userId: '2' }), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.assignedPatients.length, 2)
  assert.deepEqual(res.body.assignedPatients[0].lastHomeVisitDate, recentVisit)
  assert.equal(res.body.assignedPatients[1].lastHomeVisitDate, null)
})

test('getLhwProfile: patient with no visits → lastHomeVisitDate null', async () => {
  resetMocks()
  lhwFindUniqueResult = {
    id: 5,
    userId: 2,
    fullName: 'LHW Ayesha',
    phone: '03001112233',
    region: 'PUNJAB',
    createdAt: new Date('2026-08-25T10:00:00Z'),
    updatedAt: new Date('2026-08-25T10:00:00Z'),
    assignedPatients: [
      { id: 10, userId: 3, fullName: 'Patient A', phone: null, dateOfBirth: new Date(2001, 0, 1), villageOrArea: 'Village A', district: 'Lahore', province: 'Punjab' },
    ],
  }
  homeVisitFindFirstResults = { 10: null }

  const res = mockRes()
  await getLhwProfile(mockReq({}, { userId: '2' }), res)

  assert.equal(res.body.assignedPatients[0].lastHomeVisitDate, null)
})

test('getLhwProfile: no LHW profile → 404', async () => {
  resetMocks()
  lhwFindUniqueResult = null
  const res = mockRes()
  await getLhwProfile(mockReq({}, { userId: '2' }), res)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'LHW profile not found.')
})

test('getLhwProfile: invalid userId → 400', async () => {
  resetMocks()
  const res = mockRes()
  await getLhwProfile(mockReq({}, { userId: 'abc' }), res)
  assert.equal(res.statusCode, 400)
})

// ---------- GET /api/lhws/:userId/stats ----------

/** The local calendar-month { gte, lt } window the controller builds from a date. */
function monthWindowFor(date) {
  return {
    gte: new Date(date.getFullYear(), date.getMonth(), 1),
    lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
  }
}

/** True when `actual` matches the month window of `before` or `after` (midnight-safe). */
function isMonthWindowBetween(actual, before, after) {
  return [before, after].some((candidate) => {
    const expected = monthWindowFor(candidate)
    return actual.gte.getTime() === expected.gte.getTime()
      && actual.lt.getTime() === expected.lt.getTime()
  })
}

test('getLhwStats: returns all five aggregates for the LHW', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 7 }
  countResults = {
    patientProfile: 12,
    careMission: 3,
    followUp: 4,
    homeVisit: 9,
    referralStatusHistory: 2,
  }
  const res = mockRes()
  await getLhwStats(mockReq({}, { userId: '2' }), res)

  assert.equal(res.statusCode, null)
  assert.deepEqual(res.body, {
    lhwId: 7,
    assignedPatients: 12,
    openRedCareMissions: 3,
    overdueFollowUps: 4,
    homeVisitsThisMonth: 9,
    referralsClosedThisMonth: 2,
  })
})

test('getLhwStats: every count query is scoped to the LHW\u2019s patients', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 7 }
  const res = mockRes()

  const before = new Date()
  await getLhwStats(mockReq({}, { userId: '2' }), res)
  const after = new Date()

  // Assigned patients: direct filter on the assignment column.
  assert.deepEqual(countArgs.patientProfile.where, { assignedLhwId: 7 })

  // Open RED care missions: active statuses, through the assessment → patient chain.
  assert.deepEqual(countArgs.careMission.where, {
    riskLevel: 'RED',
    status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED'] },
    assessment: { patient: { assignedLhwId: 7 } },
  })

  // Overdue follow-ups: PENDING and due before local midnight today, owned by this LHW.
  assert.equal(countArgs.followUp.where.lhwId, 7)
  assert.equal(countArgs.followUp.where.status, 'PENDING')
  const possibleTodayStarts = [
    new Date(before.getFullYear(), before.getMonth(), before.getDate()),
    new Date(after.getFullYear(), after.getMonth(), after.getDate()),
  ]
  assert.ok(
    possibleTodayStarts.some((start) => start.getTime() === countArgs.followUp.where.dueDate.lt.getTime()),
    'overdue cut-off is local midnight today',
  )

  // Home visits this month: calendar-month window on visitDate.
  assert.equal(countArgs.homeVisit.where.lhwId, 7)
  assert.ok(isMonthWindowBetween(countArgs.homeVisit.where.visitDate, before, after))

  // Referrals closed this month: CLOSED transitions inside the month, via the patient chain.
  assert.equal(countArgs.referralStatusHistory.where.toStatus, 'CLOSED')
  assert.ok(isMonthWindowBetween(countArgs.referralStatusHistory.where.createdAt, before, after))
  assert.deepEqual(countArgs.referralStatusHistory.where.referral, { patient: { assignedLhwId: 7 } })
})

test('getLhwStats: no LHW profile → 404', async () => {
  resetMocks()
  const res = mockRes()
  await getLhwStats(mockReq({}, { userId: '2' }), res)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'LHW profile not found.')
})

test('getLhwStats: invalid userId → 400', async () => {
  resetMocks()
  const res = mockRes()
  await getLhwStats(mockReq({}, { userId: 'abc' }), res)
  assert.equal(res.statusCode, 400)
})

// ---------- GET /api/patients/:userId/profile — nextImmunizationDue enrichment ----------

test('getPatientProfile: no TT doses → nextImmunizationDue suggests TT1 today', async () => {
  resetMocks()
  patientProfileResult = profileWithPregnancyAtWeek(20)
  immunizationFindManyResult = []
  const res = mockRes()
  await getPatientProfile(mockReq({}, { userId: '1' }), res)

  assert.equal(res.body.nextImmunizationDue.doseNumber, 1)
  assert.equal(res.body.nextImmunizationDue.suggestedDate, new Date().toISOString().slice(0, 10))
})

test('getPatientProfile: TT1 done → nextImmunizationDue suggests TT2 (+1 month)', async () => {
  resetMocks()
  patientProfileResult = profileWithPregnancyAtWeek(20)
  immunizationFindManyResult = [{ doseNumber: 1, dateAdministered: new Date('2026-06-15') }]
  const res = mockRes()
  await getPatientProfile(mockReq({}, { userId: '1' }), res)

  assert.equal(res.body.nextImmunizationDue.doseNumber, 2)
  assert.equal(res.body.nextImmunizationDue.suggestedDate, '2026-07-15')
})

test('getPatientProfile: all 5 TT doses done → nextImmunizationDue null', async () => {
  resetMocks()
  patientProfileResult = profileWithPregnancyAtWeek(20)
  immunizationFindManyResult = [1, 2, 3, 4, 5].map((n) => ({
    doseNumber: n,
    dateAdministered: new Date(`2023-0${n}-01`),
  }))
  const res = mockRes()
  await getPatientProfile(mockReq({}, { userId: '1' }), res)

  assert.equal(res.body.nextImmunizationDue, null)
})

test('getPatientProfile: enrichment does not break existing pregnancy decoration', async () => {
  resetMocks()
  patientProfileResult = profileWithPregnancyAtWeek(20)
  immunizationFindManyResult = []
  const res = mockRes()
  await getPatientProfile(mockReq({}, { userId: '1' }), res)

  // Pregnancy decoration still present alongside the new field.
  assert.equal(res.body.pregnancies[0].gestationalWeeks, 20)
  assert.equal(res.body.fullName, 'Demo Woman')
  assert.ok('nextImmunizationDue' in res.body)
})
