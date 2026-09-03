const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Profile controller tests (mocked prisma) ----------
//
// The Dashboard hero reads pregnancy.gestationalWeeks from the patient
// profile response, so this endpoint must decorate pregnancies with the same
// live-computed gestational-age fields as GET /api/pregnancies. The stored
// gestationalWeek column may be null or stale and must never be the display
// source. Prisma is mocked via require cache manipulation (same technique as
// checkInController.test.js and patientController.test.js).

const MS_PER_DAY = 86_400_000

// Mutable mock state — reset before each test.
let patientProfileResult = null
let upsertArgs = null

const mockPrisma = {
  patientProfile: {
    findUnique: async () => patientProfileResult,
    upsert: async (args) => {
      upsertArgs = args
      return patientProfileResult
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

const { getPatientProfile, savePatientProfile } = require('../controllers/profileController')

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
  upsertArgs = null
}

/** Profile with a single pregnancy at the given completed gestational week. */
function profileWithPregnancyAtWeek(weeks, pregnancyOverrides = {}) {
  const lmpDate = new Date(Date.now() - (weeks * 7 + 1) * MS_PER_DAY)
  return {
    id: 7,
    userId: 1,
    fullName: 'Demo Woman',
    phone: '+923004445566',
    age: 28,
    villageOrArea: 'Demo Village',
    district: 'Rawalpindi',
    province: 'Punjab',
    assignedLhwId: 3,
    createdAt: new Date('2026-08-25T21:51:36.641Z'),
    updatedAt: new Date('2026-08-25T21:51:36.641Z'),
    pregnancies: [{
      id: 7,
      patientId: 7,
      pregnancyStatus: 'ACTIVE',
      lmpDate,
      dueDate: new Date(lmpDate.getTime() + 280 * MS_PER_DAY),
      gestationalWeek: null,
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...pregnancyOverrides,
    }],
    assignedLhw: { id: 3, fullName: 'Demo LHW Ayesha', phone: '+923001112233', region: 'PUNJAB' },
    emergencyContacts: [],
  }
}

// ---------- GET /api/patients/:userId/profile ----------

test('getPatientProfile: pregnancies decorated with live gestationalWeeks (Dashboard hero data source)', async () => {
  resetMocks()
  patientProfileResult = profileWithPregnancyAtWeek(20)
  const res = mockRes()
  await getPatientProfile(mockReq({}, { userId: '1' }), res)

  const pregnancy = res.body.pregnancies[0]
  assert.equal(pregnancy.gestationalWeeks, 20)
  assert.equal(pregnancy.isPostterm, false)
  assert.equal(pregnancy.gestationalWeek, null)
  // Profile fields survive serialization untouched.
  assert.equal(res.body.fullName, 'Demo Woman')
  assert.equal(res.body.assignedLhw.fullName, 'Demo LHW Ayesha')
  // The stored record object itself is not mutated.
  assert.equal('gestationalWeeks' in patientProfileResult.pregnancies[0], false)
})

test('getPatientProfile: pregnancy without LMP → gestationalWeeks null, isPostterm null', async () => {
  resetMocks()
  patientProfileResult = profileWithPregnancyAtWeek(12, { lmpDate: null, gestationalWeek: 12 })
  const res = mockRes()
  await getPatientProfile(mockReq({}, { userId: '1' }), res)

  const pregnancy = res.body.pregnancies[0]
  assert.equal(pregnancy.gestationalWeeks, null)
  assert.equal(pregnancy.isPostterm, null)
  assert.equal(pregnancy.gestationalWeek, 12)
})

test('getPatientProfile: no profile → 404', async () => {
  resetMocks()
  const res = mockRes()
  await getPatientProfile(mockReq({}, { userId: '1' }), res)
  assert.equal(res.statusCode, 404)
  assert.equal(res.body.error, 'Patient profile not found.')
})

// ---------- PUT /api/patients/:userId/profile ----------

test('savePatientProfile: response pregnancies decorated with live gestationalWeeks too', async () => {
  resetMocks()
  patientProfileResult = profileWithPregnancyAtWeek(20)
  const res = mockRes()
  await savePatientProfile(mockReq({ fullName: 'Demo Woman Updated' }, { userId: '1' }), res)

  assert.equal(res.body.pregnancies[0].gestationalWeeks, 20)
  assert.equal(upsertArgs.where.userId, 1)
})

test('savePatientProfile: blank fullName → 400', async () => {
  resetMocks()
  const res = mockRes()
  await savePatientProfile(mockReq({ fullName: '   ' }, { userId: '1' }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.body.error, 'fullName is required.')
})
