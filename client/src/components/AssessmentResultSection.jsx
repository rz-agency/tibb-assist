import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createReferral } from '../api/api'
import StatusMessage from './StatusMessage'
import EmergencyPanel from './EmergencyPanel'
import NearbyFacilityList from './NearbyFacilityList'

const RISK_LABEL_KEY = { GREEN: 'assessment.riskGreen', YELLOW: 'assessment.riskYellow', RED: 'assessment.riskRed' }

function cleanSymptomLabel(name) {
  const cleaned = name.replace(/^(Severe|Heavy)\s+/i, '').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned
}

/**
 * Shared assessment result display — the single result view used by the AI
 * assistant flow AND the weekly check-in flow, so a routed check-in renders
 * exactly the same result (including the RED EmergencyPanel and referral
 * form) as a normal assessment.
 */
function AssessmentResultSection({ assessment, aiExplanation, notedSymptoms, user, onNavigate, onRestart, ageRiskNote }) {
  const { t } = useTranslation()

  const [selectedFacility, setSelectedFacility] = useState(null)
  const [referralNotes, setReferralNotes] = useState('')
  const [referralSubmitting, setReferralSubmitting] = useState(false)
  const [referralSuccess, setReferralSuccess] = useState('')
  const [referralError, setReferralError] = useState('')

  const submitReferral = async (event) => {
    event.preventDefault()
    setReferralError('')
    setReferralSuccess('')
    setReferralSubmitting(true)
    try {
      await createReferral({
        assessmentId: assessment.id,
        ...(selectedFacility ? { facility: selectedFacility } : {}),
        notes: referralNotes || null,
      })
      setReferralSuccess(t('assessment.referralSuccess'))
    } catch (requestError) {
      setReferralError(requestError.message)
    } finally {
      setReferralSubmitting(false)
    }
  }

  return (
    <div className="ai-result-section">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="detail-label">{t('assessment.riskLevel')}</p>
          <span className={`risk-badge risk-${assessment.riskLevel.toLowerCase()}`}>{t(RISK_LABEL_KEY[assessment.riskLevel])}</span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">{t('assessment.calculatedFromAnswers')}</p>
      </div>
      {aiExplanation && <p className="mt-4 text-[var(--text-secondary)]">{aiExplanation}</p>}
      {assessment.pregnancy && <p className="mt-3 text-sm text-[var(--text-muted)]">{t('assessment.linkedPregnancy')} {assessment.pregnancy.pregnancyStatus}</p>}

      {ageRiskNote && (
        <div className="age-risk-note">
          <svg className="age-risk-note-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
          <span>{ageRiskNote}</span>
        </div>
      )}

      {assessment.riskLevel === 'RED' && (
        <EmergencyPanel user={user} assessmentId={assessment.id} onNavigate={onNavigate} />
      )}

      <div className="mt-6 border-t border-[var(--border-soft)] pt-5">
        <h2 className="font-semibold text-[var(--text-primary)]">{t('assessment.recordedAnswers')}</h2>
        <ul className="mt-3 space-y-2">
          {assessment.assessmentSymptoms.filter((s) => s.answerStatus !== 'UNKNOWN').map((item) => (
            <li className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2 text-sm" key={item.id}>
              <span className="font-medium text-[var(--text-primary)]">{cleanSymptomLabel(item.symptom.name)}</span>
              <span className="ms-2 text-[var(--text-muted)]">{item.answerStatus}{item.severity ? ` · ${item.severity}` : ''}</span>
            </li>
          ))}
        </ul>
        {notedSymptoms.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">{t('assessment.notedSymptoms')}</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{t('assessment.notedDisclaimer')}</p>
            <ul className="mt-2 space-y-1">
              {notedSymptoms.filter((s) => s.answerStatus !== 'UNKNOWN').map((s, i) => (
                <li className="rounded-lg bg-[var(--amber-50)] border border-[var(--amber-200)] px-3 py-2 text-sm" key={i}>
                  <span className="font-medium">{s.name}</span>
                  <span className="ms-2 text-[var(--text-muted)]">{s.answerStatus}{s.severity ? ` · ${s.severity}` : ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-6 border-t border-[var(--border-soft)] pt-5">
        <h2 className="font-semibold text-[var(--text-primary)]">{t('assessment.healthcareReferral')}</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('assessment.diagnosisDisclaimer')}</p>
        {referralSuccess ? (
          <StatusMessage tone="success">{referralSuccess}</StatusMessage>
        ) : (
          <form className="mt-4 space-y-3" onSubmit={submitReferral}>
            <NearbyFacilityList
              selectedFacility={selectedFacility}
              onSelectFacility={setSelectedFacility}
            />
            <label className="form-label">{t('assessment.notes')} <span className="font-normal text-[var(--text-muted)]">{t('common.optional')}</span>
              <textarea className="form-input" rows="2" value={referralNotes} onChange={(e) => setReferralNotes(e.target.value)} />
            </label>
            {referralError && <StatusMessage>{referralError}</StatusMessage>}
            <button className="button-secondary" disabled={referralSubmitting || !selectedFacility}>
              {referralSubmitting ? t('assessment.creatingReferral') : t('assessment.createReferral')}
            </button>
          </form>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button className="button-primary" onClick={() => onNavigate('dashboard')}>{t('assessment.backToDashboard')}</button>
        {onRestart && <button className="button-secondary" onClick={onRestart}>{t('ai.startOver')}</button>}
      </div>
    </div>
  )
}

export default AssessmentResultSection
