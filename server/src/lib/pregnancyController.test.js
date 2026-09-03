const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Pregnancy controller tests (mocked prisma) ----------
//
// Regression guard for the "Gestational Week: Not recorded" bug: the
// pregnancy API must return gestationalWeeks computed LIVE from lmpDate
// (gestationalAge.js). The stored gestationalWeek column may be null (never
// entered — the demo-account case) or stale (entered once and never updated —
// the seeded demo record), so it must never be the display source. We mock
// prisma via require cache manipulation (same technique as
// checkInController.test.js and patientController.test.js).

const MS_PER_DAY = 86_400_000

// Mutable mock state — reset before each test.
let patientProfileResult = null
let pregnanciesResult = []
let createdPregnancyArgs = null
let updatedPregnancyArgs = null
let findFirstResult = null

const mockPrisma = {
  patientProfile: {
    findUnique: async () => patientProfileResult,
  },
  pregnancy: {
    findMany: async () => pregnanciesResult,
    create: async (args) => {
      createdPregnancyArgs = args
      return { id: 11, ...args.data }
    },
    findFirst: async () => findFirstResult,
    update: async (args) => {
      updatedPregnancyArgs = args
      return { id: 11, ...args.data }
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

const { listPregnancies, createPregnancy, updatePregnancy } = require('../controllers/pregnancyController')

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
  pregnanciesResult = []
  createdPregnancyArgs = null
  updatedPregnancyArgs = null
  findFirstResult = null
}

/** Pregnancy DB row at the given completed gestational week (weeks * 7 + 1 days ago). */
function pregnancyAtWeek(weeks, overrides = {}) {
  const lmpDate = new Date(Date.now() - (weeks * 7 + 1) * MS_PER_DAY)
  return {
    id: 7,
    patientId: 7,
    pregnancyStatus: 'ACTIVE',
    lmpDate,
    dueDate: new Date(lmpDate.getTime() + 280 * MS_PER_DAY),
    gestationalWeek: null,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/** Date-only LMP string at the given completed gestational week, like the client form sends. */
function lmpDateOnlyAtWeek(weeks) {
  return new Date(Date.now() - (weeks * 7 + 1) * MS_PER_DAY).toISOString().slice(0, 10)
}

// ---------- GET /api/pregnancies ----------

test('list: valid LMP with null stored week → gestationalWeeks computed live (demo-account "Not recorded" regression)', async () => {
  resetMocks()
  patientProfileResult = { id: 7 }
  pregnanciesResult = [pregnancyAtWeek(20)]
  const res = mockRes()
  await listPregnancies(mockReq(), res)

  const pregnancy = res.body.pregnancies[0]
  assert.equal(pregnancy.gestationalWeeks, 20)
  assert.equal(pregnancy.gestationalWeek, null)
  assert.equal(pregnancy.isPostterm, false)
})

test('list: stale stored week loses to live computation from LMP', async () => {
  resetMocks()
  patientProfileResult = { id: 7 }
  pregnanciesResult = [pregnancyAtWeek(29, { gestationalWeek: 28 })]
  const res = mockRes()
  await listPregnancies(mockReq(), res)

  assert.equal(res.body.pregnancies[0].gestationalWeeks, 29)
  assert.equal(res.body.pregnancies[0].gestationalWeek, 28)
})

test('list: pregnancy without LMP → gestationalWeeks null so the client can fall back to the stored week', async () => {
  resetMocks()
  patientProfileResult = { id: 7 }
  pregnanciesResult = [pregnancyAtWeek(12, { lmpDate: null, gestationalWeek: 12 })]
  const res = mockRes()
  await listPregnancies(mockReq(), res)

  const pregnancy = res.body.pregnancies[0]
  assert.equal(pregnancy.gestationalWeeks, null)
  assert.equal(pregnancy.gestationalWeek, 12)
  assert.equal(pregnancy.isPostterm, null)
})

test('list: postterm pregnancy → isPostterm true', async () => {
  resetMocks()
  patientProfileResult = { id: 7 }
  pregnanciesResult = [pregnancyAtWeek(43)]
  const res = mockRes()
  await listPregnancies(mockReq(), res)

  assert.equal(res.body.pregnancies[0].gestationalWeeks, 43)
  assert.equal(res.body.pregnancies[0].isPostterm, true)
})

test('list: no patient profile → 404', async () => {
  resetMocks()
  const res = mockRes()
  await listPregnancies(mockReq(), res)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'Patient profile not found.')
})

// ---------- POST /api/pregnancies ----------

test('create: LMP-only payload (date-only string) → Naegele due date + live gestationalWeeks', async () => {
  resetMocks()
  patientProfileResult = { id: 7 }
  const lmpDateOnly = lmpDateOnlyAtWeek(20)
  const res = mockRes()
  await createPregnancy(mockReq({
    pregnancyStatus: 'ACTIVE',
    lmpDate: lmpDateOnly,
    dueDate: null,
    gestationalWeek: null,
    notes: null,
  }), res)

  assert.equal(res.statusCode, 201)
  const pregnancy = res.body.pregnancy
  assert.equal(pregnancy.gestationalWeeks, 20)
  assert.equal(pregnancy.gestationalWeek, null)
  // Naegele's rule: due date = LMP + 280 days.
  const expectedDue = new Date(`${lmpDateOnly}T00:00:00.000Z`).getTime() + 280 * MS_PER_DAY
  assert.equal(new Date(pregnancy.dueDate).getTime(), expectedDue)
})

// ---------- PUT /api/pregnancies/:id ----------

test('update: response decorated with live gestationalWeeks', async () => {
  resetMocks()
  patientProfileResult = { id: 7 }
  findFirstResult = { id: 11 }
  const res = mockRes()
  await updatePregnancy(mockReq({
    pregnancyStatus: 'ACTIVE',
    lmpDate: lmpDateOnlyAtWeek(20),
    dueDate: null,
    gestationalWeek: null,
    notes: null,
  }, { id: '11' }), res)

  assert.equal(res.body.pregnancy.gestationalWeeks, 20)
  assert.equal(updatedPregnancyArgs.where.id, 11)
})

test('update: pregnancy owned by another patient → 404', async () => {
  resetMocks()
  patientProfileResult = { id: 7 }
  findFirstResult = null
  const res = mockRes()
  await updatePregnancy(mockReq({
    pregnancyStatus: 'ACTIVE',
    lmpDate: '2026-08-05',
    dueDate: null,
    gestationalWeek: null,
    notes: null,
  }, { id: '11' }), res)

  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'Pregnancy not found.')
})
