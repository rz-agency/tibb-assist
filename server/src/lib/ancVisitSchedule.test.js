const test = require('node:test')
const assert = require('node:assert/strict')
const {
  TARGET_VISIT_WEEKS,
  VISIT_MATCH_TOLERANCE,
  buildVisitSchedule,
  scheduleSummary,
} = require('./ancVisitSchedule')

const MS_PER_DAY = 86_400_000

/** Returns an LMP date that puts "now" at the given gestational week. */
function lmpForWeek(weeks) {
  return new Date(Date.now() - weeks * 7 * MS_PER_DAY)
}

// ─── Constants ───────────────────────────────────────────────────

test('TARGET_VISIT_WEEKS matches WHO 8-contact schedule', () => {
  assert.deepEqual(TARGET_VISIT_WEEKS, [12, 20, 26, 30, 34, 36, 38, 40])
})

test('VISIT_MATCH_TOLERANCE is 2 weeks', () => {
  assert.equal(VISIT_MATCH_TOLERANCE, 2)
})

// ─── buildVisitSchedule: edge cases ─────────────────────────────

test('buildVisitSchedule: null LMP → empty array', () => {
  assert.deepEqual(buildVisitSchedule(null), [])
})

test('buildVisitSchedule: undefined LMP → empty array', () => {
  assert.deepEqual(buildVisitSchedule(undefined), [])
})

// ─── buildVisitSchedule: status logic ────────────────────────────

test('buildVisitSchedule: early pregnancy (week 8) with no visits → all upcoming', () => {
  const lmp = lmpForWeek(8)
  const schedule = buildVisitSchedule(lmp, [])
  assert.equal(schedule.length, 8)
  for (const slot of schedule) {
    assert.equal(slot.status, 'upcoming')
    assert.equal(slot.actualWeek, null)
  }
})

test('buildVisitSchedule: visit numbers are 1-based sequential', () => {
  const lmp = lmpForWeek(8)
  const schedule = buildVisitSchedule(lmp, [])
  const visitNumbers = schedule.map((s) => s.visitNumber)
  assert.deepEqual(visitNumbers, [1, 2, 3, 4, 5, 6, 7, 8])
})

test('buildVisitSchedule: target weeks match WHO schedule', () => {
  const lmp = lmpForWeek(8)
  const schedule = buildVisitSchedule(lmp, [])
  const targetWeeks = schedule.map((s) => s.targetWeek)
  assert.deepEqual(targetWeeks, TARGET_VISIT_WEEKS)
})

test('buildVisitSchedule: target dates are computed from LMP', () => {
  // Use a fixed LMP for deterministic dates.
  const lmp = new Date(Date.UTC(2026, 0, 1)) // 2026-01-01
  const schedule = buildVisitSchedule(lmp, [])
  // Week 12 = 84 days after Jan 1 → Mar 26
  assert.equal(schedule[0].targetDate, '2026-03-26')
  // Week 40 = 280 days after Jan 1 → Oct 8
  assert.equal(schedule[7].targetDate, '2026-10-08')
})

test('buildVisitSchedule: completed visit matched within tolerance', () => {
  // Pregnancy at week 22 — visit logged at week 12 (exact target).
  const lmp = lmpForWeek(22)
  const visits = [{ visitNumber: 1, gestationalWeekAtVisit: 12 }]
  const schedule = buildVisitSchedule(lmp, visits)

  const slot1 = schedule[0] // target week 12
  assert.equal(slot1.status, 'completed')
  assert.equal(slot1.actualWeek, 12)

  // Week 20 target should be "behind" (current week 22 > 20, no visit near 20).
  const slot2 = schedule[1]
  assert.equal(slot2.status, 'behind')
})

test('buildVisitSchedule: visit at week 13 matches target week 12 (within ±2 tolerance)', () => {
  const lmp = lmpForWeek(22)
  const visits = [{ visitNumber: 1, gestationalWeekAtVisit: 13 }]
  const schedule = buildVisitSchedule(lmp, visits)
  assert.equal(schedule[0].status, 'completed')
  assert.equal(schedule[0].actualWeek, 13)
})

test('buildVisitSchedule: visit at week 15 does NOT match target week 12 (outside tolerance)', () => {
  const lmp = lmpForWeek(22)
  const visits = [{ visitNumber: 1, gestationalWeekAtVisit: 15 }]
  const schedule = buildVisitSchedule(lmp, visits)
  // Week 12 target should be "behind" (no match within ±2).
  assert.equal(schedule[0].status, 'behind')
})

test('buildVisitSchedule: behind status for past target weeks without visits', () => {
  // Pregnancy at week 32 — weeks 12, 20, 26, 30 are all behind.
  const lmp = lmpForWeek(32)
  const schedule = buildVisitSchedule(lmp, [])
  const statuses = schedule.map((s) => s.status)
  // First 4 targets (12, 20, 26, 30) should be behind.
  assert.equal(statuses[0], 'behind') // 12
  assert.equal(statuses[1], 'behind') // 20
  assert.equal(statuses[2], 'behind') // 26
  assert.equal(statuses[3], 'behind') // 30
  // Week 34 is upcoming (32 < 34).
  assert.equal(statuses[4], 'upcoming') // 34
})

test('buildVisitSchedule: multiple visits correctly matched', () => {
  const lmp = lmpForWeek(36)
  const visits = [
    { visitNumber: 1, gestationalWeekAtVisit: 12 },
    { visitNumber: 2, gestationalWeekAtVisit: 20 },
    { visitNumber: 3, gestationalWeekAtVisit: 26 },
    { visitNumber: 4, gestationalWeekAtVisit: 30 },
    { visitNumber: 5, gestationalWeekAtVisit: 35 },
  ]
  const schedule = buildVisitSchedule(lmp, visits)
  // First 4 completed, week 34 matched by visit at 35 (within ±2).
  assert.equal(schedule[0].status, 'completed') // 12
  assert.equal(schedule[1].status, 'completed') // 20
  assert.equal(schedule[2].status, 'completed') // 26
  assert.equal(schedule[3].status, 'completed') // 30
  assert.equal(schedule[4].status, 'completed') // 34 → matched by 35
  // Week 36 target is also matched by visit at 35 (diff=1, within ±2).
  assert.equal(schedule[5].status, 'completed') // 36 → also matched by 35
  // Week 38 is upcoming (36 < 38).
  assert.equal(schedule[6].status, 'upcoming')
})

test('buildVisitSchedule: closest visit wins when multiple are within tolerance', () => {
  const lmp = lmpForWeek(22)
  // Two visits near target week 12: at weeks 11 and 13.
  const visits = [
    { visitNumber: 1, gestationalWeekAtVisit: 11 },
    { visitNumber: 2, gestationalWeekAtVisit: 13 },
  ]
  const schedule = buildVisitSchedule(lmp, visits)
  // Week 12 target: visit at 11 is closer (diff=1) than 13 (diff=1) — but
  // sort is stable, so the first one in the array with same diff wins.
  assert.equal(schedule[0].status, 'completed')
  assert.equal(schedule[0].actualWeek, 11)
})

test('buildVisitSchedule: visit with null gestationalWeekAtVisit is ignored', () => {
  const lmp = lmpForWeek(22)
  const visits = [{ visitNumber: 1, gestationalWeekAtVisit: null }]
  const schedule = buildVisitSchedule(lmp, visits)
  assert.equal(schedule[0].status, 'behind') // week 12 not matched
  assert.equal(schedule[0].actualWeek, null)
})

// ─── scheduleSummary ─────────────────────────────────────────────

test('scheduleSummary: correct counts for mixed statuses', () => {
  const schedule = [
    { status: 'completed' },
    { status: 'completed' },
    { status: 'behind' },
    { status: 'upcoming' },
    { status: 'upcoming' },
    { status: 'upcoming' },
    { status: 'upcoming' },
    { status: 'upcoming' },
  ]
  const summary = scheduleSummary(schedule)
  assert.equal(summary.completed, 2)
  assert.equal(summary.behind, 1)
  assert.equal(summary.upcoming, 5)
  assert.equal(summary.total, 8)
})

test('scheduleSummary: empty schedule → all zeros', () => {
  const summary = scheduleSummary([])
  assert.deepEqual(summary, { completed: 0, behind: 0, upcoming: 0, total: 0 })
})

test('scheduleSummary: all completed', () => {
  const schedule = TARGET_VISIT_WEEKS.map(() => ({ status: 'completed' }))
  const summary = scheduleSummary(schedule)
  assert.equal(summary.completed, 8)
  assert.equal(summary.behind, 0)
  assert.equal(summary.total, 8)
})
