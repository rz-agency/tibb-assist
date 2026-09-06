/**
 * Push notification subscription controller.
 *
 * Three endpoints:
 *   GET  /api/push/vapid-public-key — expose the VAPID public key so the
 *                                     browser can subscribe via PushManager
 *   POST /api/push/subscribe        — save or update a PushSubscription
 *   POST /api/push/unsubscribe      — remove a PushSubscription by endpoint
 *
 * All three require authentication (session cookie). The subscribe endpoint
 * also validates the incoming subscription payload shape before persisting.
 *
 * The VAPID public-key endpoint intentionally does NOT require auth so the
 * service worker registration code in main.jsx can fetch it before the user
 * has logged in (and skip gracefully if permission is later denied).
 */

const prisma = require('../lib/prisma')
const { saveSubscription, removeSubscription } = require('../lib/pushService')

function parsePositiveInteger(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function handleDatabaseError(error, res) {
  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'A duplicate record was submitted.' })
  }
  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'A related record was not found.' })
  }
  console.error('[pushController]', error.message)
  return res.status(500).json({ error: 'A database error occurred.' })
}

/** GET /api/push/vapid-public-key */
function getVapidPublicKey(req, res) {
  const publicKey = process.env.VAPID_PUBLIC_KEY || null
  if (!publicKey) {
    return res.status(503).json({ error: 'Web push is not configured on this server.' })
  }
  return res.json({ publicKey })
}

/** POST /api/push/subscribe */
async function subscribe(req, res) {
  const { endpoint, keys } = req.body

  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'endpoint must be a non-empty string.' })
  }
  if (!keys || typeof keys !== 'object' || !keys.p256dh || !keys.auth) {
    return res.status(400).json({ error: 'keys must include p256dh and auth.' })
  }

  try {
    await saveSubscription(req.user.id, { endpoint, keys })
    return res.status(201).json({ subscribed: true })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

/** POST /api/push/unsubscribe */
async function unsubscribe(req, res) {
  const { endpoint } = req.body

  if (!endpoint || typeof endpoint !== 'string') {
    return res.status(400).json({ error: 'endpoint must be a non-empty string.' })
  }

  try {
    await removeSubscription(endpoint)
    return res.json({ unsubscribed: true })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
}
