const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Integration test: RED assessment → CareMission → Referral lifecycle ----------
//
// End-to-end test exercising three controller boundaries against a single
// mocked Prisma instance:
//
//   1. createAssessment  — a RED-triggering symptom set produces a RED
//      assessment and auto-creates a CareMission with the 4-item RED
//      checklist.
//   2. createReferral    — a Referral is created in RECOMMENDED status,
//      linked to the RED assessment and a healthcare facility.
//   3. updateReferralStatus × 7 — the Referral advances through every
//      lifecycle stage (RECOMMENDED → … → CLOSED), with a REFERRAL_CHECK
//      follow-up created when the status reaches FOLLOW_UP_DUE.
//
// Prisma is mocked via require.cache manipulation (same technique as
// assessmentController.test.js and referralController.test.js).

// ── Mutable mock state ────────────────────────────────────────────────────

const patientProfile = {
  id: 1,
  userId: 2,
  fullName: 'Test Patient',
  assignedLhwId: 7,
  dateOfBirth: new Date('1995-06-15'),
}

let careMissionCreateArgs = null
let checklistCreateManyArgs = null
let timelineCreateArgs = null
let careMissionFollowUpCreateArgs = null
let referralCreateArgs = null
let referralCurrentStatus = 'RECOMMENDED'
let statusHistoryRecords = []
let referralTimelineRecords = []
let referralFollowUpCreateArgs = null
let assessmentCareMissionId = 100

function resetAll() {
  careMissionCreateArgs = null
  checklistCreateManyArgs = null
  timelineCreateArgs = null
  careMissionFollowUpCreateArgs = null
  referralCreateArgs = null
  referralCurrentStatus = 'RECOMMENDED'
  statusHistoryRecords = []
  referralTimelineRecords = []
  referralFollowUpCreateArgs = null
  assessmentCareMissionId = 100
}

// ── Prisma mock ───────────────────────────────────────────────────────────

const mockPrisma = {
  patientProfile: {
    findFirst: async () => patientProfile,
    findUnique: async () => patientProfile,
  },
  lhw: {
    findUnique: async () => ({ id: 7, phone: '0300-1234567' }),
  },
  pregnancy: {
    findFirst: async () => ({ id: 5, lmpDate: new Date('2026-05-01') }),
  },
  symptom: {
    findMany: async () => [
      { id: 1, code: 'heavy_bleeding', category: 'BLEEDING' },
    ],
  },
  healthcareFacility: {
    findUnique: async (args) => ({ id: args.where.id, name: 'DHQ Hospital' }),
  },
  // Non-tx models (used outside $transaction by the controllers).
  assessment: {
    findFirst: async (args) => {
      if (args?.where?.id === 999) {
        return { id: 999, patientId: 1 }
      }
      return null
    },
  },
  referral: {
    findFirst: async (args) => {
      // Outside-tx referral lookups (used by updateReferralStatus).
      return {
        id: 200,
        status: referralCurrentStatus,
        patientId: 1,
        patient: { assignedLhwId: 7 },
      }
    },
    create: async (args) => {
      referralCreateArgs = args
      referralCurrentStatus = args.data.status
      return {
        id: 200,
        patientId: args.data.patientId,
        assessmentId: args.data.assessmentId,
        facilityId: args.data.facilityId,
        status: args.data.status,
        referralDate: args.data.referralDate,
        notes: args.data.notes,
        createdAt: new Date(),
      }
    },
  },
  followUp: {
    findUnique: async () => null,
    create: async (args) => {
      // Route follow-up creates to the right bucket based on data shape.
      if (args.data.relatedReferralId) {
        referralFollowUpCreateArgs = args
      } else if (args.data.relatedCareMissionId) {
        careMissionFollowUpCreateArgs = args
      }
      return { id: 300, ...args.data }
    },
  },
  careMission: {
    findUnique: async () => null,
    findFirst: async () => null,
  },
  careMissionTimeline: {
    create: async () => ({ id: 400 }),
  },
  // ── $transaction mock ──────────────────────────────────────────────────
  $transaction: async (fn) => {
    const mockTx = {
      assessment: {
        create: async (args) => ({
          id: 999,
          patientId: args.data.patientId,
          assessedByUserId: args.data.assessedByUserId,
          riskLevel: args.data.riskLevel,
          resultCode: args.data.resultCode,
          assessmentDate: new Date(),
          assessmentSymptoms: [],
          pregnancy: null,
          patient: patientProfile,
        }),
      },
      careMission: {
        findUnique: async () => null,
        create: async (args) => {
          careMissionCreateArgs = args
          assessmentCareMissionId++

          // Prisma processes nested creates — replicate that for the mock.
          if (args.data.timelineEntries?.create) {
            timelineCreateArgs = { data: args.data.timelineEntries.create }
          }
          if (args.data.checklistItems?.create) {
            // Prisma uses nested `create` (not createMany) for checklist items.
            checklistCreateManyArgs = { data: args.data.checklistItems.create }
          }

          return {
            id: assessmentCareMissionId,
            assessmentId: args.data.assessmentId,
            riskLevel: args.data.riskLevel,
            status: 'OPEN',
            assignedLhwId: args.data.assignedLhwId,
          }
        },
        findFirst: async () => ({ id: assessmentCareMissionId }),
      },
      careMissionTimelineEntry: {
        create: async (args) => {
          timelineCreateArgs = args
          return { id: 401 }
        },
      },
      careMissionChecklistItem: {
        createMany: async (args) => {
          checklistCreateManyArgs = args
          return { count: args.data.length }
        },
      },
      careMissionTimeline: {
        create: async (args) => {
          referralTimelineRecords.push(args.data)
          return { id: 402 }
        },
      },
      referral: {
        create: async (args) => {
          referralCreateArgs = args
          referralCurrentStatus = args.data.status
          return {
            id: 200,
            patientId: args.data.patientId,
            assessmentId: args.data.assessmentId,
            facilityId: args.data.facilityId,
            status: args.data.status,
            referralDate: args.data.referralDate,
            notes: args.data.notes,
            createdAt: new Date(),
          }
        },
        update: async (args) => {
          referralCurrentStatus = args.data.status
          return {
            id: args.where.id,
            status: args.data.status,
            referralDate: new Date(),
          }
        },
        findFirst: async () => null,
      },
      referralStatusHistory: {
        create: async (args) => {
          statusHistoryRecords.push(args.data)
          return { id: statusHistoryRecords.length }
        },
      },
      followUp: {
        findUnique: async () => null,
        create: async (args) => {
          if (args.data.relatedReferralId) {
            referralFollowUpCreateArgs = args
          } else {
            careMissionFollowUpCreateArgs = args
          }
          return { id: 301, ...args.data }
        },
      },
    }
    return fn(mockTx)
  },
}

// ── Install the mock ──────────────────────────────────────────────────────

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: mockPrisma,
}

const { createAssessment } = require('../controllers/assessmentController')
const { createReferral, updateReferralStatus } = require('../controllers/referralController')

// ── HTTP mock helpers ─────────────────────────────────────────────────────

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this },
    json(payload) { this.body = payload; return this },
  }
}

// ── 1. RED assessment auto-creates CareMission with RED checklist ─────────

test('RED assessment creates CareMission with 4 RED checklist items', async () => {
  resetAll()

  const req = {
    user: { id: 2, role: 'WOMAN' },
    body: {
      patientId: 1,
      inputMethod: 'VISUAL',
      symptoms: [
        { symptomId: 1, answerStatus: 'PRESENT', severity: 'SEVERE' },
      ],
    },
  }

  const res = mockRes()
  await createAssessment(req, res)

  // The controller should return 201.
  assert.equal(res.statusCode, 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
  assert.equal(res.body.assessment.riskLevel, 'RED')
  assert.equal(res.body.assessment.resultCode, 'EMERGENCY_WARNING_SIGN')

  // CareMission must have been created with riskLevel RED.
  assert.ok(careMissionCreateArgs, 'CareMission must be created')
  assert.equal(careMissionCreateArgs.data.riskLevel, 'RED')
  assert.equal(careMissionCreateArgs.data.assessmentId, 999)
  assert.equal(careMissionCreateArgs.data.assignedLhwId, 7)

  // The initial timeline entry must record CARE_MISSION_CREATED.
  assert.ok(timelineCreateArgs, 'timeline entry must be created')
  assert.equal(timelineCreateArgs.data.action, 'CARE_MISSION_CREATED')
  assert.equal(timelineCreateArgs.data.toStatus, 'OPEN')

  // RED checklist must have exactly 4 items in the correct order.
  assert.ok(checklistCreateManyArgs, 'checklist items must be created')
  const items = checklistCreateManyArgs.data
  assert.equal(items.length, 4)
  assert.equal(items[0].taskKey, 'RED_IMMEDIATE_FACILITY_CONTACT')
  assert.equal(items[0].sortOrder, 1)
  assert.equal(items[1].taskKey, 'RED_ARRANGE_EMERGENCY_TRANSPORT')
  assert.equal(items[1].sortOrder, 2)
  assert.equal(items[2].taskKey, 'RED_NOTIFY_EMERGENCY_CONTACT')
  assert.equal(items[2].sortOrder, 3)
  assert.equal(items[3].taskKey, 'RED_CONFIRM_LHW_FOLLOW_UP')
  assert.equal(items[3].sortOrder, 4)

  // LHW follow-up must be scheduled (patient has assignedLhwId = 7).
  assert.ok(careMissionFollowUpCreateArgs, 'care-mission follow-up must be created for assigned LHW')
  assert.equal(careMissionFollowUpCreateArgs.data.patientId, 1)
  assert.equal(careMissionFollowUpCreateArgs.data.lhwId, 7)
})

// ── 2. Referral creation from the RED assessment ─────────────────────────

test('createReferral from RED assessment starts at RECOMMENDED', async () => {
  resetAll()

  const req = {
    user: { id: 2, role: 'WOMAN' },
    body: {
      assessmentId: 999,
      facilityId: 10,
      notes: 'Urgent referral for severe bleeding',
    },
  }

  const res = mockRes()
  await createReferral(req, res)

  assert.equal(res.statusCode, 201, `expected 201, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
  assert.ok(referralCreateArgs, 'referral must be created')
  assert.equal(referralCreateArgs.data.status, 'RECOMMENDED')
  assert.equal(referralCreateArgs.data.assessmentId, 999)
  assert.equal(referralCreateArgs.data.patientId, 1)
  assert.equal(referralCreateArgs.data.facilityId, 10)
  assert.equal(referralCreateArgs.data.notes, 'Urgent referral for severe bleeding')
  assert.ok(referralCreateArgs.data.referralDate instanceof Date)
})

// ── 3. Full referral lifecycle: RECOMMENDED → … → CLOSED ─────────────────

const LIFECYCLE_STEPS = [
  { from: 'RECOMMENDED',       to: 'FACILITY_SELECTED'  },
  { from: 'FACILITY_SELECTED', to: 'FACILITY_CONTACTED' },
  { from: 'FACILITY_CONTACTED', to: 'TRANSPORT_ARRANGED' },
  { from: 'TRANSPORT_ARRANGED', to: 'PATIENT_DEPARTED'  },
  { from: 'PATIENT_DEPARTED',  to: 'PATIENT_ARRIVED'    },
  { from: 'PATIENT_ARRIVED',   to: 'FOLLOW_UP_DUE'      },
  { from: 'FOLLOW_UP_DUE',     to: 'CLOSED'             },
]

test('full referral lifecycle RECOMMENDED → CLOSED with 7 transitions', async () => {
  resetAll()
  referralCurrentStatus = 'RECOMMENDED'

  const user = { id: 2, role: 'LHW' }

  for (const step of LIFECYCLE_STEPS) {
    const res = mockRes()
    const req = {
      user,
      params: { id: '200' },
      body: { status: step.to },
    }

    await updateReferralStatus(req, res)

    assert.equal(
      res.statusCode, null,
      `${step.from} → ${step.to}: expected 200 (no status call), got ${res.statusCode}: ${JSON.stringify(res.body)}`,
    )
    assert.equal(res.body.changed, true, `${step.from} → ${step.to}: must report changed`)
    assert.equal(referralCurrentStatus, step.to)
  }

  // All 7 transitions must have recorded status history entries.
  assert.equal(statusHistoryRecords.length, 7)
  for (let i = 0; i < LIFECYCLE_STEPS.length; i++) {
    assert.equal(statusHistoryRecords[i].fromStatus, LIFECYCLE_STEPS[i].from)
    assert.equal(statusHistoryRecords[i].toStatus, LIFECYCLE_STEPS[i].to)
    assert.equal(statusHistoryRecords[i].createdByUserId, user.id)
  }

  // CareMission timeline entries must have been created for transitions
  // that map to a CareMissionAction (all except RECOMMENDED → FACILITY_SELECTED
  // which maps to FACILITY_SELECTED).
  assert.ok(referralTimelineRecords.length > 0, 'timeline entries must be created')

  // FOLLOW_UP_DUE transition must have created a REFERRAL_CHECK follow-up.
  assert.ok(referralFollowUpCreateArgs, 'referral follow-up must be created at FOLLOW_UP_DUE')
  assert.equal(referralFollowUpCreateArgs.data.type, 'REFERRAL_CHECK')
  assert.equal(referralFollowUpCreateArgs.data.patientId, 1)
  assert.equal(referralFollowUpCreateArgs.data.lhwId, 7)
  assert.equal(referralFollowUpCreateArgs.data.relatedReferralId, 200)

  // Due date should be ~1 day out.
  const daysOut = (new Date(referralFollowUpCreateArgs.data.dueDate).getTime() - Date.now()) / 86400000
  assert.ok(daysOut > 0.99 && daysOut < 1.01, 'referral check due ~1 day out')
})

// ── 4. Backward transitions are rejected ─────────────────────────────────

test('backward lifecycle transition is rejected with 422', async () => {
  resetAll()
  referralCurrentStatus = 'PATIENT_ARRIVED'

  const res = mockRes()
  const req = {
    user: { id: 2, role: 'LHW' },
    params: { id: '200' },
    body: { status: 'RECOMMENDED' },
  }

  await updateReferralStatus(req, res)

  assert.equal(res.statusCode, 422)
  assert.match(res.body.error, /Cannot transition/)
})

// ── 5. Cancellation requires a note ──────────────────────────────────────

test('cancellation without note is rejected with 422', async () => {
  resetAll()
  referralCurrentStatus = 'FACILITY_SELECTED'

  const res = mockRes()
  const req = {
    user: { id: 2, role: 'LHW' },
    params: { id: '200' },
    body: { status: 'CANCELLED' },
  }

  await updateReferralStatus(req, res)

  assert.equal(res.statusCode, 422)
  assert.match(res.body.error, /Cancellation requires/)
})

test('cancellation with note succeeds', async () => {
  resetAll()
  referralCurrentStatus = 'FACILITY_SELECTED'

  const res = mockRes()
  const req = {
    user: { id: 2, role: 'LHW' },
    params: { id: '200' },
    body: { status: 'CANCELLED', note: 'Patient declined referral.' },
  }

  await updateReferralStatus(req, res)

  assert.equal(res.statusCode, null, `expected 200, got ${res.statusCode}: ${JSON.stringify(res.body)}`)
  assert.equal(res.body.changed, true)
  assert.equal(referralCurrentStatus, 'CANCELLED')

  // Status history must record the cancellation.
  assert.equal(statusHistoryRecords.length, 1)
  assert.equal(statusHistoryRecords[0].fromStatus, 'FACILITY_SELECTED')
  assert.equal(statusHistoryRecords[0].toStatus, 'CANCELLED')
  assert.equal(statusHistoryRecords[0].note, 'Patient declined referral.')
})
