/**
 * Centralized Care Mission access-control helpers.
 *
 * Determines which Care Missions a logged-in user is allowed to see or
 * modify, based on the existing project access model:
 *   - WOMAN: sees only her own patient profile's missions
 *   - LHW:   sees only missions for patients assigned to that LHW
 *
 * ADMIN is not granted access unless an explicit and tested admin policy
 * is added later.
 */

const prisma = require('./prisma')

/**
 * Returns a Prisma where-clause filter that scopes PatientProfile queries
 * to only the patients the current user is allowed to see.
 *
 * @param {object} user - Authenticated user from req.user
 * @returns {Promise<object|null>} Prisma filter or null if access denied
 */
async function getAccessiblePatientFilter(user) {
  if (user.role === 'WOMAN') {
    return { userId: user.id }
  }

  if (user.role === 'LHW') {
    const lhw = await prisma.lhw.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    return lhw ? { assignedLhwId: lhw.id } : null
  }

  return null
}

/**
 * Returns a Prisma where-clause that can be applied directly to
 * CareMission queries. CareMission has no direct patient link —
 * the relation chain is: CareMission → Assessment → PatientProfile.
 *
 * @param {object} user - Authenticated user from req.user
 * @returns {Promise<object|null>} Prisma filter or null if access denied
 */
async function getCareMissionAccessFilter(user) {
  const patientFilter = await getAccessiblePatientFilter(user)
  return patientFilter ? { assessment: { patient: patientFilter } } : null
}

module.exports = {
  getAccessiblePatientFilter,
  getCareMissionAccessFilter,
}
