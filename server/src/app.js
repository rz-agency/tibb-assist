require('dotenv').config()

const express = require('express')
const session = require('express-session')
const prisma = require('./lib/prisma')
const authRoutes = require('./routes/authRoutes')
const assessmentRoutes = require('./routes/assessmentRoutes')
const profileRoutes = require('./routes/profileRoutes')
const facilityRoutes = require('./routes/facilityRoutes')
const pregnancyRoutes = require('./routes/pregnancyRoutes')
const referralRoutes = require('./routes/referralRoutes')
const emergencyContactRoutes = require('./routes/emergencyContactRoutes')
const aiAssistantRoutes = require('./routes/aiAssistantRoutes')
const careMissionRoutes = require('./routes/careMissionRoutes')

const app = express()

app.use(express.json({ limit: '5mb' }))
app.use(session({
  name: 'tibbAssist.sid',
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
  },
}))
app.use('/api/auth', authRoutes)
app.use('/api', assessmentRoutes)
app.use('/api', profileRoutes)
app.use('/api', facilityRoutes)
app.use('/api', pregnancyRoutes)
app.use('/api', referralRoutes)
app.use('/api', emergencyContactRoutes)
app.use('/api', aiAssistantRoutes)
app.use('/api', careMissionRoutes)

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Tibb Assist backend is running.'
  })
})

app.get('/api/health/db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({
      status: 'ok',
      database: 'connected',
      message: 'Prisma connected to MySQL successfully.'
    })
  } catch (error) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      message: 'Database connection failed.',
      error: error.message
    })
  }
})

module.exports = app
