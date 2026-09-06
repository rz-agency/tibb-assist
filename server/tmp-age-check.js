// Temporary check: how many patient_profiles rows rely on the legacy age column
// (age set without a date_of_birth) before dropping it.
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.$queryRaw`
    SELECT
      COUNT(*) AS total,
      SUM(age IS NOT NULL) AS with_age,
      SUM(date_of_birth IS NOT NULL) AS with_dob,
      SUM(age IS NOT NULL AND date_of_birth IS NULL) AS age_only
    FROM patient_profiles
  `
  console.log(JSON.stringify(rows[0], (key, value) => (typeof value === 'bigint' ? Number(value) : value), null, 2))
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error('FAIL:', e.message)
    prisma.$disconnect()
    process.exit(1)
  })
