const express = require('express')
const {
  listReferrals,
  createReferral,
} = require('../controllers/referralController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/referrals', requireAuth, listReferrals)
router.post('/referrals', requireAuth, createReferral)

module.exports = router
