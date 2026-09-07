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
const ancVisitRoutes = require('./routes/ancVisitRoutes')
const homeVisitRoutes = require('./routes/homeVisitRoutes')
const immunizationRoutes = require('./routes/immunizationRoutes')
const followUpRoutes = require('./routes/followUpRoutes')
const pushNotificationRoutes = require('./routes/pushNotificationRoutes')

const app = express()

app.set('trust proxy', 1)

const isProduction = process.env.NODE_ENV === 'production'

const sessionStore = new MySQLStore(
  {},
  mysql.createPool(process.env.DATABASE_URL)
)

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store')
  next()
})

app.use(cors({
  origin: isProduction
    ? 'https://tibb-assist.vercel.app'
    : 'http://localhost:5173',
  credentials: true,
}))

app.use(express.json({ limit: '5mb' }))

app.use(session({
  name: 'tibbAssist.sid',
  secret: process.env.SESSION_SECRET,
  store: sessionStore,
  proxy: isProduction,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
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
app.use('/api/ai-assistant', aiAssistantRoutes)
app.use('/api', careMissionRoutes)
app.use('/api', checkInRoutes)
app.use('/api', ancVisitRoutes)
app.use('/api', homeVisitRoutes)
app.use('/api', immunizationRoutes)
app.use('/api', followUpRoutes)
app.use('/api', pushNotificationRoutes)

module.exports = app