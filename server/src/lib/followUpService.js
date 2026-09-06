/**
 * FollowUp creation service.
 *
 * Auto-creates LHW follow-up tasks at the two lifecycle points where the
 * field worker is expected to check on a woman:
 *   1. A CareMission is created for a YELLOW/RED assessment → a HOME_VISIT
 *      follow-up is scheduled (RED 3 days out, YELLOW 7 days out).
 *   2. A Referral's status becomes FOLLOW_UP_DUE → a REFERRAL_CHECK
 *      follow-up is scheduled 1 day out.
 *
 * Follow-ups are always owned by an LHW (`lhwId` is required). When the
 * patient has no assigned LHW, no follow-up is created — the mission
 * checklist / referral lifecycle still records the escalation.
 *
 * FollowUpType values ANC_VISIT and CHECK_IN_REMINDER are part of the model
 * for future scheduling hooks (ANC visit planner, weekly check-in nudges);
 * no automated creation path uses them yet.
 *
 * The transaction client (`tx`) must be passed by the caller — this module
 * never imports the global Prisma singleton (same pattern as
 * careMissionService.js).
 */

// How many days after CareMission creation the LHW follow-up is due.
const CARE_MISSION_FOLLOW_UP_LEAD_DAYS = {
  RED: 3,
  YELLOW: 7,
}

// How many days after a referral reaches FOLLOW_UP_DUE the check is due.
const REFERRAL_CHECK_DUE_DAYS = 1

/**
 * Returns a new Date exactly `days` days later (UTC day arithmetic).
 *
 * @param {Date} date
 * @param {number} days
 * @returns {Date} New date — the input is never mutated.
 */
function addDays(date, days) {
  const result = new Date(date.getTime())
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

/**
 * Creates the LHW follow-up for a newly created CareMission.
 *
 * @param {object} tx - Prisma transaction client
 * @param {object} params
 * @param {number} params.careMissionId - ID of the just-created CareMission
 * @param {number} params.patientId     - ID of the assessed patient
 * @param {string} params.riskLevel     - 'YELLOW' or 'RED'
 * @param {number|null} params.assignedLhwId - Patient's assigned LHW
 * @returns {Promise<object|null>} The created FollowUp, or null when no
 *   follow-up applies (GREEN risk or no assigned LHW).
 */
async function createFollowUpForCareMission(tx, {
  careMissionId,
  patientId,
  riskLevel,
  assignedLhwId,
}) {
  if (!assignedLhwId) {
    return null
  }

  const leadDays = CARE_MISSION_FOLLOW_UP_LEAD_DAYS[riskLevel]
  if (!leadDays) {
    return null
  }

  // Check-then-create to honor the unique constraint on relatedCareMissionId
  // (protects against endpoint retries).
  const existing = await tx.followUp.findUnique({
    where: { relatedCareMissionId: careMissionId },
    select: { id: true },
  })

  if (existing) {
    return existing
  }

  return tx.followUp.create({
    data: {
      patientId,
      lhwId: assignedLhwId,
      dueDate: addDays(new Date(), leadDays),
      type: 'HOME_VISIT',
      relatedCareMissionId: careMissionId,
    },
  })
}

/**
 * Creates the LHW follow-up when a Referral reaches FOLLOW_UP_DUE.
 *
 * @param {object} tx - Prisma transaction client
 * @param {object} params
 * @param {number} params.referralId    - ID of the referral
 * @param {number} params.patientId     - ID of the referred patient
 * @param {number|null} params.assignedLhwId - Patient's assigned LHW
 * @returns {Promise<object|null>} The created FollowUp, or null when the
 *   patient has no assigned LHW.
 */
async function createFollowUpForReferral(tx, {
  referralId,
  patientId,
  assignedLhwId,
}) {
  if (!assignedLhwId) {
    return null
  }

  // Check-then-create to honor the unique constraint on relatedReferralId.
  const existing = await tx.followUp.findUnique({
    where: { relatedReferralId: referralId },
    select: { id: true },
  })

  if (existing) {
    return existing
  }

  return tx.followUp.create({
    data: {
      patientId,
      lhwId: assignedLhwId,
      dueDate: addDays(new Date(), REFERRAL_CHECK_DUE_DAYS),
      type: 'REFERRAL_CHECK',
      relatedReferralId: referralId,
    },
  })
}

module.exports = {
  CARE_MISSION_FOLLOW_UP_LEAD_DAYS,
  REFERRAL_CHECK_DUE_DAYS,
  addDays,
  createFollowUpForCareMission,
  createFollowUpForReferral,
}
