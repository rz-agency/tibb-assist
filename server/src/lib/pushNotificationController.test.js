const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Push notification controller tests (mocked prisma) ----------
//
// Tests for the three push-subscription endpoints: vapid-public-key,
// subscribe, and unsubscribe. Validates input shape, auth requirements,
// and Prisma persistence calls. Prisma is mocked via require cache
// manipulation (same technique as followUpController.test.js).

let pushSubscriptionUpsertArgs = null
let pushSubscriptionUpsertError = null
let pushSubscriptionDeleteManyArgs = null

const mockPrisma = {
  pushSubscription: {
    upsert: async (args) => {
      if (pushSubscriptionUpsertError) {
        const err = pushSubscriptionUpsertError
        pushSubscriptionUpsertError = null
        throw err
      }
      pushSubscriptionUpsertArgs = args
      return { id: 1, ...args.create }
    },
    deleteMany: async (args) => {
      pushSubscriptionDeleteManyArgs = args
      return { count: 1 }
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

// Force VAPID env so getVapidPublicKey succeeds.
process.env.VAPID_PUBLIC_KEY = 'test-vapid-public-key-xyz'
process.env.VAPID_PRIVATE_KEY = 'test-vapid-private-key-xyz'

const {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
} = require('../controllers/pushNotificationController')

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function mockReq(body, user = { id: 10, role: 'WOMAN' }) {
  return { user, body }
}

function resetMocks() {
  pushSubscriptionUpsertArgs = null
  pushSubscriptionUpsertError = null
  pushSubscriptionDeleteManyArgs = null
}

// ── getVapidPublicKey ────────────────────────────────────────────────────────

test('getVapidPublicKey returns the public key from env', () => {
  const res = mockRes()
  getVapidPublicKey({}, res)
  assert.equal(res.statusCode, null) // 200 default
  assert.equal(res.body.publicKey, 'test-vapid-public-key-xyz')
})

test('getVapidPublicKey returns 503 when VAPID not configured', () => {
  const originalKey = process.env.VAPID_PUBLIC_KEY
  delete process.env.VAPID_PUBLIC_KEY

  const res = mockRes()
  getVapidPublicKey({}, res)
  assert.equal(res.statusCode, 503)

  process.env.VAPID_PUBLIC_KEY = originalKey
})

// ── subscribe ────────────────────────────────────────────────────────────────

test('subscribe with valid payload → 201', async () => {
  resetMocks()
  const res = mockRes()

  await subscribe(
    mockReq({
      endpoint: 'https://push.example.com/my-sub',
      keys: { p256dh: 'key1', auth: 'key2' },
    }),
    res,
  )

  assert.equal(res.statusCode, 201)
  assert.equal(res.body.subscribed, true)
  assert.equal(pushSubscriptionUpsertArgs.where.endpoint, 'https://push.example.com/my-sub')
  assert.equal(pushSubscriptionUpsertArgs.create.userId, 10)
})

test('subscribe without endpoint → 400', async () => {
  resetMocks()
  const res = mockRes()

  await subscribe(
    mockReq({ keys: { p256dh: 'a', auth: 'b' } }),
    res,
  )

  assert.equal(res.statusCode, 400)
  assert.equal(pushSubscriptionUpsertArgs, null)
})

test('subscribe without keys.p256dh → 400', async () => {
  resetMocks()
  const res = mockRes()

  await subscribe(
    mockReq({
      endpoint: 'https://push.example.com/sub',
      keys: { auth: 'b' },
    }),
    res,
  )

  assert.equal(res.statusCode, 400)
})

test('subscribe without keys.auth → 400', async () => {
  resetMocks()
  const res = mockRes()

  await subscribe(
    mockReq({
      endpoint: 'https://push.example.com/sub',
      keys: { p256dh: 'a' },
    }),
    res,
  )

  assert.equal(res.statusCode, 400)
})

test('subscribe with non-object keys → 400', async () => {
  resetMocks()
  const res = mockRes()

  await subscribe(
    mockReq({
      endpoint: 'https://push.example.com/sub',
      keys: 'not-an-object',
    }),
    res,
  )

  assert.equal(res.statusCode, 400)
})

test('subscribe with Prisma P2002 → 409', async () => {
  resetMocks()
  const p2002 = new Error('Unique constraint')
  p2002.code = 'P2002'
  pushSubscriptionUpsertError = p2002

  const res = mockRes()
  await subscribe(
    mockReq({
      endpoint: 'https://push.example.com/dup',
      keys: { p256dh: 'a', auth: 'b' },
    }),
    res,
  )

  assert.equal(res.statusCode, 409)
})

// ── unsubscribe ──────────────────────────────────────────────────────────────

test('unsubscribe with valid endpoint → 200', async () => {
  resetMocks()
  const res = mockRes()

  await unsubscribe(
    mockReq({ endpoint: 'https://push.example.com/my-sub' }),
    res,
  )

  assert.equal(res.statusCode, null) // 200 default
  assert.equal(res.body.unsubscribed, true)
  assert.equal(pushSubscriptionDeleteManyArgs.where.endpoint, 'https://push.example.com/my-sub')
})

test('unsubscribe without endpoint → 400', async () => {
  resetMocks()
  const res = mockRes()

  await unsubscribe(mockReq({}), res)

  assert.equal(res.statusCode, 400)
  assert.equal(pushSubscriptionDeleteManyArgs, null)
})
