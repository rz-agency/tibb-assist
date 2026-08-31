import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createAssessment, createReferral, getFacilities, getPatientProfile, getSymptoms } from '../api/api'
import StatusMessage from '../components/StatusMessage'
import { ShieldIcon, AlertIcon, HeartIcon } from '../components/Illustrations'

const RISK_LABEL_KEY = { GREEN: 'assessment.riskGreen', YELLOW: 'assessment.riskYellow', RED: 'assessment.riskRed' }
const RISK_ICONS = { GREEN: <ShieldIcon size={24} color="var(--risk-green-fg)" />, YELLOW: <AlertIcon size={24} color="var(--risk-amber-fg)" />, RED: <AlertIcon size={24} color="var(--risk-red-fg)" /> }

const RESULT_CODE_MESSAGES = {
  PRETERM_LABOR_RISK: { explanationKey: 'assessment.pretermLaborRiskExplanation', actionKey: 'assessment.pretermLaborRiskAction' },
  POSTTERM_PREGNANCY: { explanationKey: 'assessment.posttermPregnancyExplanation', actionKey: 'assessment.posttermPregnancyAction' },
}

function cleanSymptomLabel(name) {
  const cleaned = name.replace(/^(Severe|Heavy)\s+/i, '').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned
}

/** Horizontal step indicator */
function StepBar({ steps, current }) {
  return (
    <div className="step-bar">
      {steps.map((label, i) => (
        <div key={label} className="flex flex-1 items-center gap-0">
          <div className="step-node">
            <div className={`step-dot ${i < current ? 'step-dot-done' : i === current ? 'step-dot-active' : ''}`}>
              {i < current ? '\u2713' : i + 1}
            </div>
            <span className={`step-label ${i === current ? 'step-label-active' : ''}`}>{label}</span>
          </div>
          {i < steps.length - 1 && <div className={`step-connector ${i < current ? 'step-connector-done' : ''}`} />}
        </div>
      ))}
    </div>
  )
}

function AssessmentPage({ user, onNavigate }) {
  const { t } = useTranslation()
  const [symptoms, setSymptoms] = useState([])
  const [patientId, setPatientId] = useState(null)
  const [answers, setAnswers] = useState({})
  const [pregnancies, setPregnancies] = useState([])
  const [selectedPregnancyId, setSelectedPregnancyId] = useState('')
  const [completedAssessment, setCompletedAssessment] = useState(null)
  const [facilities, setFacilities] = useState([])
  const [facilityLoading, setFacilityLoading] = useState(false)
  const [facilityError, setFacilityError] = useState('')
  const [selectedFacilityId, setSelectedFacilityId] = useState('')
  const [referralNotes, setReferralNotes] = useState('')
  const [referralSubmitting, setReferralSubmitting] = useState(false)
  const [referralSuccess, setReferralSuccess] = useState('')
  const [referralError, setReferralError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadAssessmentForm = async () => {
      try {
        const [symptomResult, profile] = await Promise.all([getSymptoms(), getPatientProfile(user.id)])
        setSymptoms(symptomResult.symptoms)
        setPatientId(profile.id)
        setPregnancies(profile.pregnancies || [])
        const activePregnancies = (profile.pregnancies || []).filter((pregnancy) => pregnancy.pregnancyStatus === 'ACTIVE')
        if (activePregnancies.length === 1) setSelectedPregnancyId(activePregnancies[0].id)
        setAnswers(Object.fromEntries(symptomResult.symptoms.map((symptom) => [symptom.id, { answerStatus: 'UNKNOWN', severity: '' }])))
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setLoading(false)
      }
    }

    loadAssessmentForm()
  }, [user.id])

  const updateAnswer = (symptomId, field, value) => {
    setAnswers({ ...answers, [symptomId]: { ...answers[symptomId], [field]: value } })
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await createAssessment({
        patientId,
        inputMethod: 'VISUAL',
        ...(selectedPregnancyId ? { pregnancyId: selectedPregnancyId } : {}),
        symptoms: symptoms.map((symptom) => ({
          symptomId: symptom.id,
          answerStatus: answers[symptom.id].answerStatus,
          severity: answers[symptom.id].severity || null,
        })),
      })
      setCompletedAssessment(result.assessment)
      setFacilityLoading(true)
      getFacilities().then((facilityResult) => {
        setFacilities(facilityResult.facilities)
        if (facilityResult.facilities.length > 0) setSelectedFacilityId(facilityResult.facilities[0].id)
      }).catch((requestError) => setFacilityError(requestError.message)).finally(() => setFacilityLoading(false))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  const submitReferral = async (event) => {
    event.preventDefault()
    setReferralError('')
    setReferralSuccess('')
    setReferralSubmitting(true)
    try {
      await createReferral({
        assessmentId: completedAssessment.id,
        facilityId: Number(selectedFacilityId),
        notes: referralNotes || null,
      })
      setReferralSuccess(t('assessment.referralSuccess'))
    } catch (requestError) {
      setReferralError(requestError.message)
    } finally {
      setReferralSubmitting(false)
    }
  }

  if (user.role !== 'WOMAN') {
    return (
      <section className="content-panel text-center">
        <div className="empty-state-icon mx-auto"><ShieldIcon size={28} /></div>
        <h1 className="section-title">{t('assessment.entryTitle')}</h1>
        <p className="mt-3 text-[var(--text-secondary)]">{t('assessment.entryRestriction')}</p>
      </section>
    )
  }

  if (completedAssessment) {
    const resultMessages = {
      GREEN: { explanation: t('assessment.greenExplanation'), nextAction: t('assessment.greenAction') },
      YELLOW: { explanation: t('assessment.yellowExplanation'), nextAction: t('assessment.yellowAction') },
      RED: { explanation: t('assessment.redExplanation'), nextAction: t('assessment.redAction') },
    }
    const resultMessage = resultMessages[completedAssessment.riskLevel]
    const risk = completedAssessment.riskLevel.toLowerCase()
    const facility = facilities[0]
    const isResultCodeMsg = completedAssessment.resultCode && RESULT_CODE_MESSAGES[completedAssessment.resultCode]

    return (
      <div className="space-y-8">
        {/* Step bar */}
        <StepBar steps={[t('assessment.stepSymptoms', { defaultValue: 'Symptoms' }), t('assessment.stepReview', { defaultValue: 'Review' }), t('assessment.stepResult', { defaultValue: 'Result' })]} current={2} />

        <div>
          <p className="eyebrow">{t('assessment.resultEyebrow')}</p>
          <h1 className="page-title">{t('assessment.assessmentCompleted')}</h1>
        </div>

        {/* ── Risk result hero ────────────────────────────── */}
        <div className={`risk-result-hero risk-${risk}`}>
          <div className="risk-result-icon">{RISK_ICONS[completedAssessment.riskLevel]}</div>
          <div className="flex-1">
            <p className="text-lg font-bold" style={{ color: `var(--risk-${risk === 'yellow' ? 'amber' : risk}-fg)` }}>
              {t(RISK_LABEL_KEY[completedAssessment.riskLevel])}
            </p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {isResultCodeMsg ? t(RESULT_CODE_MESSAGES[completedAssessment.resultCode].explanationKey) : resultMessage.explanation}
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">
              {isResultCodeMsg ? t(RESULT_CODE_MESSAGES[completedAssessment.resultCode].actionKey) : resultMessage.nextAction}
            </p>
          </div>
        </div>

        {completedAssessment.pregnancy && (
          <p className="text-sm text-[var(--text-muted)]">
            {t('assessment.linkedPregnancy')} {completedAssessment.pregnancy.pregnancyStatus}
            {completedAssessment.pregnancy.gestationalWeek !== null ? ` \u00B7 ${completedAssessment.pregnancy.gestationalWeek} ${t('assessment.weeks')}` : ''}
          </p>
        )}

        {/* ── Referral section ────────────────────────────── */}
        <section className="content-panel">
          <h2 className="section-title">{t('assessment.healthcareReferral')}</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('assessment.diagnosisDisclaimer')}</p>

          {facilityLoading && <p className="mt-3 text-sm text-[var(--text-muted)]">{t('assessment.loadingFacilities')}</p>}
          {facilityError && <StatusMessage>{facilityError}</StatusMessage>}
          {!facilityLoading && !facilityError && !facility && <p className="mt-3 text-sm text-[var(--text-muted)]">{t('assessment.noFacilities')}</p>}

          {facility && (
            <div className="compact-card mt-3">
              <p className="font-semibold text-[var(--text-primary)]">{facility.name}</p>
              <p className="text-sm text-[var(--text-secondary)]">{facility.facilityType.replace('_', ' ')}</p>
              {(facility.address || facility.city) && <p className="text-sm text-[var(--text-muted)]">{[facility.address, facility.city].filter(Boolean).join(', ')}</p>}
              {facility.phone && <p className="text-sm text-[var(--text-muted)]">{t('assessment.phoneLabel')} {facility.phone}</p>}
            </div>
          )}

          {facilities.length > 0 && !referralSuccess && (
            <form className="mt-5 space-y-4" onSubmit={submitReferral}>
              <label className="form-label">{t('assessment.selectFacility')}
                <select className="form-input" value={selectedFacilityId} onChange={(event) => setSelectedFacilityId(event.target.value)}>
                  {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}{f.city ? ` - ${f.city}` : ''}</option>)}
                </select>
              </label>
              <label className="form-label">{t('assessment.notes')} <span className="font-normal text-[var(--text-muted)]">{t('common.optional')}</span>
                <textarea className="form-input" rows="2" value={referralNotes} onChange={(event) => setReferralNotes(event.target.value)} />
              </label>
              {referralError && <StatusMessage>{referralError}</StatusMessage>}
              <button className="button-primary" disabled={referralSubmitting}>
                {referralSubmitting ? t('assessment.creatingReferral') : t('assessment.createReferral')}
              </button>
            </form>
          )}
          {referralSuccess && <div className="mt-4"><StatusMessage tone="success">{referralSuccess}</StatusMessage></div>}
        </section>

        {/* ── Recorded answers ────────────────────────────── */}
        <section className="content-panel">
          <h2 className="section-title">{t('assessment.recordedAnswers')}</h2>
          <ul className="mt-4 space-y-2">
            {completedAssessment.assessmentSymptoms.map((item) => (
              <li className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-4 py-3 text-sm" key={item.id}>
                <span className="font-semibold text-[var(--text-primary)]">{cleanSymptomLabel(item.symptom.name)}</span>
                <span className="ms-2 text-[var(--text-muted)]">{item.answerStatus}{item.severity ? ` \u00B7 ${item.severity}` : ''}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap gap-3">
          <button className="button-primary" onClick={() => onNavigate('dashboard')}>{t('assessment.backToDashboard')}</button>
          <button className="button-secondary" onClick={() => onNavigate('history')}>{t('assessment.viewAssessmentHistory')}</button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <StepBar steps={[t('assessment.stepSymptoms', { defaultValue: 'Symptoms' }), t('assessment.stepReview', { defaultValue: 'Review' }), t('assessment.stepResult', { defaultValue: 'Result' })]} current={0} />

      <div>
        <p className="eyebrow">{t('assessment.symptomCheck')}</p>
        <h1 className="page-title">{t('assessment.newAssessment')}</h1>
        <p className="mt-3 text-[var(--text-secondary)]">{t('assessment.assessmentSubtitle')}</p>
      </div>

      {loading && <p className="text-sm text-[var(--text-muted)]">{t('assessment.loadingSymptoms')}</p>}
      {error && <StatusMessage>{error}</StatusMessage>}

      {pregnancies.filter((p) => p.pregnancyStatus === 'ACTIVE').length === 0 && (
        <StatusMessage>{t('assessment.noActivePregnancy')} <button className="link-button" onClick={() => onNavigate('pregnancy')}>{t('assessment.openPregnancy')}</button></StatusMessage>
      )}
      {pregnancies.filter((p) => p.pregnancyStatus === 'ACTIVE').length > 1 && (
        <label className="form-label">
          {t('assessment.activePregnancyLabel')}
          <select className="form-input" value={selectedPregnancyId} onChange={(event) => setSelectedPregnancyId(Number(event.target.value))}>
            <option value="">{t('assessment.selectPregnancy')}</option>
            {pregnancies.filter((p) => p.pregnancyStatus === 'ACTIVE').map((p) => (
              <option key={p.id} value={p.id}>{t('assessment.pregnancyLabel')} {p.id}{p.dueDate ? ` \u00B7 ${t('assessment.duePrefix')} ${p.dueDate.slice(0, 10)}` : ''}</option>
            ))}
          </select>
        </label>
      )}

      {!loading && !error && symptoms.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><HeartIcon size={24} /></div>
          <p className="text-sm text-[var(--text-muted)]">{t('assessment.noActiveSymptoms')}</p>
        </div>
      )}

      {!loading && !error && symptoms.length > 0 && (
        <form onSubmit={submit}>
          <div className="space-y-3">
            {symptoms.map((symptom, idx) => (
              <div className="content-panel" key={symptom.id}>
                <div className="flex items-center gap-3">
                  <span className="step-dot step-dot-active" style={{ width: 28, height: 28, fontSize: 'var(--text-xs)' }}>{idx + 1}</span>
                  <p className="font-semibold text-[var(--text-primary)]">{symptom.name}</p>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="form-label">{t('assessment.answer')}
                    <select className="form-input" value={answers[symptom.id]?.answerStatus || 'UNKNOWN'} onChange={(event) => updateAnswer(symptom.id, 'answerStatus', event.target.value)}>
                      <option value="UNKNOWN">{t('assessment.unknown')}</option>
                      <option value="PRESENT">{t('assessment.present')}</option>
                      <option value="ABSENT">{t('assessment.absent')}</option>
                    </select>
                  </label>
                  <label className="form-label">{t('assessment.severity')} <span className="font-normal text-[var(--text-muted)]">{t('common.optional')}</span>
                    <select className="form-input" value={answers[symptom.id]?.severity || ''} onChange={(event) => updateAnswer(symptom.id, 'severity', event.target.value)}>
                      <option value="">{t('common.notRecorded')}</option>
                      <option value="MILD">{t('assessment.mild')}</option>
                      <option value="MODERATE">{t('assessment.moderate')}</option>
                      <option value="SEVERE">{t('assessment.severe')}</option>
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button className="button-primary mt-6" disabled={submitting}>
            {submitting ? t('common.saving') : t('assessment.saveAssessment')}
          </button>
        </form>
      )}
    </div>
  )
}

export default AssessmentPage
