/**
 * Deterministic default checklist templates for Care Missions.
 *
 * These templates define the tasks that are automatically created when a
 * YELLOW or RED assessment triggers a Care Mission. They are pure data —
 * no database access, no AI, no side effects.
 */

const YELLOW_CHECKLIST = [
  {
    taskKey: 'YELLOW_CONTACT_HEALTHCARE_PROVIDER',
    taskLabel: 'Contact a healthcare provider',
    sortOrder: 1,
  },
  {
    taskKey: 'YELLOW_CONFIRM_TRANSPORT_PLAN',
    taskLabel: 'Confirm transportation plan',
    sortOrder: 2,
  },
  {
    taskKey: 'YELLOW_SCHEDULE_FOLLOW_UP',
    taskLabel: 'Schedule follow-up within 48 hours',
    sortOrder: 3,
  },
]

const RED_CHECKLIST = [
  {
    taskKey: 'RED_IMMEDIATE_FACILITY_CONTACT',
    taskLabel: 'Contact an appropriate healthcare facility immediately',
    sortOrder: 1,
  },
  {
    taskKey: 'RED_ARRANGE_EMERGENCY_TRANSPORT',
    taskLabel: 'Arrange emergency transportation',
    sortOrder: 2,
  },
  {
    taskKey: 'RED_NOTIFY_EMERGENCY_CONTACT',
    taskLabel: 'Notify the primary emergency contact',
    sortOrder: 3,
  },
  {
    taskKey: 'RED_CONFIRM_LHW_FOLLOW_UP',
    taskLabel: 'Confirm Lady Health Worker follow-up',
    sortOrder: 4,
  },
]

/**
 * Returns the default checklist items for a given risk level.
 *
 * @param {string} riskLevel - 'GREEN', 'YELLOW', or 'RED'
 * @returns {Array<{taskKey: string, taskLabel: string, sortOrder: number}>}
 *   Empty array for GREEN (no Care Mission is created for GREEN assessments).
 */
function getChecklistForRiskLevel(riskLevel) {
  if (riskLevel === 'RED') return RED_CHECKLIST.slice()
  if (riskLevel === 'YELLOW') return YELLOW_CHECKLIST.slice()
  return []
}

module.exports = {
  YELLOW_CHECKLIST,
  RED_CHECKLIST,
  getChecklistForRiskLevel,
}
