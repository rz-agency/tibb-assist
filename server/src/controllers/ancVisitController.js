const prisma = require('../lib/prisma')
const { getGestationalWeeks } = require('../lib/gestationalAge')
const { buildVisitSchedule, scheduleSummary } = require('../lib/ancVisitSchedule')

const ancVisitSelect = {
  id: true,
  pregnancyId: true,
  loggedByUserId: true,
  visitNumber: true,
  visitDate: true,
  gestationalWeekAtVisit: true,
  bloodPressure: true,
  weightKg: true,
  dangerSignsChecked: true,
  notes: true,
  nextVisitDate: true,
  createdAt: true,
  updatedAt: true,
}

function handleDatabaseError(error, res) {
  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'A duplicate ANC visit record was submitted.' })
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
 * Returns a Prisma where-clause that scopes AncVisit queries to only the
 * pregnancies the current user is allowed to see.
 *
 * Access model (same as assessmentController.js):
 *   - WOMAN: sees visits for her own pregnancies
 *   - LHW:   sees visits for assigned patients' pregnancies
 */
async function getAccessiblePatientFilter(user) {
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

async function getAncVisitAccessFilter(user) {
  const patientFilter = await getAccessiblePatientFilter(user)
  return patientFilter ? { pregnancy: patientFilter } : null
}

async function listAncVisits(req, res) {
  const pregnancyId = parsePositiveInteger(req.query.pregnancyId)

  if (!pregnancyId) {
    return res.status(400).json({ error: 'pregnancyId query parameter is required.' })
  }

  try {
    const accessFilter = await getAncVisitAccessFilter(req.user)

    if (!accessFilter) {
      return res.status(403).json({ error: 'You do not have permission to view ANC visits.' })
    }

    const visits = await prisma.ancVisit.findMany({
      where: {
        pregnancyId,
        ...accessFilter,
      },
      select: ancVisitSelect,
      orderBy: { visitNumber: 'asc' },
    })

    // Fetch the pregnancy to build the schedule.
    const pregnancy = await prisma.pregnancy.findUnique({
      where: { id: pregnancyId },
      select: { id: true, lmpDate: true, pregnancyStatus: true },
    })

    if (!pregnancy) {
      return res.status(404).json({ error: 'Pregnancy not found.' })
    }

    const schedule = buildVisitSchedule(pregnancy.lmpDate, visits)
    const summary = scheduleSummary(schedule)

    return res.json({ visits, schedule, summary })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function createAncVisit(req, res) {
  const { pregnancyId, visitNumber, visitDate, bloodPressure, weightKg, dangerSignsChecked, notes, nextVisitDate } = req.body

  if (!parsePositiveInteger(pregnancyId)) {
    return res.status(400).json({ error: 'pregnancyId is required.' })
  }

  if (!parsePositiveInteger(visitNumber)) {
    return res.status(400).json({ error: 'visitNumber must be a positive integer.' })
  }

  if (!visitDate || typeof visitDate !== 'string') {
    return res.status(400).json({ error: 'visitDate is required (YYYY-MM-DD).' })
  }

  try {
    // Verify the user can access this pregnancy.
    const accessFilter = await getAccessiblePatientFilter(req.user)
    if (!accessFilter) {
      return res.status(403).json({ error: 'You do not have permission to log visits for this pregnancy.' })
    }

    const pregnancy = await prisma.pregnancy.findFirst({
      where: {
        id: pregnancyId,
        ...accessFilter,
      },
      select: { id: true, lmpDate: true },
    })

    if (!pregnancy) {
      return res.status(404).json({ error: 'Pregnancy not found or access denied.' })
    }

    // Compute gestationalWeekAtVisit from visitDate and LMP.
    const gestationalWeekAtVisit = pregnancy.lmpDate
      ? getGestationalWeeks(pregnancy.lmpDate, visitDate)
      : null

    const visit = await prisma.ancVisit.create({
      data: {
        pregnancyId,
        loggedByUserId: req.user.id,
        visitNumber,
        visitDate: new Date(visitDate),
        gestationalWeekAtVisit,
        bloodPressure: typeof bloodPressure === 'string' && bloodPressure.trim() ? bloodPressure.trim() : null,
        weightKg: weightKg != null && weightKg !== '' ? Number(weightKg) : null,
        dangerSignsChecked: dangerSignsChecked === true,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
        nextVisitDate: nextVisitDate ? new Date(nextVisitDate) : null,
      },
      select: ancVisitSelect,
    })

    return res.status(201).json({ visit })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function updateAncVisit(req, res) {
  const visitId = parsePositiveInteger(req.params.id)
  if (!visitId) {
    return res.status(400).json({ error: 'A valid visit id is required.' })
  }

  try {
    const accessFilter = await getAncVisitAccessFilter(req.user)
    if (!accessFilter) {
      return res.status(403).json({ error: 'You do not have permission to update ANC visits.' })
    }

    const existing = await prisma.ancVisit.findFirst({
      where: { id: visitId, ...accessFilter },
      select: { id: true },
    })

    if (!existing) {
      return res.status(404).json({ error: 'ANC visit not found or access denied.' })
    }

    const { bloodPressure, weightKg, dangerSignsChecked, notes, nextVisitDate, visitDate } = req.body

    // If visitDate changed, recompute gestationalWeekAtVisit.
    let gestationalWeekAtVisit = undefined
    if (visitDate) {
      const visit = await prisma.ancVisit.findUnique({
        where: { id: visitId },
        select: { pregnancy: { select: { lmpDate: true } } },
      })
      if (visit?.pregnancy?.lmpDate) {
        gestationalWeekAtVisit = getGestationalWeeks(visit.pregnancy.lmpDate, visitDate)
      }
    }

    const updated = await prisma.ancVisit.update({
      where: { id: visitId },
      data: {
        ...(visitDate ? { visitDate: new Date(visitDate), gestationalWeekAtVisit } : {}),
        ...(bloodPressure !== undefined ? { bloodPressure: typeof bloodPressure === 'string' && bloodPressure.trim() ? bloodPressure.trim() : null } : {}),
        ...(weightKg !== undefined ? { weightKg: weightKg != null && weightKg !== '' ? Number(weightKg) : null } : {}),
        ...(dangerSignsChecked !== undefined ? { dangerSignsChecked: dangerSignsChecked === true } : {}),
        ...(notes !== undefined ? { notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null } : {}),
        ...(nextVisitDate !== undefined ? { nextVisitDate: nextVisitDate ? new Date(nextVisitDate) : null } : {}),
      },
      select: ancVisitSelect,
    })

    return res.json({ visit: updated })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  listAncVisits,
  createAncVisit,
  updateAncVisit,
}
