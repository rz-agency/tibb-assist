const express = require('express')
const { listImmunizations, createImmunization } = require('../controllers/immunizationController')
const { requireAuth, requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
const lhwOnly = requireRole('LHW')

router.get('/immunizations', requireAuth, listImmunizations)
router.post('/immunizations', lhwOnly, createImmunization)

module.exports = router
