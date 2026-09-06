const test = require('node:test')
const assert = require('node:assert/strict')
const {
  getGestationalWeeks,
  isPreterm,
  isPostterm,
  getTrimester,
  calculateDueDate,
  toUTCDate,
  decoratePregnancy,
} = require('./gestationalAge')

const MS_PER_DAY = 86_400_000

// ─── getGestationalWeeks ──────────────────────────────────────────

test('getGestationalWeeks: null lmpDate → null', () => {
  assert.equal(getGestationalWeeks(null, new Date()), null)
})

test('getGestationalWeeks: undefined lmpDate → null', () => {
  assert.equal(getGestationalWeeks(undefined, new Date()), null)
})

test('getGestationalWeeks: 0 weeks (same day)', () => {
  const today = new Date('2026-06-01')
  assert.equal(getGestationalWeeks(today, today), 0)
})

test('getGestationalWeeks: exactly 37 weeks → 37', () => {
  const lmp = new Date('2026-01-01')
  const ref = new Date(lmp.getTime() + 37 * 7 * MS_PER_DAY)
  assert.equal(getGestationalWeeks(lmp, ref), 37)
})

test('getGestationalWeeks: 36 weeks + 6 days → 36', () => {
  const lmp = new Date('2026-01-01')
  const ref = new Date(lmp.getTime() + (36 * 7 + 6) * MS_PER_DAY)
  assert.equal(getGestationalWeeks(lmp, ref), 36)
})

test('getGestationalWeeks: exactly 42 weeks → 42', () => {
  const lmp = new Date('2026-01-01')
  const ref = new Date(lmp.getTime() + 42 * 7 * MS_PER_DAY)
  assert.equal(getGestationalWeeks(lmp, ref), 42)
})

test('getGestationalWeeks: 43 weeks → 43', () => {
  const lmp = new Date('2026-01-01')
  const ref = new Date(lmp.getTime() + 43 * 7 * MS_PER_DAY)
  assert.equal(getGestationalWeeks(lmp, ref), 43)
})

test('getGestationalWeeks: future LMP → 0', () => {
  const lmp = new Date('2026-12-01')
  const ref = new Date('2026-06-01')
  assert.equal(getGestationalWeeks(lmp, ref), 0)
})

test('getGestationalWeeks: ISO string input works', () => {
  // 2026-01-01 → 2026-09-17 = 260 days = 37.14 weeks → 37
  assert.equal(getGestationalWeeks('2026-01-01', '2026-09-17'), 37)
})

// ─── isPreterm ────────────────────────────────────────────────────

test('isPreterm: 36 weeks → true', () => {
  assert.equal(isPreterm(36), true)
})

test('isPreterm: 37 weeks → false (boundary)', () => {
  assert.equal(isPreterm(37), false)
})

test('isPreterm: 0 weeks → true', () => {
  assert.equal(isPreterm(0), true)
})

test('isPreterm: null → false', () => {
  assert.equal(isPreterm(null), false)
})

// ─── isPostterm ───────────────────────────────────────────────────

test('isPostterm: 42 weeks → false (boundary)', () => {
  assert.equal(isPostterm(42), false)
})

test('isPostterm: 43 weeks → true', () => {
  assert.equal(isPostterm(43), true)
})

test('isPostterm: 37 weeks → false', () => {
  assert.equal(isPostterm(37), false)
})

test('isPostterm: null → false', () => {
  assert.equal(isPostterm(null), false)
})

// ─── calculateDueDate ─────────────────────────────────────────────

test('calculateDueDate: "2026-01-01" → "2026-10-08"', () => {
  const due = calculateDueDate('2026-01-01')
  assert.ok(due instanceof Date)
  // Compare as ISO date string to avoid timezone issues.
  assert.equal(due.toISOString().slice(0, 10), '2026-10-08')
})

test('calculateDueDate: null → null', () => {
  assert.equal(calculateDueDate(null), null)
})

test('calculateDueDate: Date object input works', () => {
  const lmp = new Date(Date.UTC(2026, 0, 1)) // Jan 1 2026 UTC
  const due = calculateDueDate(lmp)
  assert.equal(due.toISOString().slice(0, 10), '2026-10-08')
})

test('calculateDueDate: produces UTC-midnight Date (no time drift)', () => {
  const due = calculateDueDate('2026-06-15')
  assert.equal(due.getUTCHours(), 0)
  assert.equal(due.getUTCMinutes(), 0)
  assert.equal(due.getUTCSeconds(), 0)
})

// ─── Timezone stability ───────────────────────────────────────────

test('timezone stability: "2026-01-01" always → due 2026-10-08 regardless of server TZ', () => {
  // This test would catch the bug where local-time methods (getFullYear /
  // getMonth / getDate) are used instead of UTC methods.  A server running
  // in UTC-6 would shift "2026-01-01T00:00:00Z" back to Dec 31 18:00 local
  // time, producing Dec 31 instead of Jan 1 when local methods are used.
  const input = '2026-01-01'
  const due = calculateDueDate(input)
  assert.equal(due.toISOString().slice(0, 10), '2026-10-08')

  const weeks = getGestationalWeeks(
    input,
    new Date(input).getTime() + 20 * 7 * MS_PER_DAY, // exactly 20 weeks later
  )
  assert.equal(weeks, 20)
})

test('toUTCDate: normalises a Date to UTC midnight', () => {
  // Simulate a Date that could be off by timezone offset.
  const localMidnight = new Date(2026, 0, 1, 0, 0, 0) // local midnight
  const normalised = toUTCDate(localMidnight)
  // The normalised date must have UTC hours/minutes/seconds = 0.
  assert.equal(normalised.getUTCHours(), 0)
  assert.equal(normalised.getUTCMinutes(), 0)
})

// ─── getTrimester ────────────────────────────────────────────────

test('getTrimester: null → null', () => {
  assert.equal(getTrimester(null), null)
})

test('getTrimester: undefined → null', () => {
  assert.equal(getTrimester(undefined), null)
})

test('getTrimester: 0 weeks → 1 (first trimester)', () => {
  assert.equal(getTrimester(0), 1)
})

test('getTrimester: 13 weeks → 1 (last week of first trimester)', () => {
  assert.equal(getTrimester(13), 1)
})

test('getTrimester: 14 weeks → 2 (first week of second trimester)', () => {
  assert.equal(getTrimester(14), 2)
})

test('getTrimester: 27 weeks → 2 (last week of second trimester)', () => {
  assert.equal(getTrimester(27), 2)
})

test('getTrimester: 28 weeks → 3 (first week of third trimester)', () => {
  assert.equal(getTrimester(28), 3)
})

test('getTrimester: 40 weeks → 3 (full term)', () => {
  assert.equal(getTrimester(40), 3)
})

test('getTrimester: 43 weeks → 3 (postterm still trimester 3)', () => {
  assert.equal(getTrimester(43), 3)
})

// ─── decoratePregnancy: trimester field ──────────────────────────

test('decoratePregnancy: includes trimester field (first trimester)', () => {
  // 8 weeks ago → trimester 1
  const lmpDate = new Date(Date.now() - 8 * 7 * MS_PER_DAY)
  const result = decoratePregnancy({ id: 1, lmpDate, dueDate: null })
  assert.equal(result.gestationalWeeks, 8)
  assert.equal(result.trimester, 1)
})

test('decoratePregnancy: includes trimester field (second trimester)', () => {
  // 20 weeks ago → trimester 2
  const lmpDate = new Date(Date.now() - 20 * 7 * MS_PER_DAY)
  const result = decoratePregnancy({ id: 2, lmpDate, dueDate: null })
  assert.equal(result.gestationalWeeks, 20)
  assert.equal(result.trimester, 2)
})

test('decoratePregnancy: includes trimester field (third trimester)', () => {
  // 32 weeks ago → trimester 3
  const lmpDate = new Date(Date.now() - 32 * 7 * MS_PER_DAY)
  const result = decoratePregnancy({ id: 3, lmpDate, dueDate: null })
  assert.equal(result.gestationalWeeks, 32)
  assert.equal(result.trimester, 3)
})

test('decoratePregnancy: trimester null when lmpDate is null', () => {
  const result = decoratePregnancy({ id: 4, lmpDate: null, dueDate: null })
  assert.equal(result.gestationalWeeks, null)
  assert.equal(result.trimester, null)
})
