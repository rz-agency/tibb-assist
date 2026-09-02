const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Emergency action log endpoint tests (mocked prisma, no DB) ----------
//
// We test the endpoint handler directly by providing a mock prisma module
// via require cache manipulation (same technique as careMissionAccess.test.js
// and patientController.test.js). This keeps the tests fast and database-free.

const mockPrisma = {
  careMission: {
    findUnique: async () => { throw new Error('Mock not configured') },
    findFirst: async () => { throw new Error('Mock not configured') },
  },
  careMissionTimeline: {
    create: async () => { throw new Error('Mock not configured') },
  },
  lhw: {
    findUnique: async () => { throw new Error('Mock not configured') },
  },
}

// Replace the prisma module in require cache before importing the controller.
// careMissionAccess.js also requires ./prisma, so it picks up the same mock.
const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: mockPrisma,
}

const { logEmergencyAction } = require('../controllers/careMissionController')
const { requireAuth } = require('../middleware/authMiddleware')

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

function mockRequest({ user, missionId, actionType } = {}) {
  return {
    user,
    params: { missionId },
    body: actionType === undefined ? {} : { actionType },
  }
}

const womanOwner = { id: 11, role: 'WOMAN' }
const otherWoman = { id: 22, role: 'WOMAN' }

function grantAccess() {
  // Mission exists and the access-filtered lookup also finds it.
  mockPrisma.careMission.findUnique = async () => ({ id: 5 })
  mockPrisma.careMission.findFirst = async () => ({ id: 5 })
}

// ---------- Authentication ----------

test('emergency log: unauthenticated request is rejected with 401', async () => {
  const res = mockRes()
  let nextCalled = false
  await requireAuth({ session: {} }, res, () => { nextCalled = true })
  assert.equal(res.statusCode, 401)
  assert.equal(nextCalled, false)
})

// ---------- Validation ----------

test('emergency log: invalid missionId format returns 400', async () => {
  grantAccess()
  const res = mockRes()
  await logEmergencyAction(mockRequest({ user: womanOwner, missionId: 'abc', actionType: 'CALLED_RESCUE_1122' }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'Care mission id must be a positive integer.')
})

test('emergency log: missing actionType returns 400', async () => {
  grantAccess()
  const res = mockRes()
  await logEmergencyAction(mockRequest({ user: womanOwner, missionId: 5 }), res)
  assert.equal(res.statusCode, 400)
  assert.ok(res.body.error.includes('actionType'))
})

test('emergency log: unknown actionType returns 400', async () => {
  grantAccess()
  mockPrisma.careMissionTimeline.create = async () => { throw new Error('should not be called') }
  const res = mockRes()
  await logEmergencyAction(mockRequest({ user: womanOwner, missionId: 5, actionType: 'AMBULANCE_DISPATCHED' }), res)
  assert.equal(res.statusCode, 400)
  assert.ok(res.body.error.includes('actionType'))
})

// ---------- Existence and access ----------

test('emergency log: unknown missionId returns 404', async () => {
  mockPrisma.careMission.findUnique = async () => null
  mockPrisma.careMission.findFirst = async () => { throw new Error('should not be called') }
  const res = mockRes()
  await logEmergencyAction(mockRequest({ user: womanOwner, missionId: 999, actionType: 'CALLED_RESCUE_1122' }), res)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'Care mission not found.')
})

test('emergency log: WOMAN who does not own the mission is rejected with 403', async () => {
  mockPrisma.careMission.findUnique = async () => ({ id: 5 })
  // Access-filtered lookup finds nothing for this user.
  mockPrisma.careMission.findFirst = async () => null
  mockPrisma.careMissionTimeline.create = async () => { throw new Error('should not be called') }

  const res = mockRes()
  await logEmergencyAction(mockRequest({ user: otherWoman, missionId: 5, actionType: 'CALLED_RESCUE_1122' }), res)
  assert.equal(res.statusCode, 403)
})

test('emergency log: LHW not assigned to the patient is rejected with 403', async () => {
  mockPrisma.careMission.findUnique = async () => ({ id: 5 })
  mockPrisma.lhw.findUnique = async (args) => {
    assert.deepEqual(args.where, { userId: 30 })
    return { id: 7 }
  }
  mockPrisma.careMission.findFirst = async () => null
  mockPrisma.careMissionTimeline.create = async () => { throw new Error('should not be called') }

  const res = mockRes()
  await logEmergencyAction(mockRequest({ user: { id: 30, role: 'LHW' }, missionId: 5, actionType: 'CALLED_RESCUE_1122' }), res)
  assert.equal(res.statusCode, 403)
})

test('emergency log: role without an access policy is rejected with 403', async () => {
  mockPrisma.careMission.findUnique = async () => ({ id: 5 })
  mockPrisma.careMission.findFirst = async () => { throw new Error('should not be called') }
  mockPrisma.careMissionTimeline.create = async () => { throw new Error('should not be called') }

  const res = mockRes()
  await logEmergencyAction(mockRequest({ user: { id: 1, role: 'ADMIN' }, missionId: 5, actionType: 'CALLED_RESCUE_1122' }), res)
  assert.equal(res.statusCode, 403)
})

// ---------- Successful logging ----------

test('emergency log: WOMAN owner logging CALLED_RESCUE_1122 creates an initiation-only timeline entry', async () => {
  grantAccess()
  const created = { id: 77, action: 'EMERGENCY_CALL_INITIATED', notes: 'User initiated call to Rescue 1122.', createdByUserId: 11 }
  mockPrisma.careMissionTimeline.create = async (args) => {
    assert.equal(args.data.careMissionId, 5)
    assert.equal(args.data.action, 'EMERGENCY_CALL_INITIATED')
    assert.equal(args.data.notes, 'User initiated call to Rescue 1122.')
    assert.equal(args.data.createdByUserId, 11)
    return created
  }

  const res = mockRes()
  await logEmergencyAction(mockRequest({ user: womanOwner, missionId: '5', actionType: 'CALLED_RESCUE_1122' }), res)
  assert.equal(res.statusCode, 201)
  assert.deepEqual(res.body, { entry: created })
})

test('emergency log: CALLED_EMERGENCY_CONTACT records contact call initiation', async () => {
  grantAccess()
  mockPrisma.careMissionTimeline.create = async (args) => {
    assert.equal(args.data.action, 'EMERGENCY_CALL_INITIATED')
    assert.equal(args.data.notes, 'User initiated call to primary emergency contact.')
    return { id: 78, action: args.data.action, notes: args.data.notes }
  }

  const res = mockRes()
  await logEmergencyAction(mockRequest({ user: womanOwner, missionId: 5, actionType: 'CALLED_EMERGENCY_CONTACT' }), res)
  assert.equal(res.statusCode, 201)
  assert.equal(res.body.entry.notes, 'User initiated call to primary emergency contact.')
})

test('emergency log: CALLED_LHW records LHW call initiation', async () => {
  grantAccess()
  mockPrisma.careMissionTimeline.create = async (args) => {
    assert.equal(args.data.action, 'EMERGENCY_CALL_INITIATED')
    assert.equal(args.data.notes, 'User initiated call to assigned LHW.')
    return { id: 79, action: args.data.action, notes: args.data.notes }
  }

  const res = mockRes()
  await logEmergencyAction(mockRequest({ user: womanOwner, missionId: 5, actionType: 'CALLED_LHW' }), res)
  assert.equal(res.statusCode, 201)
  assert.equal(res.body.entry.notes, 'User initiated call to assigned LHW.')
})

test('emergency log: assigned LHW can log an emergency action for her patient mission', async () => {
  mockPrisma.careMission.findUnique = async () => ({ id: 5 })
  mockPrisma.lhw.findUnique = async () => ({ id: 7 })
  mockPrisma.careMission.findFirst = async (args) => {
    // The access filter must scope the mission to this LHW's assigned patients.
    assert.deepEqual(args.where, {
      id: 5,
      assessment: { patient: { assignedLhwId: 7 } },
    })
    return { id: 5 }
  }
  mockPrisma.careMissionTimeline.create = async (args) => ({
    id: 80,
    action: args.data.action,
    notes: args.data.notes,
    createdByUserId: args.data.createdByUserId,
  })

  const res = mockRes()
  await logEmergencyAction(mockRequest({ user: { id: 30, role: 'LHW' }, missionId: 5, actionType: 'CALLED_RESCUE_1122' }), res)
  assert.equal(res.statusCode, 201)
  assert.equal(res.body.entry.createdByUserId, 30)
})

test('emergency log: timeline notes never claim completion or dispatch', async () => {
  grantAccess()
  const forbiddenWords = ['dispatch', 'on the way', 'notified', 'acknowledged', 'completed call', 'call succeeded']
  for (const actionType of ['CALLED_RESCUE_1122', 'CALLED_EMERGENCY_CONTACT', 'CALLED_LHW']) {
    mockPrisma.careMissionTimeline.create = async (args) => ({ id: 1, notes: args.data.notes })
    const res = mockRes()
    await logEmergencyAction(mockRequest({ user: womanOwner, missionId: 5, actionType }), res)
    const notes = res.body.entry.notes.toLowerCase()
    for (const word of forbiddenWords) {
      assert.ok(!notes.includes(word), `notes must not contain "${word}": "${notes}"`)
    }
    assert.ok(notes.includes('initiated'), `notes must describe initiation: "${notes}"`)
  }
})

// Cleanup: restore original prisma module in cache.
delete require.cache[prismaPath]
