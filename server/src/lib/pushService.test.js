const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- Push service tests (mocked prisma + mocked web-push) ----------
//
// Tests for the web-push notification service: subscription persistence,
// deduplication via PushNotificationLog, stale-subscription cleanup, and
// graceful degradation when VAPID keys are not configured.
//
// Both prisma and web-push are replaced in require.cache before the service
// is loaded (same technique as emergencyActionLog.test.js).

let sendNotificationCalls = []
let sendNotificationError = null

const mockWebPush = {
  setVapidDetails: () => {},
  sendNotification: async (sub, payload) => {
    if (sendNotificationError) {
      const err = sendNotificationError
      sendNotificationError = null
      throw err
    }
    sendNotificationCalls.push({ sub, payload })
  },
}

const webPushPath = require.resolve('web-push')
require.cache[webPushPath] = {
  id: webPushPath,
  filename: webPushPath,
  loaded: true,
  exports: mockWebPush,
}

// ── Mock prisma ──────────────────────────────────────────────────────────────

let pushSubscriptionsFindManyResult = []
let pushSubscriptionUpsertArgs = null
let pushSubscriptionDeleteManyArgs = []
let pushNotificationLogCreateResult = null  // null = success; set to Error to simulate
let pushNotificationLogCreateError = null
let lhwFindUniqueResult = null
let patientProfileFindUniqueResult = null

const mockPrisma = {
  pushSubscription: {
    findMany: async () => pushSubscriptionsFindManyResult,
    upsert: async (args) => {
      pushSubscriptionUpsertArgs = args
      return { id: 1, ...args.create }
    },
    deleteMany: async (args) => {
      pushSubscriptionDeleteManyArgs.push(args)
      return { count: 1 }
    },
  },
  pushNotificationLog: {
    create: async (args) => {
      if (pushNotificationLogCreateError) {
        const err = pushNotificationLogCreateError
        pushNotificationLogCreateError = null
        throw err
      }
      return { id: 1, ...args.data }
    },
  },
  lhw: {
    findUnique: async () => lhwFindUniqueResult,
  },
  patientProfile: {
    findUnique: async () => patientProfileFindUniqueResult,
  },
}

const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: mockPrisma,
}

// Force VAPID env so the module considers itself configured.
process.env.VAPID_PUBLIC_KEY = 'test-public-key'
process.env.VAPID_PRIVATE_KEY = 'test-private-key'

const {
  saveSubscription,
  removeSubscription,
  recordNotificationSent,
  sendToUser,
  sendCheckInDueNotification,
  sendRedAlertToLhw,
  _resetVapid,
} = require('./pushService')

// ── Helpers ──────────────────────────────────────────────────────────────────

function resetMocks() {
  _resetVapid()
  sendNotificationCalls = []
  sendNotificationError = null
  pushSubscriptionsFindManyResult = []
  pushSubscriptionUpsertArgs = null
  pushSubscriptionDeleteManyArgs = []
  pushNotificationLogCreateResult = null
  pushNotificationLogCreateError = null
  lhwFindUniqueResult = null
  patientProfileFindUniqueResult = null
}

// ── saveSubscription ─────────────────────────────────────────────────────────

test('saveSubscription upserts with endpoint as unique key', async () => {
  resetMocks()
  await saveSubscription(42, {
    endpoint: 'https://push.example.com/sub-1',
    keys: { p256dh: 'aaa', auth: 'bbb' },
  })

  assert.equal(pushSubscriptionUpsertArgs.where.endpoint, 'https://push.example.com/sub-1')
  assert.equal(pushSubscriptionUpsertArgs.create.userId, 42)
  assert.deepEqual(pushSubscriptionUpsertArgs.create.keys, { p256dh: 'aaa', auth: 'bbb' })
})

// ── removeSubscription ───────────────────────────────────────────────────────

test('removeSubscription deletes by endpoint', async () => {
  resetMocks()
  await removeSubscription('https://push.example.com/sub-1')
  assert.equal(pushSubscriptionDeleteManyArgs.length, 1)
  assert.equal(pushSubscriptionDeleteManyArgs[0].where.endpoint, 'https://push.example.com/sub-1')
})

// ── recordNotificationSent ───────────────────────────────────────────────────

test('recordNotificationSent returns true on success', async () => {
  resetMocks()
  const result = await recordNotificationSent(1, 'CHECK_IN_DUE', 'week-24')
  assert.equal(result, true)
})

test('recordNotificationSent returns false on P2002 (duplicate)', async () => {
  resetMocks()
  const p2002 = new Error('Unique constraint failed')
  p2002.code = 'P2002'
  pushNotificationLogCreateError = p2002
  const result = await recordNotificationSent(1, 'CHECK_IN_DUE', 'week-24')
  assert.equal(result, false)
})

// ── sendToUser ───────────────────────────────────────────────────────────────

test('sendToUser: no subscriptions → skips without calling web-push', async () => {
  resetMocks()
  pushSubscriptionsFindManyResult = []
  await sendToUser(1, { title: 'Test', body: 'Hi' }, 'CHECK_IN_DUE', 'week-1')
  assert.equal(sendNotificationCalls.length, 0)
})

test('sendToUser: delivers to all subscriptions and logs the notification', async () => {
  resetMocks()
  pushSubscriptionsFindManyResult = [
    { endpoint: 'https://push.example.com/sub-a', keys: { p256dh: 'a', auth: 'a' } },
    { endpoint: 'https://push.example.com/sub-b', keys: { p256dh: 'b', auth: 'b' } },
  ]

  await sendToUser(10, { title: 'Hello', body: 'World' }, 'CHECK_IN_DUE', 'week-2')

  assert.equal(sendNotificationCalls.length, 2)
  assert.equal(sendNotificationCalls[0].sub.endpoint, 'https://push.example.com/sub-a')
  assert.equal(sendNotificationCalls[1].sub.endpoint, 'https://push.example.com/sub-b')
})

test('sendToUser: 410 from push provider → cleans up stale subscription', async () => {
  resetMocks()
  pushSubscriptionsFindManyResult = [
    { endpoint: 'https://push.example.com/stale', keys: { p256dh: 'x', auth: 'x' } },
  ]
  const staleError = new Error('Subscription expired')
  staleError.statusCode = 410
  sendNotificationError = staleError

  await sendToUser(10, { title: 'Test', body: '' }, 'CHECK_IN_DUE', 'week-3')

  // Cleanup should have been called with the stale endpoint.
  assert.equal(pushSubscriptionDeleteManyArgs.length, 1)
  assert.deepEqual(pushSubscriptionDeleteManyArgs[0].where.endpoint.in, ['https://push.example.com/stale'])
})

test('sendToUser: duplicate notification (P2002 on log) → suppresses send', async () => {
  resetMocks()
  pushSubscriptionsFindManyResult = [
    { endpoint: 'https://push.example.com/sub-ok', keys: { p256dh: 'k', auth: 'k' } },
  ]
  const p2002 = new Error('Unique constraint')
  p2002.code = 'P2002'
  pushNotificationLogCreateError = p2002

  await sendToUser(10, { title: 'Dup', body: '' }, 'CHECK_IN_DUE', 'week-4')

  // The log insert failed with P2002 → recordNotificationSent returns false
  // → sendToUser returns before calling web-push.
  assert.equal(sendNotificationCalls.length, 0)
})

// ── sendCheckInDueNotification ───────────────────────────────────────────────

test('sendCheckInDueNotification: uses CHECK_IN_DUE type with week-N dedupe key', async () => {
  resetMocks()
  pushSubscriptionsFindManyResult = [
    { endpoint: 'https://push.example.com/w', keys: { p256dh: 'w', auth: 'w' } },
  ]

  await sendCheckInDueNotification(5, 22)

  assert.equal(sendNotificationCalls.length, 1)
  const payload = JSON.parse(sendNotificationCalls[0].payload)
  assert.ok(payload.title.includes('Check-In'))
  assert.ok(payload.body.includes('22'))
  assert.equal(payload.data.url, '/weekly-check-in')
})

// ── sendRedAlertToLhw ────────────────────────────────────────────────────────

test('sendRedAlertToLhw: LHW not found → skips silently', async () => {
  resetMocks()
  lhwFindUniqueResult = null
  await sendRedAlertToLhw(999, { patientId: 1, assessmentId: 42 })
  assert.equal(sendNotificationCalls.length, 0)
})

test('sendRedAlertToLhw: delivers RED alert to LHW user subscription', async () => {
  resetMocks()
  lhwFindUniqueResult = { userId: 20, fullName: 'LHW Ayesha' }
  patientProfileFindUniqueResult = { fullName: 'Sara Bibi' }
  pushSubscriptionsFindManyResult = [
    { endpoint: 'https://push.example.com/lhw', keys: { p256dh: 'lhw', auth: 'lhw' } },
  ]

  await sendRedAlertToLhw(5, { patientId: 7, assessmentId: 100 })

  assert.equal(sendNotificationCalls.length, 1)
  const payload = JSON.parse(sendNotificationCalls[0].payload)
  assert.ok(payload.title.includes('RED'))
  assert.ok(payload.body.includes('Sara Bibi'))
})
