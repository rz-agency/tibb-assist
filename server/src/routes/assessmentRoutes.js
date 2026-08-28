const express = require('express')
const {
  listSymptoms,
  listAssessments,
  createAssessment,
  getAssessment,
} = require('../controllers/assessmentController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/symptoms', requireAuth, listSymptoms)
router.get('/assessments', requireAuth, listAssessments)
router.post('/assessments', requireAuth, createAssessment)
router.get('/assessments/:id', requireAuth, getAssessment)

module.exports = router
