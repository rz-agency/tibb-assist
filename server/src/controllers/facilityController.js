const prisma = require('../lib/prisma')
const { findNearbyFacilities } = require('../lib/placesService')

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

/**
 * GET /api/facilities/nearby?lat=...&lng=...&radius=...
 * Proxies to OpenStreetMap Overpass via placesService.
 */
async function getNearbyFacilities(req, res) {
  const { lat, lng, radius } = req.query

  if (!lat || !lng || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
    return res.status(400).json({ error: 'lat and lng query parameters are required and must be numeric.' })
  }

  const radiusMeters = Math.min(Number(radius) || 5000, 20000)

  try {
    const facilities = await findNearbyFacilities({
      lat: Number(lat),
      lng: Number(lng),
      radiusMeters,
    })

    return res.json({ facilities })
  } catch (error) {
    console.error('Nearby facilities lookup failed:', error)
    return res.status(502).json({
      error: 'Unable to retrieve nearby facilities from OpenStreetMap. Please try again later.',
    })
  }
}

module.exports = {
  listFacilities,
  getNearbyFacilities,
}