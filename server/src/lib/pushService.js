/**
 * Web Push notification service.
 *
 * Uses VAPID keys (configured via VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env
 * vars) to deliver Web Push messages to browsers that have granted permission.
 *
 * Two notification triggers:
 *   - CHECK_IN_DUE:         a weekly check-in becomes due for a patient
 *   - RED_ASSESSMENT_ALERT: an LHW's assigned patient produces a RED assessment
 *
 * Delivery is best-effort: any error (no subscriptions, push provider rejects
 * the endpoint, network failure) is logged and skipped. Expired or invalid
 * subscriptions (HTTP 404 / 410 from the push provider) are pruned from the
 * database automatically.
 *
 * Deduplication uses the PushNotificationLog table with a composite unique
 * constraint on [userId, notificationType, dedupeKey]. If a log row already
 * exists for the same trigger, the send is skipped — this prevents repeat
 * notifications when the client polls the check-in due endpoint on every
 * dashboard load.
 */

const webpush = require('web-push')
const prisma = require('./prisma')

// Lazy VAPID initialisation — checked on first use rather than at module
// load so that test files can set/clear env vars before the service is
// exercised, regardless of require-order across test files.
let _vapidReady = null

function ensureVapid() {
  if (_vapidReady !== null) return _vapidReady
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (pub && priv) {
    webpush.setVapidDetails('mailto:tibb-assist@localhost', pub, priv)
    _vapidReady = true
  } else {
    console.warn('[pushService] VAPID keys not configured — web push notifications disabled.')
    _vapidReady = false
  }
  return _vapidReady
}

function isConfigured() {
  return ensureVapid()
}

/**
 * Persist or update a push subscription for the given user.
 * Uses upsert on the unique `endpoint` column so re-subscribing from the same
 * browser simply refreshes the keys.
 */
async function saveSubscription(userId, { endpoint, keys }) {
  return prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId, keys },
    create: { userId, endpoint, keys },
  })
}

/**
 * Remove a subscription by endpoint (called when the user unsubscribes or
 * when the push provider returns 404/410 for an expired subscription).
 */
async function removeSubscription(endpoint) {
  return prisma.pushSubscription.deleteMany({ where: { endpoint } })
}

/**
 * Record that a notification of `notificationType` with `dedupeKey` has been
 * sent to `userId`. Returns true if the log row was created (first send),
 * false if a duplicate was detected (Prisma P2002 unique-violation error).
 */
async function recordNotificationSent(userId, notificationType, dedupeKey) {
  try {
    await prisma.pushNotificationLog.create({
      data: { userId, notificationType, dedupeKey },
    })
    return true
  } catch (error) {
    if (error.code === 'P2002') {
      return false
    }
    console.error('[pushService] Failed to record notification log:', error.message)
    return false
  }
}

/**
 * Send a web-push payload to all active subscriptions for `userId`.
 *
 * @param {number} userId - Recipient user ID
 * @param {object} payload - JSON-serializable notification body
 * @param {string} notificationType - 'CHECK_IN_DUE' | 'RED_ASSESSMENT_ALERT'
 * @param {string} dedupeKey - Deduplication key (e.g. 'week-24')
 */
async function sendToUser(userId, payload, notificationType, dedupeKey) {
  if (!ensureVapid()) {
    console.log('[pushService] Skipping push (VAPID not configured):', { userId, notificationType, dedupeKey })
    return
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
    select: { endpoint: true, keys: true },
  })

  if (subscriptions.length === 0) {
    console.log('[pushService] No subscriptions for user', userId, '— skipping', notificationType)
    return
  }

  const logged = await recordNotificationSent(userId, notificationType, dedupeKey)
  if (!logged) {
    console.log('[pushService] Duplicate notification suppressed:', { userId, notificationType, dedupeKey })
    return
  }

  const body = JSON.stringify(payload)
  const staleEndpoints = []

  const deliveries = subscriptions.map(async (sub) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        body,
      )
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        staleEndpoints.push(sub.endpoint)
      }
      // Graceful degradation: log and skip (never throws up to caller).
      console.error('[pushService] Delivery failed for', sub.endpoint, ':', error.message)
    }
  })

  await Promise.allSettled(deliveries)

  if (staleEndpoints.length > 0) {
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: { in: staleEndpoints } },
    }).catch((err) => console.error('[pushService] Cleanup of stale endpoints failed:', err.message))
  }
}

/**
 * Notify a patient that their weekly check-in is due.
 *
 * Called from checkInController.getDueStatus when the response is about to
 * return { due: true }. Dedupe key is `week-${gestationalWeek}` so at most
 * one push is sent per gestational week.
 */
async function sendCheckInDueNotification(userId, gestationalWeek) {
  try {
    await sendToUser(
      userId,
      {
        title: 'Weekly Check-In Due',
        body: `It's time for your week ${gestationalWeek} check-in. Tap to complete it now.`,
        data: { url: '/weekly-check-in' },
      },
      'CHECK_IN_DUE',
      `week-${gestationalWeek}`,
    )
  } catch (error) {
    console.error('[pushService] sendCheckInDueNotification error:', error.message)
  }
}

/**
 * Notify the LHW assigned to a patient that a new RED assessment was created.
 *
 * Called from assessmentController.createAssessment after the transaction
 * commits. Only fires when the patient has an assigned LHW. The LHW's userId
 * (used for the PushSubscription lookup) is resolved from the Lhw table.
 */
async function sendRedAlertToLhw(assignedLhwId, { patientId, assessmentId }) {
  try {
    const lhw = await prisma.lhw.findUnique({
      where: { id: assignedLhwId },
      select: { userId: true, fullName: true },
    })
    if (!lhw) {
      console.log('[pushService] LHW not found for id', assignedLhwId, '— skipping RED alert')
      return
    }

    const patient = await prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: { fullName: true },
    })
    const patientName = patient ? patient.fullName : `Patient #${patientId}`

    await sendToUser(
      lhw.userId,
      {
        title: 'RED Assessment Alert',
        body: `${patientName} has a new RED assessment. Immediate review is recommended.`,
        data: { url: `/assessments/${assessmentId}` },
      },
      'RED_ASSESSMENT_ALERT',
      `assessment-${assessmentId}`,
    )
  } catch (error) {
    console.error('[pushService] sendRedAlertToLhw error:', error.message)
  }
}

module.exports = {
  isConfigured,
  saveSubscription,
  removeSubscription,
  recordNotificationSent,
  sendToUser,
  sendCheckInDueNotification,
  sendRedAlertToLhw,
  // Test-only hook: resets the lazy VAPID cache so env changes take effect.
  _resetVapid: () => { _vapidReady = null },
}
