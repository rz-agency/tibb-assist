/**
 * ANC visit schedule helper.
 *
 * WHO-recommended antenatal-care contact schedule (minimum 8 contacts):
 *   Week 12, 20, 26, 30, 34, 36, 38, 40
 *
 * Given a pregnancy's LMP date and existing visit records, this module
 * produces a display-only schedule that flags each target visit as:
 *   - "completed"  — a visit was logged at or near this target week
 *   - "behind"     — the target week has passed without a logged visit
 *   - "upcoming"   — the target week has not yet been reached
 *
 * This is purely informational — it is NOT wired into riskAssessment.js.
 */

const { getGestationalWeeks, toUTCDate } = require('./gestationalAge')

const MS_PER_DAY = 86_400_000

/** Standard WHO-recommended target visit weeks. */
const TARGET_VISIT_WEEKS = [12, 20, 26, 30, 34, 36, 38, 40]

/**
 * A visit counts as "completed" for a target week if its actual
 * gestationalWeekAtVisit is within this tolerance (±weeks).
 */
const VISIT_MATCH_TOLERANCE = 2

/**
 * Build the target schedule for a pregnancy.
 *
 * @param {Date|string|null} lmpDate - Last menstrual period date
 * @param {Array<{visitNumber: number, gestationalWeekAtVisit: number|null}>} existingVisits
 * @returns {Array<{visitNumber: number, targetWeek: number, targetDate: string|null, status: string, actualWeek: number|null}>}
 */
function buildVisitSchedule(lmpDate, existingVisits = []) {
  const lmp = toUTCDate(lmpDate)
  if (!lmp) return []

  const currentWeeks = getGestationalWeeks(lmpDate)

  return TARGET_VISIT_WEEKS.map((targetWeek, index) => {
    const targetDate = new Date(lmp.getTime() + targetWeek * 7 * MS_PER_DAY)

    // Find a matching logged visit (closest within tolerance).
    const match = existingVisits
      .filter((v) => {
        if (v.gestationalWeekAtVisit == null) return false
        return Math.abs(v.gestationalWeekAtVisit - targetWeek) <= VISIT_MATCH_TOLERANCE
      })
      .sort((a, b) =>
        Math.abs(a.gestationalWeekAtVisit - targetWeek)
        - Math.abs(b.gestationalWeekAtVisit - targetWeek),
      )[0]

    let status
    if (match) {
      status = 'completed'
    } else if (currentWeeks != null && currentWeeks >= targetWeek) {
      status = 'behind'
    } else {
      status = 'upcoming'
    }

    return {
      visitNumber: index + 1,
      targetWeek,
      targetDate: targetDate.toISOString().slice(0, 10),
      status,
      actualWeek: match?.gestationalWeekAtVisit ?? null,
    }
  })
}

/**
 * Summary counts for a visit schedule.
 *
 * @param {Array<{status: string}>} schedule - Output from buildVisitSchedule
 * @returns {{completed: number, behind: number, upcoming: number, total: number}}
 */
function scheduleSummary(schedule) {
  const completed = schedule.filter((v) => v.status === 'completed').length
  const behind = schedule.filter((v) => v.status === 'behind').length
  const upcoming = schedule.filter((v) => v.status === 'upcoming').length
  return { completed, behind, upcoming, total: schedule.length }
}

module.exports = {
  TARGET_VISIT_WEEKS,
  VISIT_MATCH_TOLERANCE,
  buildVisitSchedule,
  scheduleSummary,
}
