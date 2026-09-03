const express = require('express')
const {
  getCurrentQuestions,
  getDueStatus,
  submitCheckIn,
} = require('../controllers/checkInController')
const { requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
const womanOnly = requireRole('WOMAN')

router.get('/checkins/current-questions', womanOnly, getCurrentQuestions)
router.get('/checkins/due', womanOnly, getDueStatus)
router.post('/checkins', womanOnly, submitCheckIn)

module.exports = router
