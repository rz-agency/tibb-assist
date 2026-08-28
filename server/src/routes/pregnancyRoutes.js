const express = require('express')
const {
  listPregnancies,
  createPregnancy,
  updatePregnancy,
} = require('../controllers/pregnancyController')
const { requireRole } = require('../middleware/authMiddleware')

const router = express.Router()
const womanOnly = requireRole('WOMAN')

router.get('/pregnancies', womanOnly, listPregnancies)
router.post('/pregnancies', womanOnly, createPregnancy)
router.put('/pregnancies/:id', womanOnly, updatePregnancy)

module.exports = router