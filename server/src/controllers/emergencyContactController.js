const prisma = require('../lib/prisma')

const contactSelect = {
  id: true,
  patientId: true,
  name: true,
  relationship: true,
  phoneNumber: true,
  isPrimary: true,
  createdAt: true,
  updatedAt: true,
}

function parsePositiveInteger(value) {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

function isValidPhoneNumber(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  return /^\+?[\d\s\-().]{7,30}$/.test(trimmed)
}

function handleDatabaseError(error, res) {
  if (error.code === 'P2025') {
    return res.status(404).json({ error: 'Emergency contact not found.' })
  }

  console.error(error)
  return res.status(500).json({ error: 'A database error occurred.' })
}

async function verifyPatientAccess(patientId, user) {
  const patient = await prisma.patientProfile.findUnique({
    where: { id: patientId },
    select: { id: true, userId: true, assignedLhwId: true },
  })

  if (!patient) return { exists: false, accessible: false }

  if (user.role === 'WOMAN' && patient.userId === user.id) return { exists: true, accessible: true, patient }
  if (user.role === 'LHW' && patient.assignedLhwId) {
    const lhw = await prisma.lhw.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (lhw && patient.assignedLhwId === lhw.id) return { exists: true, accessible: true, patient }
  }

  return { exists: true, accessible: false }
}

async function verifyContactAccess(contactId, user) {
  const contact = await prisma.emergencyContact.findUnique({
    where: { id: contactId },
    select: { id: true, patientId: true },
  })

  if (!contact) return { exists: false, accessible: false }

  const patientCheck = await verifyPatientAccess(contact.patientId, user)
  if (!patientCheck.exists) return { exists: false, accessible: false }
  if (!patientCheck.accessible) return { exists: true, accessible: false }
  return { exists: true, accessible: true, contact }
}

function getContactData(body) {
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const relationship = typeof body.relationship === 'string' ? body.relationship.trim() : ''
  const phoneNumber = typeof body.phoneNumber === 'string' ? body.phoneNumber.trim() : ''
  const isPrimary = body.isPrimary === true

  if (!name) return { error: 'name is required.' }
  if (!relationship) return { error: 'relationship is required.' }
  if (!phoneNumber) return { error: 'phoneNumber is required.' }
  if (!isValidPhoneNumber(phoneNumber)) return { error: 'phoneNumber format is invalid.' }

  return { data: { name, relationship, phoneNumber, isPrimary } }
}

async function listContacts(req, res) {
  const patientId = parsePositiveInteger(req.params.patientId)
  if (!patientId) return res.status(400).json({ error: 'patientId must be a positive integer.' })

  try {
    const check = await verifyPatientAccess(patientId, req.user)
    if (!check.exists) {
      return res.status(404).json({ error: 'Patient not found.' })
    }
    if (!check.accessible) {
      return res.status(404).json({ error: 'Emergency contacts not found.' })
    }

    const contacts = await prisma.emergencyContact.findMany({
      where: { patientId },
      select: contactSelect,
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    })

    return res.json({ emergencyContacts: contacts })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function createContact(req, res) {
  const patientId = parsePositiveInteger(req.params.patientId)
  if (!patientId) return res.status(400).json({ error: 'patientId must be a positive integer.' })

  const parsed = getContactData(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })

  try {
    const check = await verifyPatientAccess(patientId, req.user)
    if (!check.exists) {
      return res.status(404).json({ error: 'Patient not found.' })
    }
    if (!check.accessible) {
      return res.status(404).json({ error: 'Emergency contacts not found.' })
    }

    if (parsed.data.isPrimary) {
      await prisma.emergencyContact.updateMany({
        where: { patientId, isPrimary: true },
        data: { isPrimary: false },
      })
    }

    const contact = await prisma.emergencyContact.create({
      data: { patientId, ...parsed.data },
      select: contactSelect,
    })

    return res.status(201).json({ emergencyContact: contact })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function updateContact(req, res) {
  const contactId = parsePositiveInteger(req.params.id)
  if (!contactId) return res.status(400).json({ error: 'Contact id must be a positive integer.' })

  const parsed = getContactData(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })

  try {
    const check = await verifyContactAccess(contactId, req.user)
    if (!check.exists) {
      return res.status(404).json({ error: 'Emergency contact not found.' })
    }
    if (!check.accessible) {
      return res.status(404).json({ error: 'Emergency contact not found.' })
    }

    if (parsed.data.isPrimary) {
      await prisma.emergencyContact.updateMany({
        where: { patientId: check.contact.patientId, isPrimary: true, id: { not: contactId } },
        data: { isPrimary: false },
      })
    }

    const updated = await prisma.emergencyContact.update({
      where: { id: contactId },
      data: parsed.data,
      select: contactSelect,
    })

    return res.json({ emergencyContact: updated })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

async function deleteContact(req, res) {
  const contactId = parsePositiveInteger(req.params.id)
  if (!contactId) return res.status(400).json({ error: 'Contact id must be a positive integer.' })

  try {
    const check = await verifyContactAccess(contactId, req.user)
    if (!check.exists) {
      return res.status(404).json({ error: 'Emergency contact not found.' })
    }
    if (!check.accessible) {
      return res.status(404).json({ error: 'Emergency contact not found.' })
    }

    await prisma.emergencyContact.delete({ where: { id: contactId } })

    return res.json({ message: 'Emergency contact deleted.' })
  } catch (error) {
    return handleDatabaseError(error, res)
  }
}

module.exports = {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  getContactData,
  isValidPhoneNumber,
  verifyPatientAccess,
}
