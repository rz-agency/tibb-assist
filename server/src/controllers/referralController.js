const prisma = require('../lib/prisma')
const { getAccessiblePatientFilter } = require('../lib/careMissionAccess')
const {
  validateTransition,
  getAllowedTransitions,
  toCareMissionAction,
} = require('../lib/referralLifecycle')

// Status groups for list filtering.
const activeStatuses = [
  'RECOMMENDED', 'FACILITY_SELECTED', 'FACILITY_CONTACTED',
  'TRANSPORT_ARRANGED', 'PATIENT_DEPARTED', 'PATIENT_ARRIVED',
  'FOLLOW_UP_DUE',
]
const allStatuses = [...activeStatuses, 'CLOSED', 'CANCELLED']

// Risk-level sort priority: RED first, then YELLOW, then GREEN.
const riskPriority = { RED: 0, YELLOW: 1, GREEN: 2 }

// ---------- Shared helpers ----------

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

// ---------- Select shapes ----------

const listSelect = {
  id: true,
  patientId: true,
  status: true,
  referralDate: true,
  notes: true,
  createdAt: true,
  facility: {
    select: {
      id: true,
      name: true,
      facilityType: true,
      city: true,
      phone: true,
    },
  },
  assessment: {
    select: {
      id: true,
      assessmentDate: true,
      riskLevel: true,
      patient: {
        select: { id: true, fullName: true },
      },
    },
  },
}

const detailSelect = {
  id: true,
  patientId: true,
  assessmentId: true,
  facilityId: true,
  status: true,
  referralDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
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
  assessment: {
    select: {
      id: true,
      assessmentDate: true,
      riskLevel: true,
      inputMethod: true,
      triageNotes: true,
      assessmentSymptoms: {
        select: {
          answerStatus: true,
          severity: true,
          symptom: { select: { code: true, name: true } },
        },
      },
    },
  },
  careMission: {
    select: {
      id: true,
      riskLevel: true,
      status: true,
    },
  },
  statusHistory: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      createdByUserId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  },
}

// ---------- GET /api/referrals ----------

async function listReferrals(req, res) {
  try {
    const patientFilter = await getAccessiblePatientFilter(req.user)
    if (!patientFilter) {
      return res.status(403).json({ error: 'You do not have permission to view referrals.' })
    }

    const includeCompleted = req.query.includeCompleted === 'true'
    const statusFilter = includeCompleted ? allStatuses : activeStatuses

    const referrals = await prisma.referral.findMany({
      where: {
        status: { in: statusFilter },
        patient: patientFilter,
      },
      select: listSelect,
    })

    // Sort: RED first, then YELLOW; oldest unresolved first within each group.
    referrals.sort((a, b) => {
      const riskA = a.assessment?.riskLevel
      const riskB = b.assessment?.riskLevel
      const riskDiff = (riskPriority[riskA] ?? 9) - (riskPriority[riskB] ?? 9)
      if (riskDiff !== 0) return riskDiff
      return a.referralDate.getTime() - b.referralDate.getTime()
    })

    return res.json({ referrals })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

// ---------- POST /api/referrals (existing, unchanged behavior) ----------

async function createReferral(req, res) {
  const assessmentId = parsePositiveInteger(req.body.assessmentId)
  const facilityId = parsePositiveInteger(req.body.facilityId)
  const { notes } = req.body

  if (!assessmentId) return res.status(400).json({ error: 'assessmentId must be a positive integer.' })
  if (!facilityId) return res.status(400).json({ error: 'facilityId must be a positive integer.' })
  if (notes !== undefined && notes !== null && typeof notes !== 'string') {
    return res.status(400).json({ error: 'notes must be text.' })
  }

  try {
    const patientFilter = await getAccessiblePatientFilter(req.user)
    if (!patientFilter) {
      return res.status(403).json({ error: 'You do not have permission to create referrals.' })
    }

    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, patient: patientFilter },
      select: { id: true, patientId: true },
    })

    if (!assessment) {
      return res.status(403).json({ error: 'You can only create referrals for an allowed assessment.' })
    }

    const facility = await prisma.healthcareFacility.findUnique({
      where: { id: facilityId },
      select: { id: true },
    })

    if (!facility) {
      return res.status(404).json({ error: 'Healthcare facility not found.' })
    }

    const referral = await prisma.referral.create({
      data: {
        patientId: assessment.patientId,
        assessmentId,
        facilityId,
        status: 'RECOMMENDED',
        referralDate: new Date(),
        notes: notes ?? null,
      },
      select: listSelect,
    })

    return res.status(201).json({ referral })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

// ---------- GET /api/referrals/:id ----------

async function getReferral(req, res) {
  const referralId = parsePositiveInteger(req.params.id)
  if (!referralId) {
    return res.status(400).json({ error: 'Referral id must be a positive integer.' })
  }

  try {
    const patientFilter = await getAccessiblePatientFilter(req.user)
    if (!patientFilter) {
      return res.status(403).json({ error: 'You do not have permission to view referrals.' })
    }

    const referral = await prisma.referral.findFirst({
      where: { id: referralId, patient: patientFilter },
      select: detailSelect,
    })

    if (!referral) {
      return res.status(404).json({ error: 'Referral not found.' })
    }

    // Attach allowed next transitions for the current user's convenience.
    const allowedNext = getAllowedTransitions(referral.status)

    return res.json({ referral, allowedTransitions: allowedNext })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

// ---------- PATCH /api/referrals/:id/status ----------

async function updateReferralStatus(req, res) {
  const referralId = parsePositiveInteger(req.params.id)
  if (!referralId) {
    return res.status(400).json({ error: 'Referral id must be a positive integer.' })
  }

  // Strict body validation: only { status, note? } allowed.
  const bodyKeys = Object.keys(req.body)
  const allowedKeys = ['status', 'note']
  if (bodyKeys.length === 0 || bodyKeys.some((k) => !allowedKeys.includes(k))) {
    return res.status(400).json({
      error: 'Request body must contain { "status": string } and optionally { "note": string }.',
    })
  }

  const { status: nextStatus, note } = req.body

  if (typeof nextStatus !== 'string') {
    return res.status(400).json({ error: 'status must be a string.' })
  }
  if (note !== undefined && note !== null && typeof note !== 'string') {
    return res.status(400).json({ error: 'note must be a string.' })
  }

  try {
    const patientFilter = await getAccessiblePatientFilter(req.user)
    if (!patientFilter) {
      return res.status(403).json({ error: 'You do not have permission to modify referrals.' })
    }

    // Fetch the current referral with access check.
    const referral = await prisma.referral.findFirst({
      where: { id: referralId, patient: patientFilter },
      select: { id: true, status: true },
    })

    if (!referral) {
      return res.status(404).json({ error: 'Referral not found.' })
    }

    // Validate the transition using the deterministic lifecycle engine.
    const validation = validateTransition(referral.status, nextStatus, note)
    if (!validation.valid) {
      return res.status(422).json({ error: validation.error })
    }

    // No-op if already in the target state (idempotent).
    if (referral.status === nextStatus) {
      const unchanged = await prisma.referral.findUnique({
        where: { id: referralId },
        select: listSelect,
      })
      return res.json({ referral: unchanged, changed: false })
    }

    // Execute in a single transaction:
    //   1. Update Referral.status
    //   2. Create ReferralStatusHistory record
    //   3. Create CareMissionTimeline entry (if linked Care Mission exists)
    const action = toCareMissionAction(nextStatus)

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReferral = await tx.referral.update({
        where: { id: referralId },
        data: { status: nextStatus },
        select: listSelect,
      })

      await tx.referralStatusHistory.create({
        data: {
          referralId,
          fromStatus: referral.status,
          toStatus: nextStatus,
          note: note ?? null,
          createdByUserId: req.user.id,
        },
      })

      // If a Care Mission is linked, add a matching timeline entry.
      if (action) {
        const careMission = await tx.careMission.findFirst({
          where: { referralId },
          select: { id: true },
        })

        if (careMission) {
          await tx.careMissionTimeline.create({
            data: {
              careMissionId: careMission.id,
              action,
              fromStatus: null,
              toStatus: null,
              notes: `Referral status changed from ${referral.status} to ${nextStatus}.`,
              createdByUserId: req.user.id,
            },
          })
        }
      }

      return updatedReferral
    })

    return res.json({ referral: updated, changed: true })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  listReferrals,
  createReferral,
  getReferral,
  updateReferralStatus,
}
