const prisma = require('../lib/prisma')
const { getCareMissionAccessFilter } = require('../lib/careMissionAccess')

const activeStatuses = ['OPEN', 'IN_PROGRESS', 'ESCALATED']
const allStatuses = ['OPEN', 'IN_PROGRESS', 'ESCALATED', 'COMPLETED', 'CANCELLED']

// Risk-level sort priority: RED first, then YELLOW, then GREEN.
const riskPriority = { RED: 0, YELLOW: 1, GREEN: 2 }

function parsePositiveInteger(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function handleDatabaseError(error, res) {
  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'A duplicate record was submitted.' })
  }

  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'A related record was not found.' })
  }

  console.error(error)
  return res.status(500).json({ error: 'A database error occurred.' })
}

// ---------- Summary select (no full checklist/timeline) ----------

const listSelect = {
  id: true,
  riskLevel: true,
  status: true,
  assignedLhwId: true,
  createdAt: true,
  updatedAt: true,
  assessment: {
    select: {
      id: true,
      assessmentDate: true,
      riskLevel: true,
      patient: {
        select: {
          id: true,
          fullName: true,
        },
      },
    },
  },
}

// ---------- Detail select (full mission with relations) ----------

const detailSelect = {
  id: true,
  riskLevel: true,
  status: true,
  assessmentId: true,
  referralId: true,
  assignedLhwId: true,
  createdAt: true,
  updatedAt: true,
  assessment: {
    select: {
      id: true,
      assessmentDate: true,
      riskLevel: true,
      inputMethod: true,
      triageNotes: true,
      patient: {
        select: {
          id: true,
          fullName: true,
          phone: true,
        },
      },
      assessmentSymptoms: {
        select: {
          answerStatus: true,
          severity: true,
          symptom: {
            select: { code: true, name: true, category: true },
          },
        },
      },
    },
  },
  referral: {
    select: {
      id: true,
      status: true,
      referralDate: true,
      notes: true,
      facility: {
        select: {
          id: true,
          name: true,
          facilityType: true,
          address: true,
          city: true,
          phone: true,
        },
      },
    },
  },
  assignedLhw: {
    select: {
      id: true,
      fullName: true,
      phone: true,
    },
  },
  checklistItems: {
    select: {
      id: true,
      taskKey: true,
      taskLabel: true,
      isCompleted: true,
      completedByUserId: true,
      completedAt: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: 'asc' },
  },
  timelineEntries: {
    select: {
      id: true,
      action: true,
      fromStatus: true,
      toStatus: true,
      notes: true,
      createdByUserId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
}

// ---------- GET /api/care-missions ----------

async function listCareMissions(req, res) {
  try {
    const accessFilter = await getCareMissionAccessFilter(req.user)
    if (!accessFilter) {
      return res.status(403).json({ error: 'You do not have permission to view care missions.' })
    }

    const includeCompleted = req.query.includeCompleted === 'true'
    const statusFilter = includeCompleted ? allStatuses : activeStatuses

    const missions = await prisma.careMission.findMany({
      where: {
        status: { in: statusFilter },
        ...accessFilter,
      },
      select: listSelect,
    })

    // Sort: RED first, then YELLOW, then GREEN; newest first within each group.
    missions.sort((a, b) => {
      const riskDiff = (riskPriority[a.riskLevel] ?? 9) - (riskPriority[b.riskLevel] ?? 9)
      if (riskDiff !== 0) return riskDiff
      return b.createdAt.getTime() - a.createdAt.getTime()
    })

    return res.json({ careMissions: missions })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

// ---------- GET /api/care-missions/:id ----------

async function getCareMission(req, res) {
  const missionId = parsePositiveInteger(req.params.id)
  if (!missionId) {
    return res.status(400).json({ error: 'Care mission id must be a positive integer.' })
  }

  try {
    const accessFilter = await getCareMissionAccessFilter(req.user)
    if (!accessFilter) {
      return res.status(403).json({ error: 'You do not have permission to view care missions.' })
    }

    const mission = await prisma.careMission.findFirst({
      where: { id: missionId, ...accessFilter },
      select: detailSelect,
    })

    if (!mission) {
      return res.status(404).json({ error: 'Care mission not found.' })
    }

    return res.json({ careMission: mission })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

// ---------- PATCH /api/care-missions/:id/checklist-items/:itemId ----------

async function updateChecklistItem(req, res) {
  const missionId = parsePositiveInteger(req.params.id)
  const itemId = parsePositiveInteger(req.params.itemId)

  if (!missionId) {
    return res.status(400).json({ error: 'Care mission id must be a positive integer.' })
  }
  if (!itemId) {
    return res.status(400).json({ error: 'Checklist item id must be a positive integer.' })
  }

  // Strict body validation: only isCompleted is allowed.
  const bodyKeys = Object.keys(req.body)
  if (bodyKeys.length !== 1 || bodyKeys[0] !== 'isCompleted') {
    return res.status(400).json({
      error: 'Request body must contain only { "isCompleted": boolean }.',
    })
  }

  const { isCompleted } = req.body
  if (typeof isCompleted !== 'boolean') {
    return res.status(400).json({ error: 'isCompleted must be a boolean (true or false).' })
  }

  try {
    const accessFilter = await getCareMissionAccessFilter(req.user)
    if (!accessFilter) {
      return res.status(403).json({ error: 'You do not have permission to modify care missions.' })
    }

    // Verify the mission exists and the user has access.
    const mission = await prisma.careMission.findFirst({
      where: { id: missionId, ...accessFilter },
      select: { id: true },
    })

    if (!mission) {
      return res.status(404).json({ error: 'Care mission not found.' })
    }

    // Verify the checklist item belongs to this mission.
    const item = await prisma.careMissionChecklistItem.findFirst({
      where: { id: itemId, careMissionId: missionId },
      select: { id: true, taskKey: true, taskLabel: true, isCompleted: true },
    })

    if (!item) {
      return res.status(404).json({ error: 'Checklist item not found for this care mission.' })
    }

    // No-op if the item is already in the requested state.
    if (item.isCompleted === isCompleted) {
      const updated = await prisma.careMissionChecklistItem.findUnique({
        where: { id: itemId },
      })
      return res.json({ checklistItem: updated })
    }

    const action = isCompleted ? 'CHECKLIST_ITEM_COMPLETED' : 'CHECKLIST_ITEM_REOPENED'
    const verb = isCompleted ? 'completed' : 'reopened'
    const taskDescription = item.taskLabel || item.taskKey

    const result = await prisma.$transaction(async (tx) => {
      let updatedItem

      if (isCompleted) {
        updatedItem = await tx.careMissionChecklistItem.update({
          where: { id: itemId },
          data: {
            isCompleted: true,
            completedByUserId: req.user.id,
            completedAt: new Date(),
          },
        })
      } else {
        updatedItem = await tx.careMissionChecklistItem.update({
          where: { id: itemId },
          data: {
            isCompleted: false,
            completedByUserId: null,
            completedAt: null,
          },
        })
      }

      await tx.careMissionTimeline.create({
        data: {
          careMissionId: missionId,
          action,
          fromStatus: null,
          toStatus: null,
          notes: `Checklist task "${taskDescription}" ${verb}.`,
          createdByUserId: req.user.id,
        },
      })

      return updatedItem
    })

    return res.json({ checklistItem: result })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  listCareMissions,
  getCareMission,
  updateChecklistItem,
}
