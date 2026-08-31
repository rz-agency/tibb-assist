const express = require('express')
const { listFacilities, getNearbyFacilities } = require('../controllers/facilityController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

// Register /nearby BEFORE any /:id route so it isn't shadowed.
router.get('/facilities/nearby', requireAuth, getNearbyFacilities)
router.get('/facilities', requireAuth, listFacilities)

module.exports = router