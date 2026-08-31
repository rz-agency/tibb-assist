import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCareMissions, getCareMission, updateChecklistItem } from '../api/api'
import StatusMessage from '../components/StatusMessage'

const RISK_LABEL_KEY = { GREEN: 'assessment.riskGreen', YELLOW: 'assessment.riskYellow', RED: 'assessment.riskRed' }

function cleanSymptomLabel(name) {
  const cleaned = name.replace(/^(Severe|Heavy)\s+/i, '').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned
}

function formatDate(value) {
  return new Date(value).toLocaleString()
}

function CareMissionPage({ user }) {
  const { t } = useTranslation()
  const [missions, setMissions] = useState([])
  const [selectedMission, setSelectedMission] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [checklistUpdating, setChecklistUpdating] = useState(null)

  const loadMissions = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await getCareMissions()
      setMissions(result.careMissions)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadMissions() }, [])

  const openMission = async (id) => {
    setDetailLoading(true)
    setError('')
    try {
      const result = await getCareMission(id)
      setSelectedMission(result.careMission)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const toggleChecklist = async (itemId, currentValue) => {
    if (!selectedMission) return
    const newValue = !currentValue
    setChecklistUpdating(itemId)

    const prevItems = selectedMission.checklistItems.map((item) => ({ ...item }))
    setSelectedMission((prev) => ({
      ...prev,
      checklistItems: prev.checklistItems.map((item) =>
        item.id === itemId ? { ...item, isCompleted: newValue } : item,
      ),
    }))

    try {
      await updateChecklistItem(selectedMission.id, itemId, newValue)
      await openMission(selectedMission.id)
    } catch (requestError) {
      setSelectedMission((prev) => ({
        ...prev,
        checklistItems: prevItems,
      }))
      setError(requestError.message)
    } finally {
      setChecklistUpdating(null)
    }
  }

  const completedCount = selectedMission?.checklistItems.filter((i) => i.isCompleted).length ?? 0
  const totalCount = selectedMission?.checklistItems.length ?? 0

  if (loading) {
    return <section className="content-panel"><p className="text-sm text-[var(--text-muted)]">{t('careMission.loading')}</p></section>
  }

  if (error && missions.length === 0 && !selectedMission) {
    return (
      <section className="content-panel">
        <h1 className="section-title">{t('careMission.pageTitle')}</h1>
        <StatusMessage>{error}</StatusMessage>
      </section>
    )
  }

  // ---------- DETAIL VIEW ----------

  if (selectedMission) {
    const risk = selectedMission.riskLevel.toLowerCase()
    return (
      <div>
        <button className="link-button mb-5" onClick={() => setSelectedMission(null)}>
          ← {t('careMission.backToList')}
        </button>
        {error && <StatusMessage>{error}</StatusMessage>}
        {detailLoading && <p className="text-sm text-[var(--text-muted)]">{t('careMission.loadingDetail')}</p>}

        <section className="content-panel">
          {/* Header — risk + status */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{t('careMission.pageTitle')}</p>
              <div className={`cm-risk-banner cm-risk-banner-${risk}`}>
                <span className="cm-risk-icon">{risk === 'red' ? '!' : 'i'}</span>
                <div>
                  <p className="cm-risk-level">{t(RISK_LABEL_KEY[selectedMission.riskLevel])}</p>
                  <p className="cm-risk-explanation">{t(`careMission.${risk}Explanation`)}</p>
                </div>
              </div>
            </div>
            <span className={`status-badge status-${selectedMission.status.toLowerCase() === 'open' ? 'recommended' : selectedMission.status.toLowerCase() === 'completed' ? 'completed' : 'contacted'}`}>
              {selectedMission.status.replace('_', ' ')}
            </span>
          </div>

          {/* Patient (LHW view) */}
          {user.role === 'LHW' && selectedMission.assessment?.patient && (
            <div className="mt-4">
              <span className="detail-label">{t('careMission.patient')}</span>
              <p className="font-semibold text-[var(--text-primary)]">{selectedMission.assessment.patient.fullName}</p>
              {selectedMission.assessment.patient.phone && (
                <p className="text-sm text-[var(--text-muted)]">{selectedMission.assessment.patient.phone}</p>
              )}
            </div>
          )}

          {/* Assessment summary */}
          <div className="mt-6">
            <h2 className="font-semibold text-[var(--text-primary)]">{t('careMission.assessmentSummary')}</h2>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <span className="detail-label">{t('careMission.assessmentDate')}</span>
                <span>{formatDate(selectedMission.assessment.assessmentDate)}</span>
              </div>
              {selectedMission.assessment.inputMethod && (
                <div>
                  <span className="detail-label">{t('history.inputMethod')}</span>
                  <span>{selectedMission.assessment.inputMethod}</span>
                </div>
              )}
            </div>
            {selectedMission.assessment.triageNotes && (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">{t('careMission.triageNotes')} {selectedMission.assessment.triageNotes}</p>
            )}
            {selectedMission.assessment.assessmentSymptoms?.length > 0 && (
              <ul className="mt-3 space-y-1">
                {selectedMission.assessment.assessmentSymptoms
                  .filter((s) => s.answerStatus !== 'UNKNOWN')
                  .map((item, i) => (
                    <li className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2 text-sm" key={i}>
                      <span className="font-medium text-[var(--text-primary)]">{cleanSymptomLabel(item.symptom.name)}</span>
                      <span className="ms-2 text-[var(--text-muted)]">
                        {item.answerStatus}{item.severity ? ` · ${item.severity}` : ''}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </div>

          {/* Checklist */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[var(--text-primary)]">{t('careMission.checklistTitle')}</h2>
              <span className="text-sm text-[var(--text-muted)]">{completedCount}/{totalCount}</span>
            </div>
            <div className="cm-progress-bar"><div className="cm-progress-fill" style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }} /></div>
            <ul className="mt-3 space-y-2">
              {selectedMission.checklistItems.map((item) => (
                <li key={item.id}>
                  <button
                    className={`cm-checklist-item ${item.isCompleted ? 'cm-checklist-done' : ''}`}
                    onClick={() => toggleChecklist(item.id, item.isCompleted)}
                    disabled={checklistUpdating === item.id}
                  >
                    <span className="cm-checklist-check">{item.isCompleted ? '✓' : '○'}</span>
                    <span className={`cm-checklist-label ${item.isCompleted ? 'line-through text-slate-400' : ''}`}>
                      {item.taskLabel}
                    </span>
                    {checklistUpdating === item.id && <span className="cm-checklist-spinner">…</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Timeline */}
          {selectedMission.timelineEntries?.length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold text-[var(--text-primary)]">{t('careMission.timelineTitle')}</h2>
              <div className="cm-timeline">
                {selectedMission.timelineEntries.map((entry, index) => (
                  <div className="cm-timeline-entry" key={entry.id}>
                    <div className="cm-timeline-dot" />
                    {index < selectedMission.timelineEntries.length - 1 && <div className="cm-timeline-line" />}
                    <div className="cm-timeline-content">
                      <p className="cm-timeline-action">{entry.notes || entry.action.replace(/_/g, ' ')}</p>
                      <p className="cm-timeline-time">{formatDate(entry.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Referral */}
          <div className="mt-6">
            <h2 className="font-semibold text-[var(--text-primary)]">{t('careMission.referralSection')}</h2>
            {selectedMission.referral ? (
              <div className="cm-info-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{selectedMission.referral.facility?.name}</p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {selectedMission.referral.facility?.facilityType?.replace('_', ' ')}
                      {selectedMission.referral.facility?.city ? ` · ${selectedMission.referral.facility.city}` : ''}
                    </p>
                  </div>
                  <span className={`status-badge status-${selectedMission.referral.status.toLowerCase()}`}>
                    {selectedMission.referral.status}
                  </span>
                </div>
                {selectedMission.referral.notes && (
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">{selectedMission.referral.notes}</p>
                )}
                <p className="mt-2 text-xs text-[var(--text-muted)]">
                  {t('careMission.referralDate')} {new Date(selectedMission.referral.referralDate).toLocaleDateString()}
                </p>
                {selectedMission.referral.facility?.phone && (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{t('careMission.phone')} {selectedMission.referral.facility.phone}</p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-[var(--text-muted)]">{t('careMission.noReferral')}</p>
            )}
          </div>

          {/* Assigned LHW */}
          {selectedMission.assignedLhw && (
            <div className="mt-6">
              <h2 className="font-semibold text-[var(--text-primary)]">{t('careMission.assignedLhw')}</h2>
              <div className="cm-info-card">
                <p className="font-semibold text-[var(--text-primary)]">{selectedMission.assignedLhw.fullName}</p>
                {selectedMission.assignedLhw.phone && (
                  <p className="text-sm text-[var(--text-secondary)]">{t('careMission.phone')} {selectedMission.assignedLhw.phone}</p>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    )
  }

  // ---------- LIST VIEW ----------

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">{t('careMission.pageTitle')}</p>
        <h1 className="page-title">{t('careMission.pageTitle')}</h1>
        <p className="mt-3 text-[var(--text-secondary)]">{t('careMission.subtitle')}</p>
      </div>
      {error && <StatusMessage>{error}</StatusMessage>}
      {missions.length === 0 && !error && (
        <section className="content-panel">
          <p className="text-[var(--text-secondary)]">{t('careMission.noMissions')}</p>
        </section>
      )}
      {missions.length > 0 && (
        <div className="space-y-3">
          {missions.map((mission) => {
            const risk = mission.riskLevel.toLowerCase()
            return (
              <button className={`cm-mission-card cm-mission-${risk}`} key={mission.id} onClick={() => openMission(mission.id)}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={`risk-badge risk-${risk}`}>{t(RISK_LABEL_KEY[mission.riskLevel])}</span>
                    <p className="mt-1 font-semibold text-[var(--text-primary)]">
                      {user.role === 'LHW' && mission.assessment?.patient
                        ? mission.assessment.patient.fullName
                        : t('careMission.pageTitle')}
                    </p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">
                      {new Date(mission.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className={`status-badge status-${mission.status.toLowerCase() === 'open' ? 'recommended' : mission.status.toLowerCase() === 'completed' ? 'completed' : 'contacted'}`}>
                    {mission.status.replace('_', ' ')}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CareMissionPage
