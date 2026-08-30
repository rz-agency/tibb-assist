const express = require('express')
const {
  listReferrals,
  createReferral,
  getReferral,
  updateReferralStatus,
} = require('../controllers/referralController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/referrals', requireAuth, listReferrals)
router.post('/referrals', requireAuth, createReferral)
router.get('/referrals/:id', requireAuth, getReferral)
router.patch('/referrals/:id/status', requireAuth, updateReferralStatus)

module.exports = router
