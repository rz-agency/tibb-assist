import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  getAssessments,
  getAncVisits,
  getCareMissions,
  getHomeVisits,
  getImmunizations,
  getPregnancies,
  getReferrals,
} from '../api/api'
import { RISK_LABEL_KEY, cleanSymptomLabel } from '../utils/riskLabels'
import StatusMessage from '../components/StatusMessage'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatDateTime(value) {
  if (!value) return ''
  return new Date(value).toLocaleString()
}

function getTime(value) {
  return value ? new Date(value).getTime() : 0
}

// ── Timeline entry types ───────────────────────────────────────────────────

const TYPE_STYLES = {
  assessment: { bg: 'bg-[var(--teal-100)]', fg: 'text-[var(--teal-800)]', label: 'Assessment' },
  homeVisit: { bg: 'bg-[var(--blue-100,#dbeafe)]', fg: 'text-[var(--blue-800,#1e40af)]', label: 'Home Visit' },
  ancVisit: { bg: 'bg-[var(--amber-100)]', fg: 'text-[var(--amber-800)]', label: 'ANC Visit' },
  immunization: { bg: 'bg-[var(--purple-100,#ede9fe)]', fg: 'text-[var(--purple-800,#5b21b6)]', label: 'Immunization' },
  referral: { bg: 'bg-[var(--risk-red-bg)]', fg: 'text-[var(--risk-red-fg)]', label: 'Referral' },
  careMission: { bg: 'bg-[var(--orange-100,#ffedd5)]', fg: 'text-[var(--orange-800,#9a3412)]', label: 'Care Mission' },
}

// ── Component ──────────────────────────────────────────────────────────────

function PatientDetailPage({ patientId, onBack }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [patient, setPatient] = useState(null)
  const [entries, setEntries] = useState([])

  useEffect(() => {
    if (!patientId) return
    setLoading(true)
    setError('')

    const timeline = []

    Promise.all([
      // Assessments (filter client-side for this patient)
      getAssessments()
        .then((result) => {
          const mine = (result.assessments || []).filter((a) => a.patientId === patientId)
          if (mine.length > 0 && !patient) {
            setPatient(mine[0].patient)
          }
          mine.forEach((a) => {
            timeline.push({
              type: 'assessment',
              date: a.assessmentDate,
              sortKey: getTime(a.assessmentDate),
              data: a,
            })
          })
        })
        .catch(() => {}),

      // Home visits
      getHomeVisits(patientId)
        .then((result) => {
          (result.visits || []).forEach((v) => {
            timeline.push({
              type: 'homeVisit',
              date: v.visitDate,
              sortKey: getTime(v.visitDate),
              data: v,
            })
          })
        })
        .catch(() => {}),

      // ANC visits — need pregnancies first, then visits per pregnancy
      getPregnancies(patientId)
        .then((pregResult) => {
          const pregnancies = pregResult.pregnancies || []
          return Promise.all(
            pregnancies.map((p) =>
              getAncVisits(p.id)
                .then((visitResult) => {
                  (visitResult.visits || []).forEach((v) => {
                    timeline.push({
                      type: 'ancVisit',
                      date: v.visitDate,
                      sortKey: getTime(v.visitDate),
                      data: { ...v, pregnancyStatus: p.pregnancyStatus },
                    })
                  })
                })
                .catch(() => {}),
            ),
          )
        })
        .catch(() => {}),

      // Immunizations
      getImmunizations(patientId)
        .then((result) => {
          (result.immunizations || []).forEach((v) => {
            timeline.push({
              type: 'immunization',
              date: v.dateAdministered,
              sortKey: getTime(v.dateAdministered),
              data: v,
            })
          })
        })
        .catch(() => {}),

      // Referrals (include completed, filter client-side)
      getReferrals(true)
        .then((result) => {
          (result.referrals || [])
            .filter((r) => r.patientId === patientId)
            .forEach((r) => {
              timeline.push({
                type: 'referral',
                date: r.referralDate,
                sortKey: getTime(r.referralDate),
                data: r,
              })
            })
        })
        .catch(() => {}),

      // Care missions (include completed, filter by patient via assessment)
      getCareMissions(true)
        .then((result) => {
          (result.careMissions || [])
            .filter((m) => m.assessment?.patient?.id === patientId)
            .forEach((m) => {
              timeline.push({
                type: 'careMission',
                date: m.createdAt,
                sortKey: getTime(m.createdAt),
                data: m,
              })
            })
        })
        .catch(() => {}),
    ]).then(() => {
      // Sort newest first
      timeline.sort((a, b) => b.sortKey - a.sortKey)
      setEntries(timeline)
      setLoading(false)
    })
  }, [patientId])

  if (loading) {
    return (
      <div>
        <button className="link-button mb-5" onClick={onBack}>
          &larr; {t('lhw.pageTitle')}
        </button>
        <p className="text-sm text-[var(--text-muted)]">
          {t('patientDetail.loading', { defaultValue: 'Loading patient history\u2026' })}
        </p>
      </div>
    )
  }

  return (
    <div>
      <button className="link-button mb-5" onClick={onBack}>
        &larr; {t('lhw.pageTitle')}
      </button>
      {error && <StatusMessage>{error}</StatusMessage>}

      <div className="mb-6">
        <p className="eyebrow">{t('patientDetail.eyebrow', { defaultValue: 'Patient Detail' })}</p>
        <h1 className="page-title">{patient?.fullName || t('patientDetail.unknownPatient', { defaultValue: 'Patient' })}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {t('patientDetail.timelineCount', { count: entries.length, defaultValue: `${entries.length} records` })}
        </p>
      </div>

      {entries.length === 0 && (
        <div className="content-panel">
          <p className="text-[var(--text-secondary)]">
            {t('patientDetail.noRecords', { defaultValue: 'No records found for this patient.' })}
          </p>
        </div>
      )}

      {entries.length > 0 && (
        <div className="relative space-y-0">
          {/* Timeline spine */}
          <div className="absolute top-0 bottom-0 left-[19px] w-px bg-[var(--border-soft)]" aria-hidden />

          {entries.map((entry, index) => {
            const style = TYPE_STYLES[entry.type] || TYPE_STYLES.assessment
            return (
              <div className="relative flex gap-4 pb-6" key={`${entry.type}-${entry.data.id}-${index}`}>
                {/* Timeline dot */}
                <div className={`relative z-10 mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.bg} ${style.fg}`}>
                  <span className="text-[10px] font-bold leading-none">{style.label.slice(0, 2).toUpperCase()}</span>
                </div>

                {/* Content card */}
                <div className="min-w-0 flex-1 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.bg} ${style.fg}`}>
                      {style.label}
                    </span>
                    <time className="text-xs text-[var(--text-muted)]">{formatDate(entry.date)}</time>
                  </div>

                  {/* Type-specific content */}
                  {entry.type === 'assessment' && <AssessmentEntry data={entry.data} />}
                  {entry.type === 'homeVisit' && <HomeVisitEntry data={entry.data} />}
                  {entry.type === 'ancVisit' && <AncVisitEntry data={entry.data} />}
                  {entry.type === 'immunization' && <ImmunizationEntry data={entry.data} />}
                  {entry.type === 'referral' && <ReferralEntry data={entry.data} />}
                  {entry.type === 'careMission' && <CareMissionEntry data={entry.data} />}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Type-specific entry renderers ──────────────────────────────────────────

function AssessmentEntry({ data }) {
  const { t } = useTranslation()
  const symptomSummary = (data.assessmentSymptoms || [])
    .map((s) => `${cleanSymptomLabel(s.symptom.name)} (${s.answerStatus}${s.severity ? ` ${s.severity}` : ''})`)
    .join(', ')
  return (
    <div className="mt-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`risk-badge risk-${data.riskLevel.toLowerCase()}`}>
          {t(RISK_LABEL_KEY[data.riskLevel])}
        </span>
        <span className="text-[var(--text-muted)]">{data.inputMethod}</span>
        {data.resultCode && <span className="text-xs text-[var(--text-muted)]">{data.resultCode}</span>}
      </div>
      {symptomSummary && (
        <p className="mt-1 text-[var(--text-secondary)]">{symptomSummary}</p>
      )}
      {data.triageNotes && (
        <p className="mt-1 text-[var(--text-secondary)]"><em>{data.triageNotes}</em></p>
      )}
    </div>
  )
}

function HomeVisitEntry({ data }) {
  return (
    <div className="mt-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-[var(--text-primary)]">{data.visitType?.replace('_', ' ')}</span>
        {data.bloodPressureChecked && <span className="text-xs text-[var(--teal-700)]">BP checked</span>}
      </div>
      {data.topicsDiscussed?.length > 0 && (
        <p className="mt-1 text-[var(--text-secondary)]">Topics: {data.topicsDiscussed.join(', ')}</p>
      )}
      {data.notes && <p className="mt-1 text-[var(--text-secondary)]">{data.notes}</p>}
    </div>
  )
}

function AncVisitEntry({ data }) {
  const { t } = useTranslation()
  return (
    <div className="mt-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-[var(--text-primary)]">
          {t('ancVisit.visit', { n: data.visitNumber, defaultValue: `Visit ${data.visitNumber}` })}
        </span>
        {data.gestationalWeekAtVisit != null && (
          <span className="text-xs text-[var(--text-muted)]">
            {t('pregnancy.gestationalWeek')}: {data.gestationalWeekAtVisit}
          </span>
        )}
      </div>
      {data.bloodPressure && <p className="mt-1 text-[var(--text-secondary)]">BP: {data.bloodPressure}</p>}
      {data.weightKg != null && <p className="text-[var(--text-secondary)]">{data.weightKg} kg</p>}
      {data.dangerSignsChecked && <p className="text-[var(--danger-600)]">Danger signs checked</p>}
      {data.notes && <p className="mt-1 text-[var(--text-secondary)]">{data.notes}</p>}
    </div>
  )
}

function ImmunizationEntry({ data }) {
  return (
    <div className="mt-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-[var(--text-primary)]">{data.vaccineName}-{data.doseNumber}</span>
        {data.nextDoseDate && (
          <span className="text-xs text-[var(--text-muted)]">Next: {data.nextDoseDate?.slice(0, 10)}</span>
        )}
      </div>
      {data.notes && <p className="mt-1 text-[var(--text-secondary)]">{data.notes}</p>}
    </div>
  )
}

function ReferralEntry({ data }) {
  return (
    <div className="mt-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-[var(--text-primary)]">{data.facility?.name || 'Facility'}</span>
        <span className={`status-badge status-${data.status === 'CLOSED' ? 'completed' : data.status === 'CANCELLED' ? 'cancelled' : 'recommended'}`}>
          {data.status?.replace('_', ' ')}
        </span>
      </div>
      {data.notes && <p className="mt-1 text-[var(--text-secondary)]">{data.notes}</p>}
      <p className="mt-1 text-xs text-[var(--text-muted)]">
        {data.assessment?.riskLevel && `Risk: ${data.assessment.riskLevel}`}
      </p>
    </div>
  )
}

function CareMissionEntry({ data }) {
  const { t } = useTranslation()
  return (
    <div className="mt-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`risk-badge risk-${data.riskLevel?.toLowerCase()}`}>
          {t(RISK_LABEL_KEY[data.riskLevel])}
        </span>
        <span className={`status-badge status-${data.status === 'OPEN' ? 'recommended' : data.status === 'COMPLETED' ? 'completed' : 'contacted'}`}>
          {data.status?.replace('_', ' ')}
        </span>
      </div>
    </div>
  )
}

export default PatientDetailPage
