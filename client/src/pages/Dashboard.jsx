import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getPatientProfile, getReferrals, updatePatientProfile } from '../api/api'
import EmergencyContacts from '../components/EmergencyContacts'
import StatusMessage from '../components/StatusMessage'

const RISK_LABEL_KEY = { GREEN: 'assessment.riskGreen', YELLOW: 'assessment.riskYellow', RED: 'assessment.riskRed' }

const pregnancyStatusKey = {
  ACTIVE: 'dashboard.activePregnancy',
  COMPLETED: 'dashboard.completedPregnancy',
  LOST: 'dashboard.lostPregnancy',
}

function Dashboard({ user, onNavigate }) {
  const { t } = useTranslation()
  const [pregnancy, setPregnancy] = useState(null)
  const [profile, setProfile] = useState(null)
  const [patientId, setPatientId] = useState(null)
  const [pregnancyLoading, setPregnancyLoading] = useState(true)
  const [pregnancyError, setPregnancyError] = useState('')
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '', age: '', villageOrArea: '', district: '', province: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')
  const [referrals, setReferrals] = useState([])
  const [referralsLoading, setReferralsLoading] = useState(true)
  const [referralsError, setReferralsError] = useState('')

  useEffect(() => {
    getPatientProfile(user.id)
      .then((data) => {
        setProfile(data)
        setPatientId(data.id)
        setProfileForm({
          fullName: data.fullName || '',
          phone: data.phone || '',
          age: data.age ?? '',
          villageOrArea: data.villageOrArea || '',
          district: data.district || '',
          province: data.province || '',
        })
        setPregnancy(data.pregnancies.find((item) => item.pregnancyStatus === 'ACTIVE') || data.pregnancies[0] || null)
      })
      .catch((requestError) => setPregnancyError(requestError.message))
      .finally(() => setPregnancyLoading(false))
    getReferrals()
      .then((result) => setReferrals(result.referrals))
      .catch((requestError) => setReferralsError(requestError.message))
      .finally(() => setReferralsLoading(false))
  }, [user.id])

  const updateProfileField = (event) => {
    const { name, value } = event.target
    setProfileForm({ ...profileForm, [name]: value })
  }

  const startProfileEdit = () => {
    if (profile) {
      setProfileForm({
        fullName: profile.fullName || '',
        phone: profile.phone || '',
        age: profile.age ?? '',
        villageOrArea: profile.villageOrArea || '',
        district: profile.district || '',
        province: profile.province || '',
      })
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
      const data = { ...profileForm, age: profileForm.age === '' ? null : Number(profileForm.age) }
      const updated = await updatePatientProfile(user.id, data)
      setProfile(updated)
      setProfileSuccess(t('common.profileUpdated'))
      setProfileEditing(false)
    } catch (requestError) {
      setProfileError(requestError.message)
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">{t('dashboard.yourCareSpace')}</p>
        <h1 className="page-title">{t('dashboard.goodToSeeYou')}</h1>
        <p className="mt-3 text-slate-600">{t('dashboard.workspaceDescription')}</p>
      </div>
      <section className="profile-strip">
        <div><p className="text-sm text-slate-500">{t('dashboard.signedInAs')}</p><p className="font-semibold text-slate-900">{user.email}</p></div>
        <span className="role-badge">{user.role}</span>
      </section>
      <section className="content-panel mt-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">{t('dashboard.pregnancyEyebrow')}</p>{pregnancyLoading && <p className="text-slate-600">{t('dashboard.loadingPregnancy')}</p>}{!pregnancyLoading && !pregnancyError && pregnancy && <><p className="font-semibold text-slate-900">{t(pregnancyStatusKey[pregnancy.pregnancyStatus] || 'dashboard.activePregnancy')}</p>{pregnancy.gestationalWeek !== null && <p className="mt-1 text-sm text-slate-600">{t('dashboard.weeksGestation', { weeks: pregnancy.gestationalWeek })}</p>}{pregnancy.dueDate && <p className="mt-1 text-sm text-slate-600">{t('dashboard.dueDate', { date: pregnancy.dueDate.slice(0, 10) })}</p>}</>}{!pregnancyLoading && !pregnancyError && !pregnancy && <p className="text-slate-600">{t('dashboard.noPregnancyInfo')}</p>}{pregnancyError && <StatusMessage>{pregnancyError}</StatusMessage>}</div><button className="button-secondary" onClick={() => onNavigate('pregnancy')}>{pregnancy ? t('dashboard.viewPregnancy') : t('dashboard.addPregnancy')}</button></div></section>
      <section className="content-panel mt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="eyebrow">{t('dashboard.yourProfile')}</p>
            {profile && !profileEditing && <><p className="font-semibold text-slate-900">{profile.fullName}</p>
              <div className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                {profile.phone && <><span className="detail-label">{t('dashboard.phoneLabel')}</span><span>{profile.phone}</span></>}
                {profile.age && <><span className="detail-label">{t('dashboard.ageLabel')}</span><span>{profile.age}</span></>}
                {profile.villageOrArea && <><span className="detail-label">{t('dashboard.areaLabel')}</span><span>{profile.villageOrArea}</span></>}
                {profile.district && <><span className="detail-label">{t('dashboard.districtLabel')}</span><span>{profile.district}</span></>}
                {profile.province && <><span className="detail-label">{t('dashboard.provinceLabel')}</span><span>{profile.province}</span></>}
              </div>
            </>}
          </div>
          {!profileEditing && <button className="button-secondary" onClick={startProfileEdit}>{t('common.editProfile')}</button>}
        </div>
        {profileSuccess && <StatusMessage tone="success">{profileSuccess}</StatusMessage>}
        {profileEditing && (
          <form className="mt-5 space-y-4" onSubmit={saveProfile}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-label">{t('dashboard.formFullName')}<input className="form-input" name="fullName" value={profileForm.fullName} onChange={updateProfileField} required /></label>
              <label className="form-label">{t('dashboard.formPhone')}<input className="form-input" name="phone" value={profileForm.phone} onChange={updateProfileField} /></label>
              <label className="form-label">{t('dashboard.formAge')}<input className="form-input" name="age" type="number" value={profileForm.age} onChange={updateProfileField} /></label>
              <label className="form-label">{t('dashboard.formVillageArea')}<input className="form-input" name="villageOrArea" value={profileForm.villageOrArea} onChange={updateProfileField} /></label>
              <label className="form-label">{t('dashboard.formDistrict')}<input className="form-input" name="district" value={profileForm.district} onChange={updateProfileField} /></label>
              <label className="form-label">{t('dashboard.formProvince')}<input className="form-input" name="province" value={profileForm.province} onChange={updateProfileField} /></label>
            </div>
            {profileError && <StatusMessage>{profileError}</StatusMessage>}
            <div className="flex flex-wrap gap-3">
              <button className="button-primary" disabled={profileSaving}>{profileSaving ? t('common.saving') : t('common.saveProfile')}</button>
              <button className="button-secondary" type="button" onClick={cancelProfileEdit}>{t('common.cancel')}</button>
            </div>
          </form>
        )}
      </section>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <button className="action-card" onClick={() => onNavigate('assessment')}><span className="action-icon">+</span><strong>{t('dashboard.startAssessment')}</strong><span>{t('dashboard.recordSymptoms')}</span></button>
        <button className="action-card" onClick={() => onNavigate('history')}><span className="action-icon">≡</span><strong>{t('dashboard.assessmentHistory')}</strong><span>{t('dashboard.reviewRecords')}</span></button>
        <button className="action-card" onClick={() => onNavigate('pregnancy')}><span className="action-icon">♡</span><strong>{t('dashboard.pregnancyCardTitle')}</strong><span>{t('dashboard.pregnancyCardDescription')}</span></button>
      </div>
      <section className="mt-8">
        <p className="eyebrow">{t('dashboard.referralsEyebrow')}</p>
        {referralsLoading && <p className="mt-3 text-slate-600">{t('dashboard.loadingReferrals')}</p>}
        {referralsError && <StatusMessage>{referralsError}</StatusMessage>}
        {!referralsLoading && !referralsError && referrals.length === 0 && <p className="mt-3 text-slate-600">{t('dashboard.noReferrals')}</p>}
        {!referralsLoading && referrals.length > 0 && <div className="mt-3 space-y-3">{referrals.map((referral) => <div className="history-item" key={referral.id}><span><strong>{referral.facility.name}</strong><small>{referral.facility.facilityType.replace('_', ' ')}{referral.facility.city ? ` · ${referral.facility.city}` : ''}</small><small>{t('dashboard.assessmentDate', { date: new Date(referral.assessment.assessmentDate).toLocaleDateString() })} · <span className={`risk-${referral.assessment.riskLevel.toLowerCase()}`}>{t(RISK_LABEL_KEY[referral.assessment.riskLevel])}</span></small></span><span className={`status-badge status-${referral.status.toLowerCase()}`}>{referral.status}</span></div>)}</div>}
      </section>
      {patientId && <EmergencyContacts patientId={patientId} />}
    </div>
  )
}

export default Dashboard
