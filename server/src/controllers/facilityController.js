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

/**
 * Sort facilities so that those whose city matches the patient's district or
 * province appear first. Falls back to alphabetical order when no location
 * context is available. Never filters — only reorders.
 */
function sortFacilitiesByPatientLocation(facilities, { district, province }) {
  if (!district && !province) return facilities

  const normalize = (s) => (s || '').trim().toLowerCase()
  const districtNorm = normalize(district)
  const provinceNorm = normalize(province)

  return [...facilities].sort((a, b) => {
    const cityA = normalize(a.city)
    const cityB = normalize(b.city)
    const matchA = (cityA && (cityA === districtNorm || cityA === provinceNorm)) ? 0 : 1
    const matchB = (cityB && (cityB === districtNorm || cityB === provinceNorm)) ? 0 : 1
    if (matchA !== matchB) return matchA - matchB
    return (a.name || '').localeCompare(b.name || '')
  })
}

/**
 * Resolve the authenticated user's district/province from their patient
 * profile. Returns nulls for non-WOMAN users or missing profiles.
 */
async function getPatientLocation(userId) {
  const profile = await prisma.patientProfile.findUnique({
    where: { userId },
    select: { district: true, province: true },
  })
  return { district: profile?.district || null, province: profile?.province || null }
}

async function listFacilities(req, res) {
  try {
    const facilities = await prisma.healthcareFacility.findMany({
      select: facilitySelect,
      orderBy: { name: 'asc' },
    })

    const location = await getPatientLocation(req.user.id)
    const sorted = sortFacilitiesByPatientLocation(facilities, location)

    return res.json({ facilities: sorted })
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
  sortFacilitiesByPatientLocation,
  getPatientLocation,
  facilitySelect,
}