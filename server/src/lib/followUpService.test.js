const test = require('node:test')
const assert = require('node:assert/strict')
const {
  CARE_MISSION_FOLLOW_UP_LEAD_DAYS,
  REFERRAL_CHECK_DUE_DAYS,
  addDays,
  createFollowUpForCareMission,
  createFollowUpForReferral,
} = require('./followUpService')

/**
 * Creates a mock Prisma transaction client that records follow-up calls.
 *
 * @param {object} opts
 * @param {object|null} opts.existingFollowUp - If set, findUnique returns this (duplicate case)
 * @returns {{ tx: object, calls: { findUnique: Array, create: Array } }}
 */
function createMockTx({ existingFollowUp = null } = {}) {
  const calls = { findUnique: [], create: [] }

  const tx = {
    followUp: {
      findUnique: async (args) => {
        calls.findUnique.push(args)
        return existingFollowUp
      },
      create: async (args) => {
        calls.create.push(args)
        return { id: 77, ...args.data }
      },
    },
  }

  return { tx, calls }
}

/** Difference in whole days between a stored due date and now (approximate). */
function daysFromNow(date) {
  return (new Date(date).getTime() - Date.now()) / 86400000
}

// ---------- Schedule constants ----------

test('care-mission follow-up lead days: RED 3, YELLOW 7', () => {
  assert.deepEqual(CARE_MISSION_FOLLOW_UP_LEAD_DAYS, { RED: 3, YELLOW: 7 })
})

test('referral check is due 1 day out', () => {
  assert.equal(REFERRAL_CHECK_DUE_DAYS, 1)
})

// ---------- addDays ----------

test('addDays returns a new Date exactly N days later', () => {
  const base = new Date('2026-09-05T10:30:00.000Z')
  const result = addDays(base, 3)
  assert.equal(result.toISOString(), '2026-09-08T10:30:00.000Z')
})

test('addDays does not mutate the input date', () => {
  const base = new Date('2026-09-05T10:30:00.000Z')
  addDays(base, 7)
  assert.equal(base.toISOString(), '2026-09-05T10:30:00.000Z')
})

test('addDays handles month and year boundaries', () => {
  assert.equal(addDays(new Date('2026-09-30T00:00:00.000Z'), 1).toISOString(), '2026-10-01T00:00:00.000Z')
  assert.equal(addDays(new Date('2026-12-31T00:00:00.000Z'), 1).toISOString(), '2027-01-01T00:00:00.000Z')
})

// ---------- CareMission follow-ups ----------

test('RED care mission creates a HOME_VISIT follow-up 3 days out', async () => {
  const { tx, calls } = createMockTx()

  const result = await createFollowUpForCareMission(tx, {
    careMissionId: 42,
    patientId: 10,
    riskLevel: 'RED',
    assignedLhwId: 7,
  })

  assert.equal(result.id, 77)
  assert.equal(calls.create.length, 1)

  const data = calls.create[0].data
  assert.equal(data.patientId, 10)
  assert.equal(data.lhwId, 7)
  assert.equal(data.type, 'HOME_VISIT')
  assert.equal(data.relatedCareMissionId, 42)
  assert.ok(daysFromNow(data.dueDate) > 2.99 && daysFromNow(data.dueDate) < 3.01, 'due date is ~3 days out')
})

test('YELLOW care mission creates a follow-up 7 days out', async () => {
  const { tx, calls } = createMockTx()

  await createFollowUpForCareMission(tx, {
    careMissionId: 43,
    patientId: 11,
    riskLevel: 'YELLOW',
    assignedLhwId: 7,
  })

  const data = calls.create[0].data
  assert.equal(data.type, 'HOME_VISIT')
  assert.ok(daysFromNow(data.dueDate) > 6.99 && daysFromNow(data.dueDate) < 7.01, 'due date is ~7 days out')
})

test('care mission without an assigned LHW creates no follow-up', async () => {
  const { tx, calls } = createMockTx()

  const result = await createFollowUpForCareMission(tx, {
    careMissionId: 44,
    patientId: 12,
    riskLevel: 'RED',
    assignedLhwId: null,
  })

  assert.equal(result, null)
  assert.equal(calls.findUnique.length, 0, 'should not query for an existing follow-up')
  assert.equal(calls.create.length, 0, 'should not create a follow-up')
})

test('GREEN risk level creates no follow-up', async () => {
  const { tx, calls } = createMockTx()

  const result = await createFollowUpForCareMission(tx, {
    careMissionId: 45,
    patientId: 13,
    riskLevel: 'GREEN',
    assignedLhwId: 7,
  })

  assert.equal(result, null)
  assert.equal(calls.create.length, 0, 'should not create a follow-up')
})

test('existing follow-up for the care mission is returned, not duplicated', async () => {
  const existing = { id: 99 }
  const { tx, calls } = createMockTx({ existingFollowUp: existing })

  const result = await createFollowUpForCareMission(tx, {
    careMissionId: 46,
    patientId: 14,
    riskLevel: 'RED',
    assignedLhwId: 7,
  })

  assert.deepEqual(result, existing)
  assert.equal(calls.findUnique.length, 1)
  assert.equal(calls.findUnique[0].where.relatedCareMissionId, 46)
  assert.equal(calls.create.length, 0, 'should not create a duplicate')
})

// ---------- Referral follow-ups ----------

test('referral reaching FOLLOW_UP_DUE creates a REFERRAL_CHECK follow-up 1 day out', async () => {
  const { tx, calls } = createMockTx()

  const result = await createFollowUpForReferral(tx, {
    referralId: 55,
    patientId: 10,
    assignedLhwId: 7,
  })

  assert.equal(result.id, 77)
  assert.equal(calls.create.length, 1)

  const data = calls.create[0].data
  assert.equal(data.patientId, 10)
  assert.equal(data.lhwId, 7)
  assert.equal(data.type, 'REFERRAL_CHECK')
  assert.equal(data.relatedReferralId, 55)
  assert.ok(daysFromNow(data.dueDate) > 0.99 && daysFromNow(data.dueDate) < 1.01, 'due date is ~1 day out')
})

test('referral follow-up without an assigned LHW is skipped', async () => {
  const { tx, calls } = createMockTx()

  const result = await createFollowUpForReferral(tx, {
    referralId: 56,
    patientId: 15,
    assignedLhwId: null,
  })

  assert.equal(result, null)
  assert.equal(calls.findUnique.length, 0)
  assert.equal(calls.create.length, 0)
})

test('existing follow-up for the referral is returned, not duplicated', async () => {
  const existing = { id: 88 }
  const { tx, calls } = createMockTx({ existingFollowUp: existing })

  const result = await createFollowUpForReferral(tx, {
    referralId: 57,
    patientId: 16,
    assignedLhwId: 7,
  })

  assert.deepEqual(result, existing)
  assert.equal(calls.findUnique[0].where.relatedReferralId, 57)
  assert.equal(calls.create.length, 0, 'should not create a duplicate')
})
