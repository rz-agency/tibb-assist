import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAdminLhwOverview } from '../api/api'
import StatusMessage from '../components/StatusMessage'

function AdminDashboardPage({ user, onNavigate }) {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [lhws, setLhws] = useState([])

  useEffect(() => {
    getAdminLhwOverview()
      .then((result) => setLhws(result.lhws))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">{t('admin.loading', { defaultValue: 'Loading LHW overview\u2026' })}</p>
  }

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">{t('admin.eyebrow', { defaultValue: 'Supervisor Dashboard' })}</p>
        <h1 className="page-title">{t('admin.pageTitle', { defaultValue: 'LHW Overview' })}</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          {t('admin.subtitle', { defaultValue: 'Workload summary for all Lady Health Workers this month.' })}
        </p>
      </div>

      {error && <StatusMessage>{error}</StatusMessage>}

      {lhws.length === 0 && !error && (
        <div className="content-panel">
          <p className="text-[var(--text-secondary)]">
            {t('admin.noLhws', { defaultValue: 'No LHWs are registered yet.' })}
          </p>
        </div>
      )}

      {lhws.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--border-soft)] text-left">
                <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">{t('admin.colName', { defaultValue: 'LHW' })}</th>
                <th className="px-3 py-2 font-semibold text-[var(--text-primary)]">{t('admin.colRegion', { defaultValue: 'Region' })}</th>
                <th className="px-3 py-2 text-center font-semibold text-[var(--text-primary)]">{t('admin.colAssigned', { defaultValue: 'Assigned' })}</th>
                <th className="px-3 py-2 text-center font-semibold text-[var(--risk-red-fg)]">{t('admin.colOpenRed', { defaultValue: 'Open RED' })}</th>
                <th className="px-3 py-2 text-center font-semibold text-[var(--text-primary)]">{t('admin.colOverdue', { defaultValue: 'Overdue' })}</th>
                <th className="px-3 py-2 text-center font-semibold text-[var(--text-primary)]">{t('admin.colVisits', { defaultValue: 'Visits' })}</th>
                <th className="px-3 py-2 text-center font-semibold text-[var(--text-primary)]">{t('admin.colReferrals', { defaultValue: 'Ref. Closed' })}</th>
                <th className="px-3 py-2 font-semibold text-[var(--text-primary)]"></th>
              </tr>
            </thead>
            <tbody>
              {lhws.map((lhw) => (
                <tr key={lhw.lhwId} className="border-b border-[var(--border-soft)] hover:bg-[var(--bg-subtle)]">
                  <td className="px-3 py-3">
                    <div>
                      <strong className="text-[var(--text-primary)]">{lhw.fullName}</strong>
                      <small className="block text-[var(--text-muted)]">{lhw.email}</small>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[var(--text-secondary)]">{lhw.region?.replace('_', ' ') || '\u2014'}</td>
                  <td className="px-3 py-3 text-center">
                    <span className="inline-block rounded-full bg-[var(--bg-subtle)] px-2.5 py-0.5 text-xs font-semibold">
                      {lhw.assignedPatients}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-center">
                    {lhw.openRedCareMissions > 0 ? (
                      <span className="inline-block rounded-full bg-[var(--risk-red-bg)] px-2.5 py-0.5 text-xs font-bold text-[var(--risk-red-fg)]">
                        {lhw.openRedCareMissions}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">0</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center">
                    {lhw.overdueFollowUps > 0 ? (
                      <span className="inline-block rounded-full bg-[var(--amber-100)] px-2.5 py-0.5 text-xs font-bold text-[var(--amber-800)]">
                        {lhw.overdueFollowUps}
                      </span>
                    ) : (
                      <span className="text-[var(--text-muted)]">0</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center text-[var(--text-primary)]">{lhw.homeVisitsThisMonth}</td>
                  <td className="px-3 py-3 text-center text-[var(--text-primary)]">{lhw.referralsClosedThisMonth}</td>
                  <td className="px-3 py-3">
                    <button
                      className="text-xs text-[var(--teal-700)] hover:underline"
                      onClick={() => onNavigate(`monthly-report:${lhw.userId}`)}
                    >
                      {t('admin.viewReport', { defaultValue: 'Monthly report \u2192' })}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default AdminDashboardPage
