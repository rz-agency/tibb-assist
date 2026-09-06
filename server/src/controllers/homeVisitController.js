const prisma = require('../lib/prisma')

const VALID_VISIT_TYPES = ['ROUTINE', 'FOLLOW_UP', 'POSTNATAL', 'EMERGENCY_FOLLOW_UP']

const homeVisitSelect = {
  id: true,
  patientId: true,
  lhwId: true,
  visitDate: true,
  visitType: true,
  topicsDiscussed: true,
  bloodPressureChecked: true,
  notes: true,
  nextVisitDate: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
}

function handleDatabaseError(error, res) {
  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'A duplicate home visit record was submitted.' })
  }

  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'A related record was not found.' })
  }

  console.error(error)
  return res.status(500).json({ error: 'A database error occurred.' })
}

function parsePositiveInteger(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

/**
 * Returns a Prisma where-clause that scopes HomeVisit queries to only the
 * patients the current user is allowed to see.
 *
 * Access model (same pattern as ancVisitController.js):
 *   - WOMAN: sees visits for her own patient profile
 *   - LHW:   sees visits for assigned patients
 */
async function getHomeVisitAccessFilter(user) {
  if (user.role === 'WOMAN') {
    return { patient: { userId: user.id } }
  }

  if (user.role === 'LHW') {
    const lhw = await prisma.lhw.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    return lhw ? { patient: { assignedLhwId: lhw.id } } : null
  }

  return null
}

async function listHomeVisits(req, res) {
  const patientId = parsePositiveInteger(req.query.patientId)

  if (!patientId) {
    return res.status(400).json({ error: 'patientId query parameter is required.' })
  }

  try {
    const accessFilter = await getHomeVisitAccessFilter(req.user)

    if (!accessFilter) {
      return res.status(403).json({ error: 'You do not have permission to view home visits.' })
    }

    const visits = await prisma.homeVisit.findMany({
      where: {
        patientId,
        ...accessFilter,
      },
      select: homeVisitSelect,
      orderBy: { visitDate: 'desc' },
    })

    return res.json({ visits })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function createHomeVisit(req, res) {
  const { patientId, visitDate, visitType, topicsDiscussed, bloodPressureChecked, notes, nextVisitDate } = req.body

  if (!parsePositiveInteger(patientId)) {
    return res.status(400).json({ error: 'patientId is required.' })
  }

  if (!visitDate || typeof visitDate !== 'string') {
    return res.status(400).json({ error: 'visitDate is required (YYYY-MM-DD).' })
  }

  if (!visitType || !VALID_VISIT_TYPES.includes(visitType)) {
    return res.status(400).json({ error: `visitType must be one of: ${VALID_VISIT_TYPES.join(', ')}` })
  }

  try {
    // LHW-only: look up the LHW record.
    const lhw = await prisma.lhw.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    })

    if (!lhw) {
      return res.status(403).json({ error: 'Only LHWs can log home visits.' })
    }

    // Verify the patient is assigned to this LHW.
    const patient = await prisma.patientProfile.findFirst({
      where: { id: patientId, assignedLhwId: lhw.id },
      select: { id: true },
    })

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found or not assigned to you.' })
    }

    // Sanitize topicsDiscussed: must be an array of non-empty strings if provided.
    let sanitizedTopics = null
    if (topicsDiscussed != null) {
      if (!Array.isArray(topicsDiscussed)) {
        return res.status(400).json({ error: 'topicsDiscussed must be an array of strings.' })
      }
      sanitizedTopics = topicsDiscussed
        .filter((t) => typeof t === 'string' && t.trim())
        .map((t) => t.trim())
      if (sanitizedTopics.length === 0) sanitizedTopics = null
    }

    const visit = await prisma.homeVisit.create({
      data: {
        patientId,
        lhwId: lhw.id,
        visitDate: new Date(visitDate),
        visitType,
        topicsDiscussed: sanitizedTopics,
        bloodPressureChecked: bloodPressureChecked === true,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
        nextVisitDate: nextVisitDate ? new Date(nextVisitDate) : null,
        createdByUserId: req.user.id,
      },
      select: homeVisitSelect,
    })

    return res.status(201).json({ visit })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  listHomeVisits,
  createHomeVisit,
}
