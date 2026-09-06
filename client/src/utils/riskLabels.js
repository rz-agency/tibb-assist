/**
 * Shared risk-level label keys and symptom-label formatting.
 *
 * These were duplicated across AssessmentPage, AssessmentHistory,
 * CareMissionPage, AssessmentResultSection, and LhwDashboard.
 * Centralised here so the mapping lives in exactly one place.
 */

/** Maps each RiskLevel enum value to its i18n translation key. */
export const RISK_LABEL_KEY = {
  GREEN: 'assessment.riskGreen',
  YELLOW: 'assessment.riskYellow',
  RED: 'assessment.riskRed',
}

/**
 * Strip a leading "Severe " / "Heavy " prefix from a symptom name and
 * capitalise the first letter of the remainder.  Returns the cleaned
 * string, or the empty string if the input collapses to nothing.
 *
 * @param {string} name — raw symptom name from the database
 * @returns {string}
 */
export function cleanSymptomLabel(name) {
  const cleaned = name.replace(/^(Severe|Heavy)\s+/i, '').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned
}
