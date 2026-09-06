const express = require('express')
const { getLhwOverview, getMonthlyReport } = require('../controllers/adminController')
const { requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
const adminAccess = requireRole('ADMIN')

router.get('/admin/lhw-overview', adminAccess, getLhwOverview)
router.get('/admin/monthly-report/:userId', adminAccess, getMonthlyReport)

module.exports = router
