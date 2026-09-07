import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCareMissions, getCheckInDue, getHomeVisits, getImmunizations, getPatientProfile, getReferrals, updatePatientProfile } from '../api/api'
import EmergencyContacts from '../components/EmergencyContacts'
import StatusMessage from '../components/StatusMessage'
import { HeartIcon, ShieldIcon, HistoryIcon, LocationIcon, PregnancyHeroIllustration } from '../components/Illustrations'

const RISK_LABEL_KEY = { GREEN: 'assessment.riskGreen', YELLOW: 'assessment.riskYellow', RED: 'assessment.riskRed' }

function computeAgeFromDate(dateStr) {
  if (!dateStr) return null
  const dob = new Date(dateStr)
  if (isNaN(dob.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age >= 0 ? age : null
}

/** Format a Date or ISO string as YYYY-MM-DD for <input type="date">. */
function toDateInputValue(value) {
  if (!value) return ''
  const d = new Date(value)
  if (isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

const pregnancyStatusKey = {
  ACTIVE: 'dashboard.activePregnancy',
  COMPLETED: 'dashboard.completedPregnancy',
  LOST: 'dashboard.lostPregnancy',
}

function GaProgressRing({ week, remaining, trimester, t }) {
  const TOTAL_WEEKS = 40
  const clamped = Math.max(0, Math.min(week, TOTAL_WEEKS))
  const radius = 92
  const circumference = 2 * Math.PI * radius
  const progress = clamped / TOTAL_WEEKS
  const dashOffset = circumference * (1 - progress)
  const gradientId = 'gaRingGradient'

  return (
    <div className="ga-ring" role="img" aria-label={t('dashboard.gaRingLabel', { week: clamped, defaultValue: `Week ${clamped} of ${TOTAL_WEEKS}` })}>
      <svg viewBox="0 0 220 220" className="ga-ring-track" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--teal-500)" />
            <stop offset="100%" stopColor="var(--amber-500)" />
          </linearGradient>
        </defs>
        <circle className="ga-ring-bg" cx="110" cy="110" r={radius} />
        <circle className="ga-ring-track" cx="110" cy="110" r={radius} />
        <circle
          className="ga-ring-fill"
          cx="110"
          cy="110"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="ga-ring-center">
        <span className="ga-ring-week">{clamped}</span>
        <span className="ga-ring-label">{t('dashboard.gaRingWeeks', { defaultValue: 'weeks' })}</span>
        <span className="ga-ring-sub">
          {remaining > 0
            ? t('dashboard.gaRingRemaining', { weeks: remaining, defaultValue: `${remaining} to go` })
            : t('dashboard.gaRingDue', { defaultValue: 'Baby is near' })}
        </span>
        <span className="ga-ring-sub" style={{ color: 'var(--teal-700)' }}>
          {trimester != null
            ? t('dashboard.gaRingTrimester', { trimester, defaultValue: `Trimester ${trimester}` })
            : null}
        </span>
      </div>
    </div>
  )
}

function Dashboard({ user, onNavigate }) {
  const { t } = useTranslation()
  const [pregnancy, setPregnancy] = useState(null)
  const [pregnancies, setPregnancies] = useState([])
  const [selectedPregnancyId, setSelectedPregnancyId] = useState('')
  const [profile, setProfile] = useState(null)
  const [patientId, setPatientId] = useState(null)
  const [pregnancyLoading, setPregnancyLoading] = useState(true)
  const [pregnancyError, setPregnancyError] = useState('')
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileForm, setProfileForm] = useState({ fullName: '', phone: '', dateOfBirth: '', villageOrArea: '', district: '', province: '' })
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSuccess, setProfileSuccess] = useState('')
  const [profileError, setProfileError] = useState('')
  const [referrals, setReferrals] = useState([])
  const [referralsLoading, setReferralsLoading] = useState(true)
  const [referralsError, setReferralsError] = useState('')
  const [careMissions, setCareMissions] = useState([])
  const [careMissionsLoading, setCareMissionsLoading] = useState(true)
  const [careMissionsError, setCareMissionsError] = useState('')
  // Weekly check-in reminder — purely reactive (fetched on page load), never a
  // push notification. Dismissal lasts only for the current visit.
  const [checkInDue, setCheckInDue] = useState(null)
  const [checkInBannerDismissed, setCheckInBannerDismissed] = useState(false)
  const [homeVisits, setHomeVisits] = useState([])
  const [homeVisitsLoading, setHomeVisitsLoading] = useState(true)
  const [immunizations, setImmunizations] = useState([])
  const [immunizationsLoading, setImmunizationsLoading] = useState(true)
  const [nextImmunizationDue, setNextImmunizationDue] = useState(null)

  useEffect(() => {
    getPatientProfile(user.id)
      .then((data) => {
        setProfile(data)
        setPatientId(data.id)
        setNextImmunizationDue(data.nextImmunizationDue || null)
        setProfileForm({
          fullName: data.fullName || '',
          phone: data.phone || '',
          dateOfBirth: toDateInputValue(data.dateOfBirth),
          villageOrArea: data.villageOrArea || '',
          district: data.district || '',
          province: data.province || '',
        })
        const allPregnancies = data.pregnancies || []
        setPregnancies(allPregnancies)
        const activePregnancies = allPregnancies.filter((item) => item.pregnancyStatus === 'ACTIVE')
        if (activePregnancies.length > 0) {
          setSelectedPregnancyId(activePregnancies[0].id)
          setPregnancy(activePregnancies[0])
        } else {
          setPregnancy(allPregnancies[0] || null)
        }
      })
      .catch((requestError) => setPregnancyError(requestError.message))
      .finally(() => setPregnancyLoading(false))
    getReferrals()
      .then((result) => setReferrals(result.referrals))
      .catch((requestError) => setReferralsError(requestError.message))
      .finally(() => setReferralsLoading(false))
    getCareMissions()
      .then((result) => setCareMissions(result.careMissions))
      .catch((requestError) => setCareMissionsError(requestError.message))
      .finally(() => setCareMissionsLoading(false))
    getCheckInDue()
      .then((data) => setCheckInDue(data))
      .catch(() => setCheckInDue({ due: false }))
  }, [user.id])

  // Load home visit history once we know the patientId
  useEffect(() => {
    if (!patientId) return
    getHomeVisits(patientId)
      .then((result) => setHomeVisits(result.visits || []))
      .catch(() => setHomeVisits([]))
      .finally(() => setHomeVisitsLoading(false))
    getImmunizations(patientId)
      .then((result) => setImmunizations(result.immunizations || []))
      .catch(() => setImmunizations([]))
      .finally(() => setImmunizationsLoading(false))
  }, [patientId])

  const updateProfileField = (event) => {
    const { name, value } = event.target
    setProfileForm({ ...profileForm, [name]: value })
  }

  const startProfileEdit = () => {
    if (profile) {
      setProfileForm({
        fullName: profile.fullName || '',
        phone: profile.phone || '',
        dateOfBirth: toDateInputValue(profile.dateOfBirth),
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
      const data = { ...profileForm, dateOfBirth: profileForm.dateOfBirth || null }
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

  const displayName = profile?.fullName || user.email.split('@')[0]
  const gaWeek = pregnancy?.gestationalWeeks ?? null
  const trimester = pregnancy?.trimester ?? null
  const remaining = gaWeek != null ? 40 - gaWeek : null

  const activePregnancies = pregnancies.filter((p) => p.pregnancyStatus === 'ACTIVE')

  const selectPregnancy = (event) => {
    const id = Number(event.target.value)
    setSelectedPregnancyId(id)
    setPregnancy(pregnancies.find((p) => p.id === id) || null)
  }

  return (
    <div className="space-y-8">
      {/* ── Hero section ─────────────────────────────────── */}
      <div className="hero-card flex flex-col-reverse items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1 min-w-0">
          <p className="eyebrow">{t('dashboard.yourCareSpace')}</p>
          <h1 className="page-title">
            {t('dashboard.greetingName', { defaultValue: `Hello, ${displayName}`, name: displayName })}
          </h1>
          <p className="mt-2 text-[var(--text-secondary)]">{t('dashboard.workspaceDescription')}</p>
          {gaWeek != null && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="ga-pill ga-pill-week">{t('dashboard.currentWeek', { currentWeek: gaWeek })}</span>
              <span className="ga-pill ga-pill-tri">{t('dashboard.trimester', { trimester })}</span>
              {remaining > 0
                ? <span className="ga-pill ga-pill-remain">{t('dashboard.weeksRemaining', { weeks: remaining })}</span>
                : <span className="ga-pill ga-pill-overdue">{t('dashboard.overdue')}</span>}
              {pregnancy.isPostterm && <span className="ga-pill ga-pill-postterm">{t('dashboard.posttermAlert')}</span>}
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="button-primary" onClick={() => onNavigate('assessment')}>
              {t('dashboard.startAssessment')}
            </button>
            <button className="button-secondary" onClick={() => onNavigate('pregnancy')}>
              {pregnancy ? t('dashboard.viewPregnancy') : t('dashboard.addPregnancy')}
            </button>
          </div>
        </div>
        <div className="hero-illustration" aria-hidden="true">
          {gaWeek != null ? (
            <GaProgressRing week={gaWeek} remaining={remaining} trimester={trimester} t={t} />
          ) : (
            <PregnancyHeroIllustration />
          )}
        </div>
      </div>

      {/* ── Weekly check-in reminder (reactive, dismissible per visit) ── */}
      {checkInDue?.due && !checkInBannerDismissed && (
        <div className="checkin-banner">
          <p className="checkin-banner-text">{t('checkIn.bannerText', { week: checkInDue.gestationalWeek })}</p>
          <div className="checkin-banner-actions">
            <button className="button-primary" onClick={() => onNavigate('checkin')}>{t('checkIn.bannerAction')}</button>
            <button
              className="checkin-banner-dismiss"
              onClick={() => setCheckInBannerDismissed(true)}
              aria-label={t('checkIn.bannerDismiss')}
              type="button"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ── Profile strip ────────────────────────────────── */}
      <section className="profile-strip">
        <div>
          <p className="text-xs text-[var(--text-muted)]">{t('dashboard.signedInAs')}</p>
          <p className="font-semibold text-[var(--text-primary)]">{user.email}</p>
        </div>
        <span className="role-badge">{user.role}</span>
      </section>

      {/* ── Pregnancy summary (compact card when hero has data) ── */}
      {pregnancyLoading && <p className="text-sm text-[var(--text-muted)]">{t('dashboard.loadingPregnancy')}</p>}
      {pregnancyError && <StatusMessage>{pregnancyError}</StatusMessage>}
      {!pregnancyLoading && !pregnancyError && pregnancy && (
        <div className="tinted-card">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="eyebrow">{t('dashboard.pregnancyEyebrow')}</p>
              {activePregnancies.length > 1 && (
                <label className="form-label mt-1 mb-2">
                  {t('dashboard.activePregnancyLabel', { defaultValue: 'Active pregnancy' })}
                  <select className="form-input" value={selectedPregnancyId} onChange={selectPregnancy}>
                    {activePregnancies.map((p) => (
                      <option key={p.id} value={p.id}>
                        {t('dashboard.pregnancyOption', { id: p.id, dueDate: p.dueDate ? p.dueDate.slice(0, 10) : '', defaultValue: `Pregnancy #${p.id}${p.dueDate ? ` · Due ${p.dueDate.slice(0, 10)}` : ''}` })}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <p className="font-semibold text-[var(--text-primary)]">{t(pregnancyStatusKey[pregnancy.pregnancyStatus] || 'dashboard.activePregnancy')}</p>
              {gaWeek != null && (
                <div className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {pregnancy.lmpDate && <><span className="detail-label">{t('dashboard.lmpStart')}</span><span>{pregnancy.lmpDate.slice(0, 10)}</span></>}
                  {pregnancy.dueDate && <><span className="detail-label">{t('dashboard.dueEnd')}</span><span>{pregnancy.dueDate.slice(0, 10)}</span></>}
                </div>
              )}
              {gaWeek == null && (
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  {t('dashboard.enterLmpPrompt')}{' '}
                  <button className="link-button" onClick={() => onNavigate('pregnancy')}>{t('dashboard.enterLmpLink')}</button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      {!pregnancyLoading && !pregnancyError && !pregnancy && (
        <div className="empty-state">
          <div className="empty-state-icon"><HeartIcon size={28} /></div>
          <p className="text-sm text-[var(--text-secondary)]">{t('dashboard.noPregnancyInfo')}</p>
          <button className="button-secondary" onClick={() => onNavigate('pregnancy')}>{t('dashboard.addPregnancy')}</button>
        </div>
      )}

      {/* ── Today: Action cards grid ─────────────────────── */}
      <div>
        <p className="eyebrow">{t('dashboard.todayActions', { defaultValue: 'Today' })}</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button className="action-card action-card-rise" onClick={() => onNavigate('assessment')}>
            <span className="action-icon action-icon-gold"><ShieldIcon size={20} /></span>
            <strong>{t('dashboard.startAssessment')}</strong>
            <span className="text-sm">{t('dashboard.recordSymptoms')}</span>
          </button>
          <button className="action-card action-card-rise" onClick={() => onNavigate('history')}>
            <span className="action-icon"><HistoryIcon size={20} /></span>
            <strong>{t('dashboard.assessmentHistory')}</strong>
            <span className="text-sm">{t('dashboard.reviewRecords')}</span>
          </button>
          <button className="action-card action-card-rise" onClick={() => onNavigate('pregnancy')}>
            <span className="action-icon"><HeartIcon size={20} /></span>
            <strong>{t('dashboard.pregnancyCardTitle')}</strong>
            <span className="text-sm">{t('dashboard.pregnancyCardDescription')}</span>
          </button>
          <button className="action-card action-card-rise" onClick={() => onNavigate('nearby')}>
            <span className="action-icon"><LocationIcon size={20} /></span>
            <strong>{t('dashboard.nearbyCardTitle')}</strong>
            <span className="text-sm">{t('dashboard.nearbyCardDescription')}</span>
          </button>
        </div>
      </div>

      {/* ── Profile section ──────────────────────────────── */}
      <section className="content-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{t('dashboard.yourProfile')}</p>
            {profile && !profileEditing && (
              <>
                <p className="mt-1 text-lg font-semibold text-[var(--text-primary)]">{profile.fullName}</p>
                <div className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                  {profile.phone && <><span className="detail-label">{t('dashboard.phoneLabel')}</span><span>{profile.phone}</span></>}
                  {(profile.computedAge ?? computeAgeFromDate(profile.dateOfBirth)) != null && <><span className="detail-label">{t('dashboard.ageLabel')}</span><span>{profile.computedAge ?? computeAgeFromDate(profile.dateOfBirth)}</span></>}
                  {profile.villageOrArea && <><span className="detail-label">{t('dashboard.areaLabel')}</span><span>{profile.villageOrArea}</span></>}
                  {profile.district && <><span className="detail-label">{t('dashboard.districtLabel')}</span><span>{profile.district}</span></>}
                  {profile.province && <><span className="detail-label">{t('dashboard.provinceLabel')}</span><span>{profile.province}</span></>}
                </div>
                {profile.assignedLhw && (
                  <div className="mt-3 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2">
                    <span className="detail-label">{t('dashboard.assignedLhwLabel', { defaultValue: 'Your Lady Health Worker' })}</span>
                    <p className="mt-1 font-semibold text-[var(--text-primary)]">{profile.assignedLhw.fullName}</p>
                    {profile.assignedLhw.phone && <p className="text-[var(--text-secondary)]">{profile.assignedLhw.phone}</p>}
                  </div>
                )}
              </>
            )}
          </div>
          {!profileEditing && <button className="button-secondary" onClick={startProfileEdit}>{t('common.editProfile')}</button>}
        </div>
        {profileSuccess && <StatusMessage tone="success">{profileSuccess}</StatusMessage>}
        {profileEditing && (
          <form className="mt-5 space-y-4" onSubmit={saveProfile}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-label">{t('dashboard.formFullName')}<input className="form-input" name="fullName" value={profileForm.fullName} onChange={updateProfileField} required /></label>
              <label className="form-label">{t('dashboard.formPhone')}<input className="form-input" name="phone" value={profileForm.phone} onChange={updateProfileField} /></label>
              <label className="form-label">{t('dashboard.formDateOfBirth', { defaultValue: 'Date of birth' })}<input className="form-input" name="dateOfBirth" type="date" value={profileForm.dateOfBirth} onChange={updateProfileField} /></label>
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

      {/* ── Care missions ─────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between">
          <p className="eyebrow mb-0">{t('careMission.pageTitle')}</p>
          {careMissions.length > 0 && (
            <button className="link-button text-xs" onClick={() => onNavigate('care-missions')}>
              {t('dashboard.viewAll', { defaultValue: 'View all' })}
            </button>
          )}
        </div>
        {careMissionsLoading && <p className="mt-3 text-sm text-[var(--text-muted)]">{t('careMission.loading')}</p>}
        {careMissionsError && <StatusMessage>{careMissionsError}</StatusMessage>}
        {!careMissionsLoading && !careMissionsError && careMissions.length === 0 && (
          <div className="mt-3 empty-state">
            <div className="empty-state-icon"><ShieldIcon size={24} /></div>
            <p className="text-sm text-[var(--text-muted)]">{t('careMission.noMissions')}</p>
          </div>
        )}
        {!careMissionsLoading && careMissions.length > 0 && (
          <div className="mt-3 space-y-3">
            {careMissions.map((mission) => {
              const risk = mission.riskLevel.toLowerCase()
              return (
                <button className={`cm-mission-card cm-mission-${risk}`} key={mission.id} onClick={() => onNavigate('care-missions')}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className={`risk-badge risk-${risk}`}>{t(RISK_LABEL_KEY[mission.riskLevel])}</span>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">{new Date(mission.createdAt).toLocaleString()}</p>
                    </div>
                    <span className={`status-badge status-${mission.status.toLowerCase() === 'open' ? 'recommended' : mission.status.toLowerCase() === 'completed' ? 'closed' : 'contacted'}`}>
                      {mission.status.replace('_', ' ')}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Referrals ─────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between">
          <p className="eyebrow mb-0">{t('dashboard.referralsEyebrow')}</p>
          {referrals.length > 0 && (
            <button className="link-button text-xs" onClick={() => onNavigate('referrals')}>
              {t('dashboard.viewAll', { defaultValue: 'View all' })}
            </button>
          )}
        </div>
        {referralsLoading && <p className="mt-3 text-sm text-[var(--text-muted)]">{t('dashboard.loadingReferrals')}</p>}
        {referralsError && <StatusMessage>{referralsError}</StatusMessage>}
        {!referralsLoading && !referralsError && referrals.length === 0 && (
          <p className="mt-3 text-sm text-[var(--text-muted)]">{t('dashboard.noReferrals')}</p>
        )}
        {!referralsLoading && referrals.length > 0 && (
          <div className="mt-3 space-y-3">
            {referrals.map((referral) => (
              <button className="history-item w-full cursor-pointer text-start" key={referral.id} onClick={() => onNavigate('referrals')}>
                <span>
                  <strong className="text-[var(--text-primary)]">{referral.facility.name}</strong>
                  <small className="block">{referral.facility.facilityType.replace('_', ' ')}{referral.facility.city ? ` \u00B7 ${referral.facility.city}` : ''}</small>
                  <small>{t('dashboard.assessmentDate', { date: new Date(referral.assessment.assessmentDate).toLocaleDateString() })} &middot; <span className={`risk-badge risk-${referral.assessment.riskLevel.toLowerCase()}`}>{t(RISK_LABEL_KEY[referral.assessment.riskLevel])}</span></small>
                </span>
                <span className={`status-badge status-${referral.status.toLowerCase()}`}>{referral.status}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Immunization next-dose banner ──────────────── */}
      {nextImmunizationDue && (
        <div className="checkin-banner">
          <p className="checkin-banner-text">
            {t('immunization.nextDoseBanner', {
              dose: nextImmunizationDue.doseNumber,
              date: nextImmunizationDue.suggestedDate,
              defaultValue: `TT${nextImmunizationDue.doseNumber} is due — suggested date: ${nextImmunizationDue.suggestedDate}`,
            })}
          </p>
        </div>
      )}

      {/* ── Home visit history (read-only) ────────────────── */}
      <section>
        <p className="eyebrow mb-0">{t('homeVisit.title', { defaultValue: 'Home Visits' })}</p>
        {homeVisitsLoading && <p className="mt-3 text-sm text-[var(--text-muted)]">{t('homeVisit.loading', { defaultValue: 'Loading visits...' })}</p>}
        {!homeVisitsLoading && homeVisits.length === 0 && (
          <p className="mt-3 text-sm text-[var(--text-muted)]">{t('homeVisit.noVisits', { defaultValue: 'No home visits recorded yet.' })}</p>
        )}
        {!homeVisitsLoading && homeVisits.length > 0 && (
          <div className="mt-3 space-y-3">
            {homeVisits.map((v) => (
              <div className="history-item" key={v.id}>
                <span>
                  <strong className="text-[var(--text-primary)]">{v.visitType.replace('_', ' ')} — {v.visitDate ? v.visitDate.slice(0, 10) : ''}</strong>
                  {v.topicsDiscussed?.length > 0 && (
                    <small className="block">{v.topicsDiscussed.join(', ')}</small>
                  )}
                  {v.notes && <small className="block text-[var(--text-secondary)]">{v.notes}</small>}
                </span>
                <span className="flex items-center gap-2">
                  {v.bloodPressureChecked && <span className="text-xs text-[var(--teal-700)]">BP ✓</span>}
                  {v.nextVisitDate && <span className="text-xs text-[var(--text-muted)]">{t('homeVisit.nextVisit', { date: v.nextVisitDate.slice(0, 10), defaultValue: `Next: ${v.nextVisitDate.slice(0, 10)}` })}</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Immunization history (read-only) ──────────────── */}
      <section>
        <p className="eyebrow mb-0">{t('immunization.title', { defaultValue: 'Immunizations (TT)' })}</p>
        {immunizationsLoading && <p className="mt-3 text-sm text-[var(--text-muted)]">{t('immunization.loading', { defaultValue: 'Loading...' })}</p>}
        {!immunizationsLoading && immunizations.length === 0 && (
          <p className="mt-3 text-sm text-[var(--text-muted)]">{t('immunization.noDoses', { defaultValue: 'No TT doses recorded yet.' })}</p>
        )}
        {!immunizationsLoading && immunizations.length > 0 && (
          <div className="mt-3 space-y-3">
            {immunizations.map((v) => (
              <div className="history-item" key={v.id}>
                <span>
                  <strong className="text-[var(--text-primary)]">{v.vaccineName}-{v.doseNumber} — {v.dateAdministered ? v.dateAdministered.slice(0, 10) : ''}</strong>
                  {v.notes && <small className="block text-[var(--text-secondary)]">{v.notes}</small>}
                </span>
                {v.nextDoseDate && <span className="text-xs text-[var(--text-muted)]">{t('immunization.nextDose', { date: v.nextDoseDate.slice(0, 10), defaultValue: `Next: ${v.nextDoseDate.slice(0, 10)}` })}</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {patientId && <EmergencyContacts patientId={patientId} />}
    </div>
  )
}

export default Dashboard

