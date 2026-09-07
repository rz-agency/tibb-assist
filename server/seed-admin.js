/**
 * One-off script to create an ADMIN user for the Tibb Assist platform.
 *
 * Usage:
 *   cd server
 *   node seed-admin.js [email] [password]
 *
 * Defaults:
 *   email    = admin@tibbassist.local
 *   password = AdminPassword123!
 *
 * The ADMIN role has no PatientProfile or Lhw row — it exists only as a
 * User record with role='ADMIN'.  Admin accounts cannot be created through
 * the public registration endpoint (which is restricted to WOMAN and LHW).
 *
 * This script is idempotent: running it again with the same email is a no-op.
 */

const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function main() {
  const email = (process.argv[2] || 'admin@tibbassist.local').trim().toLowerCase()
  const password = process.argv[3] || 'AdminPassword123!'

  if (password.length < 8) {
    console.error('Password must be at least 8 characters.')
    process.exit(1)
  }

  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    console.log(`User "${email}" already exists (id=${existing.id}, role=${existing.role}). No changes made.`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'ADMIN',
      isActive: true,
    },
  })

  console.log(`ADMIN user created: id=${user.id}, email="${email}"`)
  console.log('Log in at the normal login endpoint with the password you specified.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
