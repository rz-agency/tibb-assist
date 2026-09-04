import { useCallback, useEffect, useState } from 'react'
import { getNearbyFacilities } from '../api/api'

const GEO_OPTIONS = { timeout: 10000, enableHighAccuracy: false }

/**
 * Parse a manual "lat, lng" entry. Returns { lat, lng } or null when invalid.
 * Shared by the Nearby Help page and the referral facility selector so both
 * accept the exact same manual input.
 */
export function parseManualCoords(value) {
  const parts = String(value ?? '').trim().split(',').map((s) => s.trim())
  if (parts.length !== 2 || parts.some((p) => p === '' || Number.isNaN(Number(p)))) {
    return null
  }
  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

/**
 * Shared nearby-facility search — the single location/facility mechanism
 * behind both the Nearby Help page and the referral facility selector.
 *
 * Owns:
 *  - browser geolocation on mount (same options as the original Nearby Help page)
 *  - geo phase: 'locating' | 'denied' | 'ready'
 *  - retry + manual coordinate entry for the GPS-denied fallback
 *  - the GET /api/facilities/nearby fetch (OpenStreetMap results) with
 *    loading / error state
 */
export function useNearbyFacilitySearch() {
  // Geolocation phase: 'locating' | 'denied' | 'ready'
  const [geoPhase, setGeoPhase] = useState('locating')
  const [coords, setCoords] = useState(null)

  // Fetch state
  const [facilities, setFacilities] = useState([])
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')

  const locate = useCallback(() => {
    setGeoPhase('locating')
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoPhase('denied')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoPhase('ready')
      },
      () => setGeoPhase('denied'),
      GEO_OPTIONS,
    )
  }, [])

  // ── Geolocation on mount ────────────────────────────────────────────────────
  useEffect(() => {
    locate()
  }, [locate])

  // ── Fetch when coords change ───────────────────────────────────────────────
  useEffect(() => {
    if (geoPhase !== 'ready' || !coords) return

    let cancelled = false
    setFetchLoading(true)
    setFetchError('')
    setFacilities([])

    getNearbyFacilities(coords.lat, coords.lng).then(
      (result) => { if (!cancelled) setFacilities(result) },
      (err) => { if (!cancelled) setFetchError(err.message) },
    ).finally(() => {
      if (!cancelled) setFetchLoading(false)
    })

    return () => { cancelled = true }
  }, [coords, geoPhase])

  // ── Manual location entry (GPS-denied fallback) ─────────────────────────────
  const submitManualLocation = useCallback((lat, lng) => {
    setCoords({ lat, lng })
    setGeoPhase('ready')
  }, [])

  return {
    geoPhase,
    coords,
    facilities,
    fetchLoading,
    fetchError,
    retryLocation: locate,
    submitManualLocation,
  }
}
