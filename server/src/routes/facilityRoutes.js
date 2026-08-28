const express = require('express')
const { listFacilities } = require('../controllers/facilityController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/facilities', requireAuth, listFacilities)

module.exports = router