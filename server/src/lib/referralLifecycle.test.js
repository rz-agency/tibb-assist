const test = require('node:test')
const assert = require('node:assert/strict')

const {
  LIFECYCLE_ORDER,
  TERMINAL_STATUSES,
  VALID_STATUSES,
  getAllowedTransitions,
  validateTransition,
  toCareMissionAction,
} = require('../lib/referralLifecycle')

// ── LIFECYCLE_ORDER completeness ──────────────────────────────────────────

test('LIFECYCLE_ORDER has exactly 8 stages ending with CLOSED', () => {
  assert.equal(LIFECYCLE_ORDER.length, 8)
  assert.equal(LIFECYCLE_ORDER[0], 'RECOMMENDED')
  assert.equal(LIFECYCLE_ORDER[LIFECYCLE_ORDER.length - 1], 'CLOSED')
})

test('TERMINAL_STATUSES contains CLOSED and CANCELLED only', () => {
  assert.equal(TERMINAL_STATUSES.size, 2)
  assert.ok(TERMINAL_STATUSES.has('CLOSED'))
  assert.ok(TERMINAL_STATUSES.has('CANCELLED'))
})

test('VALID_STATUSES contains all 9 statuses', () => {
  assert.equal(VALID_STATUSES.size, 9)
  for (const s of LIFECYCLE_ORDER) assert.ok(VALID_STATUSES.has(s))
  assert.ok(VALID_STATUSES.has('CANCELLED'))
})

// ── getAllowedTransitions ─────────────────────────────────────────────────

test('RECOMMENDED allows FACILITY_SELECTED and CANCELLED', () => {
  const allowed = getAllowedTransitions('RECOMMENDED')
  assert.deepEqual(allowed, ['FACILITY_SELECTED', 'CANCELLED'])
})

test('FACILITY_SELECTED allows FACILITY_CONTACTED and CANCELLED', () => {
  const allowed = getAllowedTransitions('FACILITY_SELECTED')
  assert.deepEqual(allowed, ['FACILITY_CONTACTED', 'CANCELLED'])
})

test('FACILITY_CONTACTED allows TRANSPORT_ARRANGED and CANCELLED', () => {
  const allowed = getAllowedTransitions('FACILITY_CONTACTED')
  assert.deepEqual(allowed, ['TRANSPORT_ARRANGED', 'CANCELLED'])
})

test('TRANSPORT_ARRANGED allows PATIENT_DEPARTED and CANCELLED', () => {
  const allowed = getAllowedTransitions('TRANSPORT_ARRANGED')
  assert.deepEqual(allowed, ['PATIENT_DEPARTED', 'CANCELLED'])
})

test('PATIENT_DEPARTED allows PATIENT_ARRIVED and CANCELLED', () => {
  const allowed = getAllowedTransitions('PATIENT_DEPARTED')
  assert.deepEqual(allowed, ['PATIENT_ARRIVED', 'CANCELLED'])
})

test('PATIENT_ARRIVED allows FOLLOW_UP_DUE and CANCELLED', () => {
  const allowed = getAllowedTransitions('PATIENT_ARRIVED')
  assert.deepEqual(allowed, ['FOLLOW_UP_DUE', 'CANCELLED'])
})

test('FOLLOW_UP_DUE allows CLOSED and CANCELLED', () => {
  const allowed = getAllowedTransitions('FOLLOW_UP_DUE')
  assert.deepEqual(allowed, ['CLOSED', 'CANCELLED'])
})

test('CLOSED allows nothing (terminal)', () => {
  assert.deepEqual(getAllowedTransitions('CLOSED'), [])
})

test('CANCELLED allows nothing (terminal)', () => {
  assert.deepEqual(getAllowedTransitions('CANCELLED'), [])
})

test('null/undefined returns empty', () => {
  assert.deepEqual(getAllowedTransitions(null), [])
  assert.deepEqual(getAllowedTransitions(undefined), [])
})

// ── validateTransition — valid transitions ──────────────────────────────

test('every forward step is valid', () => {
  for (let i = 0; i < LIFECYCLE_ORDER.length - 1; i++) {
    const result = validateTransition(LIFECYCLE_ORDER[i], LIFECYCLE_ORDER[i + 1])
    assert.ok(result.valid, `${LIFECYCLE_ORDER[i]} → ${LIFECYCLE_ORDER[i + 1]}`)
  }
})

test('cancellation from RECOMMENDED with note is valid', () => {
  const result = validateTransition('RECOMMENDED', 'CANCELLED', 'Patient declined referral.')
  assert.ok(result.valid)
})

test('cancellation from every non-terminal status with note is valid', () => {
  const nonTerminal = LIFECYCLE_ORDER.filter((s) => !TERMINAL_STATUSES.has(s))
  for (const status of nonTerminal) {
    const result = validateTransition(status, 'CANCELLED', 'Reason given.')
    assert.ok(result.valid, `cancellation from ${status}`)
  }
})

// ── validateTransition — invalid transitions ─────────────────────────────

test('skipped transition RECOMMENDED → FACILITY_CONTACTED rejected', () => {
  const result = validateTransition('RECOMMENDED', 'FACILITY_CONTACTED')
  assert.ok(!result.valid)
})

test('skipped transition RECOMMENDED → TRANSPORT_ARRANGED rejected', () => {
  const result = validateTransition('RECOMMENDED', 'TRANSPORT_ARRANGED')
  assert.ok(!result.valid)
})

test('CLOSED → anything rejected', () => {
  assert.ok(!validateTransition('CLOSED', 'RECOMMENDED').valid)
  assert.ok(!validateTransition('CLOSED', 'CANCELLED').valid)
})

test('CANCELLED → anything rejected', () => {
  assert.ok(!validateTransition('CANCELLED', 'RECOMMENDED').valid)
  assert.ok(!validateTransition('CANCELLED', 'CLOSED').valid)
})

test('backward transition FACILITY_CONTACTED → RECOMMENDED rejected', () => {
  const result = validateTransition('FACILITY_CONTACTED', 'RECOMMENDED')
  assert.ok(!result.valid)
})

test('same-status transition rejected', () => {
  const result = validateTransition('RECOMMENDED', 'RECOMMENDED')
  assert.ok(!result.valid)
})

// ── Cancellation requires note ───────────────────────────────────────────

test('cancellation without note rejected', () => {
  const result = validateTransition('RECOMMENDED', 'CANCELLED')
  assert.ok(!result.valid)
  assert.match(result.error, /note/i)
})

test('cancellation with empty string rejected', () => {
  const result = validateTransition('FACILITY_SELECTED', 'CANCELLED', '')
  assert.ok(!result.valid)
})

test('cancellation with whitespace-only note rejected', () => {
  const result = validateTransition('TRANSPORT_ARRANGED', 'CANCELLED', '   ')
  assert.ok(!result.valid)
})

test('cancellation with null note rejected', () => {
  const result = validateTransition('PATIENT_ARRIVED', 'CANCELLED', null)
  assert.ok(!result.valid)
})

// ── Invalid enum rejected ────────────────────────────────────────────────

test('invalid current status rejected', () => {
  const result = validateTransition('BOGUS', 'CANCELLED', 'reason')
  assert.ok(!result.valid)
})

test('invalid target status rejected', () => {
  const result = validateTransition('RECOMMENDED', 'FACILITY_ACCEPTED')
  assert.ok(!result.valid)
})

test('null target status rejected', () => {
  const result = validateTransition('RECOMMENDED', null)
  assert.ok(!result.valid)
})

// ── toCareMissionAction mapping ──────────────────────────────────────────

test('toCareMissionAction maps lifecycle statuses correctly', () => {
  assert.equal(toCareMissionAction('FACILITY_SELECTED'), 'FACILITY_SELECTED')
  assert.equal(toCareMissionAction('FACILITY_CONTACTED'), 'FACILITY_CONTACTED')
  assert.equal(toCareMissionAction('TRANSPORT_ARRANGED'), 'TRANSPORT_ARRANGED')
  assert.equal(toCareMissionAction('PATIENT_DEPARTED'), 'PATIENT_DEPARTED')
  assert.equal(toCareMissionAction('PATIENT_ARRIVED'), 'PATIENT_ARRIVED')
  assert.equal(toCareMissionAction('FOLLOW_UP_DUE'), 'REFERRAL_FOLLOW_UP_DUE')
  assert.equal(toCareMissionAction('CLOSED'), 'REFERRAL_CLOSED')
  assert.equal(toCareMissionAction('CANCELLED'), 'REFERRAL_CANCELLED')
})

test('toCareMissionAction returns null for RECOMMENDED (initial)', () => {
  assert.equal(toCareMissionAction('RECOMMENDED'), null)
})

// ── Referral sort logic (pure function) ─────────────────────────────────

const riskPriority = { RED: 0, YELLOW: 1, GREEN: 2 }

function sortReferrals(referrals) {
  return referrals.slice().sort((a, b) => {
    const riskA = a.assessment?.riskLevel
    const riskB = b.assessment?.riskLevel
    const riskDiff = (riskPriority[riskA] ?? 9) - (riskPriority[riskB] ?? 9)
    if (riskDiff !== 0) return riskDiff
    return a.referralDate.getTime() - b.referralDate.getTime()
  })
}

test('referral sort: RED before YELLOW', () => {
  const refs = [
    { assessment: { riskLevel: 'YELLOW' }, referralDate: new Date('2026-01-01') },
    { assessment: { riskLevel: 'RED' }, referralDate: new Date('2026-01-01') },
  ]
  const sorted = sortReferrals(refs)
  assert.equal(sorted[0].assessment.riskLevel, 'RED')
})

test('referral sort: same risk, oldest first', () => {
  const refs = [
    { assessment: { riskLevel: 'YELLOW' }, referralDate: new Date('2026-06-01') },
    { assessment: { riskLevel: 'YELLOW' }, referralDate: new Date('2026-01-01') },
  ]
  const sorted = sortReferrals(refs)
  assert.equal(sorted[0].referralDate.getTime(), new Date('2026-01-01').getTime())
})
