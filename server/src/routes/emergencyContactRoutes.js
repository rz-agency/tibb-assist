const express = require('express')
const {
  listContacts,
  createContact,
  updateContact,
  deleteContact,
} = require('../controllers/emergencyContactController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/patients/:patientId/emergency-contacts', requireAuth, listContacts)
router.post('/patients/:patientId/emergency-contacts', requireAuth, createContact)
router.put('/emergency-contacts/:id', requireAuth, updateContact)
router.delete('/emergency-contacts/:id', requireAuth, deleteContact)

module.exports = router
