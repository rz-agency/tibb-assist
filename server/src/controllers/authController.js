const bcrypt = require('bcryptjs')
const prisma = require('../lib/prisma')

const safeUserSelect = {
  id: true,
  email: true,
  role: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
}

const allowedRegistrationRoles = ['WOMAN', 'LHW']

function getSafeUser(user) {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }
}

function normalizeEmail(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : ''
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isStrongEnoughPassword(password) {
  return typeof password === 'string'
    && password.length >= 8
    && /[A-Za-z]/.test(password)
    && /\d/.test(password)
}

async function register(req, res) {
  const email = normalizeEmail(req.body.email)
  const { password, role, fullName } = req.body

  if (!email || typeof password !== 'string' || !role) {
    return res.status(400).json({ error: 'email, password, and role are required.' })
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' })
  }

  if (!isStrongEnoughPassword(password)) {
    return res.status(400).json({ error: 'Password must be at least 8 characters and include letters and numbers.' })
  }

  if (!allowedRegistrationRoles.includes(role)) {
    return res.status(400).json({ error: 'Only WOMAN and LHW accounts can be registered publicly.' })
  }

  if (role === 'WOMAN' && (typeof fullName !== 'string' || !fullName.trim())) {
    return res.status(400).json({ error: 'fullName is required for WOMAN registration.' })
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return res.status(409).json({ error: 'An account with that email already exists.' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const user = await prisma.$transaction(async (transaction) => {
      const createdUser = await transaction.user.create({
        data: { email, passwordHash, role },
        select: safeUserSelect,
      })

      if (role === 'WOMAN') {
        await transaction.patientProfile.create({
          data: {
            userId: createdUser.id,
            fullName: fullName.trim(),
          },
        })
      }

      return createdUser
    })

    req.session.user = getSafeUser(user)
    return res.status(201).json({ user: getSafeUser(user) })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: 'An account with that email already exists.' })
    }

    console.error(error)
    return res.status(500).json({ error: 'Registration failed.' })
  }
}

async function login(req, res) {
  const email = normalizeEmail(req.body.email)
  const { password } = req.body

  if (!email || typeof password !== 'string') {
    return res.status(400).json({ error: 'email and password are required.' })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        ...safeUserSelect,
        passwordHash: true,
      },
    })

    if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: 'Invalid email or password.' })
    }

    const safeUser = getSafeUser(user)
    req.session.user = safeUser
    return res.json({ user: safeUser })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Login failed.' })
  }
}

function logout(req, res) {
  req.session.destroy((error) => {
    if (error) {
      console.error(error)
      return res.status(500).json({ error: 'Logout failed.' })
    }

    res.clearCookie('tibbAssist.sid')
    return res.json({ message: 'Logged out successfully.' })
  })
}

function currentUser(req, res) {
  return res.json({ user: req.user })
}

module.exports = {
  register,
  login,
  logout,
  currentUser,
}
