const prisma = require('../lib/prisma')

const referralStatuses = ['RECOMMENDED', 'CONTACTED', 'COMPLETED', 'CANCELLED']

const referralSelect = {
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
    },
  },
}

function parsePositiveInteger(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function handleDatabaseError(error, res) {
  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'A related record was not found.' })
  }

  console.error(error)
  return res.status(500).json({ error: 'A database error occurred.' })
}

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

async function listReferrals(req, res) {
  try {
    const patientFilter = await getAccessiblePatientFilter(req.user)

    if (!patientFilter) {
      return res.status(403).json({ error: 'You do not have permission to view referrals.' })
    }

    const referrals = await prisma.referral.findMany({
      where: { patient: patientFilter },
      select: referralSelect,
      orderBy: { referralDate: 'desc' },
    })

    return res.json({ referrals })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

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
      select: referralSelect,
    })

    return res.status(201).json({ referral })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  listReferrals,
  createReferral,
}
