const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Immunization controller tests (mocked prisma) ----------
//
// Immunizations are LHW-authored records of TT doses administered to
// assigned patients. WOMAN role can read her own immunizations; LHW role
// can read and create immunizations for assigned patients. Prisma is mocked
// via require-cache manipulation (same technique as homeVisitController.test.js).

// Mutable mock state — reset before each test.
let lhwFindUniqueResult = null
let patientFindFirstResult = null
let pregnancyFindFirstResult = null
let immFindManyResult = []
let immFindFirstResult = null
let immCreateResult = null
let immCreateArgs = null
let findManyWhere = null

const mockPrisma = {
  lhw: {
    findUnique: async () => lhwFindUniqueResult,
  },
  patientProfile: {
    findFirst: async () => patientFindFirstResult,
  },
  pregnancy: {
    findFirst: async () => pregnancyFindFirstResult,
  },
  immunization: {
    findMany: async (args) => {
      findManyWhere = args.where
      return immFindManyResult
    },
    findFirst: async () => immFindFirstResult,
    create: async (args) => {
      immCreateArgs = args
      return immCreateResult
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

const { listImmunizations, createImmunization } = require('../controllers/immunizationController')

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

function mockReq(overrides = {}) {
  return {
    user: overrides.user || { id: 1, role: 'WOMAN' },
    query: overrides.query || {},
    body: overrides.body || {},
  }
}

function resetMocks() {
  lhwFindUniqueResult = null
  patientFindFirstResult = null
  pregnancyFindFirstResult = null
  immFindManyResult = []
  immFindFirstResult = null
  immCreateResult = null
  immCreateArgs = null
  findManyWhere = null
}

const SAMPLE_IMM = {
  id: 1,
  patientId: 10,
  pregnancyId: 3,
  vaccineName: 'TT',
  doseNumber: 1,
  dateAdministered: new Date('2026-08-01'),
  administeredByUserId: 2,
  nextDoseDate: new Date('2026-09-01'),
  notes: 'First dose',
  createdAt: new Date('2026-08-01T10:00:00Z'),
  updatedAt: new Date('2026-08-01T10:00:00Z'),
}

// ---------- GET /api/immunizations — validation ----------

test('listImmunizations: missing patientId → 400', async () => {
  resetMocks()
  const res = mockRes()
  await listImmunizations(mockReq({ query: {} }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /patientId/)
})

test('listImmunizations: non-numeric patientId → 400', async () => {
  resetMocks()
  const res = mockRes()
  await listImmunizations(mockReq({ query: { patientId: 'abc' } }), res)
  assert.equal(res.statusCode, 400)
})

// ---------- GET /api/immunizations — access control ----------

test('listImmunizations: WOMAN sees her own immunizations scoped by userId', async () => {
  resetMocks()
  immFindManyResult = [SAMPLE_IMM]
  const res = mockRes()
  await listImmunizations(mockReq({ user: { id: 1, role: 'WOMAN' }, query: { patientId: '10' } }), res)

  assert.equal(res.statusCode, null) // 200
  assert.equal(res.body.immunizations.length, 1)
  assert.deepEqual(findManyWhere, { patientId: 10, patient: { userId: 1 } })
  // TT schedule is included in the response
  assert.equal(res.body.ttSchedule.nextDoseNumber, 2)
})

test('listImmunizations: LHW sees immunizations scoped by assignedLhwId', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  immFindManyResult = [SAMPLE_IMM]
  const res = mockRes()
  await listImmunizations(mockReq({ user: { id: 2, role: 'LHW' }, query: { patientId: '10' } }), res)

  assert.equal(res.statusCode, null)
  assert.deepEqual(findManyWhere, { patientId: 10, patient: { assignedLhwId: 5 } })
})

test('listImmunizations: LHW without lhw record → 403', async () => {
  resetMocks()
  lhwFindUniqueResult = null
  const res = mockRes()
  await listImmunizations(mockReq({ user: { id: 99, role: 'LHW' }, query: { patientId: '10' } }), res)

  assert.equal(res.statusCode, 403)
})

test('listImmunizations: ADMIN role → 403', async () => {
  resetMocks()
  const res = mockRes()
  await listImmunizations(mockReq({ user: { id: 1, role: 'ADMIN' }, query: { patientId: '10' } }), res)

  assert.equal(res.statusCode, 403)
})

test('listImmunizations: empty history → TT1 suggested, schedule all upcoming', async () => {
  resetMocks()
  immFindManyResult = []
  const res = mockRes()
  await listImmunizations(mockReq({ user: { id: 1, role: 'WOMAN' }, query: { patientId: '10' } }), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.ttSchedule.nextDoseNumber, 1)
  assert.equal(res.body.ttSchedule.schedule[0].status, 'next')
})

test('listImmunizations: all 5 doses done → nextDoseNumber null', async () => {
  resetMocks()
  immFindManyResult = [1, 2, 3, 4, 5].map((n) => ({
    ...SAMPLE_IMM,
    doseNumber: n,
    dateAdministered: new Date(`202${3 + Math.floor(n / 4)}-0${n}-01`),
  }))
  const res = mockRes()
  await listImmunizations(mockReq({ user: { id: 1, role: 'WOMAN' }, query: { patientId: '10' } }), res)

  assert.equal(res.statusCode, null)
  assert.equal(res.body.ttSchedule.nextDoseNumber, null)
  assert.equal(res.body.ttSchedule.suggestedDate, null)
})

// ---------- POST /api/immunizations — validation ----------

test('createImmunization: missing patientId → 400', async () => {
  resetMocks()
  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { vaccineName: 'TT', doseNumber: 1, dateAdministered: '2026-09-01' },
  }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /patientId/)
})

test('createImmunization: missing vaccineName → 400', async () => {
  resetMocks()
  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, doseNumber: 1, dateAdministered: '2026-09-01' },
  }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /vaccineName/)
})

test('createImmunization: non-TT vaccineName → 400 (TT only)', async () => {
  resetMocks()
  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'BCG', doseNumber: 1, dateAdministered: '2026-09-01' },
  }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /TT/)
})

test('createImmunization: doseNumber 0 → 400', async () => {
  resetMocks()
  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 0, dateAdministered: '2026-09-01' },
  }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /doseNumber/)
})

test('createImmunization: doseNumber 6 → 400 (max is 5)', async () => {
  resetMocks()
  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 6, dateAdministered: '2026-09-01' },
  }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /doseNumber/)
})

test('createImmunization: non-integer doseNumber → 400', async () => {
  resetMocks()
  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 2.5, dateAdministered: '2026-09-01' },
  }), res)
  assert.equal(res.statusCode, 400)
})

test('createImmunization: missing dateAdministered → 400', async () => {
  resetMocks()
  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 1 },
  }), res)
  assert.equal(res.statusCode, 400)
  assert.match(res.body.error, /dateAdministered/)
})

// ---------- POST /api/immunizations — access control ----------

test('createImmunization: LHW without lhw record → 403', async () => {
  resetMocks()
  lhwFindUniqueResult = null
  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 99, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 1, dateAdministered: '2026-09-01' },
  }), res)
  assert.equal(res.statusCode, 403)
  assert.match(res.body.error, /LHW/i)
})

test('createImmunization: patient not assigned to LHW → 404', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = null
  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 1, dateAdministered: '2026-09-01' },
  }), res)
  assert.equal(res.statusCode, 404)
  assert.match(res.body.error, /not found|not assigned/i)
})

test('createImmunization: pregnancyId not belonging to patient → 404', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  pregnancyFindFirstResult = null
  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 1, dateAdministered: '2026-09-01', pregnancyId: 999 },
  }), res)
  assert.equal(res.statusCode, 404)
  assert.match(res.body.error, /Pregnancy/)
})

test('createImmunization: duplicate dose (same patient + TT + doseNumber) → 409', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  immFindFirstResult = { id: 42 }
  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 1, dateAdministered: '2026-09-01' },
  }), res)
  assert.equal(res.statusCode, 409)
  assert.match(res.body.error, /already been recorded/i)
})

// ---------- POST /api/immunizations — successful creation ----------

test('createImmunization: valid TT1 → 201, nextDoseDate auto-suggested (TT2 +1 month)', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  immFindFirstResult = null
  immFindManyResult = [] // no existing doses
  immCreateResult = { ...SAMPLE_IMM }

  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 1, dateAdministered: '2026-09-01' },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(res.body.immunization.id, 1)
  assert.equal(immCreateArgs.data.patientId, 10)
  assert.equal(immCreateArgs.data.vaccineName, 'TT')
  assert.equal(immCreateArgs.data.doseNumber, 1)
  assert.equal(immCreateArgs.data.administeredByUserId, 2)
  assert.ok(immCreateArgs.data.dateAdministered instanceof Date)
  // nextDoseDate auto-suggested: TT2 = TT1 + 1 month = 2026-10-01
  assert.equal(immCreateArgs.data.nextDoseDate.toISOString().slice(0, 10), '2026-10-01')
})

test('createImmunization: TT2 logged → nextDoseDate is TT3 (+6 months)', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  immFindFirstResult = null
  immFindManyResult = [{ doseNumber: 1, dateAdministered: new Date('2026-06-01') }]
  immCreateResult = { ...SAMPLE_IMM, doseNumber: 2 }

  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 2, dateAdministered: '2026-07-01' },
  }), res)

  assert.equal(res.statusCode, 201)
  // TT3 = TT2 + 6 months = 2027-01-01
  assert.equal(immCreateArgs.data.nextDoseDate.toISOString().slice(0, 10), '2027-01-01')
})

test('createImmunization: TT5 logged → nextDoseDate null (series complete)', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  immFindFirstResult = null
  immFindManyResult = [1, 2, 3, 4].map((n) => ({
    doseNumber: n,
    dateAdministered: new Date(`2025-0${n}-01`),
  }))
  immCreateResult = { ...SAMPLE_IMM, doseNumber: 5, nextDoseDate: null }

  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 5, dateAdministered: '2026-09-01' },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(immCreateArgs.data.nextDoseDate, null)
})

test('createImmunization: explicit nextDoseDate overrides auto-suggestion', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  immFindFirstResult = null
  immFindManyResult = []
  immCreateResult = { ...SAMPLE_IMM }

  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: {
      patientId: 10, vaccineName: 'TT', doseNumber: 1,
      dateAdministered: '2026-09-01',
      nextDoseDate: '2026-12-15', // LHW override
    },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(immCreateArgs.data.nextDoseDate.toISOString().slice(0, 10), '2026-12-15')
})

test('createImmunization: pregnancyId stored when valid', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  pregnancyFindFirstResult = { id: 3 }
  immFindFirstResult = null
  immFindManyResult = []
  immCreateResult = { ...SAMPLE_IMM }

  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 1, dateAdministered: '2026-09-01', pregnancyId: 3 },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(immCreateArgs.data.pregnancyId, 3)
})

test('createImmunization: pregnancyId omitted → stored as null', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  immFindFirstResult = null
  immFindManyResult = []
  immCreateResult = { ...SAMPLE_IMM, pregnancyId: null }

  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 1, dateAdministered: '2026-09-01' },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(immCreateArgs.data.pregnancyId, null)
})

// ---------- POST /api/immunizations — notes sanitization ----------

test('createImmunization: whitespace-only notes → null', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  immFindFirstResult = null
  immFindManyResult = []
  immCreateResult = { ...SAMPLE_IMM, notes: null }

  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 1, dateAdministered: '2026-09-01', notes: '   ' },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(immCreateArgs.data.notes, null)
})

test('createImmunization: notes trimmed', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  immFindFirstResult = null
  immFindManyResult = []
  immCreateResult = { ...SAMPLE_IMM }

  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 1, dateAdministered: '2026-09-01', notes: '  Mild fever  ' },
  }), res)

  assert.equal(res.statusCode, 201)
  assert.equal(immCreateArgs.data.notes, 'Mild fever')
})

// ---------- POST /api/immunizations — database errors ----------

test('createImmunization: P2002 duplicate → 409', async () => {
  resetMocks()
  lhwFindUniqueResult = { id: 5 }
  patientFindFirstResult = { id: 10 }
  immFindFirstResult = null
  immFindManyResult = []

  const origCreate = mockPrisma.immunization.create
  mockPrisma.immunization.create = async () => {
    const err = new Error('Unique constraint failed')
    err.code = 'P2002'
    throw err
  }

  const res = mockRes()
  await createImmunization(mockReq({
    user: { id: 2, role: 'LHW' },
    body: { patientId: 10, vaccineName: 'TT', doseNumber: 1, dateAdministered: '2026-09-01' },
  }), res)

  assert.equal(res.statusCode, 409)
  assert.match(res.body.error, /duplicate/i)
  mockPrisma.immunization.create = origCreate
})

test('listImmunizations: database error → 500', async () => {
  resetMocks()
  const origFindMany = mockPrisma.immunization.findMany
  mockPrisma.immunization.findMany = async () => {
    const err = new Error('Connection lost')
    err.code = 'P1001'
    throw err
  }

  const res = mockRes()
  await listImmunizations(mockReq({ user: { id: 1, role: 'WOMAN' }, query: { patientId: '10' } }), res)

  assert.equal(res.statusCode, 500)
  assert.match(res.body.error, /database/i)
  mockPrisma.immunization.findMany = origFindMany
})
