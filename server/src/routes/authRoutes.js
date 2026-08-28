const express = require('express')
const {
  register,
  login,
  logout,
  currentUser,
} = require('../controllers/authController')
const { requireAuth } = require('../middleware/authMiddleware')

const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.post('/logout', logout)
router.get('/me', requireAuth, currentUser)

module.exports = router
