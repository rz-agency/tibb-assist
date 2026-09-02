const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Controller endpoint tests (mocked prisma, no DB) ----------
//
// We test the endpoint handlers directly by providing a mock prisma module
// via require cache manipulation (same technique as careMissionAccess.test.js).
// This keeps the tests fast and database-free.

const mockPrisma = {
  user: {
    findUnique: async () => { throw new Error('Mock not configured') },
  },
  lhw: {
    findUnique: async () => { throw new Error('Mock not configured') },
  },
  patientProfile: {
    findMany: async () => { throw new Error('Mock not configured') },
    findUnique: async () => { throw new Error('Mock not configured') },
    update: async () => { throw new Error('Mock not configured') },
  },
}

// Replace the prisma module in require cache before importing the controller.
const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: mockPrisma,
}

const {
  listUnassignedPatients,
  assignLhwToPatient,
} = require('../controllers/patientController')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')

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

function mockRequest({ user, patientId, lhwId } = {}) {
  return {
    user,
    params: { patientId },
    body: lhwId === undefined ? {} : { lhwId },
  }
}

// ---------- Role guard (LHW-only access) ----------

test('role guard: unauthenticated request is rejected with 401', async () => {
  const res = mockRes()
  let nextCalled = false
  await requireAuth({ session: {} }, res, () => { nextCalled = true })
  assert.equal(res.statusCode, 401)
  assert.equal(nextCalled, false)
})

test('role guard: WOMAN caller is rejected with 403', async () => {
  const [, lhwGuard] = requireRole('LHW')
  const res = mockRes()
  let nextCalled = false
  await lhwGuard({ user: { id: 5, role: 'WOMAN' } }, res, () => { nextCalled = true })
  assert.equal(res.statusCode, 403)
  assert.equal(nextCalled, false)
})

test('role guard: LHW caller passes through', async () => {
  const [, lhwGuard] = requireRole('LHW')
  const res = mockRes()
  let nextCalled = false
  await lhwGuard({ user: { id: 5, role: 'LHW' } }, res, () => { nextCalled = true })
  assert.equal(res.statusCode, null)
  assert.equal(nextCalled, true)
})

// ---------- GET /patients/unassigned ----------

test('unassigned list: queries patients where assignedLhwId is null, newest first', async () => {
  const expectedPatients = [
    { id: 9, fullName: 'Bibi', createdAt: '2026-09-01', pregnancies: [] },
    { id: 4, fullName: 'Ayesha', createdAt: '2026-08-01', pregnancies: [{ id: 2, pregnancyStatus: 'ACTIVE' }] },
  ]

  mockPrisma.patientProfile.findMany = async (args) => {
    assert.deepEqual(args.where, { assignedLhwId: null })
    assert.deepEqual(args.orderBy, { createdAt: 'desc' })
    return expectedPatients
  }

  const res = mockRes()
  await listUnassignedPatients(mockRequest({ user: { id: 5, role: 'LHW' } }), res)
  assert.equal(res.statusCode, null)
  assert.deepEqual(res.body, { patients: expectedPatients })
})

test('unassigned list: only selects minimal non-medical fields', async () => {
  mockPrisma.patientProfile.findMany = async (args) => {
    assert.deepEqual(Object.keys(args.select).sort(), [
      'createdAt',
      'district',
      'fullName',
      'id',
      'pregnancies',
      'villageOrArea',
    ])
    return []
  }

  const res = mockRes()
  await listUnassignedPatients(mockRequest({ user: { id: 5, role: 'LHW' } }), res)
  assert.equal(res.statusCode, null)
  assert.deepEqual(res.body, { patients: [] })
})

test('unassigned list: database error returns 500', async () => {
  mockPrisma.patientProfile.findMany = async () => { throw new Error('connection failed') }

  const res = mockRes()
  await listUnassignedPatients(mockRequest({ user: { id: 5, role: 'LHW' } }), res)
  assert.equal(res.statusCode, 500)
  assert.equal(res.body.error, 'A database error occurred.')
})

// ---------- PATCH /patients/:patientId/assign-lhw ----------

test('assign: successful assignment updates assignedLhwId to the LHW profile id', async () => {
  mockPrisma.user.findUnique = async (args) => {
    assert.deepEqual(args.where, { id: 12 })
    return { id: 12, role: 'LHW' }
  }
  mockPrisma.lhw.findUnique = async (args) => {
    assert.deepEqual(args.where, { userId: 12 })
    return { id: 3 }
  }
  mockPrisma.patientProfile.findUnique = async (args) => {
    assert.deepEqual(args.where, { id: 7 })
    return { id: 7 }
  }
  const updatedPatient = { id: 7, fullName: 'Ayesha', assignedLhwId: 3 }
  mockPrisma.patientProfile.update = async (args) => {
    assert.deepEqual(args.where, { id: 7 })
    assert.deepEqual(args.data, { assignedLhwId: 3 })
    return updatedPatient
  }

  const res = mockRes()
  await assignLhwToPatient(mockRequest({ user: { id: 12, role: 'LHW' }, patientId: '7', lhwId: '12' }), res)
  assert.equal(res.statusCode, null)
  assert.deepEqual(res.body, { patient: updatedPatient })
})

test('assign: lhwId accepted as a numeric string from JSON body', async () => {
  mockPrisma.user.findUnique = async () => ({ id: 12, role: 'LHW' })
  mockPrisma.lhw.findUnique = async () => ({ id: 3 })
  mockPrisma.patientProfile.findUnique = async () => ({ id: 7 })
  mockPrisma.patientProfile.update = async () => ({ id: 7, assignedLhwId: 3 })

  const res = mockRes()
  await assignLhwToPatient(mockRequest({ user: { id: 12, role: 'LHW' }, patientId: 7, lhwId: 12 }), res)
  assert.equal(res.statusCode, null)
})

test('assign: nonexistent lhwId user returns 400', async () => {
  mockPrisma.user.findUnique = async () => null
  mockPrisma.lhw.findUnique = async () => { throw new Error('should not be called') }

  const res = mockRes()
  await assignLhwToPatient(mockRequest({ user: { id: 12, role: 'LHW' }, patientId: 7, lhwId: 999 }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'lhwId must correspond to an existing user with role LHW.')
})

test('assign: lhwId pointing to a WOMAN user returns 400', async () => {
  mockPrisma.user.findUnique = async () => ({ id: 12, role: 'WOMAN' })
  mockPrisma.lhw.findUnique = async () => { throw new Error('should not be called') }

  const res = mockRes()
  await assignLhwToPatient(mockRequest({ user: { id: 12, role: 'LHW' }, patientId: 7, lhwId: 12 }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'lhwId must correspond to an existing user with role LHW.')
})

test('assign: LHW user without an LHW profile returns 400', async () => {
  mockPrisma.user.findUnique = async () => ({ id: 12, role: 'LHW' })
  mockPrisma.lhw.findUnique = async () => null
  mockPrisma.patientProfile.findUnique = async () => { throw new Error('should not be called') }

  const res = mockRes()
  await assignLhwToPatient(mockRequest({ user: { id: 12, role: 'LHW' }, patientId: 7, lhwId: 12 }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'LHW profile not found for this user.')
})

test('assign: nonexistent patientId returns 404', async () => {
  mockPrisma.user.findUnique = async () => ({ id: 12, role: 'LHW' })
  mockPrisma.lhw.findUnique = async () => ({ id: 3 })
  mockPrisma.patientProfile.findUnique = async () => null
  mockPrisma.patientProfile.update = async () => { throw new Error('should not be called') }

  const res = mockRes()
  await assignLhwToPatient(mockRequest({ user: { id: 12, role: 'LHW' }, patientId: 55, lhwId: 12 }), res)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'Patient profile not found.')
})

test('assign: invalid patientId returns 400 without database access', async () => {
  mockPrisma.user.findUnique = async () => { throw new Error('should not be called') }

  const res = mockRes()
  await assignLhwToPatient(mockRequest({ user: { id: 12, role: 'LHW' }, patientId: 'abc', lhwId: 12 }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'patientId must be a positive integer.')
})

test('assign: missing or invalid lhwId returns 400 without database access', async () => {
  mockPrisma.user.findUnique = async () => { throw new Error('should not be called') }

  const res = mockRes()
  await assignLhwToPatient(mockRequest({ user: { id: 12, role: 'LHW' }, patientId: 7, lhwId: 'not-a-number' }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'lhwId must be a positive integer.')

  const resWithoutBody = mockRes()
  await assignLhwToPatient({ user: { id: 12, role: 'LHW' }, params: { patientId: '7' }, body: {} }, resWithoutBody)
  assert.equal(resWithoutBody.statusCode, 400)
  assert.equal(resWithoutBody.body.error, 'lhwId must be a positive integer.')
})

test('assign: database error during update returns 500', async () => {
  mockPrisma.user.findUnique = async () => ({ id: 12, role: 'LHW' })
  mockPrisma.lhw.findUnique = async () => ({ id: 3 })
  mockPrisma.patientProfile.findUnique = async () => ({ id: 7 })
  mockPrisma.patientProfile.update = async () => { throw new Error('connection failed') }

  const res = mockRes()
  await assignLhwToPatient(mockRequest({ user: { id: 12, role: 'LHW' }, patientId: 7, lhwId: 12 }), res)
  assert.equal(res.statusCode, 500)
  assert.equal(res.body.error, 'A database error occurred.')
})

// Cleanup: restore original prisma module in cache.
delete require.cache[prismaPath]
