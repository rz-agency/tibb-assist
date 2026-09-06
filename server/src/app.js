require('dotenv').config()

const express = require('express')
const cors = require('cors')
const session = require('express-session')
const mysql = require('mysql2/promise')
const MySQLStore = require('express-mysql-session')(session)
const prisma = require('./lib/prisma')
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

const app = express()

const sessionStore = new MySQLStore(
  {},
  mysql.createPool(process.env.DATABASE_URL)
)

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

app.use(cors({
  origin: 'https://tibb-assist.vercel.app',
  credentials: true,
}))

app.use(express.json({ limit: '5mb' }))

app.use(session({
  name: 'tibbAssist.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'none',
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
app.use('/api', patientRoutes)
app.use('/api', aiAssistantRoutes)
app.use('/api', careMissionRoutes)
app.use('/api', checkInRoutes)

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

/*
 * COOKIE DIAGNOSTIC
 * Tests whether Express/Vercel can send a normal cookie.
 */
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

/*
 * SESSION COOKIE DIAGNOSTIC
 * Tests express-session + MySQL session store.
 */
app.get('/api/health/session-cookie', (req, res) => {
  req.session.test = 'hello123'

  req.session.save((err) => {
    if (err) {
      console.error('SESSION SAVE ERROR:', err)

      return res.status(500).json({
        status: 'error',
        message: err.message,
      })
    }

    console.log('SESSION SAVED SUCCESSFULLY')
    console.log('SESSION ID:', req.sessionID)

    res.json({
      status: 'ok',
      message: 'Session saved successfully.',
      sessionID: req.sessionID,
    })
  })
})

module.exports = app