const prisma = require('../lib/prisma')
const { decoratePregnancy } = require('../lib/gestationalAge')
const { suggestNextDose } = require('../lib/ttSchedule')

const VALID_BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

// Same active-mission definition as careMissionController.js.
const activeCareMissionStatuses = ['OPEN', 'IN_PROGRESS', 'ESCALATED']

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

const patientProfileSummarySelect = {
  id: true,
  userId: true,
  fullName: true,
  phone: true,
  age: true,
  villageOrArea: true,
  district: true,
  province: true,
  pregnancies: {
    select: {
      id: true,
      pregnancyStatus: true,
      lmpDate: true,
      dueDate: true,
    },
  },
}

function serializePatientProfileSummary(profile) {
  return {
    id: profile.id,
    fullName: profile.fullName,
    phone: profile.phone,
    age: profile.age,
    villageOrArea: profile.villageOrArea,
    district: profile.district,
    province: profile.province,
    pregnancies: profile.pregnancies.map(decoratePregnancy),
  }
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
    computedAge,
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

    // Enrich with next TT immunization due date for the dashboard banner.
    const ttDoses = await prisma.immunization.findMany({
      where: { patientId: profile.id, vaccineName: 'TT' },
      select: { doseNumber: true, dateAdministered: true },
      orderBy: { doseNumber: 'asc' },
    })
    const ttSuggestion = suggestNextDose(ttDoses)
    const serialized = serializePatientProfile(profile)
    return res.json({
      ...serialized,
      nextImmunizationDue: ttSuggestion.nextDoseNumber
        ? { doseNumber: ttSuggestion.nextDoseNumber, suggestedDate: ttSuggestion.suggestedDate }
        : null,
    })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function getPatientProfileSummary(req, res) {
  const userId = parseId(req.params.userId)
  if (!userId) return res.status(400).json({ error: 'userId must be a positive integer.' })

  try {
    const profile = await prisma.patientProfile.findUnique({
      where: { userId },
      select: patientProfileSummarySelect,
    })

    if (!profile) return res.status(404).json({ error: 'Patient profile not found.' })
    return res.json(serializePatientProfileSummary(profile))
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

  // Derive age from dateOfBirth; if only an explicit age is submitted
  // (legacy clients), approximate dateOfBirth as January 1 of the year
  // that would make them that age.
  let resolvedDob = null
  if (dateOfBirth) {
    const dobDate = new Date(dateOfBirth)
    if (isNaN(dobDate.getTime())) {
      return res.status(400).json({ error: 'dateOfBirth must be a valid date.' })
    }
    const derivedAge = computeAgeFromDob(dobDate)
    if (derivedAge === null || derivedAge < 12 || derivedAge > 60) {
      return res.status(400).json({ error: 'Age must be between 12 and 60 years.' })
    }
    resolvedDob = dobDate
  } else if (age !== undefined && age !== null) {
    const numericAge = Number(age)
    if (!Number.isInteger(numericAge) || numericAge < 12 || numericAge > 60) {
      return res.status(400).json({ error: 'Age must be between 12 and 60 years.' })
    }
    // Approximate: January 1 of the year that would make them this age.
    const year = new Date().getFullYear() - numericAge
    resolvedDob = new Date(year, 0, 1)
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
    dateOfBirth: resolvedDob ?? undefined,
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
            dateOfBirth: true,
            villageOrArea: true,
            district: true,
            province: true,
          },
        },
      },
    })

    if (!profile) return res.status(404).json({ error: 'LHW profile not found.' })

    // Enrich assigned patients with lastHomeVisitDate for visit-gap sorting.
    const enrichedPatients = await Promise.all(
      profile.assignedPatients.map(async (patient) => {
        const lastVisit = await prisma.homeVisit.findFirst({
          where: { patientId: patient.id },
          orderBy: { visitDate: 'desc' },
          select: { visitDate: true },
        })
        return { ...patient, lastHomeVisitDate: lastVisit?.visitDate ?? null }
      }),
    )

    return res.json({ ...profile, assignedPatients: enrichedPatients })
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

// ---------- GET /api/lhws/:userId/stats ----------

/**
 * LHW workload aggregates — all real Prisma count queries scoped to the
 * LHW's assigned patients (access-filter pattern: the patient chain is the
 * source of truth, not the snapshot assignedLhwId on CareMission).
 *
 * "This month" boundaries use the server's local calendar month; "overdue"
 * means a PENDING follow-up whose due date is before today.
 */
async function getLhwStats(req, res) {
  const userId = parseId(req.params.userId)
  if (!userId) return res.status(400).json({ error: 'userId must be a positive integer.' })

  try {
    const lhw = await prisma.lhw.findUnique({
      where: { userId },
      select: { id: true },
    })

    if (!lhw) return res.status(404).json({ error: 'LHW profile not found.' })

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const patientFilter = { assignedLhwId: lhw.id }

    const [
      assignedPatients,
      openRedCareMissions,
      overdueFollowUps,
      homeVisitsThisMonth,
      referralsClosedThisMonth,
    ] = await Promise.all([
      prisma.patientProfile.count({ where: patientFilter }),
      prisma.careMission.count({
        where: {
          riskLevel: 'RED',
          status: { in: activeCareMissionStatuses },
          assessment: { patient: patientFilter },
        },
      }),
      prisma.followUp.count({
        where: { lhwId: lhw.id, status: 'PENDING', dueDate: { lt: todayStart } },
      }),
      prisma.homeVisit.count({
        where: { lhwId: lhw.id, visitDate: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.referralStatusHistory.count({
        where: {
          toStatus: 'CLOSED',
          createdAt: { gte: monthStart, lt: monthEnd },
          referral: { patient: patientFilter },
        },
      }),
    ])

    return res.json({
      lhwId: lhw.id,
      assignedPatients,
      openRedCareMissions,
      overdueFollowUps,
      homeVisitsThisMonth,
      referralsClosedThisMonth,
    })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  getPatientProfile,
  getPatientProfileSummary,
  savePatientProfile,
  getLhwProfile,
  saveLhwProfile,
  getLhwStats,
  computeAgeFromDob,
  computeAgeRiskNote,
  patientProfileSelect,
}
