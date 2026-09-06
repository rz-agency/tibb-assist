const prisma = require('../lib/prisma')

const followUpSelect = {
  id: true,
  patientId: true,
  lhwId: true,
  dueDate: true,
  type: true,
  status: true,
  relatedReferralId: true,
  relatedCareMissionId: true,
  completedAt: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  patient: {
    select: {
      id: true,
      fullName: true,
      villageOrArea: true,
      district: true,
    },
  },
}

function parsePositiveInteger(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function handleDatabaseError(error, res) {
  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'A duplicate follow-up record was submitted.' })
  }

  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'A related record was not found.' })
  }

  console.error(error)
  return res.status(500).json({ error: 'A database error occurred.' })
}

/**
 * Returns a Prisma where-clause that scopes FollowUp queries to only the
 * records the current user is allowed to see.
 *
 * Access model (same pattern as careMissionAccess.js / homeVisitController.js):
 *   - WOMAN: sees follow-ups for her own patient profile
 *   - LHW:   sees follow-ups owned by her Lhw row
 */
async function getFollowUpAccessFilter(user) {
  if (user.role === 'WOMAN') {
    return { patient: { userId: user.id } }
  }

  if (user.role === 'LHW') {
    const lhw = await prisma.lhw.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    return lhw ? { lhwId: lhw.id } : null
  }

  return null
}

// ---------- GET /api/follow-ups ----------

async function listFollowUps(req, res) {
  try {
    const accessFilter = await getFollowUpAccessFilter(req.user)

    if (!accessFilter) {
      return res.status(403).json({ error: 'You do not have permission to view follow-ups.' })
    }

    const includeCompleted = req.query.includeCompleted === 'true'

    const followUps = await prisma.followUp.findMany({
      where: {
        ...accessFilter,
        ...(includeCompleted ? {} : { status: 'PENDING' }),
      },
      select: followUpSelect,
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    })

    return res.json({ followUps })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

// ---------- POST /api/follow-ups/:id/complete ----------

async function completeFollowUp(req, res) {
  const followUpId = parsePositiveInteger(req.params.id)
  if (!followUpId) {
    return res.status(400).json({ error: 'Follow-up id must be a positive integer.' })
  }

  const { notes } = req.body

  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return res.status(400).json({ error: 'notes must be text.' })
  }

  try {
    // LHW-only: the follow-up queue belongs to the field worker.
    const lhw = await prisma.lhw.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    })

    if (!lhw) {
      return res.status(403).json({ error: 'Only LHWs can complete follow-ups.' })
    }

    const followUp = await prisma.followUp.findFirst({
      where: { id: followUpId, lhwId: lhw.id },
      select: { id: true, status: true },
    })

    if (!followUp) {
      return res.status(404).json({ error: 'Follow-up not found or not assigned to you.' })
    }

    // Idempotent — completing an already-completed follow-up is a no-op.
    if (followUp.status === 'COMPLETED') {
      const unchanged = await prisma.followUp.findUnique({
        where: { id: followUpId },
        select: followUpSelect,
      })
      return res.json({ followUp: unchanged, changed: false })
    }

    const updated = await prisma.followUp.update({
      where: { id: followUpId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        ...(typeof notes === 'string' && notes.trim() ? { notes: notes.trim() } : {}),
      },
      select: followUpSelect,
    })

    return res.json({ followUp: updated, changed: true })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  listFollowUps,
  completeFollowUp,
}
