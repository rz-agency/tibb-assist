const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Access filter unit tests (pure logic, no DB) ----------

// We test the filter-building logic by importing the access module and
// providing a mock prisma module via require cache manipulation. This
// keeps the tests fast and database-free.

// Mock prisma before importing the access module.
const mockPrisma = {
  lhw: {
    findUnique: async () => { throw new Error('Mock not configured') },
  },
}

// Replace the prisma module in require cache.
const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: mockPrisma,
}

const {
  getAccessiblePatientFilter,
  getCareMissionAccessFilter,
} = require('../lib/careMissionAccess')

// ---------- getAccessiblePatientFilter ----------

test('WOMAN: returns userId filter matching the authenticated user', async () => {
  const user = { id: 42, role: 'WOMAN' }
  const filter = await getAccessiblePatientFilter(user)
  assert.deepEqual(filter, { userId: 42 })
})

test('LHW with valid record: returns assignedLhwId filter', async () => {
  mockPrisma.lhw.findUnique = async (args) => {
    assert.equal(args.where.userId, 10)
    return { id: 7 }
  }

  const user = { id: 10, role: 'LHW' }
  const filter = await getAccessiblePatientFilter(user)
  assert.deepEqual(filter, { assignedLhwId: 7 })
})

test('LHW without record: returns null (access denied)', async () => {
  mockPrisma.lhw.findUnique = async () => null

  const user = { id: 99, role: 'LHW' }
  const filter = await getAccessiblePatientFilter(user)
  assert.equal(filter, null)
})

test('ADMIN: returns null (no access granted)', async () => {
  const user = { id: 1, role: 'ADMIN' }
  const filter = await getAccessiblePatientFilter(user)
  assert.equal(filter, null)
})

test('Unknown role: returns null', async () => {
  const user = { id: 1, role: 'UNKNOWN_ROLE' }
  const filter = await getAccessiblePatientFilter(user)
  assert.equal(filter, null)
})

// ---------- getCareMissionAccessFilter ----------

test('WOMAN: wraps userId filter in assessment.patient chain', async () => {
  const user = { id: 42, role: 'WOMAN' }
  const filter = await getCareMissionAccessFilter(user)
  assert.deepEqual(filter, {
    assessment: { patient: { userId: 42 } },
  })
})

test('LHW with valid record: wraps assignedLhwId in assessment.patient chain', async () => {
  mockPrisma.lhw.findUnique = async () => ({ id: 7 })

  const user = { id: 10, role: 'LHW' }
  const filter = await getCareMissionAccessFilter(user)
  assert.deepEqual(filter, {
    assessment: { patient: { assignedLhwId: 7 } },
  })
})

test('LHW without record: returns null', async () => {
  mockPrisma.lhw.findUnique = async () => null

  const user = { id: 99, role: 'LHW' }
  const filter = await getCareMissionAccessFilter(user)
  assert.equal(filter, null)
})

test('ADMIN: returns null', async () => {
  const user = { id: 1, role: 'ADMIN' }
  const filter = await getCareMissionAccessFilter(user)
  assert.equal(filter, null)
})

// ---------- Sorting logic (pure function) ----------

const riskPriority = { RED: 0, YELLOW: 1, GREEN: 2 }

function sortCareMissions(missions) {
  return missions.slice().sort((a, b) => {
    const riskDiff = (riskPriority[a.riskLevel] ?? 9) - (riskPriority[b.riskLevel] ?? 9)
    if (riskDiff !== 0) return riskDiff
    return b.createdAt.getTime() - a.createdAt.getTime()
  })
}

test('sorting: RED missions appear before YELLOW', () => {
  const missions = [
    { riskLevel: 'YELLOW', createdAt: new Date('2026-01-01') },
    { riskLevel: 'RED', createdAt: new Date('2026-01-01') },
  ]
  const sorted = sortCareMissions(missions)
  assert.equal(sorted[0].riskLevel, 'RED')
  assert.equal(sorted[1].riskLevel, 'YELLOW')
})

test('sorting: within same risk level, newest first', () => {
  const missions = [
    { riskLevel: 'YELLOW', createdAt: new Date('2026-01-01') },
    { riskLevel: 'YELLOW', createdAt: new Date('2026-06-15') },
  ]
  const sorted = sortCareMissions(missions)
  assert.equal(sorted[0].createdAt.getTime(), new Date('2026-06-15').getTime())
  assert.equal(sorted[1].createdAt.getTime(), new Date('2026-01-01').getTime())
})

test('sorting: complex mix of RED, YELLOW, and newest-first within groups', () => {
  const missions = [
    { riskLevel: 'YELLOW', createdAt: new Date('2026-03-01') },
    { riskLevel: 'RED', createdAt: new Date('2026-02-01') },
    { riskLevel: 'YELLOW', createdAt: new Date('2026-01-01') },
    { riskLevel: 'RED', createdAt: new Date('2026-04-01') },
  ]
  const sorted = sortCareMissions(missions)
  assert.equal(sorted[0].riskLevel, 'RED')
  assert.equal(sorted[0].createdAt.getMonth(), 3) // April
  assert.equal(sorted[1].riskLevel, 'RED')
  assert.equal(sorted[1].createdAt.getMonth(), 1) // February
  assert.equal(sorted[2].riskLevel, 'YELLOW')
  assert.equal(sorted[2].createdAt.getMonth(), 2) // March
  assert.equal(sorted[3].riskLevel, 'YELLOW')
  assert.equal(sorted[3].createdAt.getMonth(), 0) // January
})

// ---------- Body validation logic (pure function) ----------

function validatePatchBody(body) {
  const bodyKeys = Object.keys(body)
  if (bodyKeys.length !== 1 || bodyKeys[0] !== 'isCompleted') {
    return 'Request body must contain only { "isCompleted": boolean }.'
  }
  if (typeof body.isCompleted !== 'boolean') {
    return 'isCompleted must be a boolean (true or false).'
  }
  return null
}

test('body validation: accepts { isCompleted: true }', () => {
  assert.equal(validatePatchBody({ isCompleted: true }), null)
})

test('body validation: accepts { isCompleted: false }', () => {
  assert.equal(validatePatchBody({ isCompleted: false }), null)
})

test('body validation: rejects empty body', () => {
  assert.notEqual(validatePatchBody({}), null)
})

test('body validation: rejects non-boolean isCompleted', () => {
  assert.notEqual(validatePatchBody({ isCompleted: 1 }), null)
  assert.notEqual(validatePatchBody({ isCompleted: 'true' }), null)
  assert.notEqual(validatePatchBody({ isCompleted: null }), null)
})

test('body validation: rejects extra fields', () => {
  assert.notEqual(
    validatePatchBody({ isCompleted: true, riskLevel: 'RED' }),
    null,
  )
})

test('body validation: rejects missing isCompleted with other fields', () => {
  assert.notEqual(
    validatePatchBody({ status: 'COMPLETED' }),
    null,
  )
})

// Cleanup: restore original prisma module in cache.
delete require.cache[prismaPath]
