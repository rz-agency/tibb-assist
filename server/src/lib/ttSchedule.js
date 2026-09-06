/**
 * TT (Tetanus Toxoid) immunization schedule helper.
 *
 * Standard WHO-recommended TT schedule for pregnant women:
 *   TT1 — as soon as possible after pregnancy is confirmed
 *   TT2 — 1 month after TT1
 *   TT3 — 6 months after TT2
 *   TT4 — 1 year after TT3
 *   TT5 — 1 year after TT4
 *
 * This module is used only to *suggest* nextDoseDate when an LHW logs a
 * dose — it is never enforced or used for validation. The LHW can always
 * override the suggested date.
 *
 * ── Future scope: Child EPI (Expanded Programme on Immunization) ─────────
 *
 * After delivery, the same Immunization model can be extended to track the
 * child's EPI schedule (BCG, OPV, Pentavalent, PCV, IPV, Measles, etc.).
 * The model already supports a nullable pregnancyId and a patientId that
 * would point to the child's own PatientProfile record once created.
 *
 * Key additions needed for EPI:
 *   1. A `VaccineSchedule` lookup table mapping vaccineName → doseNumber →
 *      recommended age-in-months (e.g. BCG at birth, Pentavalent-1 at 6 wks).
 *   2. A child-registration flow that creates a PatientProfile linked to the
 *      mother and sets a `patientType` discriminator (MOTHER vs CHILD).
 *   3. A `suggestChildDoseDate(childDob, vaccineName, doseNumber)` helper
 *      analogous to the TT logic below, computing dates from the child's DOB
 *      instead of from previous-dose dates.
 *   4. VaccineName values beyond the TT family (BCG, OPV-0..3, Penta-1..3,
 *      PCV-1..3, IPV, Measles-1..2) with their own interval rules.
 *
 * This is deliberately deferred — the current scope covers only maternal TT.
 */

const MS_PER_DAY = 86_400_000

/**
 * Interval in months from the previous dose to the next dose.
 * TT1 has no predecessor (scheduled ASAP), so it is not listed here.
 */
const DOSE_INTERVAL_MONTHS = {
  2: 1,
  3: 6,
  4: 12,
  5: 12,
}

const MAX_TT_DOSE = 5

/**
 * Add calendar months to a date, clamping to the last valid day of the
 * target month (e.g. Jan 31 + 1 month → Feb 28).
 */
function addMonths(date, months) {
  const result = new Date(date.getTime())
  const day = result.getUTCDate()
  // Set to day 1 first to avoid month-overflow, then clamp the day.
  result.setUTCDate(1)
  result.setUTCMonth(result.getUTCMonth() + months)
  const lastDayOfMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(day, lastDayOfMonth))
  return result
}

/**
 * Given existing TT immunization records for a patient, suggest the next
 * dose number and its recommended date.
 *
 * @param {Array<{doseNumber: number, dateAdministered: Date|string}>} existingDoses
 * @returns {{ nextDoseNumber: number|null, suggestedDate: string|null, schedule: Array<{doseNumber: number, status: string}> }}
 */
function suggestNextDose(existingDoses = []) {
  const ttDoses = existingDoses
    .filter((d) => d.doseNumber >= 1 && d.doseNumber <= MAX_TT_DOSE)
    .sort((a, b) => a.doseNumber - b.doseNumber)

  const completedNumbers = new Set(ttDoses.map((d) => d.doseNumber))
  const nextDoseNumber = (() => {
    for (let i = 1; i <= MAX_TT_DOSE; i++) {
      if (!completedNumbers.has(i)) return i
    }
    return null // all 5 doses completed
  })()

  const schedule = []
  for (let i = 1; i <= MAX_TT_DOSE; i++) {
    schedule.push({
      doseNumber: i,
      status: completedNumbers.has(i) ? 'completed' : (i === nextDoseNumber ? 'next' : 'upcoming'),
    })
  }

  if (!nextDoseNumber) {
    return { nextDoseNumber: null, suggestedDate: null, schedule }
  }

  // Reference date: the actual administration date of the previous dose, or
  // today if this is the first dose (TT1 — ASAP).
  let referenceDate
  if (nextDoseNumber === 1) {
    referenceDate = new Date()
  } else {
    const prevDose = ttDoses.find((d) => d.doseNumber === nextDoseNumber - 1)
    referenceDate = prevDose ? new Date(prevDose.dateAdministered) : new Date()
  }

  const intervalMonths = DOSE_INTERVAL_MONTHS[nextDoseNumber] || 0
  const suggested = addMonths(referenceDate, intervalMonths)

  return {
    nextDoseNumber,
    suggestedDate: suggested.toISOString().slice(0, 10),
    schedule,
  }
}

module.exports = {
  DOSE_INTERVAL_MONTHS,
  MAX_TT_DOSE,
  addMonths,
  suggestNextDose,
}
