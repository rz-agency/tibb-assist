const express = require('express')
const { getNearbyFacilities } = require('../controllers/facilityController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/facilities/nearby', requireAuth, getNearbyFacilities)

module.exports = router