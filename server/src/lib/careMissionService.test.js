const test = require('node:test')
const assert = require('node:assert/strict')
const { createCareMissionForAssessment } = require('./careMissionService')

/**
 * Creates a mock Prisma transaction client that records all calls.
 *
 * @param {object} opts
 * @param {object|null} opts.existingCareMission - If set, findUnique returns this (duplicate case)
 * @returns {{ tx: object, calls: { findUnique: Array, create: Array } }}
 */
function createMockTx({ existingCareMission = null } = {}) {
  const calls = { findUnique: [], create: [] }

  const tx = {
    careMission: {
      findUnique: async (args) => {
        calls.findUnique.push(args)
        return existingCareMission
      },
      create: async (args) => {
        calls.create.push(args)
        // Simulate Prisma returning the top-level record.
        return {
          id: 42,
          assessmentId: args.data.assessmentId,
          referralId: null,
          riskLevel: args.data.riskLevel,
          status: args.data.status,
          assignedLhwId: args.data.assignedLhwId,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      },
    },
  }

  return { tx, calls }
}

// ---------- GREEN: no Care Mission ----------

test('GREEN risk creates no CareMission', async () => {
  const { tx, calls } = createMockTx()

  const result = await createCareMissionForAssessment(tx, {
    assessmentId: 1,
    riskLevel: 'GREEN',
    assignedLhwId: null,
    createdByUserId: 10,
  })

  assert.equal(result, null)
  assert.equal(calls.findUnique.length, 0, 'should not query for existing CareMission')
  assert.equal(calls.create.length, 0, 'should not create a CareMission')
})

// ---------- YELLOW: creates exactly one OPEN CareMission ----------

test('YELLOW risk creates one OPEN CareMission', async () => {
  const { tx, calls } = createMockTx()

  const result = await createCareMissionForAssessment(tx, {
    assessmentId: 100,
    riskLevel: 'YELLOW',
    assignedLhwId: null,
    createdByUserId: 10,
  })

  assert.equal(calls.create.length, 1, 'exactly one create call')
  assert.equal(result.id, 42)

  const createData = calls.create[0].data
  assert.equal(createData.assessmentId, 100)
  assert.equal(createData.riskLevel, 'YELLOW')
  assert.equal(createData.status, 'OPEN')
})

test('YELLOW creates exactly 3 checklist tasks in order', async () => {
  const { tx, calls } = createMockTx()

  await createCareMissionForAssessment(tx, {
    assessmentId: 200,
    riskLevel: 'YELLOW',
    assignedLhwId: null,
    createdByUserId: 10,
  })

  const checklistCreate = calls.create[0].data.checklistItems.create
  assert.equal(checklistCreate.length, 3)
  assert.equal(checklistCreate[0].taskKey, 'YELLOW_CONTACT_HEALTHCARE_PROVIDER')
  assert.equal(checklistCreate[0].sortOrder, 1)
  assert.equal(checklistCreate[1].taskKey, 'YELLOW_CONFIRM_TRANSPORT_PLAN')
  assert.equal(checklistCreate[1].sortOrder, 2)
  assert.equal(checklistCreate[2].taskKey, 'YELLOW_SCHEDULE_FOLLOW_UP')
  assert.equal(checklistCreate[2].sortOrder, 3)
})

// ---------- RED: creates exactly one OPEN CareMission ----------

test('RED risk creates one OPEN CareMission', async () => {
  const { tx, calls } = createMockTx()

  const result = await createCareMissionForAssessment(tx, {
    assessmentId: 300,
    riskLevel: 'RED',
    assignedLhwId: null,
    createdByUserId: 10,
  })

  assert.equal(calls.create.length, 1)
  const createData = calls.create[0].data
  assert.equal(createData.assessmentId, 300)
  assert.equal(createData.riskLevel, 'RED')
  assert.equal(createData.status, 'OPEN')
})

test('RED creates exactly 4 checklist tasks in order', async () => {
  const { tx, calls } = createMockTx()

  await createCareMissionForAssessment(tx, {
    assessmentId: 400,
    riskLevel: 'RED',
    assignedLhwId: null,
    createdByUserId: 10,
  })

  const checklistCreate = calls.create[0].data.checklistItems.create
  assert.equal(checklistCreate.length, 4)
  assert.equal(checklistCreate[0].taskKey, 'RED_IMMEDIATE_FACILITY_CONTACT')
  assert.equal(checklistCreate[0].sortOrder, 1)
  assert.equal(checklistCreate[1].taskKey, 'RED_ARRANGE_EMERGENCY_TRANSPORT')
  assert.equal(checklistCreate[1].sortOrder, 2)
  assert.equal(checklistCreate[2].taskKey, 'RED_NOTIFY_EMERGENCY_CONTACT')
  assert.equal(checklistCreate[2].sortOrder, 3)
  assert.equal(checklistCreate[3].taskKey, 'RED_CONFIRM_LHW_FOLLOW_UP')
  assert.equal(checklistCreate[3].sortOrder, 4)
})

// ---------- Timeline entry ----------

test('newly created mission has exactly one CARE_MISSION_CREATED timeline entry', async () => {
  const { tx, calls } = createMockTx()

  await createCareMissionForAssessment(tx, {
    assessmentId: 500,
    riskLevel: 'YELLOW',
    assignedLhwId: null,
    createdByUserId: 10,
  })

  const timelineCreate = calls.create[0].data.timelineEntries.create
  // Prisma nested create: single object means exactly one record
  assert.ok(!Array.isArray(timelineCreate), 'timeline entry is a single object, not an array')
  assert.equal(timelineCreate.action, 'CARE_MISSION_CREATED')
})

test('timeline entry has null fromStatus and OPEN toStatus', async () => {
  const { tx, calls } = createMockTx()

  await createCareMissionForAssessment(tx, {
    assessmentId: 600,
    riskLevel: 'RED',
    assignedLhwId: null,
    createdByUserId: 10,
  })

  const timelineCreate = calls.create[0].data.timelineEntries.create
  assert.equal(timelineCreate.fromStatus, null)
  assert.equal(timelineCreate.toStatus, 'OPEN')
})

test('timeline entry notes include the risk level', async () => {
  const { tx, calls } = createMockTx()

  await createCareMissionForAssessment(tx, {
    assessmentId: 700,
    riskLevel: 'RED',
    assignedLhwId: null,
    createdByUserId: 10,
  })

  const timelineCreate = calls.create[0].data.timelineEntries.create
  assert.ok(timelineCreate.notes.includes('RED'))
})

test('timeline entry createdByUserId matches the authenticated user', async () => {
  const { tx, calls } = createMockTx()

  await createCareMissionForAssessment(tx, {
    assessmentId: 800,
    riskLevel: 'YELLOW',
    assignedLhwId: null,
    createdByUserId: 42,
  })

  const timelineCreate = calls.create[0].data.timelineEntries.create
  assert.equal(timelineCreate.createdByUserId, 42)
})

// ---------- LHW assignment ----------

test('copies patient assignedLhwId when one exists', async () => {
  const { tx, calls } = createMockTx()

  await createCareMissionForAssessment(tx, {
    assessmentId: 900,
    riskLevel: 'YELLOW',
    assignedLhwId: 7,
    createdByUserId: 10,
  })

  assert.equal(calls.create[0].data.assignedLhwId, 7)
})

test('assignedLhwId is null when patient has no LHW', async () => {
  const { tx, calls } = createMockTx()

  await createCareMissionForAssessment(tx, {
    assessmentId: 1000,
    riskLevel: 'RED',
    assignedLhwId: null,
    createdByUserId: 10,
  })

  assert.equal(calls.create[0].data.assignedLhwId, null)
})

// ---------- Duplicate protection ----------

test('duplicate CareMission creation is prevented (existing CareMission found)', async () => {
  const existingMission = { id: 99 }
  const { tx, calls } = createMockTx({ existingCareMission: existingMission })

  const result = await createCareMissionForAssessment(tx, {
    assessmentId: 1100,
    riskLevel: 'YELLOW',
    assignedLhwId: null,
    createdByUserId: 10,
  })

  assert.deepEqual(result, existingMission, 'should return the existing CareMission')
  assert.equal(calls.create.length, 0, 'should not attempt to create a duplicate')
  assert.equal(calls.findUnique.length, 1, 'should check for existing CareMission')
})

// ---------- Risk level is a snapshot, not AI-determined ----------

test('riskLevel is stored exactly as passed from the deterministic engine', async () => {
  const { tx, calls } = createMockTx()

  await createCareMissionForAssessment(tx, {
    assessmentId: 1200,
    riskLevel: 'RED',
    assignedLhwId: null,
    createdByUserId: 10,
  })

  // The service function receives the risk level as a parameter — it never
  // calls the AI layer or modifies the risk level. Verify it's stored as-is.
  assert.equal(calls.create[0].data.riskLevel, 'RED')
})
