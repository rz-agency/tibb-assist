const prisma = require('../lib/prisma')
const { decoratePregnancy } = require('../lib/gestationalAge')

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

/**
 * Match Pakistani phone numbers: 03XXXXXXXXX or +923XXXXXXXXX (with optional
 * spaces/dashes). Also accepts the 0092 international prefix.
 */
const PK_PHONE_RE = /^(\+92|0092|0)3[0-9]{9}$/

function isValidPakistaniPhone(value) {
  if (!value) return true // empty is allowed (nullable field)
  const digits = String(value).replace(/[\s\-]/g, '')
  return PK_PHONE_RE.test(digits)
}

function computeAgeFromDob(dateOfBirth) {
  if (!dateOfBirth) return null
  const dob = new Date(dateOfBirth)
  if (isNaN(dob.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const monthDiff = today.getMonth() - dob.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--
  }
  return age >= 0 ? age : null
}

function computeAgeRiskNote(dateOfBirth) {
  const age = computeAgeFromDob(dateOfBirth)
  if (age === null) return null
  if (age >= 35) return 'Advanced maternal age (35+) — additional monitoring advised'
  if (age < 18) return 'Adolescent pregnancy (<18) — additional monitoring advised'
  return null
}

const patientProfileSelect = {
  id: true,
  userId: true,
  fullName: true,
  phone: true,
  age: true,
  dateOfBirth: true,
  address: true,
  bloodGroup: true,
  emergencyContactName: true,
  emergencyContactPhone: true,
  emergencyContactRelation: true,
  preferredLanguage: true,
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

/**
 * Serialize a patient profile for API responses. Pregnancies are decorated
 * with gestationalWeeks / isPostterm computed live from lmpDate so every
 * consumer (Dashboard hero, Pregnancy page) sees the current week — the
 * stored gestationalWeek column may be null or stale.
 */
function serializePatientProfile(profile) {
  const computedAge = computeAgeFromDob(profile.dateOfBirth)
  return {
    ...profile,
    computedAge: computedAge ?? profile.age ?? null,
    ageRiskNote: computeAgeRiskNote(profile.dateOfBirth),
    pregnancies: profile.pregnancies.map(decoratePregnancy),
  }
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
    return res.json(serializePatientProfile(profile))
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function savePatientProfile(req, res) {
  const userId = parseId(req.params.userId)
  if (!userId) return res.status(400).json({ error: 'userId must be a positive integer.' })

  const {
    fullName, phone, age, villageOrArea, district, province,
    dateOfBirth, address, bloodGroup,
    emergencyContactName, emergencyContactPhone, emergencyContactRelation,
    preferredLanguage,
  } = req.body

  if (typeof fullName !== 'string' || !fullName.trim()) {
    return res.status(400).json({ error: 'fullName is required.' })
  }

  // ── Validation ──────────────────────────────────────────────────
  if (phone && !isValidPakistaniPhone(phone)) {
    return res.status(400).json({ error: 'phone must be a valid Pakistani number (e.g. 03XXXXXXXXX or +923XXXXXXXXX).' })
  }
  if (emergencyContactPhone && !isValidPakistaniPhone(emergencyContactPhone)) {
    return res.status(400).json({ error: 'emergencyContactPhone must be a valid Pakistani number (e.g. 03XXXXXXXXX or +923XXXXXXXXX).' })
  }

  // Derive age from dateOfBirth when provided
  let derivedAge = null
  if (dateOfBirth) {
    const dobDate = new Date(dateOfBirth)
    if (isNaN(dobDate.getTime())) {
      return res.status(400).json({ error: 'dateOfBirth must be a valid date.' })
    }
    derivedAge = computeAgeFromDob(dobDate)
    if (derivedAge === null || derivedAge < 12 || derivedAge > 60) {
      return res.status(400).json({ error: 'Age must be between 12 and 60 years.' })
    }
  } else if (age !== undefined && age !== null) {
    // Backward compat: allow explicit age when no dateOfBirth is set
    const numericAge = Number(age)
    if (!Number.isInteger(numericAge) || numericAge < 12 || numericAge > 60) {
      return res.status(400).json({ error: 'Age must be between 12 and 60 years.' })
    }
  }

  if (bloodGroup !== undefined && bloodGroup !== null && !VALID_BLOOD_GROUPS.includes(bloodGroup)) {
    return res.status(400).json({ error: `bloodGroup must be one of: ${VALID_BLOOD_GROUPS.join(', ')}.` })
  }

  if (preferredLanguage !== undefined && !['en', 'ur'].includes(preferredLanguage)) {
    return res.status(400).json({ error: 'preferredLanguage must be "en" or "ur".' })
  }

  const data = {
    fullName: fullName.trim(),
    phone: phone ?? null,
    age: derivedAge ?? (age !== undefined ? (age ?? null) : undefined),
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
    address: address ?? null,
    bloodGroup: bloodGroup ?? null,
    emergencyContactName: emergencyContactName ?? null,
    emergencyContactPhone: emergencyContactPhone ?? null,
    emergencyContactRelation: emergencyContactRelation ?? null,
    preferredLanguage: preferredLanguage ?? 'ur',
    villageOrArea: villageOrArea ?? null,
    district: district ?? null,
    province: province ?? null,
  }

  // Remove undefined keys so upsert doesn't null them out accidentally
  const cleanData = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined))

  try {
    const profile = await prisma.patientProfile.upsert({
      where: { userId },
      create: { userId, ...cleanData },
      update: cleanData,
      select: patientProfileSelect,
    })

    return res.json(serializePatientProfile(profile))
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
  computeAgeFromDob,
  computeAgeRiskNote,
  patientProfileSelect,
}
