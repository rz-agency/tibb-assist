const express = require('express')
const {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
} = require('../controllers/pushNotificationController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

// Public: the client fetches the VAPID key before subscribing (the subscribe
// call itself requires auth, so an unauthenticated client just gets a key
// it cannot use).
router.get('/push/vapid-public-key', getVapidPublicKey)
router.post('/push/subscribe', requireAuth, subscribe)
router.post('/push/unsubscribe', requireAuth, unsubscribe)

module.exports = router
