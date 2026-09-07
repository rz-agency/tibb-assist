const express = require('express')
const {
  listAncVisits,
  createAncVisit,
  updateAncVisit,
} = require('../controllers/ancVisitController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/anc-visits', requireAuth, listAncVisits)
router.post('/anc-visits', requireAuth, createAncVisit)
router.put('/anc-visits/:id', requireAuth, updateAncVisit)

module.exports = router
