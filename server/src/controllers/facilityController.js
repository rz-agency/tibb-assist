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
 * Return a numeric match score for a facility city against a patient's
 * district / province.  Lower is better:
 *   0 = exact match (after normalization)
 *   1 = partial / contains match (fallback for data like "Karachi City")
 *   2 = no match at all
 *
 * Guarded against empty strings so "" never falsely matches.
 */
function locationMatchScore(cityNorm, districtNorm, provinceNorm) {
  if (!cityNorm) return 2

  // Exact match
  if ((districtNorm && cityNorm === districtNorm) || (provinceNorm && cityNorm === provinceNorm)) {
    return 0
  }

  // Partial / contains match (either direction)
  if (
    (districtNorm && (cityNorm.includes(districtNorm) || districtNorm.includes(cityNorm))) ||
    (provinceNorm && (cityNorm.includes(provinceNorm) || provinceNorm.includes(cityNorm)))
  ) {
    return 1
  }

  return 2
}

/**
 * Sort facilities so that those whose city matches the patient's district or
 * province appear first. Uses a tiered scoring system:
 *   1. Exact match (case-insensitive) — e.g. "Karachi" === "Karachi"
 *   2. Partial / contains match — e.g. "Karachi City" contains "Karachi"
 *   3. No match — alphabetical fallback
 *
 * When no patient location is available (district, province, and villageOrArea
 * are all null), verified facilities are shown first as a sensible default.
 *
 * Never filters — only reorders.
 */
function sortFacilitiesByPatientLocation(facilities, { district, province, villageOrArea }) {
  const normalize = (s) => (s || '').trim().toLowerCase()
  const districtNorm = normalize(district)
  const provinceNorm = normalize(province)
  const villageNorm = normalize(villageOrArea)
  const hasLocation = !!(districtNorm || provinceNorm || villageNorm)

  return [...facilities].sort((a, b) => {
    if (hasLocation) {
      // Check district/province first (higher priority), then villageOrArea
      let scoreA = locationMatchScore(normalize(a.city), districtNorm, provinceNorm)
      let scoreB = locationMatchScore(normalize(b.city), districtNorm, provinceNorm)
      
      // If no match from district/province, try villageOrArea as fallback
      if (scoreA === 2 && villageNorm) {
        const villageScoreA = locationMatchScore(normalize(a.city), villageNorm, '')
        if (villageScoreA < scoreA) scoreA = villageScoreA + 1 // Slightly lower priority than direct match
      }
      if (scoreB === 2 && villageNorm) {
        const villageScoreB = locationMatchScore(normalize(b.city), villageNorm, '')
        if (villageScoreB < scoreB) scoreB = villageScoreB + 1
      }
      
      if (scoreA !== scoreB) return scoreA - scoreB
    } else {
      // Fallback: verified facilities first when no patient location is available
      const verifiedA = a.isVerified ? 0 : 1
      const verifiedB = b.isVerified ? 0 : 1
      if (verifiedA !== verifiedB) return verifiedA - verifiedB
    }
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
    select: { district: true, province: true, villageOrArea: true },
  })
  return {
    district: profile?.district || null,
    province: profile?.province || null,
    villageOrArea: profile?.villageOrArea || null,
  }
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
  locationMatchScore,
  getPatientLocation,
  facilitySelect,
}