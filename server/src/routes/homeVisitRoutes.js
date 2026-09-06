const express = require('express')
const {
  listHomeVisits,
  createHomeVisit,
} = require('../controllers/homeVisitController')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
const lhwOnly = requireRole('LHW')

router.get('/home-visits', requireAuth, listHomeVisits)
router.post('/home-visits', lhwOnly, createHomeVisit)

module.exports = router
