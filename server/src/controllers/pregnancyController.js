const prisma = require('../lib/prisma')
const { calculateDueDate, decoratePregnancy } = require('../lib/gestationalAge')

const pregnancyStatuses = ['ACTIVE', 'COMPLETED', 'UNKNOWN']

const pregnancySelect = {
  id: true,
  patientId: true,
  pregnancyStatus: true,
  lmpDate: true,
  dueDate: true,
  gestationalWeek: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
}

function parseId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function parseOptionalDate(value) {
  if (value === undefined || value === null || value === '') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function parseOptionalWeek(value) {
  if (value === undefined || value === null || value === '') return null
  const week = Number(value)
  return Number.isInteger(week) ? week : undefined
}

function getPregnancyData(body) {
  const lmpDate = parseOptionalDate(body.lmpDate)
  const dueDate = parseOptionalDate(body.dueDate)
  const gestationalWeek = parseOptionalWeek(body.gestationalWeek)

  if (lmpDate === undefined || dueDate === undefined || gestationalWeek === undefined) return null
  if (typeof body.pregnancyStatus !== 'string' || !pregnancyStatuses.includes(body.pregnancyStatus)) return null
  if (body.notes !== undefined && body.notes !== null && typeof body.notes !== 'string') return null

  // Naegele's rule: if lmpDate is provided but dueDate was not explicitly set,
  // calculate dueDate = lmpDate + 280 days.
  const effectiveDueDate = (dueDate === null && lmpDate instanceof Date)
    ? calculateDueDate(lmpDate)
    : dueDate

  return {
    pregnancyStatus: body.pregnancyStatus,
    lmpDate,
    dueDate: effectiveDueDate,
    gestationalWeek,
    notes: body.notes ?? null,
  }
}

function handleDatabaseError(error, res) {
  if (error.code === 'P2025') return res.status(404).json({ error: 'Pregnancy not found.' })
  console.error(error)
  return res.status(500).json({ error: 'A database error occurred.' })
}

async function getWomanPatient(userId) {
  return prisma.patientProfile.findUnique({
    where: { userId },
    select: { id: true },
  })
}

async function listPregnancies(req, res) {
  try {
    const patient = await getWomanPatient(req.user.id)
    if (!patient) return res.status(404).json({ error: 'Patient profile not found.' })

    const pregnancies = await prisma.pregnancy.findMany({
      where: { patientId: patient.id },
      select: pregnancySelect,
      orderBy: { createdAt: 'desc' },
    })

    return res.json({ pregnancies: pregnancies.map(decoratePregnancy) })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function createPregnancy(req, res) {
  const data = getPregnancyData(req.body)
  if (!data) return res.status(400).json({ error: 'Pregnancy details are invalid.' })

  try {
    const patient = await getWomanPatient(req.user.id)
    if (!patient) return res.status(404).json({ error: 'Patient profile not found.' })

    const pregnancy = await prisma.pregnancy.create({
      data: { patientId: patient.id, ...data },
      select: pregnancySelect,
    })

    return res.status(201).json({ pregnancy: decoratePregnancy(pregnancy) })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function updatePregnancy(req, res) {
  const pregnancyId = parseId(req.params.id)
  const data = getPregnancyData(req.body)
  if (!pregnancyId) return res.status(400).json({ error: 'Pregnancy id must be a positive integer.' })
  if (!data) return res.status(400).json({ error: 'Pregnancy details are invalid.' })

  try {
    const patient = await getWomanPatient(req.user.id)
    if (!patient) return res.status(404).json({ error: 'Patient profile not found.' })

    const pregnancy = await prisma.pregnancy.findFirst({
      where: { id: pregnancyId, patientId: patient.id },
      select: { id: true },
    })

    if (!pregnancy) return res.status(404).json({ error: 'Pregnancy not found.' })

    const updatedPregnancy = await prisma.pregnancy.update({
      where: { id: pregnancyId },
      data,
      select: pregnancySelect,
    })

    return res.json({ pregnancy: decoratePregnancy(updatedPregnancy) })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  listPregnancies,
  createPregnancy,
  updatePregnancy,
}