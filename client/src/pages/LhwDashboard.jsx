import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { assignPatientToLhw, createAncVisit, createHomeVisit, createImmunization, completeFollowUp, getAncVisits, getAssessment, getAssessments, getCareMissions, getFollowUps, getHomeVisits, getImmunizations, getLhwProfile, getLhwStats, getPregnancies, getReferrals, getUnassignedPatients, updateLhwProfile } from '../api/api'
import { RISK_LABEL_KEY, cleanSymptomLabel } from '../utils/riskLabels'
import StatusMessage from '../components/StatusMessage'

const FOLLOW_UP_TYPES = {
  HOME_VISIT: { key: 'followUp.typeHomeVisit', label: 'Home visit' },
  ANC_VISIT: { key: 'followUp.typeAncVisit', label: 'ANC visit' },
  REFERRAL_CHECK: { key: 'followUp.typeReferralCheck', label: 'Referral check' },
  CHECK_IN_REMINDER: { key: 'followUp.typeCheckInReminder', label: 'Check-in reminder' },
}

function formatDate(value) {
  return new Date(value).toLocaleString()
}

function LhwDashboard({ user, onNavigate, onViewPatientDetail }) {
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
  const [unassignedPatients, setUnassignedPatients] = useState([])
  const [unassignedLoading, setUnassignedLoading] = useState(true)
  const [unassignedError, setUnassignedError] = useState('')
  const [assigningPatientId, setAssigningPatientId] = useState(null)
  const [assignSuccess, setAssignSuccess] = useState('')
  const [assignError, setAssignError] = useState('')
  // ANC visit state (LHW logging visits for assigned patients)
  const [ancPregnancies, setAncPregnancies] = useState([])
  const [ancPregnancyId, setAncPregnancyId] = useState(null)
  const [ancVisits, setAncVisits] = useState({})
  const [ancSchedules, setAncSchedules] = useState({})
  const [ancLoading, setAncLoading] = useState({})
  const [ancSaving, setAncSaving] = useState(false)
  const [lhwAncFormOpen, setLhwAncFormOpen] = useState(false)
  const [lhwAncForm, setLhwAncForm] = useState({ pregnancyId: null, visitNumber: '', visitDate: '', bloodPressure: '', weightKg: '', dangerSignsChecked: false, notes: '', nextVisitDate: '' })
  // Home visit state (LHW logging home visits for assigned patients)
  const [homeVisits, setHomeVisits] = useState({})
  const [hvLoading, setHvLoading] = useState(false)
  const [hvSaving, setHvSaving] = useState(false)
  const [hvFormOpen, setHvFormOpen] = useState(false)
  const [hvForm, setHvForm] = useState({ visitDate: '', visitType: 'ROUTINE', topics: [], bloodPressureChecked: false, notes: '', nextVisitDate: '' })
  // Immunization state (LHW logging TT doses for assigned patients)
  const [immunizations, setImmunizations] = useState({})
  const [immSchedule, setImmSchedule] = useState(null)
  const [immLoading, setImmLoading] = useState(false)
  const [immSaving, setImmSaving] = useState(false)
  const [immFormOpen, setImmFormOpen] = useState(false)
  const [immForm, setImmForm] = useState({ doseNumber: 1, dateAdministered: '', pregnancyId: null, notes: '' })
  // Follow-up queue state (auto-created tasks: due this week / overdue)
  const [followUps, setFollowUps] = useState([])
  const [followUpsLoading, setFollowUpsLoading] = useState(true)
  const [followUpsError, setFollowUpsError] = useState('')
  const [followUpSort, setFollowUpSort] = useState('dueDate')
  const [completingId, setCompletingId] = useState(null)
  // Patient-list search, filter and view-mode state
  const [patientSearch, setPatientSearch] = useState('')
  const [districtFilter, setDistrictFilter] = useState('')
  const [villageFilter, setVillageFilter] = useState('')
  const [patientsGrouped, setPatientsGrouped] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState('')

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [lhwProfile, assessmentResult, missionsResult, unassignedResult, followUpsResult, statsResult] = await Promise.all([
          getLhwProfile(user.id),
          getAssessments(),
          getCareMissions().catch((err) => ({ careMissions: [], error: err.message })),
          getUnassignedPatients().catch((err) => ({ patients: [], error: err.message })),
          getFollowUps().catch((err) => ({ followUps: [], error: err.message })),
          getLhwStats(user.id).catch((err) => ({ stats: null, error: err.message })),
        ])
        setProfile(lhwProfile)
        setAssessments(assessmentResult.assessments)
        if (missionsResult.error) {
          setCareMissionsError(missionsResult.error)
        } else {
          setCareMissions(missionsResult.careMissions)
        }
        if (unassignedResult.error) {
          setUnassignedError(unassignedResult.error)
        } else {
          setUnassignedPatients(unassignedResult.patients)
        }
        if (followUpsResult.error) {
          setFollowUpsError(followUpsResult.error)
        } else {
          setFollowUps(followUpsResult.followUps)
        }
        if (statsResult.error) {
          setStatsError(statsResult.error)
        } else {
          setStats(statsResult.stats)
        }
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setLoading(false)
        setCareMissionsLoading(false)
        setUnassignedLoading(false)
        setFollowUpsLoading(false)
        setStatsLoading(false)
      }
    }

    loadDashboard()
  }, [user.id])

  // Load pregnancies when selected patient changes
  useEffect(() => {
    if (!selectedPatient) {
      setAncPregnancies([])
      setAncPregnancyId(null)
      return
    }
    getPregnancies(selectedPatient.id)
      .then((result) => setAncPregnancies(result.pregnancies || []))
      .catch(() => setAncPregnancies([]))
  }, [selectedPatient])

  // Auto-load ANC visits for the selected active pregnancy
  useEffect(() => {
    const activePreg = ancPregnancies.find((p) => p.pregnancyStatus === 'ACTIVE')
    if (activePreg) {
      setAncPregnancyId(activePreg.id)
      if (!ancVisits[activePreg.id]) {
        loadAncVisitsForPregnancy(activePreg.id)
      }
    } else {
      setAncPregnancyId(null)
      setAncVisits({})
      setAncSchedules({})
    }
  }, [selectedPatient, ancPregnancies])

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
    setAncPregnancies([])
    setAncPregnancyId(null)
    setLhwAncFormOpen(false)
    setHomeVisits({})
    setHvFormOpen(false)
    setImmunizations({})
    setImmSchedule(null)
    setImmFormOpen(false)
    try {
      const [referralResult, pregnancyResult] = await Promise.all([
        getReferrals(),
        getPregnancies(patient.id).catch(() => ({ pregnancies: [] })),
      ])
      setReferrals(referralResult.referrals.filter((r) => r.patientId === patient.id))
      setAncPregnancies(pregnancyResult.pregnancies || [])
      // Load home visits for the selected patient
      getHomeVisits(patient.id)
        .then((result) => setHomeVisits({ [patient.id]: result.visits }))
        .catch(() => {})
      // Load immunizations for the selected patient
      getImmunizations(patient.id)
        .then((result) => { setImmunizations({ [patient.id]: result.immunizations }); setImmSchedule(result.ttSchedule) })
        .catch(() => {})
    } catch (requestError) {
      setReferralsError(requestError.message)
    } finally {
      setReferralsLoading(false)
    }
  }

  const assignPatient = async (patient) => {
    setAssigningPatientId(patient.id)
    setAssignSuccess('')
    setAssignError('')
    try {
      const result = await assignPatientToLhw(patient.id, user.id)
      setUnassignedPatients((prev) => prev.filter((p) => p.id !== patient.id))
      setProfile((prev) => (prev ? { ...prev, assignedPatients: [...prev.assignedPatients, result.patient] } : prev))
      setAssignSuccess(t('lhw.assignSuccess', { name: patient.fullName }))
    } catch (requestError) {
      setAssignError(requestError.message)
    } finally {
      setAssigningPatientId(null)
    }
  }

  const updateLhwAncField = (event) =>
    setLhwAncForm({ ...lhwAncForm, [event.target.name]: event.target.type === 'checkbox' ? event.target.checked : event.target.value })

  const openLhwAncForm = (nextVisitNumber) => {
    setLhwAncFormOpen(true)
    setLhwAncForm({ pregnancyId: ancPregnancyId, visitNumber: nextVisitNumber, visitDate: '', bloodPressure: '', weightKg: '', dangerSignsChecked: false, notes: '', nextVisitDate: '' })
  }

  const loadAncVisitsForPregnancy = async (pregnancyId) => {
    setAncLoading((prev) => ({ ...prev, [pregnancyId]: true }))
    try {
      const data = await getAncVisits(pregnancyId)
      setAncVisits((prev) => ({ ...prev, [pregnancyId]: data.visits }))
      setAncSchedules((prev) => ({ ...prev, [pregnancyId]: data.schedule }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setAncLoading((prev) => ({ ...prev, [pregnancyId]: false }))
    }
  }

  const submitLhwAncVisit = async (event) => {
    event.preventDefault()
    if (!lhwAncForm.pregnancyId) return
    setAncSaving(true)
    setError('')
    try {
      await createAncVisit({
        ...lhwAncForm,
        visitNumber: Number(lhwAncForm.visitNumber),
        weightKg: lhwAncForm.weightKg === '' ? null : Number(lhwAncForm.weightKg),
        nextVisitDate: lhwAncForm.nextVisitDate || null,
      })
      setLhwAncFormOpen(false)
      await loadAncVisitsForPregnancy(lhwAncForm.pregnancyId)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setAncSaving(false)
    }
  }

  const loadHomeVisitsForPatient = async (patientId) => {
    setHvLoading(true)
    try {
      const data = await getHomeVisits(patientId)
      setHomeVisits((prev) => ({ ...prev, [patientId]: data.visits }))
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setHvLoading(false)
    }
  }

  const updateHvField = (event) => {
    const { name, type, checked, value } = event.target
    setHvForm({ ...hvForm, [name]: type === 'checkbox' ? checked : value })
  }

  const toggleHvTopic = (topic) => {
    setHvForm((prev) => ({
      ...prev,
      topics: prev.topics.includes(topic)
        ? prev.topics.filter((t) => t !== topic)
        : [...prev.topics, topic],
    }))
  }

  const submitHomeVisit = async (event) => {
    event.preventDefault()
    if (!selectedPatient) return
    setHvSaving(true)
    setError('')
    try {
      await createHomeVisit({
        patientId: selectedPatient.id,
        visitDate: hvForm.visitDate,
        visitType: hvForm.visitType,
        topicsDiscussed: hvForm.topics.length > 0 ? hvForm.topics : null,
        bloodPressureChecked: hvForm.bloodPressureChecked,
        notes: hvForm.notes || null,
        nextVisitDate: hvForm.nextVisitDate || null,
      })
      setHvFormOpen(false)
      await loadHomeVisitsForPatient(selectedPatient.id)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setHvSaving(false)
    }
  }

  const loadImmunizationsForPatient = async (patientId) => {
    setImmLoading(true)
    try {
      const data = await getImmunizations(patientId)
      setImmunizations((prev) => ({ ...prev, [patientId]: data.immunizations }))
      setImmSchedule(data.ttSchedule)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setImmLoading(false)
    }
  }

  const updateImmField = (event) => {
    const { name, value } = event.target
    setImmForm((prev) => ({ ...prev, [name]: name === 'doseNumber' ? Number(value) : value }))
  }

  const submitImmunization = async (event) => {
    event.preventDefault()
    if (!selectedPatient) return
    setImmSaving(true)
    setError('')
    try {
      await createImmunization({
        patientId: selectedPatient.id,
        vaccineName: 'TT',
        doseNumber: immForm.doseNumber,
        dateAdministered: immForm.dateAdministered,
        pregnancyId: immForm.pregnancyId || null,
        notes: immForm.notes || null,
      })
      setImmFormOpen(false)
      await loadImmunizationsForPatient(selectedPatient.id)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setImmSaving(false)
    }
  }

  const markFollowUpComplete = async (followUpId) => {
    setCompletingId(followUpId)
    setFollowUpsError('')
    try {
      await completeFollowUp(followUpId)
      setFollowUps((prev) => prev.filter((f) => f.id !== followUpId))
      // Overdue counts change when a task is completed — refresh the stats strip.
      getLhwStats(user.id).then(setStats).catch(() => {})
    } catch (requestError) {
      setFollowUpsError(requestError.message)
    } finally {
      setCompletingId(null)
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

  // Sort assigned patients: no-visit / longest-gap first
  const sortedAssignedPatients = profile.assignedPatients
    ? [...profile.assignedPatients].sort((a, b) => {
        if (!a.lastHomeVisitDate && !b.lastHomeVisitDate) return 0
        if (!a.lastHomeVisitDate) return -1
        if (!b.lastHomeVisitDate) return 1
        return new Date(a.lastHomeVisitDate).getTime() - new Date(b.lastHomeVisitDate).getTime()
      })
    : []

  // ── Patient list filtering & grouping ──────────────────────────────
  const allDistricts = [...new Set((profile.assignedPatients || []).map((p) => p.district).filter(Boolean))].sort()
  const allVillages = [...new Set((profile.assignedPatients || []).map((p) => p.villageOrArea).filter(Boolean))].sort()

  const filteredPatients = sortedAssignedPatients.filter((p) => {
    const matchesSearch = patientSearch.trim() === '' || p.fullName.toLowerCase().includes(patientSearch.trim().toLowerCase())
    const matchesDistrict = !districtFilter || p.district === districtFilter
    const matchesVillage = !villageFilter || p.villageOrArea === villageFilter
    return matchesSearch && matchesDistrict && matchesVillage
  })

  const groupedByDistrict = filteredPatients.reduce((acc, patient) => {
    const key = patient.district || patient.villageOrArea || t('lhw.locationNotRecorded')
    if (!acc[key]) acc[key] = []
    acc[key].push(patient)
    return acc
  }, {})

  const toggleGroupCollapse = (group) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }))
  }

  // Follow-up queue: overdue (due date before today) vs. due in the next 7 days.
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(todayStart.getTime() + 7 * 86400000)
  const sortFollowUps = (list) => [...list].sort((a, b) => (
    followUpSort === 'patient'
      ? (a.patient?.fullName || '').localeCompare(b.patient?.fullName || '')
      : new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
  ))
  const overdueFollowUps = sortFollowUps(followUps.filter((f) => new Date(f.dueDate) < todayStart))
  const dueThisWeekFollowUps = sortFollowUps(followUps.filter((f) => {
    const dueDate = new Date(f.dueDate)
    return dueDate >= todayStart && dueDate < weekEnd
  }))
  const upcomingFollowUps = sortFollowUps(followUps.filter((f) => new Date(f.dueDate) >= weekEnd))

  const renderFollowUpRow = (followUp, overdue) => {
    const daysOverdue = overdue ? Math.floor((todayStart - new Date(followUp.dueDate)) / 86400000) : 0
    return (
      <div className="history-item" key={followUp.id}>
        <span>
          <strong className="text-[var(--text-primary)]">{followUp.patient?.fullName || t('careMission.patient')}</strong>
          <small className="block">
            {t(FOLLOW_UP_TYPES[followUp.type]?.key || 'followUp.typeOther', { defaultValue: FOLLOW_UP_TYPES[followUp.type]?.label || followUp.type })}
            {' · '}
            {followUp.dueDate ? followUp.dueDate.slice(0, 10) : ''}
            {followUp.patient?.district || followUp.patient?.villageOrArea ? ` · ${followUp.patient.district || followUp.patient.villageOrArea}` : ''}
          </small>
        </span>
        <span className="flex items-center gap-2">
          {overdue && (
            <span className="rounded-full bg-[var(--risk-red-bg)] px-2 py-0.5 text-[10px] font-semibold text-[var(--risk-red-fg)]">
              {t('followUp.daysOverdue', { days: daysOverdue, defaultValue: `${daysOverdue}d overdue` })}
            </span>
          )}
          <button className="button-secondary" disabled={completingId === followUp.id} onClick={() => markFollowUpComplete(followUp.id)}>
            {completingId === followUp.id ? t('common.saving') : t('followUp.markComplete', { defaultValue: 'Mark complete' })}
          </button>
        </span>
      </div>
    )
  }

  const selectedAssessments = selectedPatient
    ? assessments.filter((assessment) => assessment.patientId === selectedPatient.id)
    : []

  return <div>
    <div className="mb-8"><p className="eyebrow">{t('lhw.workspaceEyebrow')}</p><h1 className="page-title">{t('lhw.pageTitle')}</h1><div className="mt-3 flex flex-wrap items-center gap-3"><p className="text-[var(--text-secondary)]">{profile.fullName} \u00B7 {user.email}</p><button className="button-secondary text-xs" onClick={() => onNavigate(`monthly-report:${user.id}`)}>{t('lhw.monthlyReport', { defaultValue: 'Monthly Report' })}</button></div></div>
    {error && <StatusMessage>{error}</StatusMessage>}
    {profileSuccess && <StatusMessage tone="success">{profileSuccess}</StatusMessage>}
    {overdueFollowUps.length > 0 && (
      <div className="mt-4">
        <StatusMessage>{t('followUp.overdueBanner', { count: overdueFollowUps.length, defaultValue: ` follow-up(s) are overdue � please review and complete them.` })}</StatusMessage>
      </div>
    )}
    {/* ── Follow-up queue (auto-created tasks) ───────── */}
    <section className="mt-6 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">{t('followUp.title', { defaultValue: 'Follow-ups' })}</p>
        <label className="form-label mb-0 max-w-[220px]">
          <span className="sr-only">{t('followUp.sortLabel', { defaultValue: 'Sort follow-ups' })}</span>
          <select className="form-input" value={followUpSort} onChange={(event) => setFollowUpSort(event.target.value)}>
            <option value="dueDate">{t('followUp.sortByDueDate', { defaultValue: 'Due date' })}</option>
            <option value="patient">{t('followUp.sortByPatient', { defaultValue: 'Patient name' })}</option>
          </select>
        </label>
      </div>

      {statsLoading && <p className="mt-3 text-sm text-[var(--text-muted)]">{t('followUp.loadingStats', { defaultValue: 'Loading stats...' })}</p>}
      {statsError && <div className="mt-3"><StatusMessage>{statsError}</StatusMessage></div>}
      {stats && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2">
            <p className="text-lg font-bold text-[var(--text-primary)]">{stats.assignedPatients}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('followUp.statAssigned', { defaultValue: 'Assigned women' })}</p>
          </div>
          <div className="rounded-lg border border-[var(--risk-red-ring)] bg-[var(--bg-subtle)] px-3 py-2">
            <p className="text-lg font-bold text-[var(--risk-red-fg)]">{stats.openRedCareMissions}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('followUp.statOpenRed', { defaultValue: 'Open RED missions' })}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2">
            <p className="text-lg font-bold text-[var(--amber-700)]">{stats.overdueFollowUps}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('followUp.statOverdue', { defaultValue: 'Overdue follow-ups' })}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2">
            <p className="text-lg font-bold text-[var(--text-primary)]">{stats.homeVisitsThisMonth}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('followUp.statHomeVisits', { defaultValue: 'Home visits this month' })}</p>
          </div>
          <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2">
            <p className="text-lg font-bold text-[var(--text-primary)]">{stats.referralsClosedThisMonth}</p>
            <p className="text-xs text-[var(--text-muted)]">{t('followUp.statReferralsClosed', { defaultValue: 'Referrals closed this month' })}</p>
          </div>
        </div>
      )}

      {followUpsLoading && <p className="mt-3 text-sm text-[var(--text-muted)]">{t('followUp.loading', { defaultValue: 'Loading follow-ups...' })}</p>}
      {followUpsError && <div className="mt-3"><StatusMessage>{followUpsError}</StatusMessage></div>}
      {!followUpsLoading && !followUpsError && followUps.length === 0 && (
        <p className="mt-3 text-sm text-[var(--text-muted)]">{t('followUp.nonePending', { defaultValue: 'No pending follow-ups.' })}</p>
      )}

      {overdueFollowUps.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--risk-red-fg)]">{t('followUp.overdue', { defaultValue: 'Overdue' })}</p>
          <div className="mt-2 space-y-2">{overdueFollowUps.map((f) => renderFollowUpRow(f, true))}</div>
        </div>
      )}
      {dueThisWeekFollowUps.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--amber-700)]">{t('followUp.dueThisWeek', { defaultValue: 'Due this week' })}</p>
          <div className="mt-2 space-y-2">{dueThisWeekFollowUps.map((f) => renderFollowUpRow(f, false))}</div>
        </div>
      )}
      {upcomingFollowUps.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t('followUp.upcoming', { defaultValue: 'Upcoming' })}</p>
          <div className="mt-2 space-y-2">{upcomingFollowUps.map((f) => renderFollowUpRow(f, false))}</div>
        </div>
      )}
    </section>
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
            <label className="form-label">{t('dashboard.provinceLabel')}<select className="form-input" name="region" value={profileForm.region} onChange={updateProfileField}><option value="KPK">KPK</option><option value="PUNJAB">Punjab</option><option value="SINDH">Sindh</option><option value="BALOCHISTAN">Balochistan</option><option value="GILGIT_BALTISTAN">Gilgit-Baltistan</option><option value="AJK">AJK</option><option value="ISLAMABAD">Islamabad</option><option value="OTHER">Other</option></select></label>
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
    <section className="mb-6">
      <h2 className="mb-3 font-semibold text-[var(--text-primary)]">{t('lhw.unassignedTitle')}</h2>
      {unassignedLoading && <p className="text-sm text-[var(--text-muted)]">{t('lhw.unassignedLoading')}</p>}
      {unassignedError && <StatusMessage>{unassignedError}</StatusMessage>}
      {assignSuccess && <StatusMessage tone="success">{assignSuccess}</StatusMessage>}
      {assignError && <StatusMessage>{assignError}</StatusMessage>}
      {!unassignedLoading && !unassignedError && unassignedPatients.length === 0 && <p className="text-sm text-[var(--text-muted)]">{t('lhw.noUnassigned')}</p>}
      {unassignedPatients.length > 0 && (
        <div className="space-y-3">
          {unassignedPatients.map((patient) => (
            <div className="history-item" key={patient.id}>
              <span>
                <strong className="text-[var(--text-primary)]">{patient.fullName}</strong>
                <small>{`${patient.district || patient.villageOrArea || t('lhw.locationNotRecorded')} · ${t('lhw.registeredOn', { date: formatDate(patient.createdAt) })}`}{patient.pregnancies?.length > 0 && ` · ${t('lhw.activePregnancy')}`}</small>
              </span>
              <button className="button-secondary" disabled={assigningPatientId === patient.id} onClick={() => assignPatient(patient)}>
                {assigningPatientId === patient.id ? t('lhw.assigning') : t('lhw.assignToMe')}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
    {profile.assignedPatients.length === 0 && <section className="content-panel"><p className="text-[var(--text-secondary)]">{t('lhw.noWomenAssigned')}</p></section>}
    {profile.assignedPatients.length > 0 && <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-[var(--text-primary)]">{t('lhw.pageTitle')}</h2>
          <button className="button-secondary text-xs" onClick={() => setPatientsGrouped((v) => !v)}>
            {patientsGrouped ? t('lhw.flatView', { defaultValue: 'Flat list' }) : t('lhw.groupByArea', { defaultValue: 'Group by area' })}
          </button>
        </div>
        <input className="form-input mb-2 text-sm" type="search" placeholder={t('lhw.searchPatients', { defaultValue: 'Search patients\u2026' })} value={patientSearch} onChange={(e) => setPatientSearch(e.target.value)} />
        <div className="mb-3 flex gap-2">
          <select className="form-input text-sm" value={districtFilter} onChange={(e) => { setDistrictFilter(e.target.value); setVillageFilter('') }}>
            <option value="">{t('lhw.allDistricts', { defaultValue: 'All districts' })}</option>
            {allDistricts.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="form-input text-sm" value={villageFilter} onChange={(e) => setVillageFilter(e.target.value)}>
            <option value="">{t('lhw.allVillages', { defaultValue: 'All villages' })}</option>
            {allVillages.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        {filteredPatients.length === 0 && <p className="text-sm text-[var(--text-muted)]">{t('lhw.noMatchingPatients', { defaultValue: 'No patients match the filters.' })}</p>}
        {!patientsGrouped && <div className="space-y-3">{filteredPatients.map((patient) => { const daysAgo = patient.lastHomeVisitDate ? Math.floor((Date.now() - new Date(patient.lastHomeVisitDate).getTime()) / 86400000) : null; return (<div key={patient.id}><button className="history-item w-full" onClick={() => { openPatient(patient); setError('') }}><span><strong className="text-[var(--text-primary)]">{patient.fullName}</strong><small>{patient.district || patient.villageOrArea || t('lhw.locationNotRecorded')}</small></span>{daysAgo == null ? <span className="text-[10px] font-semibold text-[var(--amber-700)]">{t('homeVisit.noVisit', { defaultValue: 'No visit' })}</span> : <span className="text-[10px] text-[var(--text-muted)]">{t('homeVisit.lastVisited', { days: daysAgo, defaultValue: `${daysAgo}d ago` })}</span>}</button><button className="mt-1 text-xs text-[var(--teal-700)] hover:underline" onClick={() => onViewPatientDetail(patient.id)}>{t('lhw.viewFullHistory', { defaultValue: 'View full history \u2192' })}</button></div>) })}</div>}
        {patientsGrouped && Object.keys(groupedByDistrict).map((group) => (<div key={group} className="mb-3"><button className="flex w-full items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]" onClick={() => toggleGroupCollapse(group)}><span>{group} ({groupedByDistrict[group].length})</span><span>{collapsedGroups[group] ? '\u25B6' : '\u25BC'}</span></button>{!collapsedGroups[group] && (<div className="mt-2 space-y-2">{groupedByDistrict[group].map((patient) => { const daysAgo = patient.lastHomeVisitDate ? Math.floor((Date.now() - new Date(patient.lastHomeVisitDate).getTime()) / 86400000) : null; return (<div key={patient.id}><button className="history-item w-full" onClick={() => { openPatient(patient); setError('') }}><span><strong className="text-[var(--text-primary)]">{patient.fullName}</strong><small>{patient.villageOrArea || t('lhw.locationNotRecorded')}</small></span>{daysAgo == null ? <span className="text-[10px] font-semibold text-[var(--amber-700)]">{t('homeVisit.noVisit', { defaultValue: 'No visit' })}</span> : <span className="text-[10px] text-[var(--text-muted)]">{t('homeVisit.lastVisited', { days: daysAgo, defaultValue: `${daysAgo}d ago` })}</span>}</button><button className="mt-1 text-xs text-[var(--teal-700)] hover:underline" onClick={() => onViewPatientDetail(patient.id)}>{t('lhw.viewFullHistory', { defaultValue: 'View full history \u2192' })}</button></div>) })}</div>)}</div>))}
      </section>
      <section>{!selectedPatient && <div className="content-panel"><p className="text-[var(--text-secondary)]">{t('lhw.selectWomanPrompt')}</p></div>}{selectedPatient && <div><div className="mb-4"><p className="eyebrow">{t('lhw.selectedWoman')}</p><h2 className="section-title">{selectedPatient.fullName}</h2></div>{referralsLoading && <p className="mb-3 text-sm text-[var(--text-muted)]">{t('lhw.loadingReferrals')}</p>}{referralsError && <StatusMessage>{referralsError}</StatusMessage>}{!referralsLoading && referrals.length > 0 && <div className="mb-4"><p className="eyebrow">{t('lhw.referralsEyebrow')}</p><div className="mt-2 space-y-2">{referrals.map((referral) => <div className="history-item" key={referral.id}><span><strong className="text-[var(--text-primary)]">{referral.facility.name}</strong><small>{referral.status} \u00B7 {new Date(referral.referralDate).toLocaleDateString()}</small></span><span className={`risk-badge risk-${referral.assessment.riskLevel.toLowerCase()}`}>{referral.assessment.riskLevel}</span></div>)}</div></div>}{/* ── ANC Visits ────────────────────────── */}{ancPregnancyId && (<div className="mb-4"><p className="eyebrow">{t('ancVisit.title', { defaultValue: 'ANC Visits' })}</p>{ancPregnancies.length > 1 && (<select className="form-input mt-2" value={ancPregnancyId} onChange={(e) => { const pid = Number(e.target.value); setAncPregnancyId(pid); if (!ancVisits[pid]) loadAncVisitsForPregnancy(pid); }}><option value="">{t('ancVisit.selectPregnancy', { defaultValue: 'Select a pregnancy' })}</option>{ancPregnancies.map((p) => <option key={p.id} value={p.id}>{p.pregnancyStatus} — {p.lmpDate ? new Date(p.lmpDate).toLocaleDateString() : t('common.notRecorded')}</option>)}</select>)}{ancLoading[ancPregnancyId] && <p className="mt-2 text-sm text-[var(--text-muted)]">{t('ancVisit.loading', { defaultValue: 'Loading visits...' })}</p>}{ancSchedules[ancPregnancyId] && (<div className="mt-3 space-y-2">{ancSchedules[ancPregnancyId].map((slot) => (<div className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2 text-sm" key={slot.visitNumber}><div><span className="font-medium text-[var(--text-primary)]">{t('ancVisit.visit', { n: slot.visitNumber, defaultValue: `Visit ${slot.visitNumber}` })}</span><span className="ms-2 text-[var(--text-muted)]">{t('ancVisit.weekTarget', { week: slot.targetWeek, defaultValue: `Week ${slot.targetWeek}` })} · {slot.targetDate}</span></div><span className={`status-badge ${slot.status === 'completed' ? 'status-completed' : slot.status === 'behind' ? 'status-contacted' : 'status-recommended'}`}>{slot.status === 'completed' ? t('ancVisit.completed', { defaultValue: 'Done' }) : slot.status === 'behind' ? t('ancVisit.behind', { defaultValue: 'Behind' }) : t('ancVisit.upcoming', { defaultValue: 'Upcoming' })}</span></div>))}</div>)}{ancVisits[ancPregnancyId]?.length > 0 && (<details className="mt-3"><summary className="cursor-pointer text-xs font-medium text-[var(--teal-700)]">{t('ancVisit.viewHistory', { defaultValue: 'View visit history' })}</summary><div className="mt-2 space-y-2">{ancVisits[ancPregnancyId].map((v) => (<div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2 text-xs" key={v.id}><div className="flex items-center justify-between"><span className="font-medium">{t('ancVisit.visit', { n: v.visitNumber, defaultValue: `Visit ${v.visitNumber}` })} — {v.visitDate ? v.visitDate.slice(0, 10) : ''}</span><span className="text-[var(--text-muted)]">{v.gestationalWeekAtVisit != null ? `${t('pregnancy.gestationalWeek')}: ${v.gestationalWeekAtVisit}` : ''}</span></div>{v.bloodPressure && <p className="mt-1 text-[var(--text-secondary)]">BP: {v.bloodPressure}</p>}{v.weightKg != null && <p className="text-[var(--text-secondary)]">{t('ancVisit.weight', { kg: v.weightKg, defaultValue: `Weight: ${v.weightKg} kg` })}</p>}{v.dangerSignsChecked && <p className="text-[var(--danger-600)]">{t('ancVisit.dangerSignsChecked', { defaultValue: 'Danger signs checked' })}</p>}{v.notes && <p className="mt-1 text-[var(--text-secondary)]">{v.notes}</p>}</div>))}</div></details>)}{!lhwAncFormOpen && (<button className="button-secondary mt-3" onClick={() => openLhwAncForm((ancVisits[ancPregnancyId]?.length || 0) + 1)}>{t('ancVisit.logVisit', { defaultValue: 'Log a visit' })}</button>)}{lhwAncFormOpen && (<form className="mt-4 space-y-4 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-4" onSubmit={submitLhwAncVisit}><div className="grid gap-4 sm:grid-cols-2"><label className="form-label">{t('ancVisit.visitNumber', { defaultValue: 'Visit #' })}<input className="form-input" name="visitNumber" type="number" min="1" value={lhwAncForm.visitNumber} onChange={updateLhwAncField} required /></label><label className="form-label">{t('ancVisit.visitDate', { defaultValue: 'Visit date' })}<input className="form-input" name="visitDate" type="date" value={lhwAncForm.visitDate} onChange={updateLhwAncField} required /></label><label className="form-label">{t('ancVisit.bloodPressure', { defaultValue: 'Blood pressure' })}<input className="form-input" name="bloodPressure" value={lhwAncForm.bloodPressure} onChange={updateLhwAncField} placeholder="120/80" /></label><label className="form-label">{t('ancVisit.weightKg', { defaultValue: 'Weight (kg)' })}<input className="form-input" name="weightKg" type="number" step="0.1" value={lhwAncForm.weightKg} onChange={updateLhwAncField} /></label><label className="form-label">{t('ancVisit.nextVisitDate', { defaultValue: 'Next visit date' })}<input className="form-input" name="nextVisitDate" type="date" value={lhwAncForm.nextVisitDate} onChange={updateLhwAncField} /></label><label className="form-label flex items-center gap-2"><input type="checkbox" name="dangerSignsChecked" checked={lhwAncForm.dangerSignsChecked} onChange={updateLhwAncField} />{t('ancVisit.dangerSignsChecked', { defaultValue: 'Danger signs checked' })}</label></div><label className="form-label">{t('assessment.notes')}<textarea className="form-input" name="notes" rows="2" value={lhwAncForm.notes} onChange={updateLhwAncField} /></label><div className="flex flex-wrap gap-3"><button className="button-primary" disabled={ancSaving}>{ancSaving ? t('common.saving') : t('ancVisit.saveVisit', { defaultValue: 'Save visit' })}</button><button className="button-secondary" type="button" onClick={() => setLhwAncFormOpen(false)}>{t('common.cancel')}</button></div></form>)}</div>)}{/* ── Home Visits ───────────────────────── */}{selectedPatient && (<div className="mb-4"><p className="eyebrow">{t('homeVisit.title', { defaultValue: 'Home Visits' })}</p>{hvLoading && <p className="mt-2 text-sm text-[var(--text-muted)]">{t('homeVisit.loading', { defaultValue: 'Loading visits...' })}</p>}{homeVisits[selectedPatient.id]?.length > 0 && (<div className="mt-3 space-y-2">{homeVisits[selectedPatient.id].map((v) => (<div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2 text-xs" key={v.id}><div className="flex items-center justify-between"><span className="font-medium">{v.visitType.replace('_', ' ')} — {v.visitDate ? v.visitDate.slice(0, 10) : ''}</span>{v.bloodPressureChecked && <span className="text-[var(--teal-700)]">BP ✓</span>}</div>{v.topicsDiscussed?.length > 0 && <p className="mt-1 text-[var(--text-secondary)]">{v.topicsDiscussed.join(', ')}</p>}{v.notes && <p className="mt-1 text-[var(--text-secondary)]">{v.notes}</p>}</div>))}</div>)}{!hvFormOpen && (<button className="button-secondary mt-3" onClick={() => { setHvFormOpen(true); setHvForm({ visitDate: '', visitType: 'ROUTINE', topics: [], bloodPressureChecked: false, notes: '', nextVisitDate: '' }) }}>{t('homeVisit.logVisit', { defaultValue: 'Log home visit' })}</button>)}{hvFormOpen && (<form className="mt-4 space-y-4 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-4" onSubmit={submitHomeVisit}><div className="grid gap-4 sm:grid-cols-2"><label className="form-label">{t('homeVisit.visitDate', { defaultValue: 'Visit date' })}<input className="form-input" name="visitDate" type="date" value={hvForm.visitDate} onChange={updateHvField} required /></label><label className="form-label">{t('homeVisit.visitType', { defaultValue: 'Visit type' })}<select className="form-input" name="visitType" value={hvForm.visitType} onChange={updateHvField}><option value="ROUTINE">{t('homeVisit.routine', { defaultValue: 'Routine' })}</option><option value="FOLLOW_UP">{t('homeVisit.followUp', { defaultValue: 'Follow-up' })}</option><option value="POSTNATAL">{t('homeVisit.postnatal', { defaultValue: 'Postnatal' })}</option><option value="EMERGENCY_FOLLOW_UP">{t('homeVisit.emergencyFollowUp', { defaultValue: 'Emergency follow-up' })}</option></select></label><label className="form-label">{t('homeVisit.nextVisitDate', { defaultValue: 'Next visit date' })}<input className="form-input" name="nextVisitDate" type="date" value={hvForm.nextVisitDate} onChange={updateHvField} /></label><label className="form-label flex items-center gap-2"><input type="checkbox" name="bloodPressureChecked" checked={hvForm.bloodPressureChecked} onChange={updateHvField} />{t('homeVisit.bpChecked', { defaultValue: 'Blood pressure checked' })}</label></div><div><p className="form-label mb-2">{t('homeVisit.topicsDiscussed', { defaultValue: 'Topics discussed' })}</p><div className="grid gap-2 sm:grid-cols-2">{['Nutrition', 'Supplements', 'Danger signs', 'Birth planning', 'Breastfeeding', 'Family planning', 'Immunization', 'Hygiene'].map((topic) => (<label className="flex items-center gap-2 text-sm" key={topic}><input type="checkbox" checked={hvForm.topics.includes(topic)} onChange={() => toggleHvTopic(topic)} />{topic}</label>))}</div></div><label className="form-label">{t('assessment.notes')}<textarea className="form-input" name="notes" rows="2" value={hvForm.notes} onChange={updateHvField} /></label><div className="flex flex-wrap gap-3"><button className="button-primary" disabled={hvSaving}>{hvSaving ? t('common.saving') : t('homeVisit.saveVisit', { defaultValue: 'Save visit' })}</button><button className="button-secondary" type="button" onClick={() => setHvFormOpen(false)}>{t('common.cancel')}</button></div></form>)}</div>)}{/* ── Immunizations ──────────────────────── */}{selectedPatient && (<div className="mb-4"><p className="eyebrow">{t('immunization.title', { defaultValue: 'Immunizations (TT)' })}</p>{immLoading && <p className="mt-2 text-sm text-[var(--text-muted)]">{t('immunization.loading', { defaultValue: 'Loading...' })}</p>}{immSchedule && (<div className="mt-3 flex flex-wrap gap-2">{immSchedule.schedule.map((slot) => (<span className={`text-xs px-2 py-1 rounded-full font-medium ${slot.status === 'completed' ? 'bg-[var(--teal-100)] text-[var(--teal-800)]' : slot.status === 'next' ? 'bg-[var(--amber-100)] text-[var(--amber-800)]' : 'bg-[var(--bg-subtle)] text-[var(--text-muted)]'}`} key={slot.doseNumber}>{`TT${slot.doseNumber}`}</span>))}</div>)}{immunizations[selectedPatient.id]?.length > 0 && (<div className="mt-3 space-y-2">{immunizations[selectedPatient.id].map((v) => (<div className="rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] px-3 py-2 text-xs" key={v.id}><div className="flex items-center justify-between"><span className="font-medium">{v.vaccineName}-{v.doseNumber} — {v.dateAdministered ? v.dateAdministered.slice(0, 10) : ''}</span>{v.nextDoseDate && <span className="text-[var(--text-muted)]">{t('immunization.nextDose', { date: v.nextDoseDate.slice(0, 10), defaultValue: `Next: ${v.nextDoseDate.slice(0, 10)}` })}</span>}</div>{v.notes && <p className="mt-1 text-[var(--text-secondary)]">{v.notes}</p>}</div>))}</div>)}{!immFormOpen && (<button className="button-secondary mt-3" onClick={() => { setImmFormOpen(true); const nextDose = immSchedule?.nextDoseNumber || 1; setImmForm({ doseNumber: nextDose, dateAdministered: '', pregnancyId: ancPregnancyId || null, notes: '' }) }}>{t('immunization.logDose', { defaultValue: 'Log TT dose' })}</button>)}{immFormOpen && (<form className="mt-4 space-y-4 rounded-lg border border-[var(--border-soft)] bg-[var(--bg-subtle)] p-4" onSubmit={submitImmunization}><div className="grid gap-4 sm:grid-cols-2"><label className="form-label">{t('immunization.doseNumber', { defaultValue: 'Dose #' })}<select className="form-input" name="doseNumber" value={immForm.doseNumber} onChange={updateImmField}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{`TT${n}`}</option>)}</select></label><label className="form-label">{t('immunization.dateAdministered', { defaultValue: 'Date administered' })}<input className="form-input" name="dateAdministered" type="date" value={immForm.dateAdministered} onChange={updateImmField} required /></label>{ancPregnancies.length > 0 && (<label className="form-label">{t('immunization.pregnancy', { defaultValue: 'Pregnancy (optional)' })}<select className="form-input" name="pregnancyId" value={immForm.pregnancyId || ''} onChange={updateImmField}><option value="">{t('immunization.none', { defaultValue: 'None' })}</option>{ancPregnancies.map((p) => <option key={p.id} value={p.id}>{p.pregnancyStatus} — {p.lmpDate ? new Date(p.lmpDate).toLocaleDateString() : ''}</option>)}</select></label>)}</div><label className="form-label">{t('assessment.notes')}<textarea className="form-input" name="notes" rows="2" value={immForm.notes} onChange={updateImmField} /></label><div className="flex flex-wrap gap-3"><button className="button-primary" disabled={immSaving}>{immSaving ? t('common.saving') : t('immunization.saveDose', { defaultValue: 'Save dose' })}</button><button className="button-secondary" type="button" onClick={() => setImmFormOpen(false)}>{t('common.cancel')}</button></div></form>)}</div>)}{selectedAssessments.length === 0 && <section className="content-panel"><p className="text-[var(--text-secondary)]">{t('history.noAssessments')}</p></section>}{selectedAssessments.length > 0 && <div className="space-y-3">{selectedAssessments.map((assessment) => <button className="history-item" key={assessment.id} onClick={() => openAssessment(assessment.id)}><span><strong className="text-[var(--text-primary)]">{formatDate(assessment.assessmentDate)}</strong><small>{t('lhw.symptomRecords', { count: assessment.assessmentSymptoms.length })} \u00B7 {assessment.inputMethod}</small></span><span className={`risk-badge risk-${assessment.riskLevel.toLowerCase()}`}>{assessment.riskLevel}</span></button>)}</div>}</div>}</section>
    </div>}
  </div>
}

export default LhwDashboard

