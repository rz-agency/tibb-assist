/**
 * nearbyFacilityResolver — maps the OpenStreetMap facility results returned by
 * the Nearby Help search (GET /api/facilities/nearby → placesService) onto
 * HealthcareFacility rows, so referrals created from nearby results keep a
 * valid facilityId FK without duplicating the nearby-search logic.
 *
 * Resolution is find-or-create:
 *   1. look for an existing row with the same name
 *   2. reuse it only when the phone or the coordinates match (prevents linking
 *      a referral to an unrelated same-named facility in another city)
 *   3. otherwise create a new unverified row (isVerified: false)
 */

const CATEGORY_TO_FACILITY_TYPE = {
  hospital: 'HOSPITAL',
  clinic: 'CLINIC',
  doctors: 'CLINIC',
  pharmacy: 'OTHER',
}

const NAME_MAX = 255
const ADDRESS_MAX = 255
const PHONE_MAX = 30
const COORDINATE_MATCH_METERS = 100
const EARTH_RADIUS_METERS = 6371000

function mapCategoryToFacilityType(category) {
  if (typeof category !== 'string') return 'OTHER'
  return CATEGORY_TO_FACILITY_TYPE[category.trim().toLowerCase()] ?? 'OTHER'
}

function truncate(value, max) {
  const str = typeof value === 'string' ? value.trim() : ''
  return str ? str.slice(0, max) : null
}

function parseCoordinate(value) {
  if (value === null || value === undefined || value === '') return null
  const num = Number(value)
  if (!Number.isFinite(num) || num < -180 || num > 180) return null
  return Math.round(num * 1e6) / 1e6 // Decimal(9, 6)
}

/**
 * Validate + normalise an OpenStreetMap facility payload (the shape returned
 * by GET /api/facilities/nearby). Accepts both lat/lng and latitude/longitude
 * key spellings. Returns { data } or { error }.
 */
function buildNearbyFacilityData(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { error: 'facility must be an object describing the selected facility.' }
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  if (!name) {
    return { error: 'facility.name must be a non-empty string.' }
  }

  return {
    data: {
      name: name.slice(0, NAME_MAX),
      facilityType: mapCategoryToFacilityType(payload.category),
      address: truncate(payload.address, ADDRESS_MAX),
      city: null,
      latitude: parseCoordinate(payload.latitude ?? payload.lat),
      longitude: parseCoordinate(payload.longitude ?? payload.lng),
      phone: truncate(payload.phone, PHONE_MAX),
    },
  }
}

function phoneDigits(phone) {
  if (typeof phone !== 'string') return ''
  const digits = phone.replace(/\D+/g, '')
  // Normalise the international access prefix so '+92...' and '0092...'
  // compare equal.
  return digits.startsWith('00') ? digits.slice(2) : digits
}

function phonesMatch(a, b) {
  const da = phoneDigits(a)
  const db = phoneDigits(b)
  return da.length > 0 && da === db
}

function haversineMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function coordinatesMatch(latA, lngA, latB, lngB) {
  const a = latA == null || lngA == null ? null : { lat: Number(latA), lng: Number(lngA) }
  const b = latB == null || lngB == null ? null : { lat: Number(latB), lng: Number(lngB) }
  if (!a || !b || [a.lat, a.lng, b.lat, b.lng].some((n) => !Number.isFinite(n))) return false
  return haversineMeters(a.lat, a.lng, b.lat, b.lng) <= COORDINATE_MATCH_METERS
}

/**
 * Find-or-create the HealthcareFacility row for a nearby (OSM) facility.
 * `prisma` is injected so tests can pass a stub.
 *
 * @returns {Promise<{ id: number }>}
 */
async function resolveNearbyFacility(prisma, data) {
  const candidates = await prisma.healthcareFacility.findMany({
    where: { name: data.name },
    select: { id: true, phone: true, latitude: true, longitude: true },
  })

  for (const candidate of candidates) {
    if (phonesMatch(candidate.phone, data.phone)) return candidate
    if (coordinatesMatch(candidate.latitude, candidate.longitude, data.latitude, data.longitude)) {
      return candidate
    }
  }

  return prisma.healthcareFacility.create({
    data: { ...data, isVerified: false },
    select: { id: true },
  })
}

module.exports = {
  buildNearbyFacilityData,
  resolveNearbyFacility,
  mapCategoryToFacilityType,
  phonesMatch,
  coordinatesMatch,
}
