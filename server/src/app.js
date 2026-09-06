 require('dotenv').config()

const express = require('express')
const cors = require('cors')
const session = require('express-session')
const mysql = require('mysql2/promise')
const MySQLStore = require('express-mysql-session')(session)
const prisma = require('./lib/prisma')
const { authLimiter, aiAssistantLimiter } = require('./middleware/rateLimiters')
const authRoutes = require('./routes/authRoutes')
const assessmentRoutes = require('./routes/assessmentRoutes')
const profileRoutes = require('./routes/profileRoutes')
const facilityRoutes = require('./routes/facilityRoutes')
const pregnancyRoutes = require('./routes/pregnancyRoutes')
const referralRoutes = require('./routes/referralRoutes')
const emergencyContactRoutes = require('./routes/emergencyContactRoutes')
const patientRoutes = require('./routes/patientRoutes')
const aiAssistantRoutes = require('./routes/aiAssistantRoutes')
const careMissionRoutes = require('./routes/careMissionRoutes')
const checkInRoutes = require('./routes/checkInRoutes')
const ancVisitRoutes = require('./routes/ancVisitRoutes')
const homeVisitRoutes = require('./routes/homeVisitRoutes')
const immunizationRoutes = require('./routes/immunizationRoutes')
const followUpRoutes = require('./routes/followUpRoutes')
const pushNotificationRoutes = require('./routes/pushNotificationRoutes')
const adminRoutes = require('./routes/adminRoutes')

const app = express()

app.set('trust proxy', 1)

const sessionStore = new MySQLStore(
  {},
  mysql.createPool(process.env.DATABASE_URL)
)

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

// Cross-origin requests are only expected from the deployed frontend
// (local development goes through the Vite same-origin proxy). The allowlist
// form only echoes an origin the browser actually sent and matches, so any
// other origin receives no CORS headers at all; with FRONTEND_ORIGIN unset
// the middleware is disabled entirely.
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ? [process.env.FRONTEND_ORIGIN] : false,
  credentials: true,
}))

app.use(express.json({ limit: '5mb' }))

app.use(session({
  name: 'tibbAssist.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  proxy: true,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'none',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000,
  },
}))

// Brute-force / cost ceilings - mounted before the route they guard.
app.use('/api/auth/register', authLimiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/ai-assistant', aiAssistantLimiter)

app.use('/api/auth', authRoutes)
app.use('/api', assessmentRoutes)
app.use('/api', profileRoutes)
app.use('/api', facilityRoutes)
app.use('/api', pregnancyRoutes)
app.use('/api', referralRoutes)
app.use('/api', emergencyContactRoutes)
app.use('/api', patientRoutes)
app.use('/api', aiAssistantRoutes)
app.use('/api', careMissionRoutes)
app.use('/api', checkInRoutes)
app.use('/api', ancVisitRoutes)
app.use('/api', homeVisitRoutes)
app.use('/api', immunizationRoutes)
app.use('/api', followUpRoutes)
app.use('/api', pushNotificationRoutes)
app.use('/api', adminRoutes)

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

app.get('/api/health/session', (req, res) => {
  sessionStore.set(
    'debug-test-id',
    {
      cookie: { maxAge: 1000 },
      test: true
    },
    (err) => {
      if (err) {
        return res.status(500).json({
          status: 'error',
          message: err.message,
          code: err.code || null,
        })
      }

      res.json({
        status: 'ok',
        message: 'Session store write succeeded.'
      })
    }
  )
})

app.get('/api/health/cookie', (req, res) => {
  res.cookie('test_cookie', 'hello123', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    maxAge: 60000,
  })

  res.json({
    status: 'ok',
    message: 'Synchronous test cookie was set.'
  })
})

app.get('/api/health/session-cookie', (req, res) => {
  req.session.test = 'hello123'

  req.session.save((err) => {
    if (err) {
      console.error('SESSION SAVE ERROR:', err)

      return res.status(500).json({
        status: 'error',
      })
    }

    res.json({
      status: 'ok',
      message: 'Session saved successfully.',
      sessionID: req.sessionID,
    })
  })
})

module.exports = app