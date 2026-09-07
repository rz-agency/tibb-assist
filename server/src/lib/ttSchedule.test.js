const test = require('node:test')
const assert = require('node:assert/strict')
const { suggestNextDose, addMonths, DOSE_INTERVAL_MONTHS, MAX_TT_DOSE } = require('./ttSchedule')

// ---------- ttSchedule.js — TT dose schedule helper ----------

test('MAX_TT_DOSE is 5', () => {
  assert.equal(MAX_TT_DOSE, 5)
})

test('DOSE_INTERVAL_MONTHS covers doses 2-5', () => {
  assert.deepEqual(DOSE_INTERVAL_MONTHS, { 2: 1, 3: 6, 4: 12, 5: 12 })
})

// ---------- addMonths ----------

test('addMonths: adds months correctly', () => {
  const base = new Date('2026-01-15T00:00:00Z')
  assert.equal(addMonths(base, 1).toISOString().slice(0, 10), '2026-02-15')
  assert.equal(addMonths(base, 6).toISOString().slice(0, 10), '2026-07-15')
  assert.equal(addMonths(base, 12).toISOString().slice(0, 10), '2027-01-15')
})

test('addMonths: clamps end-of-month (Jan 31 + 1 month → Feb 28)', () => {
  const base = new Date('2026-01-31T00:00:00Z')
  const result = addMonths(base, 1)
  assert.equal(result.toISOString().slice(0, 10), '2026-02-28')
})

test('addMonths: Aug 31 + 6 months → Feb 28 (leap-free year)', () => {
  const base = new Date('2026-08-31T00:00:00Z')
  const result = addMonths(base, 6)
  // Feb 2027 has 28 days — clamped from Aug 31
  assert.equal(result.toISOString().slice(0, 10), '2027-02-28')
})

test('addMonths: does not mutate the input date', () => {
  const base = new Date('2026-01-15T00:00:00Z')
  const before = base.getTime()
  addMonths(base, 3)
  assert.equal(base.getTime(), before)
})

// ---------- suggestNextDose ----------

test('suggestNextDose: no doses → nextDoseNumber 1, suggestedDate is today', () => {
  const result = suggestNextDose([])
  assert.equal(result.nextDoseNumber, 1)
  assert.equal(result.suggestedDate, new Date().toISOString().slice(0, 10))
  assert.equal(result.schedule.length, 5)
  assert.equal(result.schedule[0].status, 'next')
  for (let i = 1; i < 5; i++) {
    assert.equal(result.schedule[i].status, 'upcoming')
  }
})

test('suggestNextDose: TT1 done → next is TT2 (1 month after TT1)', () => {
  const tt1Date = new Date('2026-06-15')
  const result = suggestNextDose([{ doseNumber: 1, dateAdministered: tt1Date }])
  assert.equal(result.nextDoseNumber, 2)
  assert.equal(result.suggestedDate, '2026-07-15')
  assert.equal(result.schedule[0].status, 'completed')
  assert.equal(result.schedule[1].status, 'next')
})

test('suggestNextDose: TT1 + TT2 done → next is TT3 (6 months after TT2)', () => {
  const result = suggestNextDose([
    { doseNumber: 1, dateAdministered: new Date('2026-01-10') },
    { doseNumber: 2, dateAdministered: new Date('2026-02-10') },
  ])
  assert.equal(result.nextDoseNumber, 3)
  assert.equal(result.suggestedDate, '2026-08-10')
  assert.equal(result.schedule[0].status, 'completed')
  assert.equal(result.schedule[1].status, 'completed')
  assert.equal(result.schedule[2].status, 'next')
})

test('suggestNextDose: TT1-TT3 done → next is TT4 (1 year after TT3)', () => {
  const result = suggestNextDose([
    { doseNumber: 1, dateAdministered: new Date('2025-01-01') },
    { doseNumber: 2, dateAdministered: new Date('2025-02-01') },
    { doseNumber: 3, dateAdministered: new Date('2025-08-01') },
  ])
  assert.equal(result.nextDoseNumber, 4)
  assert.equal(result.suggestedDate, '2026-08-01')
})

test('suggestNextDose: TT1-TT4 done → next is TT5 (1 year after TT4)', () => {
  const result = suggestNextDose([
    { doseNumber: 1, dateAdministered: new Date('2024-01-01') },
    { doseNumber: 2, dateAdministered: new Date('2024-02-01') },
    { doseNumber: 3, dateAdministered: new Date('2024-08-01') },
    { doseNumber: 4, dateAdministered: new Date('2025-08-01') },
  ])
  assert.equal(result.nextDoseNumber, 5)
  assert.equal(result.suggestedDate, '2026-08-01')
})

test('suggestNextDose: all 5 doses done → nextDoseNumber null, suggestedDate null', () => {
  const result = suggestNextDose([
    { doseNumber: 1, dateAdministered: new Date('2023-01-01') },
    { doseNumber: 2, dateAdministered: new Date('2023-02-01') },
    { doseNumber: 3, dateAdministered: new Date('2023-08-01') },
    { doseNumber: 4, dateAdministered: new Date('2024-08-01') },
    { doseNumber: 5, dateAdministered: new Date('2025-08-01') },
  ])
  assert.equal(result.nextDoseNumber, null)
  assert.equal(result.suggestedDate, null)
  assert.equal(result.schedule.every((s) => s.status === 'completed'), true)
})

test('suggestNextDose: doses out of order → sorted correctly', () => {
  const result = suggestNextDose([
    { doseNumber: 2, dateAdministered: new Date('2026-03-01') },
    { doseNumber: 1, dateAdministered: new Date('2026-02-01') },
  ])
  assert.equal(result.nextDoseNumber, 3)
  // TT3 is 6 months after TT2 (March 1 → September 1)
  assert.equal(result.suggestedDate, '2026-09-01')
})

test('suggestNextDose: gaps in doses (TT1 + TT3, no TT2) → next is TT2', () => {
  const result = suggestNextDose([
    { doseNumber: 1, dateAdministered: new Date('2026-01-01') },
    { doseNumber: 3, dateAdministered: new Date('2026-08-01') },
  ])
  // TT2 was never logged → it's the next dose
  assert.equal(result.nextDoseNumber, 2)
  // TT2 is 1 month after TT1
  assert.equal(result.suggestedDate, '2026-02-01')
})

test('suggestNextDose: undefined input → treated as empty', () => {
  const result = suggestNextDose()
  assert.equal(result.nextDoseNumber, 1)
  assert.equal(result.schedule.length, 5)
})

test('suggestNextDose: schedule has correct statuses for mixed state', () => {
  const result = suggestNextDose([
    { doseNumber: 1, dateAdministered: new Date('2026-01-01') },
    { doseNumber: 2, dateAdministered: new Date('2026-02-01') },
  ])
  assert.deepEqual(
    result.schedule.map((s) => s.status),
    ['completed', 'completed', 'next', 'upcoming', 'upcoming'],
  )
})
