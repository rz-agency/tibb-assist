import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAdminMonthlyReport, getLhwMonthlyReport } from '../api/api'
import StatusMessage from '../components/StatusMessage'

const RISK_LABEL_KEY = { GREEN: 'risk.green', YELLOW: 'risk.yellow', RED: 'risk.red' }

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString()
}

function MonthlyReportPage({ userId, user, onBack }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [report, setReport] = useState(null)

  useEffect(() => {
    const fetcher = user?.role === 'ADMIN'
      ? getAdminMonthlyReport(userId)
      : getLhwMonthlyReport(userId)
    fetcher
      .then((data) => setReport(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [userId, user])

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">{t('monthlyReport.loading', { defaultValue: 'Loading monthly report\u2026' })}</p>
  }

  if (error) {
    return (
      <div>
        <button className="link-button mb-4" onClick={onBack}>{'\u2190'} {t('common.back', { defaultValue: 'Back' })}</button>
        <StatusMessage>{error}</StatusMessage>
      </div>
    )
  }

  if (!report) return null

  const { lhw, month, stats, homeVisits, assessments, referrals, completedFollowUps } = report

  return (
    <div>
      {/* Screen-only controls */}
      <div className="print-hide mb-4 flex flex-wrap items-center gap-3">
        <button className="link-button" onClick={onBack}>
          {'\u2190'} {t('common.back', { defaultValue: 'Back' })}
        </button>
        <button className="button-secondary" onClick={() => window.print()}>
          {t('monthlyReport.print', { defaultValue: 'Print / Save PDF' })}
        </button>
      </div>

      {/* Report body */}
      <div className="report-content">
        <header className="mb-6 border-b border-[var(--border-soft)] pb-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em]" style={{ color: 'var(--teal-700)' }}>
            {t('monthlyReport.eyebrow', { defaultValue: 'Tibb Assist \u2014 Monthly Report' })}
          </p>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">{lhw.fullName}</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            {month} &middot; {lhw.region?.replace('_', ' ') || ''}
            {lhw.phone ? ` \u00B7 ${lhw.phone}` : ''}
          </p>
        </header>

        {/* Stats grid */}
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-[var(--text-secondary)]">
            {t('monthlyReport.summaryHeading', { defaultValue: 'Month at a glance' })}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <StatCard label={t('monthlyReport.assignedWomen', { defaultValue: 'Assigned women' })} value={stats.assignedPatients} />
            <StatCard label={t('monthlyReport.openRed', { defaultValue: 'Open RED cases' })} value={stats.openRedCareMissions} highlight={stats.openRedCareMissions > 0} danger />
            <StatCard label={t('monthlyReport.overdueFollowUps', { defaultValue: 'Overdue follow-ups' })} value={stats.overdueFollowUps} highlight={stats.overdueFollowUps > 0} warning />
            <StatCard label={t('monthlyReport.visitsLogged', { defaultValue: 'Visits logged' })} value={stats.homeVisitsThisMonth} />
            <StatCard label={t('monthlyReport.referralsClosed', { defaultValue: 'Referrals closed' })} value={stats.referralsClosedThisMonth} />
          </div>
        </section>

        {/* Home visits */}
        <section className="mb-6">
          <h2 className="mb-2 font-semibold text-[var(--text-primary)]">
            {t('monthlyReport.visitsTitle', { defaultValue: 'Home visits this month' })}
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">({homeVisits.length})</span>
          </h2>
          {homeVisits.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t('monthlyReport.noVisits', { defaultValue: 'No home visits logged this month.' })}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)]">
                  <th className="px-2 py-1 text-left font-medium">{t('monthlyReport.date', { defaultValue: 'Date' })}</th>
                  <th className="px-2 py-1 text-left font-medium">{t('monthlyReport.patient', { defaultValue: 'Patient' })}</th>
                  <th className="px-2 py-1 text-left font-medium">{t('monthlyReport.type', { defaultValue: 'Type' })}</th>
                </tr>
              </thead>
              <tbody>
                {homeVisits.map((v) => (
                  <tr key={v.id} className="border-b border-[var(--border-soft)]">
                    <td className="px-2 py-1">{formatDate(v.visitDate)}</td>
                    <td className="px-2 py-1">{v.patient?.fullName || '\u2014'}</td>
                    <td className="px-2 py-1">{v.visitType?.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Assessments */}
        <section className="mb-6">
          <h2 className="mb-2 font-semibold text-[var(--text-primary)]">
            {t('monthlyReport.assessmentsTitle', { defaultValue: 'Assessments this month' })}
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">({assessments.length})</span>
          </h2>
          {assessments.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t('monthlyReport.noAssessments', { defaultValue: 'No assessments recorded this month.' })}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)]">
                  <th className="px-2 py-1 text-left font-medium">{t('monthlyReport.date', { defaultValue: 'Date' })}</th>
                  <th className="px-2 py-1 text-left font-medium">{t('monthlyReport.patient', { defaultValue: 'Patient' })}</th>
                  <th className="px-2 py-1 text-left font-medium">{t('monthlyReport.riskLevel', { defaultValue: 'Risk' })}</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.id} className="border-b border-[var(--border-soft)]">
                    <td className="px-2 py-1">{formatDate(a.assessmentDate)}</td>
                    <td className="px-2 py-1">{a.patient?.fullName || '\u2014'}</td>
                    <td className="px-2 py-1">
                      <span className={`risk-badge risk-${a.riskLevel.toLowerCase()}`}>
                        {t(RISK_LABEL_KEY[a.riskLevel], { defaultValue: a.riskLevel })}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Referrals */}
        <section className="mb-6">
          <h2 className="mb-2 font-semibold text-[var(--text-primary)]">
            {t('monthlyReport.referralsTitle', { defaultValue: 'Referrals this month' })}
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">({referrals.length})</span>
          </h2>
          {referrals.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t('monthlyReport.noReferrals', { defaultValue: 'No referrals made this month.' })}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)]">
                  <th className="px-2 py-1 text-left font-medium">{t('monthlyReport.date', { defaultValue: 'Date' })}</th>
                  <th className="px-2 py-1 text-left font-medium">{t('monthlyReport.patient', { defaultValue: 'Patient' })}</th>
                  <th className="px-2 py-1 text-left font-medium">{t('monthlyReport.facility', { defaultValue: 'Facility' })}</th>
                  <th className="px-2 py-1 text-left font-medium">{t('monthlyReport.status', { defaultValue: 'Status' })}</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--border-soft)]">
                    <td className="px-2 py-1">{formatDate(r.referralDate)}</td>
                    <td className="px-2 py-1">{r.patient?.fullName || '\u2014'}</td>
                    <td className="px-2 py-1">{r.facility?.name || '\u2014'}{r.facility?.city ? `, ${r.facility.city}` : ''}</td>
                    <td className="px-2 py-1">{r.status?.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Completed follow-ups */}
        <section className="mb-6">
          <h2 className="mb-2 font-semibold text-[var(--text-primary)]">
            {t('monthlyReport.followUpsTitle', { defaultValue: 'Follow-ups completed this month' })}
            <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">({completedFollowUps.length})</span>
          </h2>
          {completedFollowUps.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">{t('monthlyReport.noFollowUps', { defaultValue: 'No follow-ups completed this month.' })}</p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border-soft)]">
                  <th className="px-2 py-1 text-left font-medium">{t('monthlyReport.completedDate', { defaultValue: 'Completed' })}</th>
                  <th className="px-2 py-1 text-left font-medium">{t('monthlyReport.patient', { defaultValue: 'Patient' })}</th>
                  <th className="px-2 py-1 text-left font-medium">{t('monthlyReport.type', { defaultValue: 'Type' })}</th>
                </tr>
              </thead>
              <tbody>
                {completedFollowUps.map((f) => (
                  <tr key={f.id} className="border-b border-[var(--border-soft)]">
                    <td className="px-2 py-1">{formatDate(f.completedAt)}</td>
                    <td className="px-2 py-1">{f.patient?.fullName || '\u2014'}</td>
                    <td className="px-2 py-1">{f.type?.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <footer className="mt-8 border-t border-[var(--border-soft)] pt-3 text-xs text-[var(--text-muted)]">
          {t('monthlyReport.generated', { defaultValue: 'Generated by Tibb Assist' })} &middot; {new Date().toLocaleString()}
        </footer>
      </div>

      <style>{`
        @media print {
          .print-hide { display: none !important; }
          body { font-size: 11pt; }
          .report-content { max-width: 100%; }
          table { page-break-inside: avoid; }
          section { page-break-inside: avoid; }
          .risk-badge { border: 1px solid currentColor; padding: 0 4px; }
        }
      `}</style>
    </div>
  )
}

function StatCard({ label, value, highlight, danger, warning }) {
  let colorClass = 'text-[var(--text-primary)]'
  if (highlight && danger) colorClass = 'text-[var(--risk-red-fg)]'
  else if (highlight && warning) colorClass = 'text-[var(--amber-700)]'
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2">
      <p className={`text-lg font-bold ${colorClass}`}>{value}</p>
      <p className="text-xs text-[var(--text-muted)]">{label}</p>
    </div>
  )
}

export default MonthlyReportPage
