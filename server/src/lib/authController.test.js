const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Auth controller tests (mocked prisma + bcryptjs) ----------
//
// Tests the three fixes applied to authController.js:
//   1. LHW registration creates both a User and an Lhw row
//   2. Login regenerates the session id before assigning the user
//   3. All frontend region select values are valid LhwRegion enum members
//
// Prisma and bcryptjs are mocked via require cache manipulation (same
// technique as careMissionAccess.test.js, patientController.test.js and
// aiAssistantController.test.js). This keeps the tests fast, deterministic
// and database-free.

// ---------- LhwRegion enum values (source of truth: schema.prisma) ----------

const VALID_LHW_REGIONS = [
  'PUNJAB',
  'SINDH',
  'KPK',
  'BALOCHISTAN',
  'GILGIT_BALTISTAN',
  'ISLAMABAD',
  'AJK',
  'OTHER',
]

// Frontend select option values extracted from LhwDashboard.jsx (~line 220).
const FRONTEND_REGION_VALUES = [
  'KPK',
  'PUNJAB',
  'SINDH',
  'BALOCHISTAN',
  'GILGIT_BALTISTAN',
  'AJK',
  'ISLAMABAD',
  'OTHER',
]

// ---------- Mutable mock state — reset before each test ----------

let userFindUniqueResult = null
let transactionCalls = []
let capturedTransactionCallback = null
let bcryptHashResult = '$2a$12$mockedhashvalue'
let bcryptCompareResult = true

// ---------- Mock prisma ----------

const mockPrisma = {
  user: {
    findUnique: async () => userFindUniqueResult,
    create: async (args) => {
      transactionCalls.push({ model: 'user', method: 'create', args })
      return {
        id: 42,
        email: args.data.email,
        role: args.data.role,
        isActive: true,
        createdAt: new Date('2026-09-05T00:00:00.000Z'),
        updatedAt: new Date('2026-09-05T00:00:00.000Z'),
        ...args.data,
      }
    },
  },
  patientProfile: {
    create: async (args) => {
      transactionCalls.push({ model: 'patientProfile', method: 'create', args })
      return { id: 10, ...args.data }
    },
  },
  lhw: {
    create: async (args) => {
      transactionCalls.push({ model: 'lhw', method: 'create', args })
      return { id: 5, ...args.data }
    },
  },
  $transaction: async (callback) => {
    capturedTransactionCallback = callback
    return callback(mockPrisma)
  },
}

// ---------- Mock bcryptjs ----------

const mockBcrypt = {
  hash: async (_password, _rounds) => bcryptHashResult,
  compare: async (_password, _hash) => bcryptCompareResult,
}

// ---------- Install mocks in require cache ----------

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: mockPrisma,
}

const bcryptPath = require.resolve('bcryptjs')
const originalBcryptExports = require.cache[bcryptPath]?.exports
require.cache[bcryptPath] = {
  id: bcryptPath,
  filename: bcryptPath,
  loaded: true,
  exports: mockBcrypt,
}

const { register, login } = require('../controllers/authController')

// ---------- Helpers ----------

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

function mockRegisterReq(body) {
  return {
    body,
    session: { id: 'pre-register-session', user: null },
  }
}

function mockLoginReq(body) {
  return {
    body,
    session: {
      id: 'pre-login-session-abc123',
      user: null,
      regenerate(cb) {
        this.id = 'post-login-session-' + Math.random().toString(36).slice(2, 10)
        cb(null)
      },
    },
  }
}

function resetMocks() {
  userFindUniqueResult = null
  transactionCalls = []
  capturedTransactionCallback = null
  bcryptHashResult = '$2a$12$mockedhashvalue'
  bcryptCompareResult = true
}

// ---------- Fix 2: LHW registration creates both User and Lhw rows ----------

test('register: LHW creates User row AND Lhw row in the same transaction', async () => {
  resetMocks()

  const req = mockRegisterReq({
    email: 'lhw@example.com',
    password: 'pass1234',
    role: 'LHW',
    fullName: 'Ayesha LHW',
  })
  const res = mockRes()

  await register(req, res)

  assert.equal(res.statusCode, 201, 'registration should succeed with 201')
  assert.equal(res.body.user.role, 'LHW')

  const userCreateCall = transactionCalls.find(c => c.model === 'user' && c.method === 'create')
  assert.ok(userCreateCall, 'user.create must be called inside the transaction')
  assert.equal(userCreateCall.args.data.role, 'LHW')

  const lhwCreateCall = transactionCalls.find(c => c.model === 'lhw' && c.method === 'create')
  assert.ok(lhwCreateCall, 'lhw.create must be called inside the transaction for LHW role')
  assert.equal(lhwCreateCall.args.data.userId, 42, 'Lhw row must reference the created User id')
  assert.equal(lhwCreateCall.args.data.fullName, 'Ayesha LHW')
  assert.equal(lhwCreateCall.args.data.region, 'OTHER', 'default region should be OTHER')

  const patientCreateCall = transactionCalls.find(c => c.model === 'patientProfile' && c.method === 'create')
  assert.equal(patientCreateCall, undefined, 'patientProfile.create must NOT be called for LHW role')
})

test('register: WOMAN creates User row AND PatientProfile row (no Lhw row)', async () => {
  resetMocks()

  const req = mockRegisterReq({
    email: 'woman@example.com',
    password: 'pass1234',
    role: 'WOMAN',
    fullName: 'Fatima Woman',
    district: 'Rawalpindi',
    province: 'Punjab',
  })
  const res = mockRes()

  await register(req, res)

  assert.equal(res.statusCode, 201)

  const userCreateCall = transactionCalls.find(c => c.model === 'user' && c.method === 'create')
  assert.ok(userCreateCall, 'user.create must be called')

  const patientCreateCall = transactionCalls.find(c => c.model === 'patientProfile' && c.method === 'create')
  assert.ok(patientCreateCall, 'patientProfile.create must be called for WOMAN role')
  assert.equal(patientCreateCall.args.data.fullName, 'Fatima Woman')

  const lhwCreateCall = transactionCalls.find(c => c.model === 'lhw' && c.method === 'create')
  assert.equal(lhwCreateCall, undefined, 'lhw.create must NOT be called for WOMAN role')
})

test('register: LHW without fullName → 400', async () => {
  resetMocks()

  const req = mockRegisterReq({
    email: 'lhw@example.com',
    password: 'pass1234',
    role: 'LHW',
  })
  const res = mockRes()

  await register(req, res)

  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /fullName is required/)
})

test('register: LHW with blank fullName → 400', async () => {
  resetMocks()

  const req = mockRegisterReq({
    email: 'lhw@example.com',
    password: 'pass1234',
    role: 'LHW',
    fullName: '   ',
  })
  const res = mockRes()

  await register(req, res)

  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /fullName is required/)
})

// ---------- Fix 3: Login regenerates the session id ----------

test('login: session id is regenerated after successful authentication', async () => {
  resetMocks()

  userFindUniqueResult = {
    id: 42,
    email: 'user@example.com',
    role: 'WOMAN',
    isActive: true,
    passwordHash: '$2a$12$storedhash',
    createdAt: new Date('2026-09-05T00:00:00.000Z'),
    updatedAt: new Date('2026-09-05T00:00:00.000Z'),
  }

  const req = mockLoginReq({
    email: 'user@example.com',
    password: 'pass1234',
  })
  const res = mockRes()

  const preLoginSessionId = req.session.id
  await login(req, res)

  assert.equal(res.statusCode, null, 'status should not be set (res.json sends 200 by default)')
  assert.equal(res.body.user.email, 'user@example.com')
  assert.notEqual(req.session.id, preLoginSessionId, 'session id must change to prevent fixation')
  assert.equal(req.session.user.email, 'user@example.com', 'session.user must be set after regeneration')
})

test('login: session.regenerate error → 500', async () => {
  resetMocks()

  userFindUniqueResult = {
    id: 42,
    email: 'user@example.com',
    role: 'WOMAN',
    isActive: true,
    passwordHash: '$2a$12$storedhash',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const req = {
    body: { email: 'user@example.com', password: 'pass1234' },
    session: {
      id: 'old-session',
      regenerate(cb) {
        cb(new Error('session store unavailable'))
      },
    },
  }
  const res = mockRes()

  await login(req, res)

  assert.equal(res.statusCode, 500)
  assert.equal(res.body.error, 'Login failed.')
  assert.equal(req.session.user, undefined, 'session.user must NOT be set when regeneration fails')
})

test('login: wrong password → 401 (session not regenerated)', async () => {
  resetMocks()
  bcryptCompareResult = false

  userFindUniqueResult = {
    id: 42,
    email: 'user@example.com',
    role: 'WOMAN',
    isActive: true,
    passwordHash: '$2a$12$storedhash',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  let regenerateCalled = false
  const req = {
    body: { email: 'user@example.com', password: 'wrongpassword' },
    session: {
      id: 'old-session',
      regenerate(cb) {
        regenerateCalled = true
        cb(null)
      },
    },
  }
  const res = mockRes()

  await login(req, res)

  assert.equal(res.statusCode, 401)
  assert.equal(regenerateCalled, false, 'regenerate must not be called on failed login')
})

// ---------- Fix 1: All frontend region values are valid LhwRegion enum members ----------

test('region select: every frontend option value is a valid LhwRegion enum member', () => {
  for (const value of FRONTEND_REGION_VALUES) {
    assert.ok(
      VALID_LHW_REGIONS.includes(value),
      `Frontend region value "${value}" is not in the LhwRegion enum (valid: ${VALID_LHW_REGIONS.join(', ')})`,
    )
  }
})

test('region select: frontend has no duplicate values', () => {
  const uniqueValues = new Set(FRONTEND_REGION_VALUES)
  assert.equal(
    uniqueValues.size,
    FRONTEND_REGION_VALUES.length,
    'Frontend region select must not contain duplicate option values',
  )
})

test('region select: previously broken values (GB, ICT) are no longer present', () => {
  assert.ok(
    !FRONTEND_REGION_VALUES.includes('GB'),
    'GB is not a valid LhwRegion enum value; must use GILGIT_BALTISTAN',
  )
  assert.ok(
    !FRONTEND_REGION_VALUES.includes('ICT'),
    'ICT is not a valid LhwRegion enum value; must use ISLAMABAD',
  )
})

test('region select: AJK (newly added) is present in frontend options', () => {
  assert.ok(
    FRONTEND_REGION_VALUES.includes('AJK'),
    'AJK must be present as a frontend option value after the schema migration',
  )
  assert.ok(
    VALID_LHW_REGIONS.includes('AJK'),
    'AJK must be a valid LhwRegion enum member after the migration',
  )
})

// ---------- Cleanup: restore original modules in cache ----------

delete require.cache[prismaPath]
if (originalBcryptExports) {
  require.cache[bcryptPath] = {
    id: bcryptPath,
    filename: bcryptPath,
    loaded: true,
    exports: originalBcryptExports,
  }
} else {
  delete require.cache[bcryptPath]
}
