import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getReferral, getReferrals, updateReferralStatus } from '../api/api'
import StatusMessage from '../components/StatusMessage'

const RISK_LABEL_KEY = { GREEN: 'assessment.riskGreen', YELLOW: 'assessment.riskYellow', RED: 'assessment.riskRed' }

const STATUS_KEY = ['RECOMMENDED', 'FACILITY_SELECTED', 'FACILITY_CONTACTED', 'TRANSPORT_ARRANGED', 'PATIENT_DEPARTED', 'PATIENT_ARRIVED', 'FOLLOW_UP_DUE', 'CLOSED']

const TERMINAL_STATUSES = new Set(['CLOSED', 'CANCELLED'])

function statusBadgeClass(status) {
  if (TERMINAL_STATUSES.has(status)) return `status-badge status-${status.toLowerCase()}`
  return 'status-badge status-recommended'
}

function StatusTimeline({ currentStatus }) {
  const currentIdx = STATUS_KEY.indexOf(currentStatus)
  return (
    <div className="referral-timeline-steps">
      {STATUS_KEY.map((status, idx) => {
        const done = currentIdx >= idx
        const active = currentIdx === idx
        return (
          <div key={status} className={`referral-step ${done ? 'referral-step-done' : ''} ${active ? 'referral-step-active' : ''}`}>
            <span className="referral-step-dot" />
            <span className="referral-step-label">{status.replace(/_/g, ' ')}</span>
          </div>
        )
      })}
    </div>
  )
}

function ReferralDetailView({ referral, onBack, onRefresh, t }) {
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [cancelNote, setCancelNote] = useState('')

  const allowed = referral.allowedTransitions || []
  const isTerminal = TERMINAL_STATUSES.has(referral.status)

  const handleAdvance = async (nextStatus) => {
    setUpdating(true)
    setError('')
    setSuccess('')
    try {
      await updateReferralStatus(referral.id, nextStatus)
      setSuccess(t('referral.updateSuccess'))
      await onRefresh()
    } catch (err) {
      setError(err.message || t('referral.updateFailed'))
    } finally {
      setUpdating(false)
    }
  }

  const handleCancel = async () => {
    if (!cancelNote.trim()) {
      setError(t('referral.cancellationNotePlaceholder'))
      return
    }
    setUpdating(true)
    setError('')
    setSuccess('')
    try {
      await updateReferralStatus(referral.id, 'CANCELLED', cancelNote.trim())
      setSuccess(t('referral.updateSuccess'))
      setShowCancel(false)
      setCancelNote('')
      await onRefresh()
    } catch (err) {
      setError(err.message || t('referral.updateFailed'))
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div>
      <button className="back-link" onClick={onBack}>{t('referral.backToList')}</button>

      <section className="content-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{t('referral.pageTitle')}</p>
            <h1 className="text-2xl font-bold text-slate-900">{referral.facility?.name || t('referral.facility')}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {referral.facility?.facilityType?.replace('_', ' ')}
              {referral.facility?.city ? ` · ${referral.facility.city}` : ''}
            </p>
          </div>
          <span className={statusBadgeClass(referral.status)}>
            {t(`referral.${referral.status}`, referral.status)}
          </span>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div><span className="text-xs font-semibold uppercase text-slate-500">{t('referral.referralDate')}</span><p className="text-sm">{new Date(referral.referralDate).toLocaleDateString()}</p></div>
          <div><span className="text-xs font-semibold uppercase text-slate-500">{t('referral.riskLevel')}</span><p className="text-sm"><span className={`risk-${referral.assessment?.riskLevel?.toLowerCase()}`}>{t(RISK_LABEL_KEY[referral.assessment?.riskLevel])}</span></p></div>
          <div><span className="text-xs font-semibold uppercase text-slate-500">{t('referral.facility')}</span><p className="text-sm">{referral.facility?.name || '—'}</p></div>
        </div>
      </section>

      {/* Visual progress timeline */}
      <section className="content-panel">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{t('referral.nextStep')}</h2>
        <StatusTimeline currentStatus={referral.status} />
      </section>

      {/* Action buttons */}
      {!isTerminal && !showCancel && (
        <section className="content-panel">
          <div className="flex flex-wrap gap-3">
            {allowed.filter((s) => s !== 'CANCELLED').map((nextStatus) => (
              <button
                key={nextStatus}
                className="button-primary"
                disabled={updating}
                onClick={() => handleAdvance(nextStatus)}
              >
                {updating ? '...' : `${t('referral.advanceTo')} ${t(`referral.${nextStatus}`, nextStatus)}`}
              </button>
            ))}
            <button className="button-secondary" onClick={() => setShowCancel(true)}>
              {t('referral.cancelReferral')}
            </button>
          </div>
        </section>
      )}

      {showCancel && (
        <section className="content-panel">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-red-600">{t('referral.cancelReferral')}</h2>
          <label className="form-label mt-3">
            {t('referral.cancellationNote')}
            <textarea
              className="form-input mt-1"
              rows={3}
              placeholder={t('referral.cancellationNotePlaceholder')}
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-3">
            <button className="button-primary bg-red-600 hover:bg-red-700" disabled={updating} onClick={handleCancel}>
              {updating ? '...' : t('referral.confirmCancel')}
            </button>
            <button className="button-secondary" onClick={() => { setShowCancel(false); setCancelNote('') }}>
              {t('referral.cancelBack')}
            </button>
          </div>
        </section>
      )}

      {error && <StatusMessage>{error}</StatusMessage>}
      {success && <StatusMessage tone="success">{success}</StatusMessage>}

      {/* Status history */}
      <section className="content-panel">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">{t('referral.statusHistory')}</h2>
        {!referral.statusHistory || referral.statusHistory.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">{t('referral.noHistory')}</p>
        ) : (
          <div className="mt-3 space-y-3">
            {referral.statusHistory.map((entry) => (
              <div className="timeline-entry" key={entry.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {entry.fromStatus ? t(`referral.${entry.fromStatus}`, entry.fromStatus) : '—'}
                      {' → '}
                      <strong>{t(`referral.${entry.toStatus}`, entry.toStatus)}</strong>
                    </p>
                    {entry.note && <p className="mt-1 text-xs text-slate-500">{entry.note}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function ReferralJourneyPage({ user }) {
  const { t } = useTranslation()
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [selectedLoading, setSelectedLoading] = useState(false)
  const [includeCompleted, setIncludeCompleted] = useState(false)

  const loadList = useCallback(() => {
    setLoading(true)
    setError('')
    getReferrals(includeCompleted)
      .then((result) => setReferrals(result.referrals))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [includeCompleted])

  useEffect(() => { loadList() }, [loadList])

  const loadFullDetail = async (id) => {
    try {
      const result = await getReferral(id)
      setSelected({ ...result.referral, allowedTransitions: result.allowedTransitions })
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSelect = async (referral) => {
    setSelectedLoading(true)
    setSelected(null)
    await loadFullDetail(referral.id)
    setSelectedLoading(false)
  }

  const handleRefresh = async () => {
    if (selected?.id) {
      await loadFullDetail(selected.id)
    }
    loadList()
  }

  if (selectedLoading) return <p className="text-slate-600">{t('referral.loading')}</p>

  if (selected) {
    return <ReferralDetailView referral={selected} onBack={() => setSelected(null)} onRefresh={handleRefresh} t={t} />
  }

  return (
    <div>
      <p className="eyebrow">{t('referral.pageTitle')}</p>
      <h1 className="text-2xl font-bold text-slate-900">{t('referral.pageTitle')}</h1>
      <p className="mt-2 text-sm text-slate-500">{t('referral.subtitle')}</p>

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={includeCompleted} onChange={(e) => setIncludeCompleted(e.target.checked)} />
        {t('referral.showCompleted')}
      </label>

      {loading && <p className="mt-4 text-slate-600">{t('referral.loading')}</p>}
      {error && <StatusMessage>{error}</StatusMessage>}

      {!loading && !error && referrals.length === 0 && (
        <p className="mt-4 text-slate-500">{t('referral.noReferrals')}</p>
      )}

      {!loading && referrals.length > 0 && (
        <div className="mt-4 space-y-3">
          {referrals.map((referral) => (
            <button
              key={referral.id}
              className="cm-mission-card cm-mission-yellow w-full text-left"
              onClick={() => handleSelect(referral)}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <strong className="text-sm text-slate-900">{referral.facility?.name || '—'}</strong>
                  <p className="mt-1 text-xs text-slate-500">
                    {new Date(referral.referralDate).toLocaleDateString()}
                    {referral.assessment?.riskLevel && (
                      <> · <span className={`risk-${referral.assessment.riskLevel.toLowerCase()}`}>{t(RISK_LABEL_KEY[referral.assessment.riskLevel])}</span></>
                    )}
                  </p>
                </div>
                <span className={statusBadgeClass(referral.status)}>
                  {t(`referral.${referral.status}`, referral.status)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ReferralJourneyPage
