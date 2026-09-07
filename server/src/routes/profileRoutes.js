const express = require('express')
const {
  getPatientProfile,
  getPatientProfileSummary,
  savePatientProfile,
  getLhwProfile,
  saveLhwProfile,
  getLhwStats,
} = require('../controllers/profileController')
const { getMonthlyReport } = require('../controllers/adminController')
const { requireAuth, requireRole, requireSelf } = require('../middleware/authMiddleware')

const router = express.Router()
const womanProfileAccess = [...requireRole('WOMAN'), requireSelf]
const lhwProfileAccess = [...requireRole('LHW'), requireSelf]

// LHW monthly report: LHW can view their own, ADMIN can view any.
const monthlyReportAccess = [
requireAuth, (req, res, next) => {
  if (req.user.role === 'ADMIN') return next()
  if (req.user.role === 'LHW') {
    const requestedUserId = Number(req.params.userId)
    if (Number.isInteger(requestedUserId) && requestedUserId === req.user.id) return next()
  }
  return res.status(403).json({ error: 'You do not have permission to access this resource.' })
}]

router.get('/patients/:userId/profile', womanProfileAccess, getPatientProfile)
router.get('/patients/:userId/profile/summary', womanProfileAccess, getPatientProfileSummary)
router.put('/patients/:userId/profile', womanProfileAccess, savePatientProfile)
router.get('/lhws/:userId/profile', lhwProfileAccess, getLhwProfile)
router.put('/lhws/:userId/profile', lhwProfileAccess, saveLhwProfile)
router.get('/lhws/:userId/stats', lhwProfileAccess, getLhwStats)
router.get('/lhws/:userId/monthly-report', monthlyReportAccess, getMonthlyReport)

module.exports = router
