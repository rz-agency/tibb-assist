const prisma = require('../lib/prisma')

const patientProfileSelect = {
  id: true,
  userId: true,
  fullName: true,
  phone: true,
  age: true,
  villageOrArea: true,
  district: true,
  province: true,
  assignedLhwId: true,
  createdAt: true,
  updatedAt: true,
  pregnancies: true,
  assignedLhw: {
    select: {
      id: true,
      fullName: true,
      phone: true,
      region: true,
    },
  },
  emergencyContacts: true,
}

const lhwProfileSelect = {
  id: true,
  userId: true,
  fullName: true,
  phone: true,
  region: true,
  createdAt: true,
  updatedAt: true,
}

function parseId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function handleDatabaseError(error, res) {
  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'A profile already exists for this user.' })
  }

  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'Related record was not found.' })
  }

  console.error(error)
  return res.status(500).json({ error: 'A database error occurred.' })
}

async function getPatientProfile(req, res) {
  const userId = parseId(req.params.userId)
  if (!userId) return res.status(400).json({ error: 'userId must be a positive integer.' })

  try {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
      select: patientProfileSelect,
    })

    if (!profile) return res.status(404).json({ error: 'Patient profile not found.' })
    return res.json(profile)
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function savePatientProfile(req, res) {
  const userId = parseId(req.params.userId)
  if (!userId) return res.status(400).json({ error: 'userId must be a positive integer.' })

  const { fullName, phone, age, villageOrArea, district, province } = req.body

  if (typeof fullName !== 'string' || !fullName.trim()) {
    return res.status(400).json({ error: 'fullName is required.' })
  }

  const data = {
    fullName: fullName.trim(),
    phone: phone ?? null,
    age: age ?? null,
    villageOrArea: villageOrArea ?? null,
    district: district ?? null,
    province: province ?? null,
  }

  try {
    const profile = await prisma.patientProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: patientProfileSelect,
    })

    return res.json(profile)
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function getLhwProfile(req, res) {
  const userId = parseId(req.params.userId)
  if (!userId) return res.status(400).json({ error: 'userId must be a positive integer.' })

  try {
    const profile = await prisma.lhw.findUnique({
      where: { userId },
      select: {
        ...lhwProfileSelect,
        assignedPatients: {
          select: {
            id: true,
            userId: true,
            fullName: true,
            phone: true,
            age: true,
            villageOrArea: true,
            district: true,
            province: true,
          },
        },
      },
    })

    if (!profile) return res.status(404).json({ error: 'LHW profile not found.' })
    return res.json(profile)
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function saveLhwProfile(req, res) {
  const userId = parseId(req.params.userId)
  if (!userId) return res.status(400).json({ error: 'userId must be a positive integer.' })

  const { fullName, phone, region } = req.body

  if (typeof fullName !== 'string' || !fullName.trim()) {
    return res.status(400).json({ error: 'fullName is required.' })
  }

  const data = {
    fullName: fullName.trim(),
    phone: phone ?? null,
    region: region ?? 'OTHER',
  }

  try {
    const profile = await prisma.lhw.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
      select: lhwProfileSelect,
    })

    return res.json(profile)
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  getPatientProfile,
  savePatientProfile,
  getLhwProfile,
  saveLhwProfile,
}
