const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Referral controller tests (mocked prisma) ----------
//
// Focused on the follow-up hook in updateReferralStatus: when a referral
// transitions to FOLLOW_UP_DUE, a REFERRAL_CHECK follow-up must be created
// for the patient's assigned LHW inside the same transaction — and only
// once (unique relatedReferralId). Prisma is mocked via require cache
// manipulation (same technique as profileController.test.js).

// Mutable mock state — reset before each test.
let lhwFindUniqueResult = { id: 7 }
let referralFindFirstResult = null
let referralFindUniqueResult = null
let followUpFindUniqueResult = null
let followUpCreateArgs = null
let txCallCount = 0

const mockPrisma = {
  lhw: {
    findUnique: async () => lhwFindUniqueResult,
  },
  referral: {
    findFirst: async () => referralFindFirstResult,
    findUnique: async () => referralFindUniqueResult,
    update: async (args) => ({ id: args.where.id, status: args.data.status }),
  },
  referralStatusHistory: {
    create: async () => ({ id: 1 }),
  },
  careMission: {
    findFirst: async () => null, // no linked Care Mission in these tests
  },
  careMissionTimeline: {
    create: async () => ({ id: 1 }),
  },
  followUp: {
    findUnique: async () => followUpFindUniqueResult,
    create: async (args) => {
      followUpCreateArgs = args
      return { id: 77, ...args.data }
    },
  },
  $transaction: async (fn) => {
    txCallCount++
    return fn(mockPrisma)
  },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: mockPrisma,
}

const { updateReferralStatus, getReferral } = require('../controllers/referralController')

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

function mockReq(body, user = { id: 2, role: 'LHW' }) {
  return { user, body, params: { id: '50' } }
}

function resetMocks() {
  lhwFindUniqueResult = { id: 7 }
  referralFindFirstResult = {
    id: 50,
    status: 'PATIENT_ARRIVED',
    patientId: 10,
    patient: { assignedLhwId: 7 },
  }
  referralFindUniqueResult = null
  followUpFindUniqueResult = null
  followUpCreateArgs = null
  txCallCount = 0
}

// ---------- Referral → FOLLOW_UP_DUE creates a follow-up ----------

test('updateReferralStatus: transition to FOLLOW_UP_DUE creates a REFERRAL_CHECK follow-up', async () => {
  resetMocks()
  const res = mockRes()

  await updateReferralStatus(mockReq({ status: 'FOLLOW_UP_DUE' }), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.changed, true)
  assert.ok(followUpCreateArgs, 'a follow-up must be created')

  const data = followUpCreateArgs.data
  assert.equal(data.type, 'REFERRAL_CHECK')
  assert.equal(data.patientId, 10)
  assert.equal(data.lhwId, 7, 'owned by the patient\u2019s assigned LHW')
  assert.equal(data.relatedReferralId, 50)
  const daysOut = (new Date(data.dueDate).getTime() - Date.now()) / 86400000
  assert.ok(daysOut > 0.99 && daysOut < 1.01, 'referral check is due ~1 day out')
})

test('updateReferralStatus: transition to a non-follow-up status creates no follow-up', async () => {
  resetMocks()
  referralFindFirstResult = {
    id: 50,
    status: 'RECOMMENDED',
    patientId: 10,
    patient: { assignedLhwId: 7 },
  }
  const res = mockRes()

  // The lifecycle is single-step forward, so a non-follow-up move from
  // RECOMMENDED is FACILITY_SELECTED (or CANCELLED with a note).
  await updateReferralStatus(mockReq({ status: 'FACILITY_SELECTED' }), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.changed, true)
  assert.equal(followUpCreateArgs, null, 'only FOLLOW_UP_DUE schedules a follow-up')
})

test('updateReferralStatus: FOLLOW_UP_DUE without an assigned LHW creates no follow-up', async () => {
  resetMocks()
  referralFindFirstResult = {
    id: 50,
    status: 'PATIENT_ARRIVED',
    patientId: 10,
    patient: { assignedLhwId: null },
  }
  const res = mockRes()

  await updateReferralStatus(mockReq({ status: 'FOLLOW_UP_DUE' }), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.changed, true)
  assert.equal(followUpCreateArgs, null, 'no follow-up without an LHW owner')
})

test('updateReferralStatus: existing follow-up for the referral is not duplicated', async () => {
  resetMocks()
  followUpFindUniqueResult = { id: 99 }
  const res = mockRes()

  await updateReferralStatus(mockReq({ status: 'FOLLOW_UP_DUE' }), res)

  assert.equal(res.statusCode, null)
  assert.equal(followUpCreateArgs, null, 'unique relatedReferralId guards retries')
})

test('updateReferralStatus: same-status PATCH is rejected by the lifecycle validator → 422', async () => {
  resetMocks()
  referralFindFirstResult = {
    id: 50,
    status: 'FOLLOW_UP_DUE',
    patientId: 10,
    patient: { assignedLhwId: 7 },
  }
  const res = mockRes()

  // validateTransition runs before the idempotent no-op branch, so a
  // repeated PATCH of the same status cannot re-trigger the follow-up hook
  // (the unique relatedReferralId constraint is the retry backstop).
  await updateReferralStatus(mockReq({ status: 'FOLLOW_UP_DUE' }), res)

  assert.equal(res.statusCode, 422)
  assert.equal(txCallCount, 0, 'no transaction runs')
  assert.equal(followUpCreateArgs, null)
})

test('updateReferralStatus: invalid transition is rejected with 422', async () => {
  resetMocks()
  referralFindFirstResult = {
    id: 50,
    status: 'RECOMMENDED',
    patientId: 10,
    patient: { assignedLhwId: 7 },
  }
  const res = mockRes()

  // RECOMMENDED can only move to FACILITY_SELECTED or CANCELLED — not FOLLOW_UP_DUE.
  await updateReferralStatus(mockReq({ status: 'FOLLOW_UP_DUE' }), res)

  assert.equal(res.statusCode, 422)
  assert.equal(followUpCreateArgs, null)
})

// ---------- GET /api/referrals/:id — access regression ----------
//
// A user who doesn't own/isn't assigned to the referral must get 404 — the
// same response as if the referral didn't exist — so we never leak whether
// a specific record is present.

function mockGetReq(params, user = { id: 2, role: 'LHW' }) {
  return { user, params }
}

test('getReferral: WOMAN who does not own the patient gets 404', async () => {
  resetMocks()
  referralFindFirstResult = null // access-filtered lookup finds nothing
  const res = mockRes()

  await getReferral(mockGetReq({ id: '50' }, { id: 99, role: 'WOMAN' }), res)

  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'Referral not found.')
})

test('getReferral: referral exists and is accessible → returns the referral', async () => {
  resetMocks()
  referralFindFirstResult = {
    id: 50,
    patientId: 10,
    assessmentId: 3,
    facilityId: 1,
    status: 'RECOMMENDED',
    referralDate: new Date(),
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    facility: { id: 1, name: 'DHQ', facilityType: 'HOSPITAL', address: 'Main Rd', city: 'Rwp', phone: '051-1234' },
    assessment: { id: 3, assessmentDate: new Date(), riskLevel: 'RED', inputMethod: 'VISUAL', triageNotes: null, assessmentSymptoms: [] },
    careMission: null,
    statusHistory: [],
  }
  const res = mockRes()

  await getReferral(mockGetReq({ id: '50' }, { id: 2, role: 'LHW' }), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.referral.id, 50)
  assert.ok(Array.isArray(res.body.allowedTransitions))
})

test('getReferral: ADMIN role gets 404 (no access policy)', async () => {
  resetMocks()
  referralFindFirstResult = null
  const res = mockRes()

  await getReferral(mockGetReq({ id: '50' }, { id: 1, role: 'ADMIN' }), res)

  assert.equal(res.statusCode, 404)
})
