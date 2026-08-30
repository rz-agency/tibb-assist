/**
 * Deterministic referral lifecycle transition rules.
 *
 * Pure module — no database, no AI, no side effects.
 * Mirrors the Care Mission checklist pattern (careMissionTemplates.js).
 *
 * Lifecycle:
 *   RECOMMENDED → FACILITY_SELECTED → FACILITY_CONTACTED →
 *   TRANSPORT_ARRANGED → PATIENT_DEPARTED → PATIENT_ARRIVED →
 *   FOLLOW_UP_DUE → CLOSED
 *
 * Cancellation:
 *   Any non-terminal status → CANCELLED (requires a non-empty note).
 *
 * Terminal states (CLOSED, CANCELLED) cannot transition anywhere.
 */

const LIFECYCLE_ORDER = [
  'RECOMMENDED',
  'FACILITY_SELECTED',
  'FACILITY_CONTACTED',
  'TRANSPORT_ARRANGED',
  'PATIENT_DEPARTED',
  'PATIENT_ARRIVED',
  'FOLLOW_UP_DUE',
  'CLOSED',
]

const TERMINAL_STATUSES = new Set(['CLOSED', 'CANCELLED'])

const VALID_STATUSES = new Set([...LIFECYCLE_ORDER, 'CANCELLED'])

// Build the single-step forward transition map from the lifecycle order.
const FORWARD_TRANSITIONS = {}
for (let i = 0; i < LIFECYCLE_ORDER.length - 1; i++) {
  FORWARD_TRANSITIONS[LIFECYCLE_ORDER[i]] = LIFECYCLE_ORDER[i + 1]
}

/**
 * Returns the array of statuses reachable from `currentStatus`.
 *
 * @param {string} currentStatus - Current ReferralStatus value.
 * @returns {string[]} Allowed next statuses (may be empty for terminal states).
 */
function getAllowedTransitions(currentStatus) {
  if (!currentStatus || TERMINAL_STATUSES.has(currentStatus)) {
    return []
  }

  const forward = FORWARD_TRANSITIONS[currentStatus]
  const allowed = forward ? [forward] : []
  allowed.push('CANCELLED')
  return allowed
}

/**
 * Validates a proposed referral status transition.
 *
 * @param {string} currentStatus - Current ReferralStatus value.
 * @param {string} nextStatus     - Proposed next ReferralStatus value.
 * @param {string|null} note      - Optional note (required for cancellation).
 * @returns {{ valid: boolean, error?: string }}
 */
function validateTransition(currentStatus, nextStatus, note) {
  if (!currentStatus || !VALID_STATUSES.has(currentStatus)) {
    return { valid: false, error: `Invalid current status: ${currentStatus}.` }
  }

  if (!nextStatus || !VALID_STATUSES.has(nextStatus)) {
    return { valid: false, error: `Invalid target status: ${nextStatus}.` }
  }

  if (TERMINAL_STATUSES.has(currentStatus)) {
    return {
      valid: false,
      error: `Referral is already ${currentStatus.toLowerCase()} and cannot transition further.`,
    }
  }

  const allowed = getAllowedTransitions(currentStatus)
  if (!allowed.includes(nextStatus)) {
    return {
      valid: false,
      error: `Cannot transition from ${currentStatus} to ${nextStatus}. Allowed: ${allowed.join(', ')}.`,
    }
  }

  // Cancellation requires a non-empty note.
  if (nextStatus === 'CANCELLED') {
    if (!note || typeof note !== 'string' || note.trim().length === 0) {
      return {
        valid: false,
        error: 'Cancellation requires a non-empty note explaining the reason.',
      }
    }
  }

  return { valid: true }
}

/**
 * Returns a deterministic, privacy-safe note for a successful transition.
 * Used for CareMissionTimeline entries.
 *
 * @param {string} fromStatus
 * @param {string} toStatus
 * @returns {string}
 */
function buildTimelineNote(fromStatus, toStatus) {
  return `Referral status changed from ${fromStatus} to ${toStatus}.`
}

/**
 * Maps a ReferralStatus to the corresponding CareMissionAction enum value.
 * Returns null if no matching action exists.
 *
 * @param {string} toStatus - The new ReferralStatus.
 * @returns {string|null}
 */
function toCareMissionAction(toStatus) {
  const map = {
    FACILITY_SELECTED: 'FACILITY_SELECTED',
    FACILITY_CONTACTED: 'FACILITY_CONTACTED',
    TRANSPORT_ARRANGED: 'TRANSPORT_ARRANGED',
    PATIENT_DEPARTED: 'PATIENT_DEPARTED',
    PATIENT_ARRIVED: 'PATIENT_ARRIVED',
    FOLLOW_UP_DUE: 'REFERRAL_FOLLOW_UP_DUE',
    CLOSED: 'REFERRAL_CLOSED',
    CANCELLED: 'REFERRAL_CANCELLED',
  }
  return map[toStatus] || null
}

module.exports = {
  LIFECYCLE_ORDER,
  TERMINAL_STATUSES,
  VALID_STATUSES,
  getAllowedTransitions,
  validateTransition,
  buildTimelineNote,
  toCareMissionAction,
}
