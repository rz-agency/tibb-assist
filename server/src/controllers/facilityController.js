const prisma = require('../lib/prisma')

const facilitySelect = {
  id: true,
  name: true,
  facilityType: true,
  address: true,
  city: true,
  phone: true,
  isVerified: true,
}

async function listFacilities(req, res) {
  try {
    const facilities = await prisma.healthcareFacility.findMany({
      select: facilitySelect,
      orderBy: { name: 'asc' },
    })

    return res.json({ facilities })
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'A database error occurred.' })
  }
}

module.exports = {
  listFacilities,
}