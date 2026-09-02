const prisma = require('../lib/prisma')

// Minimal, non-medical fields for the LHW "unassigned patients" list view.
// Deliberately excludes assessments, referrals and other medical history.
const unassignedPatientSelect = {
  id: true,
  fullName: true,
  villageOrArea: true,
  district: true,
  createdAt: true,
  pregnancies: {
    where: { pregnancyStatus: 'ACTIVE' },
    select: { id: true, pregnancyStatus: true },
  },
}

// Matches the assignedPatients shape returned by the LHW profile endpoint so
// the client can move a patient between the two lists without extra mapping.
const assignedPatientSelect = {
  id: true,
  userId: true,
  fullName: true,
  phone: true,
  age: true,
  villageOrArea: true,
  district: true,
  province: true,
  assignedLhwId: true,
}

function parseId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function handleDatabaseError(error, res) {
  if (error.code === 'P2025') return res.status(404).json({ error: 'Patient profile not found.' })
  console.error(error)
  return res.status(500).json({ error: 'A database error occurred.' })
}

async function listUnassignedPatients(req, res) {
  try {
    const patients = await prisma.patientProfile.findMany({
      where: { assignedLhwId: null },
      select: unassignedPatientSelect,
      orderBy: { createdAt: 'desc' },
    })

    return res.json({ patients })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function assignLhwToPatient(req, res) {
  const patientId = parseId(req.params.patientId)
  if (!patientId) return res.status(400).json({ error: 'patientId must be a positive integer.' })

  const { lhwId } = req.body || {}
  const parsedLhwId = parseId(lhwId)
  if (!parsedLhwId) return res.status(400).json({ error: 'lhwId must be a positive integer.' })

  try {
    const lhwUser = await prisma.user.findUnique({
      where: { id: parsedLhwId },
      select: { id: true, role: true },
    })

    if (!lhwUser || lhwUser.role !== 'LHW') {
      return res.status(400).json({ error: 'lhwId must correspond to an existing user with role LHW.' })
    }

    // PatientProfile.assignedLhwId references the Lhw profile table, not the
    // user table, so the user id has to be resolved to the Lhw record first.
    const lhwProfile = await prisma.lhw.findUnique({
      where: { userId: lhwUser.id },
      select: { id: true },
    })

    if (!lhwProfile) {
      return res.status(400).json({ error: 'LHW profile not found for this user.' })
    }

    const patient = await prisma.patientProfile.findUnique({
      where: { id: patientId },
      select: { id: true },
    })

    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found.' })
    }

    const updatedPatient = await prisma.patientProfile.update({
      where: { id: patientId },
      data: { assignedLhwId: lhwProfile.id },
      select: assignedPatientSelect,
    })

    return res.json({ patient: updatedPatient })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  listUnassignedPatients,
  assignLhwToPatient,
}
