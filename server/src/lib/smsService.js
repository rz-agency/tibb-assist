/**
 * SMS notification service (optional stretch goal).
 *
 * Gated behind three env vars — if ANY is missing the service operates in
 * no-op mode: every call logs a one-line notice and returns null. This keeps
 * the build demoable without real SMS credentials.
 *
 * When configured, uses the Twilio REST API (via node-fetch which is already
 * available as a transitive dependency of web-push, but we use the global
 * fetch available in Node 18+) to send messages.
 *
 * Required env vars for real delivery:
 *   TWILIO_ACCOUNT_SID  — Twilio account SID
 *   TWILIO_AUTH_TOKEN   — Twilio auth token
 *   TWILIO_FROM_NUMBER  — Twilio-allocated phone number in E.164 format
 */

const configured = Boolean(
  process.env.TWILIO_ACCOUNT_SID
  && process.env.TWILIO_AUTH_TOKEN
  && process.env.TWILIO_FROM_NUMBER,
)

if (!configured) {
  console.log('[smsService] SMS provider not configured — all sends will no-op.')
}

/**
 * Returns true when real SMS delivery is available.
 */
function isConfigured() {
  return configured
}

/**
 * Send an SMS message to `to`.
 *
 * In no-op mode, logs the intended message and returns null.
 * In configured mode, calls the Twilio Messages API and returns the response
 * JSON (or throws on network/auth failure — callers should catch).
 *
 * @param {string} to     - Recipient phone number in E.164 format (e.g. +923001234567)
 * @param {string} body   - Message text (max 1600 chars per Twilio limit)
 * @returns {Promise<object|null>} Twilio message resource or null (no-op)
 */
async function sendSms(to, body) {
  if (!configured) {
    console.log(`[smsService] (no-op) Would send SMS to ${to}: ${body.slice(0, 80)}…`)
    return null
  }

  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER } = process.env
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`

  const formBody = new URLSearchParams({
    To: to,
    From: TWILIO_FROM_NUMBER,
    Body: body.slice(0, 1600),
  })

  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formBody.toString(),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Twilio API error ${response.status}: ${errorText}`)
  }

  return response.json()
}

/**
 * Convenience: send a check-in due reminder SMS.
 * No-op when the service is unconfigured or no phone number is available.
 */
async function sendCheckInDueSms(phone, gestationalWeek) {
  if (!phone) {
    console.log('[smsService] No phone number — skipping check-in due SMS.')
    return null
  }
  return sendSms(phone, `Your week ${gestationalWeek} check-in is due. Open Tibb Assist to complete it.`)
}

/**
 * Convenience: send a RED assessment alert SMS to the LHW.
 * No-op when the service is unconfigured or no phone number is available.
 */
async function sendRedAlertSms(phone, patientName) {
  if (!phone) {
    console.log('[smsService] No phone number — skipping RED alert SMS.')
    return null
  }
  return sendSms(phone, `URGENT: ${patientName} has a new RED assessment. Please review immediately.`)
}

module.exports = {
  isConfigured,
  sendSms,
  sendCheckInDueSms,
  sendRedAlertSms,
}
