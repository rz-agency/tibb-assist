import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAssessment, getAssessments, getCareMissions, getLhwProfile, getReferrals, updateLhwProfile } from '../api/api'
import StatusMessage from '../components/StatusMessage'

const RISK_LABEL_KEY = { GREEN: 'assessment.riskGreen', YELLOW: 'assessment.riskYellow', RED: 'assessment.riskRed' }

function cleanSymptomLabel(name) {
  const cleaned = name.replace(/^(Severe|Heavy)\s+/i, '').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned
}

function formatDate(value) {
  return new Date(value).toLocaleString()
}

function LhwDashboard({ user, onNavigate }) {
  const { t } = useTranslation()
  const [profile, setProfile] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedAssessment, setSelectedAssessment] = useState(null)
  const [referrals, setReferrals] = useState([])
  const [referralsLoading, setReferralsLoading] = useState(false)
  const [referralsError, setReferralsError] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '', region: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')
  const [careMissions, setCareMissions] = useState([])
  const [careMissionsLoading, setCareMissionsLoading] = useState(true)
  const [careMissionsError, setCareMissionsError] = useState('')

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [lhwProfile, assessmentResult, missionsResult] = await Promise.all([
          getLhwProfile(user.id),
          getAssessments(),
          getCareMissions().catch((err) => ({ careMissions: [], error: err.message })),
        ])
        setProfile(lhwProfile)
        setAssessments(assessmentResult.assessments)
        if (missionsResult.error) {
          setCareMissionsError(missionsResult.error)
        } else {
          setCareMissions(missionsResult.careMissions)
        }
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setLoading(false)
        setCareMissionsLoading(false)
      }
    }

    loadDashboard()
  }, [user.id])

  const updateProfileField = (event) => {
    const { name, value } = event.target
    setProfileForm({ ...profileForm, [name]: value })
  }

  const startProfileEdit = () => {
    if (profile) {
      setProfileForm({ fullName: profile.fullName || '', phone: profile.phone || '', region: profile.region || 'OTHER' })
    }
    setProfileEditing(true)
    setProfileSuccess('')
    setProfileError('')
  }

  const cancelProfileEdit = () => {
    setProfileEditing(false)
    setProfileError('')
  }

  const saveProfile = async (event) => {
    event.preventDefault()
    setProfileSaving(true)
    setProfileSuccess('')
    setProfileError('')
    try {
      const updated = await updateLhwProfile(user.id, profileForm)
      setProfile((prev) => ({ ...prev, ...updated }))
      setProfileSuccess(t('common.profileUpdated'))
      setProfileEditing(false)
    } catch (requestError) {
      setProfileError(requestError.message)
    } finally {
      setProfileSaving(false)
    }
  }

  const openAssessment = async (id) => {
    try {
      setError('')
      setDetailLoading(true)
      setSelectedAssessment((await getAssessment(id)).assessment)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDetailLoading(false)
    }
  }

  const openPatient = async (patient) => {
    setSelectedPatient(patient)
    setError('')
    setReferralsLoading(true)
    setReferralsError('')
    try {
      const result = await getReferrals()
      setReferrals(result.referrals.filter((r) => r.patientId === patient.id))
    } catch (requestError) {
      setReferralsError(requestError.message)
    } finally {
      setReferralsLoading(false)
    }
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">{t('lhw.pageTitle')}...</p>
  if (error && !profile) return <StatusMessage>{error}</StatusMessage>

  if (selectedAssessment) {
    return <div>
      <button className="link-button mb-5" onClick={() => setSelectedAssessment(null)}>← {t('lhw.pageTitle')}</button>
      {error && <StatusMessage>{error}</StatusMessage>}
      {detailLoading && <p className="text-sm text-[var(--text-muted)]">{t('history.loadingDetails')}</p>}
      <section className="content-panel">
        <p className="eyebrow">{t('history.detailEyebrow')}</p>
        <h1 className="section-title">{formatDate(selectedAssessment.assessmentDate)}</h1>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div><span className="detail-label">{t('assessment.riskLevel')}</span><span className={`risk-badge risk-${selectedAssessment.riskLevel.toLowerCase()}`}>{t(RISK_LABEL_KEY[selectedAssessment.riskLevel])}</span></div>
          <div><span className="detail-label">{t('history.inputMethod')}</span><span>{selectedAssessment.inputMethod}</span></div>
          <div><span className="detail-label">{t('history.patient')}</span><span>{selectedAssessment.patient.fullName}</span></div>
        </div>
        {selectedAssessment.pregnancy && <p className="mt-5 text-sm text-[var(--text-secondary)]">{t('history.pregnancyPrefix')} {selectedAssessment.pregnancy.pregnancyStatus}{selectedAssessment.pregnancy.gestationalWeek !== null ? ` \u00B7 ${selectedAssessment.pregnancy.gestationalWeek} ${t('assessment.weeks')}` : ''}</p>}
        <div className="mt-6"><h2 className="font-semibold text-[var(--text-primary)]">{t('history.recordedSymptoms')}</h2><ul className="mt-3 space-y-2">{selectedAssessment.assessmentSymptoms.map((item) => <li className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-4 py-3" key={item.id}><span className="font-medium text-[var(--text-primary)]">{cleanSymptomLabel(item.symptom.name)}</span><span className="ms-2 text-sm text-[var(--text-muted)]">{item.answerStatus}{item.severity ? ` \u00B7 ${item.severity}` : ''}</span>{item.notes && <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('history.notesPrefix')} {item.notes}</p>}</li>)}</ul></div>
      </section>
    </div>
  }

  const selectedAssessments = selectedPatient
    ? assessments.filter((assessment) => assessment.patientId === selectedPatient.id)
    : []

  return <div>
    <div className="mb-8"><p className="eyebrow">{t('lhw.workspaceEyebrow')}</p><h1 className="page-title">{t('lhw.pageTitle')}</h1><p className="mt-3 text-[var(--text-secondary)]">{profile.fullName} \u00B7 {user.email}</p></div>
    {error && <StatusMessage>{error}</StatusMessage>}
    {profileSuccess && <StatusMessage tone="success">{profileSuccess}</StatusMessage>}
    <section className="mt-6 mb-6">
      <p className="eyebrow">{t('careMission.pageTitle')}</p>
      {careMissionsLoading && <p className="mt-3 text-sm text-[var(--text-muted)]">{t('careMission.loading')}</p>}
      {careMissionsError && <StatusMessage>{careMissionsError}</StatusMessage>}
      {!careMissionsLoading && !careMissionsError && careMissions.length === 0 && <p className="mt-3 text-sm text-[var(--text-muted)]">{t('careMission.noMissions')}</p>}
      {!careMissionsLoading && careMissions.length > 0 && (
        <div className="mt-3 space-y-3">
          {careMissions.map((mission) => {
            const risk = mission.riskLevel.toLowerCase()
            return (
              <button className={`cm-mission-card cm-mission-${risk}`} key={mission.id} onClick={() => onNavigate('care-missions')}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className={`risk-badge risk-${risk}`}>{t(RISK_LABEL_KEY[mission.riskLevel])}</span>
                    <p className="mt-1 font-semibold text-[var(--text-primary)]">{mission.assessment?.patient?.fullName || t('careMission.patient')}</p>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">{new Date(mission.createdAt).toLocaleString()}</p>
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
    </section>
    {profileEditing && (
      <section className="content-panel mb-6">
        <h2 className="section-title">{t('common.editProfile')}</h2>
        <form className="mt-5 space-y-4" onSubmit={saveProfile}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="form-label">{t('dashboard.formFullName')}<input className="form-input" name="fullName" value={profileForm.fullName} onChange={updateProfileField} required /></label>
            <label className="form-label">{t('dashboard.formPhone')}<input className="form-input" name="phone" value={profileForm.phone} onChange={updateProfileField} /></label>
            <label className="form-label">{t('dashboard.provinceLabel')}<select className="form-input" name="region" value={profileForm.region} onChange={updateProfileField}><option value="KPK">KPK</option><option value="PUNJAB">Punjab</option><option value="SINDH">Sindh</option><option value="BALOCHISTAN">Balochistan</option><option value="GB">GB</option><option value="AJK">AJK</option><option value="ICT">ICT</option><option value="OTHER">Other</option></select></label>
          </div>
          {profileError && <StatusMessage>{profileError}</StatusMessage>}
          <div className="flex flex-wrap gap-3">
            <button className="button-primary" disabled={profileSaving}>{profileSaving ? t('common.saving') : t('common.saveProfile')}</button>
            <button className="button-secondary" type="button" onClick={cancelProfileEdit}>{t('common.cancel')}</button>
          </div>
        </form>
      </section>
    )}
    {!profileEditing && <div className="mb-6"><button className="button-secondary" onClick={startProfileEdit}>{t('common.editProfile')}</button></div>}
    {profile.assignedPatients.length === 0 && <section className="content-panel"><p className="text-[var(--text-secondary)]">{t('lhw.noWomenAssigned')}</p></section>}
    {profile.assignedPatients.length > 0 && <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
      <section><h2 className="mb-3 font-semibold text-[var(--text-primary)]">{t('lhw.pageTitle')}</h2><div className="space-y-3">{profile.assignedPatients.map((patient) => <button className="history-item" key={patient.id} onClick={() => { openPatient(patient); setError('') }}><span><strong className="text-[var(--text-primary)]">{patient.fullName}</strong><small>{patient.district || patient.villageOrArea || t('lhw.locationNotRecorded')}</small></span></button>)}</div></section>
      <section>{!selectedPatient && <div className="content-panel"><p className="text-[var(--text-secondary)]">{t('lhw.selectWomanPrompt')}</p></div>}{selectedPatient && <div><div className="mb-4"><p className="eyebrow">{t('lhw.selectedWoman')}</p><h2 className="section-title">{selectedPatient.fullName}</h2></div>{referralsLoading && <p className="mb-3 text-sm text-[var(--text-muted)]">{t('lhw.loadingReferrals')}</p>}{referralsError && <StatusMessage>{referralsError}</StatusMessage>}{!referralsLoading && referrals.length > 0 && <div className="mb-4"><p className="eyebrow">{t('lhw.referralsEyebrow')}</p><div className="mt-2 space-y-2">{referrals.map((referral) => <div className="history-item" key={referral.id}><span><strong className="text-[var(--text-primary)]">{referral.facility.name}</strong><small>{referral.status} \u00B7 {new Date(referral.referralDate).toLocaleDateString()}</small></span><span className={`risk-badge risk-${referral.assessment.riskLevel.toLowerCase()}`}>{referral.assessment.riskLevel}</span></div>)}</div></div>}{selectedAssessments.length === 0 && <section className="content-panel"><p className="text-[var(--text-secondary)]">{t('history.noAssessments')}</p></section>}{selectedAssessments.length > 0 && <div className="space-y-3">{selectedAssessments.map((assessment) => <button className="history-item" key={assessment.id} onClick={() => openAssessment(assessment.id)}><span><strong className="text-[var(--text-primary)]">{formatDate(assessment.assessmentDate)}</strong><small>{t('lhw.symptomRecords', { count: assessment.assessmentSymptoms.length })} \u00B7 {assessment.inputMethod}</small></span><span className={`risk-badge risk-${assessment.riskLevel.toLowerCase()}`}>{assessment.riskLevel}</span></button>)}</div>}</div>}</section>
    </div>}
  </div>
}

export default LhwDashboard
