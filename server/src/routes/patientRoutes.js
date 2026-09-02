const express = require('express')
const {
  listUnassignedPatients,
  assignLhwToPatient,
} = require('../controllers/patientController')
const { requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
const lhwOnly = requireRole('LHW')

router.get('/patients/unassigned', lhwOnly, listUnassignedPatients)
router.patch('/patients/:patientId/assign-lhw', lhwOnly, assignLhwToPatient)

module.exports = router
