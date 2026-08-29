const express = require('express')
const { message, confirm } = require('../controllers/aiAssistantController')
const { requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
const womanOnly = requireRole('WOMAN')

router.post('/ai-assistant/message', womanOnly, message)
router.post('/ai-assistant/confirm', womanOnly, confirm)

module.exports = router
