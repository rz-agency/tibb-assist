const express = require('express')
const {
  listCareMissions,
  getCareMission,
  updateChecklistItem,
} = require('../controllers/careMissionController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/care-missions', requireAuth, listCareMissions)
router.get('/care-missions/:id', requireAuth, getCareMission)
router.patch('/care-missions/:id/checklist-items/:itemId', requireAuth, updateChecklistItem)

module.exports = router
