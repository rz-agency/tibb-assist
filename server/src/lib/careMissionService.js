/**
 * Care Mission creation service.
 *
 * Creates a CareMission with its initial timeline entry and default checklist
 * items inside a Prisma transaction. The transaction client (`tx`) must be
 * passed by the caller — this module never imports the global Prisma singleton.
 *
 * Called by assessment controllers after a YELLOW or RED assessment has been
 * persisted. GREEN assessments never trigger Care Mission creation.
 */

const { getChecklistForRiskLevel } = require('./careMissionTemplates')

/**
 * Creates a Care Mission for a YELLOW or RED assessment within the given
 * Prisma interactive transaction.
 *
 * @param {object} tx - Prisma transaction client (Prisma.TransactionClient)
 * @param {object} params
 * @param {number} params.assessmentId - ID of the just-created assessment
 * @param {string} params.riskLevel   - 'GREEN', 'YELLOW', or 'RED' from the deterministic engine
 * @param {number|null} params.assignedLhwId - Patient's current LHW assignment (server-side only)
 * @param {number} params.createdByUserId - ID of the authenticated user
 * @returns {Promise<object|null>} The created CareMission, or null if GREEN
 */
async function createCareMissionForAssessment(tx, {
  assessmentId,
  riskLevel,
  assignedLhwId,
  createdByUserId,
}) {
  if (riskLevel === 'GREEN') {
    return null
  }

  // Check-then-create to handle the unique constraint on assessmentId.
  // In practice a duplicate should not occur because the assessment was just
  // created in this same transaction, but this guard protects against edge
  // cases where the endpoint is retried.
  const existing = await tx.careMission.findUnique({
    where: { assessmentId },
    select: { id: true },
  })

  if (existing) {
    console.warn(`CareMission already exists for assessment ${assessmentId}, skipping creation.`)
    return existing
  }

  const checklistItems = getChecklistForRiskLevel(riskLevel)

  const careMission = await tx.careMission.create({
    data: {
      assessmentId,
      riskLevel,
      status: 'OPEN',
      assignedLhwId: assignedLhwId ?? null,
      timelineEntries: {
        create: {
          action: 'CARE_MISSION_CREATED',
          fromStatus: null,
          toStatus: 'OPEN',
          notes: `Care Mission created automatically after ${riskLevel} assessment.`,
          createdByUserId,
        },
      },
      checklistItems: {
        create: checklistItems.map((item) => ({
          taskKey: item.taskKey,
          taskLabel: item.taskLabel,
          sortOrder: item.sortOrder,
        })),
      },
    },
  })

  return careMission
}

module.exports = {
  createCareMissionForAssessment,
}
