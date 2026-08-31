import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAssessment, getAssessments } from '../api/api'
import StatusMessage from '../components/StatusMessage'
import { ClipboardIcon, ShieldIcon } from '../components/Illustrations'

const RISK_LABEL_KEY = { GREEN: 'assessment.riskGreen', YELLOW: 'assessment.riskYellow', RED: 'assessment.riskRed' }
const INPUT_METHOD_KEY = { VISUAL: 'history.methodVisual', VOICE: 'history.methodVoice', AI: 'history.methodAi', OTHER: 'history.methodOther' }

const RESULT_CODE_MESSAGES = {
  PRETERM_LABOR_RISK: { explanationKey: 'assessment.pretermLaborRiskExplanation', actionKey: 'assessment.pretermLaborRiskAction' },
  POSTTERM_PREGNANCY: { explanationKey: 'assessment.posttermPregnancyExplanation', actionKey: 'assessment.posttermPregnancyAction' },
}

function cleanSymptomLabel(name) {
  const cleaned = name.replace(/^(Severe|Heavy)\s+/i, '').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned
}

function formatDate(value) {
  return new Date(value).toLocaleString()
}

function AssessmentHistory({ onNavigate }) {
  const { t } = useTranslation()
  const [assessments, setAssessments] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAssessments().then((result) => setAssessments(result.assessments)).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }, [])

  const openAssessment = async (id) => {
    try {
      setError('')
      setDetailLoading(true)
      setSelected((await getAssessment(id)).assessment)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDetailLoading(false)
    }
  }

  if (selected) {
    const resultCodeMsg = (selected.resultCode && RESULT_CODE_MESSAGES[selected.resultCode])
      ? RESULT_CODE_MESSAGES[selected.resultCode]
      : null
    const risk = selected.riskLevel.toLowerCase()

    return (
      <div className="space-y-6">
        <button className="link-button" onClick={() => setSelected(null)}>{t('history.backToHistory')}</button>
        {detailLoading && <p className="text-sm text-[var(--text-muted)]">{t('history.loadingDetails')}</p>}
        {error && <StatusMessage>{error}</StatusMessage>}

        <section className="content-panel">
          <p className="eyebrow">{t('history.detailEyebrow')}</p>
          <h1 className="section-title">{formatDate(selected.assessmentDate)}</h1>

          {/* Risk hero banner */}
          <div className={`risk-result-hero risk-${risk} mt-5`}>
            <div className="risk-result-icon"><ShieldIcon size={22} color="#fff" /></div>
            <div>
              <p className="text-lg font-bold" style={{ color: `var(--risk-${risk === 'yellow' ? 'amber' : risk}-fg)` }}>
                {t(RISK_LABEL_KEY[selected.riskLevel])}
              </p>
              <p className="text-sm text-[var(--text-secondary)]">{t(INPUT_METHOD_KEY[selected.inputMethod] || 'history.methodOther', selected.inputMethod)} &middot; {selected.patient.fullName}</p>
            </div>
          </div>

          {/* Result code callout */}
          {resultCodeMsg && (
            <div className="mt-4 rounded-lg border border-[var(--risk-amber-ring)] bg-[var(--gradient-risk-amber)] px-4 py-3">
              <p className="font-medium text-[var(--risk-amber-fg)]">{t(resultCodeMsg.explanationKey)}</p>
              <p className="mt-1 text-sm text-[var(--risk-amber-fg)]">{t(resultCodeMsg.actionKey)}</p>
            </div>
          )}

          {selected.pregnancy && (
            <p className="mt-4 text-sm text-[var(--text-muted)]">
              {t('history.pregnancyPrefix')} {selected.pregnancy.pregnancyStatus}
              {selected.pregnancy.gestationalWeek !== null ? ` \u00B7 ${selected.pregnancy.gestationalWeek} ${t('assessment.weeks')}` : ''}
            </p>
          )}

          {/* Recorded symptoms */}
          <div className="mt-6">
            <h2 className="font-semibold text-[var(--text-primary)]">{t('history.recordedSymptoms')}</h2>
            <ul className="mt-3 space-y-2">
              {selected.assessmentSymptoms.map((item) => (
                <li className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-4 py-3 text-sm" key={item.id}>
                  <span className="font-semibold text-[var(--text-primary)]">{cleanSymptomLabel(item.symptom.name)}</span>
                  <span className="ms-2 text-[var(--text-muted)]">{item.answerStatus}{item.severity ? ` \u00B7 ${item.severity}` : ''}</span>
                  {item.notes && <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('history.notesPrefix')} {item.notes}</p>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{t('history.yourRecords')}</p>
        <h1 className="page-title">{t('history.pageTitle')}</h1>
        <p className="mt-3 text-[var(--text-secondary)]">{t('history.subtitle')}</p>
      </div>

      {error && <StatusMessage>{error}</StatusMessage>}
      {loading && <p className="text-sm text-[var(--text-muted)]">{t('history.loadingHistory')}</p>}
      {detailLoading && <p className="text-sm text-[var(--text-muted)]">{t('history.loadingDetails')}</p>}

      {!loading && !error && assessments.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><ClipboardIcon size={28} /></div>
          <p className="text-[var(--text-secondary)]">{t('history.noAssessments')}</p>
          <button className="button-primary mt-3" onClick={() => onNavigate('assessment')}>{t('history.startAssessment')}</button>
        </div>
      )}

      {!loading && assessments.length > 0 && (
        <div className="space-y-3">
          {assessments.map((assessment) => (
            <button className="history-item" key={assessment.id} onClick={() => openAssessment(assessment.id)}>
              <span>
                <strong className="text-[var(--text-primary)]">{formatDate(assessment.assessmentDate)}</strong>
                <small className="block">
                  {t('history.symptomRecords', { count: assessment.assessmentSymptoms.length })}
                  {' '}&middot;{' '}
                  {t(INPUT_METHOD_KEY[assessment.inputMethod] || 'history.methodOther', assessment.inputMethod)}
                  {assessment.pregnancy ? ` \u00B7 ${t('history.pregnancySuffix', { status: assessment.pregnancy.pregnancyStatus })}` : ''}
                </small>
              </span>
              <div className="flex flex-col items-end gap-1">
                <span className={`risk-badge risk-${assessment.riskLevel.toLowerCase()}`}>{t(RISK_LABEL_KEY[assessment.riskLevel])}</span>
                {assessment.resultCode && RESULT_CODE_MESSAGES[assessment.resultCode] && (
                  <span className="rounded-full bg-[var(--amber-50)] px-2 py-0.5 text-[10px] font-medium text-[var(--amber-700)]">
                    {assessment.resultCode === 'PRETERM_LABOR_RISK'
                      ? t('assessment.pretermLaborRiskExplanation').split('.')[0]
                      : t('assessment.posttermPregnancyExplanation').split('.')[0]}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default AssessmentHistory
