import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNearbyFacilitySearch, parseManualCoords } from '../hooks/useNearbyFacilitySearch'

/**
 * Haversine distance between two lat/lng pairs.
 * @returns Distance in kilometres.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatDistance(km) {
  if (km === null || km === undefined) return null
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

const CATEGORY_LABEL_KEY = {
  hospital: 'nearby.typeHospital',
  pharmacy: 'nearby.typePharmacy',
  clinic: 'nearby.typeClinic',
}

/** Stable identity for an OpenStreetMap facility (they carry no id). */
function facilityKey(f) {
  return `${f.name}|${f.lat ?? ''}|${f.lng ?? ''}`
}

/** Same Google Maps directions URL the Nearby Help page uses. */
function facilityMapsUrl(facility) {
  return facility.lat != null && facility.lng != null
    ? `https://www.google.com/maps/dir/?api=1&destination=${facility.lat},${facility.lng}`
    : null
}

/** The payload passed to createReferral — exactly the OSM facility shape. */
function toSelectionPayload(f) {
  return { name: f.name, address: f.address, phone: f.phone, lat: f.lat, lng: f.lng, category: f.category }
}

/**
 * Referral facility selector — reuses the SAME Nearby Help search
 * (browser geolocation + GET /api/facilities/nearby / OpenStreetMap results)
 * instead of a second nearby implementation.
 *
 * - Nearest-first ordering + "~x.x km" badges (display only — same facility
 *   set Nearby Help shows for the same location).
 * - GPS-denied fallback identical to Nearby Help: message + try again +
 *   manual coordinate entry.
 * - Auto-selects the nearest facility only when nothing is selected yet.
 */
function NearbyFacilityList({ selectedFacility, onSelectFacility }) {
  const { t } = useTranslation()

  const {
    geoPhase,
    coords,
    facilities,
    fetchLoading,
    fetchError,
    retryLocation,
    submitManualLocation,
  } = useNearbyFacilitySearch()

  // Manual location input (GPS-denied fallback)
  const [manualValue, setManualValue] = useState('')
  const [manualError, setManualError] = useState('')

  // Auto-select guard — only auto-select once, and only when unselected
  const autoSelectedRef = useRef(false)

  /* ── Distance enrichment + nearest-first ordering ───────── */
  const sorted = (() => {
    const enriched = facilities.map((f) => {
      if (coords && f.lat != null && f.lng != null) {
        return { ...f, distance: haversineDistance(coords.lat, coords.lng, f.lat, f.lng) }
      }
      return { ...f, distance: null }
    })

    return [...enriched].sort((a, b) => {
      if (a.distance === null && b.distance === null) return 0
      if (a.distance === null) return 1
      if (b.distance === null) return -1
      return a.distance - b.distance
    })
  })()

  /* ── Auto-select nearest when nothing is selected ───────── */
  useEffect(() => {
    if (autoSelectedRef.current || selectedFacility) return
    if (geoPhase !== 'ready' || fetchLoading || fetchError) return

    const nearest = sorted.find((f) => f.distance !== null)
    if (nearest) {
      autoSelectedRef.current = true
      onSelectFacility(toSelectionPayload(nearest))
    }
  }, [geoPhase, fetchLoading, fetchError, sorted, selectedFacility, onSelectFacility])

  /* ── Manual coordinate entry (same fallback as Nearby Help) ─ */
  const handleManualSubmit = (e) => {
    e.preventDefault()
    setManualError('')

    const parsed = parseManualCoords(manualValue)
    if (!parsed) {
      setManualError(t('nearby.invalidCoords'))
      return
    }

    submitManualLocation(parsed.lat, parsed.lng)
  }

  const hasResults = geoPhase === 'ready' && !fetchLoading && !fetchError && facilities.length > 0

  /* ── Render ────────────────────────────────────────────── */
  return (
    <div className="nearby-facility-list">
      {/* Locating */}
      {geoPhase === 'locating' && (
        <div className="geo-status geo-loading">
          <span className="geo-icon" aria-hidden="true">📍</span>
          <span>{t('nearby.detectingLocation')}</span>
        </div>
      )}

      {/* Denied / unsupported — same fallback as the Nearby Help page */}
      {geoPhase === 'denied' && (
        <div className="nearby-denied">
          <div className="geo-status geo-denied">
            <span className="geo-icon" aria-hidden="true">⚠</span>
            <span>{t('nearby.locationDenied')}</span>
          </div>
          <button type="button" className="button-secondary" onClick={retryLocation}>
            {t('nearby.tryAgain')}
          </button>
          <form className="nearby-manual-form" onSubmit={handleManualSubmit}>
            <input
              className="form-input"
              type="text"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder={t('nearby.manualPlaceholder')}
              aria-label={t('nearby.manualLabel')}
            />
            <button type="submit" className="button-secondary">{t('nearby.searchLocation')}</button>
          </form>
          {manualError && <p className="nearby-manual-error">{manualError}</p>}
        </div>
      )}

      {/* Fetch loading */}
      {geoPhase === 'ready' && fetchLoading && (
        <div className="geo-status geo-loading">
          <span className="geo-icon" aria-hidden="true">📍</span>
          <span>{t('nearby.loadingFacilities')}</span>
        </div>
      )}

      {/* Fetch error */}
      {geoPhase === 'ready' && !fetchLoading && fetchError && (
        <div className="geo-status geo-denied">
          <span className="geo-icon" aria-hidden="true">⚠</span>
          <span>{fetchError}</span>
        </div>
      )}

      {/* No results — same message the Nearby Help page shows */}
      {geoPhase === 'ready' && !fetchLoading && !fetchError && facilities.length === 0 && (
        <div className="geo-status geo-unsupported">
          <span className="geo-icon" aria-hidden="true">ℹ</span>
          <span>{t('nearby.noResults')}</span>
        </div>
      )}

      {/* Facility cards */}
      {hasResults && (
        <div className="facility-cards" role="radiogroup" aria-label={t('assessment.selectFacility')}>
          {sorted.map((f) => {
            const isSelected = selectedFacility != null && facilityKey(selectedFacility) === facilityKey(f)
            const dist = formatDistance(f.distance)
            const mapsUrl = facilityMapsUrl(f)
            const categoryLabel = CATEGORY_LABEL_KEY[f.category] ? t(CATEGORY_LABEL_KEY[f.category]) : null

            return (
              <div
                key={facilityKey(f)}
                className={`facility-card${isSelected ? ' facility-card-selected' : ''}`}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onClick={() => onSelectFacility(toSelectionPayload(f))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectFacility(toSelectionPayload(f))
                  }
                }}
              >
                {/* Header row: radio + info + distance */}
                <div className="facility-card-header">
                  <div className="facility-card-radio" aria-hidden="true">
                    <div className={`radio-circle${isSelected ? ' radio-circle-selected' : ''}`}>
                      {isSelected && <span className="radio-dot" />}
                    </div>
                  </div>

                  <div className="facility-card-main">
                    <h3 className="facility-name">{f.name}</h3>
                    <p className="facility-type">
                      {categoryLabel || f.category || ''}
                      {f.address ? ` · ${f.address}` : ''}
                    </p>
                  </div>

                  {dist && (
                    <div className="facility-distance">
                      <span className="distance-badge">~{dist}</span>
                    </div>
                  )}
                </div>

                {/* Action row: call + directions */}
                <div className="facility-card-actions">
                  {f.phone && (
                    <a
                      href={`tel:${f.phone}`}
                      className="facility-action-btn"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`${t('nearby.call')} ${f.name}`}
                    >
                      <svg className="facility-action-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                      </svg>
                      <span>{t('nearby.call')}</span>
                    </a>
                  )}
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="facility-action-btn"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`${t('nearby.directions')} ${f.name}`}
                    >
                      <svg className="facility-action-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <span>{t('nearby.directions')}</span>
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default NearbyFacilityList
