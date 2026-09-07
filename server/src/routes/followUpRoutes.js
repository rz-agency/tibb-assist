const express = require('express')
const { listFollowUps, completeFollowUp } = require('../controllers/followUpController')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
const lhwOnly = requireRole('LHW')

router.get('/follow-ups', requireAuth, listFollowUps)
router.post('/follow-ups/:id/complete', lhwOnly, completeFollowUp)

module.exports = router
