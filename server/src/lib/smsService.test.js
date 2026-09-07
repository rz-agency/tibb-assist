const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- SMS service tests ----------
//
// Tests that the SMS service no-ops correctly when Twilio credentials are not
// configured, and that sendCheckInDueSms / sendRedAlertSms handle missing
// phone numbers gracefully.

// Clear any Twilio env vars so the module enters no-op mode.
delete process.env.TWILIO_ACCOUNT_SID
delete process.env.TWILIO_AUTH_TOKEN
delete process.env.TWILIO_FROM_NUMBER

const {
  isConfigured,
  sendSms,
  sendCheckInDueSms,
  sendRedAlertSms,
} = require('./smsService')

// ── isConfigured ─────────────────────────────────────────────────────────────

test('isConfigured returns false when env vars are not set', () => {
  assert.equal(isConfigured(), false)
})

// ── sendSms (no-op mode) ─────────────────────────────────────────────────────

test('sendSms returns null in no-op mode', async () => {
  const result = await sendSms('+923001234567', 'Test message')
  assert.equal(result, null)
})

// ── sendCheckInDueSms ────────────────────────────────────────────────────────

test('sendCheckInDueSms with phone returns null (no-op)', async () => {
  const result = await sendCheckInDueSms('+923001234567', 24)
  assert.equal(result, null)
})

test('sendCheckInDueSms without phone returns null (no phone)', async () => {
  const result = await sendCheckInDueSms(null, 24)
  assert.equal(result, null)
})

test('sendCheckInDueSms with empty string phone returns null', async () => {
  const result = await sendCheckInDueSms('', 24)
  assert.equal(result, null)
})

// ── sendRedAlertSms ──────────────────────────────────────────────────────────

test('sendRedAlertSms with phone returns null (no-op)', async () => {
  const result = await sendRedAlertSms('+923001234567', 'Sara Bibi')
  assert.equal(result, null)
})

test('sendRedAlertSms without phone returns null', async () => {
  const result = await sendRedAlertSms(null, 'Sara Bibi')
  assert.equal(result, null)
})
