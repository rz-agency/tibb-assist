const express = require('express')
const {
  getPatientProfile,
  savePatientProfile,
  getLhwProfile,
  saveLhwProfile,
} = require('../controllers/profileController')
const { requireRole, requireSelf } = require('../middleware/authMiddleware')

const router = express.Router()
const womanProfileAccess = [...requireRole('WOMAN'), requireSelf]
const lhwProfileAccess = [...requireRole('LHW'), requireSelf]

router.get('/patients/:userId/profile', womanProfileAccess, getPatientProfile)
router.put('/patients/:userId/profile', womanProfileAccess, savePatientProfile)
router.get('/lhws/:userId/profile', lhwProfileAccess, getLhwProfile)
router.put('/lhws/:userId/profile', lhwProfileAccess, saveLhwProfile)

module.exports = router
