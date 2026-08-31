import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getNearbyFacilities } from '../api/api'
import StatusMessage from '../components/StatusMessage'

// Category groupings — order matches how sections render.
const GROUPS = [
  { key: 'hospital', labelKey: 'nearby.groupHospitals' },
  { key: 'pharmacy', labelKey: 'nearby.groupPharmacies' },
  { key: 'clinic', labelKey: 'nearby.groupClinics' },
]

function NearbyFacilitiesPage() {
  const { t } = useTranslation()

  // Geolocation phase: 'locating' | 'denied' | 'ready'
  const [geoPhase, setGeoPhase] = useState('locating')
  const [coords, setCoords] = useState(null)

  // Manual location input (lat,lng)
  const [manualValue, setManualValue] = useState('')
  const [manualError, setManualError] = useState('')

  // Fetch state
  const [facilities, setFacilities] = useState([])
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState('')

  // ── Geolocation on mount ────────────────────────────────────────────────────
  // The callback-based geolocation API is an external system; the setState
  // calls inside its callback are async and legitimate.
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoPhase('denied')
      return
    }

    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setGeoPhase('ready')
      },
      () => {
        if (!cancelled) setGeoPhase('denied')
      },
      { timeout: 10000, enableHighAccuracy: false },
    )

    return () => { cancelled = true }
  }, [])

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

  // ── Manual input handler ────────────────────────────────────────────────────
  const handleManualSubmit = (e) => {
    e.preventDefault()
    setManualError('')

    const trimmed = manualValue.trim()
    const parts = trimmed.split(',').map((s) => s.trim())

    if (parts.length !== 2 || parts.some((p) => Number.isNaN(Number(p)))) {
      setManualError(t('nearby.invalidCoords'))
      return
    }

    const lat = Number(parts[0])
    const lng = Number(parts[1])

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setManualError(t('nearby.invalidCoords'))
      return
    }

    setCoords({ lat, lng })
    setGeoPhase('ready')
  }

  // ── Grouped results ─────────────────────────────────────────────────────────
  const grouped = GROUPS.map(({ key, labelKey }) => ({
    key,
    label: t(labelKey),
    items: facilities.filter((f) => f.category === key),
  }))

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div>
      <p className="eyebrow">{t('nearby.eyebrow')}</p>
      <h1 className="page-title">{t('nearby.pageTitle')}</h1>
      <p className="mt-3 text-[var(--text-secondary)]">{t('nearby.subtitle')}</p>

      {/* ── Geolocation loading ────────────────────────────────────────────── */}
      {geoPhase === 'locating' && (
        <section className="content-panel mt-6">
          <p className="text-sm text-[var(--text-muted)]">{t('nearby.detectingLocation')}</p>
        </section>
      )}

      {/* ── Geolocation denied / unsupported ───────────────────────────────── */}
      {geoPhase === 'denied' && (
        <section className="content-panel mt-6 space-y-5">
          <StatusMessage>{t('nearby.locationDenied')}</StatusMessage>
          <button
            className="button-secondary"
            onClick={() => {
              setGeoPhase('locating')
              if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
                    setGeoPhase('ready')
                  },
                  () => setGeoPhase('denied'),
                  { timeout: 10000, enableHighAccuracy: false },
                )
              } else {
                setGeoPhase('denied')
              }
            }}
          >
            {t('nearby.tryAgain')}
          </button>

          <form className="space-y-3" onSubmit={handleManualSubmit}>
            <p className="text-sm font-semibold text-[var(--text-primary)]">{t('nearby.manualLabel')}</p>
            <p className="text-sm text-[var(--text-muted)]">{t('nearby.manualHint')}</p>
            <input
              className="form-input"
              type="text"
              value={manualValue}
              onChange={(e) => setManualValue(e.target.value)}
              placeholder={t('nearby.manualPlaceholder')}
              required
            />
            {manualError && <StatusMessage>{manualError}</StatusMessage>}
            <button className="button-primary" type="submit">
              {t('nearby.searchLocation')}
            </button>
          </form>
        </section>
      )}

      {/* ── Fetch loading (skeleton) ──────────────────────────────────────── */}
      {geoPhase === 'ready' && fetchLoading && (
        <section className="content-panel mt-6 space-y-4">
          <p className="text-sm text-[var(--text-muted)]">{t('nearby.loadingFacilities')}</p>
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2 rounded-lg border border-[var(--border-soft)] p-4">
              <div className="skeleton h-4 w-1/3" />
              <div className="skeleton h-3 w-2/3" />
              <div className="skeleton h-3 w-1/4" />
            </div>
          ))}
        </section>
      )}

      {/* ── Fetch error ───────────────────────────────────────────────────── */}
      {geoPhase === 'ready' && !fetchLoading && fetchError && (
        <section className="content-panel mt-6">
          <StatusMessage>{fetchError}</StatusMessage>
        </section>
      )}

      {/* ── Success: grouped results ──────────────────────────────────────── */}
      {geoPhase === 'ready' && !fetchLoading && !fetchError && (
        <div className="mt-6 space-y-8">
          {facilities.length === 0 && (
            <section className="content-panel">
              <p className="text-[var(--text-secondary)]">{t('nearby.noResults')}</p>
            </section>
          )}

          {grouped.map(({ key, label, items }) => (
            <section key={key} className="content-panel">
              <h2 className="mb-4 text-lg font-semibold text-[var(--text-primary)]">{label}</h2>
              {items.length === 0 && (
                <p className="text-sm text-[var(--text-muted)]">{t('nearby.noneInCategory')}</p>
              )}
              <div className="space-y-3">
                {items.map((f, idx) => (
                  <FacilityCard key={`${f.name}-${idx}`} facility={f} t={t} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Facility card ───────────────────────────────────────────────────────────

function FacilityCard({ facility, t }) {
  const { name, address, phone, lat, lng } = facility
  const mapsUrl =
    lat != null && lng != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
      : null

  return (
    <article className="compact-card">
      <p className="font-semibold text-[var(--text-primary)]">{name}</p>
      {address && <p className="mt-1 text-sm text-[var(--text-secondary)]">{address}</p>}
      <div className="mt-3 flex flex-wrap gap-3">
        {phone && (
          <a
            href={`tel:${phone}`}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium"
            style={{ background: 'var(--teal-50)', color: 'var(--teal-700)', border: '1px solid var(--teal-200)' }}
          >
            {t('nearby.call')} {phone}
          </a>
        )}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium"
            style={{ background: '#eef4ff', color: '#2563eb', border: '1px solid #c7d9f7' }}
          >
            {t('nearby.directions')}
          </a>
        )}
      </div>
      {/* isOpenNow is intentionally not rendered — OSM opening_hours needs a
          parser library to evaluate reliably. Follow-up task. */}
    </article>
  )
}

export default NearbyFacilitiesPage
