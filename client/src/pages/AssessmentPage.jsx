import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createAssessment, createReferral, getFacilities, getPatientProfile, getSymptoms } from '../api/api'
import StatusMessage from '../components/StatusMessage'

const RISK_LABEL_KEY = { GREEN: 'assessment.riskGreen', YELLOW: 'assessment.riskYellow', RED: 'assessment.riskRed' }

function cleanSymptomLabel(name) {
  const cleaned = name.replace(/^(Severe|Heavy)\s+/i, '').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned
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
    return <section className="content-panel"><h1 className="section-title">{t('assessment.entryTitle')}</h1><p className="mt-3 text-slate-600">{t('assessment.entryRestriction')}</p></section>
  }

  if (completedAssessment) {
    const resultMessages = {
      GREEN: {
        explanation: t('assessment.greenExplanation'),
        nextAction: t('assessment.greenAction'),
      },
      YELLOW: {
        explanation: t('assessment.yellowExplanation'),
        nextAction: t('assessment.yellowAction'),
      },
      RED: {
        explanation: t('assessment.redExplanation'),
        nextAction: t('assessment.redAction'),
      },
    }
    const resultMessage = resultMessages[completedAssessment.riskLevel]
    const facility = facilities[0]

    return <div>
      <div className="mb-8"><p className="eyebrow">{t('assessment.resultEyebrow')}</p><h1 className="page-title">{t('assessment.assessmentCompleted')}</h1></div>
      <section className="content-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="detail-label">{t('assessment.riskLevel')}</p><span className={`risk-${completedAssessment.riskLevel.toLowerCase()}`}>{t(RISK_LABEL_KEY[completedAssessment.riskLevel])}</span></div>
          <p className="text-sm text-slate-600">{t('assessment.calculatedFromAnswers')}</p>
        </div>
        <div className="mt-6 space-y-2 text-slate-700"><p>{resultMessage.explanation}</p><p>{resultMessage.nextAction}</p></div>
        {completedAssessment.pregnancy && <p className="mt-5 text-sm text-slate-600">{t('assessment.linkedPregnancy')} {completedAssessment.pregnancy.pregnancyStatus}{completedAssessment.pregnancy.gestationalWeek !== null ? ` · ${completedAssessment.pregnancy.gestationalWeek} ${t('assessment.weeks')}` : ''}</p>}
        <div className="mt-8 border-t border-slate-100 pt-6"><h2 className="font-semibold text-slate-900">{t('assessment.healthcareReferral')}</h2><p className="mt-2 text-sm text-slate-600">{t('assessment.diagnosisDisclaimer')}</p>{facilityLoading && <p className="mt-3 text-sm text-slate-600">{t('assessment.loadingFacilities')}</p>}{facilityError && <StatusMessage>{facilityError}</StatusMessage>}{!facilityLoading && !facilityError && !facility && <p className="mt-3 text-sm text-slate-600">{t('assessment.noFacilities')}</p>}{facility && <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700"><p className="font-semibold text-slate-900">{facility.name}</p><p className="mt-1">{facility.facilityType.replace('_', ' ')}</p>{(facility.address || facility.city) && <p className="mt-1">{[facility.address, facility.city].filter(Boolean).join(', ')}</p>}{facility.phone && <p className="mt-1">{t('assessment.phoneLabel')} {facility.phone}</p>}</div>}{facilities.length > 0 && !referralSuccess && <form className="mt-5 space-y-4" onSubmit={submitReferral}><label className="form-label">{t('assessment.selectFacility')}<select className="form-input" value={selectedFacilityId} onChange={(event) => setSelectedFacilityId(event.target.value)}>{facilities.map((f) => <option key={f.id} value={f.id}>{f.name}{f.city ? ` - ${f.city}` : ''}</option>)}</select></label><label className="form-label">{t('assessment.notes')} <span className="font-normal text-slate-400">{t('common.optional')}</span><textarea className="form-input" rows="2" value={referralNotes} onChange={(event) => setReferralNotes(event.target.value)} /></label>{referralError && <StatusMessage>{referralError}</StatusMessage>}<button className="button-secondary" disabled={referralSubmitting}>{referralSubmitting ? t('assessment.creatingReferral') : t('assessment.createReferral')}</button></form>}{referralSuccess && <StatusMessage tone="success">{referralSuccess}</StatusMessage>}</div>
        <div className="mt-8"><h2 className="font-semibold text-slate-900">{t('assessment.recordedAnswers')}</h2><ul className="mt-3 space-y-2">{completedAssessment.assessmentSymptoms.map((item) => <li className="rounded-lg bg-slate-50 px-4 py-3" key={item.id}><span className="font-medium">{cleanSymptomLabel(item.symptom.name)}</span><span className="ml-2 text-sm text-slate-500">{item.answerStatus}{item.severity ? ` · ${item.severity}` : ''}</span></li>)}</ul></div>
        <div className="mt-8 flex flex-wrap gap-3"><button className="button-primary" onClick={() => onNavigate('dashboard')}>{t('assessment.backToDashboard')}</button><button className="button-secondary" onClick={() => onNavigate('history')}>{t('assessment.viewAssessmentHistory')}</button></div>
      </section>
    </div>
  }

  return <div>
    <div className="mb-8"><p className="eyebrow">{t('assessment.symptomCheck')}</p><h1 className="page-title">{t('assessment.newAssessment')}</h1><p className="mt-3 text-slate-600">{t('assessment.assessmentSubtitle')}</p></div>
    <section className="content-panel">
      {loading && <p className="text-slate-600">{t('assessment.loadingSymptoms')}</p>}
      {error && <StatusMessage>{error}</StatusMessage>}
      {pregnancies.filter((pregnancy) => pregnancy.pregnancyStatus === 'ACTIVE').length === 0 && <StatusMessage>{t('assessment.noActivePregnancy')} <button className="link-button" onClick={() => onNavigate('pregnancy')}>{t('assessment.openPregnancy')}</button></StatusMessage>}
      {pregnancies.filter((pregnancy) => pregnancy.pregnancyStatus === 'ACTIVE').length > 1 && <label className="form-label mb-6">{t('assessment.activePregnancyLabel')}<select className="form-input" value={selectedPregnancyId} onChange={(event) => setSelectedPregnancyId(Number(event.target.value))}><option value="">{t('assessment.selectPregnancy')}</option>{pregnancies.filter((pregnancy) => pregnancy.pregnancyStatus === 'ACTIVE').map((pregnancy) => <option key={pregnancy.id} value={pregnancy.id}>{t('assessment.pregnancyLabel')} {pregnancy.id}{pregnancy.dueDate ? ` · ${t('assessment.duePrefix')} ${pregnancy.dueDate.slice(0, 10)}` : ''}</option>)}</select></label>}
      {!loading && !error && symptoms.length === 0 && <p className="text-slate-600">{t('assessment.noActiveSymptoms')}</p>}
      {!loading && !error && symptoms.length > 0 && <form onSubmit={submit}>
        <div className="divide-y divide-slate-100">{symptoms.map((symptom) => <div className="py-5 first:pt-0" key={symptom.id}>
          <p className="font-semibold text-slate-900">{symptom.name}</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="form-label">{t('assessment.answer')}<select className="form-input" value={answers[symptom.id]?.answerStatus || 'UNKNOWN'} onChange={(event) => updateAnswer(symptom.id, 'answerStatus', event.target.value)}><option value="UNKNOWN">{t('assessment.unknown')}</option><option value="PRESENT">{t('assessment.present')}</option><option value="ABSENT">{t('assessment.absent')}</option></select></label>
            <label className="form-label">{t('assessment.severity')} <span className="font-normal text-slate-400">{t('common.optional')}</span><select className="form-input" value={answers[symptom.id]?.severity || ''} onChange={(event) => updateAnswer(symptom.id, 'severity', event.target.value)}><option value="">{t('common.notRecorded')}</option><option value="MILD">{t('assessment.mild')}</option><option value="MODERATE">{t('assessment.moderate')}</option><option value="SEVERE">{t('assessment.severe')}</option></select></label>
          </div>
        </div>)}</div>
        <button className="button-primary mt-6" disabled={submitting}>{submitting ? t('common.saving') : t('assessment.saveAssessment')}</button>
      </form>}
    </section>
  </div>
}

export default AssessmentPage
