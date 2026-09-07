const prisma = require('../lib/prisma')
const { suggestNextDose, MAX_TT_DOSE } = require('../lib/ttSchedule')

const immunizationSelect = {
  id: true,
  patientId: true,
  pregnancyId: true,
  vaccineName: true,
  doseNumber: true,
  dateAdministered: true,
  administeredByUserId: true,
  nextDoseDate: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
}

function handleDatabaseError(error, res) {
  if (error.code === 'P2002') {
    return res.status(409).json({ error: 'A duplicate immunization record was submitted.' })
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
 * Returns a Prisma where-clause that scopes Immunization queries to only the
 * patients the current user is allowed to see.
 *
 * Access model (same pattern as homeVisitController.js):
 *   - WOMAN: sees immunizations for her own patient profile
 *   - LHW:   sees immunizations for assigned patients
 */
async function getImmunizationAccessFilter(user) {
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

async function listImmunizations(req, res) {
  const patientId = parsePositiveInteger(req.query.patientId)

  if (!patientId) {
    return res.status(400).json({ error: 'patientId query parameter is required.' })
  }

  try {
    const accessFilter = await getImmunizationAccessFilter(req.user)

    if (!accessFilter) {
      return res.status(403).json({ error: 'You do not have permission to view immunizations.' })
    }

    const immunizations = await prisma.immunization.findMany({
      where: {
        patientId,
        ...accessFilter,
      },
      select: immunizationSelect,
      orderBy: [{ vaccineName: 'asc' }, { doseNumber: 'asc' }],
    })

    // Build TT schedule suggestion from existing TT doses.
    const ttDoses = immunizations.filter((i) => i.vaccineName === 'TT')
    const suggestion = suggestNextDose(ttDoses)

    return res.json({ immunizations, ttSchedule: suggestion })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function createImmunization(req, res) {
  const { patientId, pregnancyId, vaccineName, doseNumber, dateAdministered, nextDoseDate, notes } = req.body

  if (!parsePositiveInteger(patientId)) {
    return res.status(400).json({ error: 'patientId is required.' })
  }

  if (!vaccineName || typeof vaccineName !== 'string' || !vaccineName.trim()) {
    return res.status(400).json({ error: 'vaccineName is required.' })
  }

  const trimmedVaccine = vaccineName.trim()
  if (!trimmedVaccine.startsWith('TT')) {
    return res.status(400).json({ error: 'Currently only TT (Tetanus Toxoid) vaccines are supported.' })
  }

  if (!Number.isInteger(doseNumber) || doseNumber < 1 || doseNumber > MAX_TT_DOSE) {
    return res.status(400).json({ error: `doseNumber must be between 1 and ${MAX_TT_DOSE}.` })
  }

  if (!dateAdministered || typeof dateAdministered !== 'string') {
    return res.status(400).json({ error: 'dateAdministered is required (YYYY-MM-DD).' })
  }

  try {
    // LHW-only: look up the LHW record.
    const lhw = await prisma.lhw.findUnique({
      where: { userId: req.user.id },
      select: { id: true },
    })

    if (!lhw) {
      return res.status(403).json({ error: 'Only LHWs can log immunizations.' })
    }

    // Verify the patient is assigned to this LHW.
    const patient = await prisma.patientProfile.findFirst({
      where: { id: patientId, assignedLhwId: lhw.id },
      select: { id: true },
    })

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found or not assigned to you.' })
    }

    // If pregnancyId is provided, verify it belongs to this patient.
    if (pregnancyId != null) {
      const pregnancy = await prisma.pregnancy.findFirst({
        where: { id: pregnancyId, patientId },
        select: { id: true },
      })
      if (!pregnancy) {
        return res.status(404).json({ error: 'Pregnancy not found for this patient.' })
      }
    }

    // Check for duplicate: same patient + vaccine + dose number.
    const existing = await prisma.immunization.findFirst({
      where: { patientId, vaccineName: trimmedVaccine, doseNumber },
      select: { id: true },
    })
    if (existing) {
      return res.status(409).json({ error: `${trimmedVaccine} dose ${doseNumber} has already been recorded for this patient.` })
    }

    // Auto-suggest nextDoseDate if not explicitly provided.
    let resolvedNextDoseDate = nextDoseDate ? new Date(nextDoseDate) : null
    if (!resolvedNextDoseDate && trimmedVaccine === 'TT') {
      const existingTtDoses = await prisma.immunization.findMany({
        where: { patientId, vaccineName: 'TT' },
        select: { doseNumber: true, dateAdministered: true },
        orderBy: { doseNumber: 'asc' },
      })
      // Include the current dose in the calculation.
      const allDoses = [
        ...existingTtDoses,
        { doseNumber, dateAdministered: new Date(dateAdministered) },
      ]
      const suggestion = suggestNextDose(allDoses)
      if (suggestion.suggestedDate) {
        resolvedNextDoseDate = new Date(suggestion.suggestedDate)
      }
    }

    const immunization = await prisma.immunization.create({
      data: {
        patientId,
        pregnancyId: pregnancyId != null ? pregnancyId : null,
        vaccineName: trimmedVaccine,
        doseNumber,
        dateAdministered: new Date(dateAdministered),
        administeredByUserId: req.user.id,
        nextDoseDate: resolvedNextDoseDate,
        notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
      },
      select: immunizationSelect,
    })

    return res.status(201).json({ immunization })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  listImmunizations,
  createImmunization,
}
