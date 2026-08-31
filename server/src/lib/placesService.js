/**
 * placesService — nearby medical-facility lookup via OpenStreetMap Overpass API.
 *
 * Uses two public Overpass endpoints with automatic fallback so the demo keeps
 * working even when one server is overloaded or rate-limited.
 *
 * Known gap: isOpenNow is left as null.  Evaluating OSM opening_hours reliably
 * needs a dedicated parser library (e.g. opening_hours.js), which is out of
 * scope for this hackathon demo.
 */

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const FETCH_TIMEOUT_MS = 15_000

// ── In-memory cache ─────────────────────────────────────────────────────────
// Key: "<lat>_<lng>_<radius>"  (lat/lng rounded to 2 decimals)
// Value: { data: Array, expiresAt: number }
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes
const cache = new Map()

function cacheKey(lat, lng, radiusMeters) {
  return `${lat.toFixed(2)}_${lng.toFixed(2)}_${radiusMeters}`
}

function getCached(key) {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(key)
    return null
  }
  return entry.data
}

function setCache(key, data) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS })
}

// ── Overpass query builder ──────────────────────────────────────────────────

function buildOverpassQuery({ lat, lng, radiusMeters }) {
  return (
    `[out:json][timeout:25];\n` +
    `(\n` +
    `  node["amenity"~"^(hospital|pharmacy|clinic|doctors)$"](around:${radiusMeters},${lat},${lng});\n` +
    `  way["amenity"~"^(hospital|pharmacy|clinic|doctors)$"](around:${radiusMeters},${lat},${lng});\n` +
    `);\n` +
    `out center tags;`
  )
}

// ── Category normaliser ─────────────────────────────────────────────────────

const CATEGORY_MAP = {
  hospital: 'hospital',
  pharmacy: 'pharmacy',
  clinic: 'clinic',
  doctors: 'clinic',
}

function normaliseCategory(amenity) {
  return CATEGORY_MAP[amenity] ?? null
}

// ── Element mapper ──────────────────────────────────────────────────────────

function mapElement(el) {
  const tags = el.tags || {}

  // Coordinates: nodes carry lat/lon directly; ways use the center field.
  const lat = el.lat ?? el.center?.lat ?? null
  const lng = el.lon ?? el.center?.lon ?? null

  // Address — build from addr:* tags, omit entirely if none present.
  const addrParts = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:city'],
  ].filter(Boolean)
  const address = addrParts.length > 0 ? addrParts.join(', ') : undefined

  // Phone
  const phone = tags.phone || tags['contact:phone'] || undefined

  // Category
  const category = normaliseCategory(tags.amenity)

  // Skip noisy elements with no useful info at all.
  const name = tags.name || 'Unnamed facility'
  if (name === 'Unnamed facility' && !address && !phone) {
    return null
  }

  return {
    name,
    address,
    phone,
    lat,
    lng,
    category,
    isOpenNow: null, // see known-gap note at top of file
  }
}

// ── Single Overpass fetch ───────────────────────────────────────────────────

async function fetchOverpass(endpoint, query) {
  const body = `data=${encodeURIComponent(query)}`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'TibbAssist/1.0 (hackathon demo)',
    },
    body,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })

  if (!res.ok) {
    throw new Error(`Overpass responded ${res.status} from ${endpoint}`)
  }

  return res.json()
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Find nearby medical facilities via OpenStreetMap Overpass API.
 *
 * @param {{ lat: number, lng: number, radiusMeters?: number }} opts
 * @returns {Promise<Array>} Array of facility objects (may be empty).
 *                           Never throws — returns [] on total failure.
 */
async function findNearbyFacilities({ lat, lng, radiusMeters = 5000 }) {
  // 1. Check cache first.
  const key = cacheKey(lat, lng, radiusMeters)
  const cached = getCached(key)
  if (cached) return cached

  const query = buildOverpassQuery({ lat, lng, radiusMeters })

  // 2. Try each Overpass endpoint; first success wins.
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const json = await fetchOverpass(endpoint, query)
      const elements = Array.isArray(json.elements) ? json.elements : []

      const facilities = elements
        .map(mapElement)
        .filter(Boolean) // drop nulls from noisy elements

      setCache(key, facilities)
      return facilities
    } catch (err) {
      console.error(`Overpass endpoint failed (${endpoint}):`, err.message)
      // fall through to next endpoint
    }
  }

  // 3. Both endpoints failed — return empty rather than throwing.
  return []
}

module.exports = { findNearbyFacilities }
