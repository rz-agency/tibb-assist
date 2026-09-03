/**
 * Gestational-age helpers.
 *
 * All date arithmetic uses UTC-only methods (getUTCFullYear / getUTCMonth /
 * getUTCDate) so that results are identical regardless of the server's
 * local timezone.  This matters when a Karachi-timezone client submits
 * "2026-01-01" and the server is running in UTC or America/New_York —
 * both must produce the same gestational-week count.
 */

const MS_PER_DAY = 86_400_000 // 24 * 60 * 60 * 1000

/**
 * Return the UTC midnight-normalised representation of a date value.
 * Accepts a Date object, an ISO date string, or null/undefined.
 * Returns null when the input is null/undefined.
 */
function toUTCDate(date) {
  if (date == null) return null

  if (date instanceof Date) {
    return new Date(Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    ))
  }

  // ISO string — parse and re-normalise.
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return new Date(Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
  ))
}

/**
 * Whole completed weeks between lmpDate and referenceDate.
 * Returns null when lmpDate is null/invalid.
 *
 * @param {Date|string|null} lmpDate
 * @param {Date|string} [referenceDate=new Date()]
 * @returns {number|null}
 */
function getGestationalWeeks(lmpDate, referenceDate = new Date()) {
  const lmp = toUTCDate(lmpDate)
  if (!lmp) return null

  const ref = toUTCDate(referenceDate)
  if (!ref) return null

  const diffMs = ref.getTime() - lmp.getTime()
  if (diffMs < 0) return 0

  return Math.floor(diffMs / (MS_PER_DAY * 7))
}

/** Preterm: gestational age < 37 completed weeks. */
function isPreterm(weeks) {
  return typeof weeks === 'number' && weeks < 37
}

/** Postterm: gestational age > 42 completed weeks. */
function isPostterm(weeks) {
  return typeof weeks === 'number' && weeks > 42
}

/**
 * Naegele's rule: due date = LMP + 280 days (40 weeks).
 * Always produces a UTC-midnight Date so Prisma stores a clean date-only
 * value with no timezone drift.
 *
 * @param {Date|string|null} lmpDate
 * @returns {Date|null}
 */
function calculateDueDate(lmpDate) {
  const lmp = toUTCDate(lmpDate)
  if (!lmp) return null

  return new Date(lmp.getTime() + 280 * MS_PER_DAY)
}

/**
 * Decorate a pregnancy record with computed gestational-age fields.
 * The week is always derived live from lmpDate — never from the stored
 * gestationalWeek column, which can be null (never entered) or stale
 * (entered weeks ago and never updated).
 * Returns a new object (does not mutate the original).
 */
function decoratePregnancy(pregnancy) {
  const gestationalWeeks = getGestationalWeeks(pregnancy.lmpDate)
  return {
    ...pregnancy,
    gestationalWeeks,
    isPostterm: gestationalWeeks != null ? isPostterm(gestationalWeeks) : null,
  }
}

module.exports = {
  getGestationalWeeks,
  isPreterm,
  isPostterm,
  calculateDueDate,
  toUTCDate,
  decoratePregnancy,
}
