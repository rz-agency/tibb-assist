import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCurrentUser, logoutUser } from './api/api'
import AppLayout from './components/AppLayout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import LhwDashboard from './pages/LhwDashboard'
import AssessmentPage from './pages/AssessmentPage'
import AssessmentHistory from './pages/AssessmentHistory'
import PregnancyPage from './pages/PregnancyPage'
import AiAssistantPage from './pages/AiAssistantPage'
import WeeklyCheckInPage from './pages/WeeklyCheckInPage'
import CareMissionPage from './pages/CareMissionPage'
import ReferralJourneyPage from './pages/ReferralJourneyPage'
import NearbyFacilitiesPage from './pages/NearbyFacilitiesPage'
import ProfilePage from './pages/ProfilePage'
import PatientDetailPage from './pages/PatientDetailPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import MonthlyReportPage from './pages/MonthlyReportPage'
import './App.css'

function App() {
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')
  const [patientDetailId, setPatientDetailId] = useState(null)
  const [monthlyReportUserId, setMonthlyReportUserId] = useState(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [showRegister, setShowRegister] = useState(false)

  useEffect(() => {
    getCurrentUser().then((result) => setUser(result.user)).catch(() => {}).finally(() => setCheckingSession(false))
  }, [])

  const logout = async () => {
    try {
      await logoutUser()
    } finally {
      setUser(null)
      setPage('dashboard')
      setMonthlyReportUserId(null)
    }
  }

  if (checkingSession) return <main className="auth-shell"><p className="text-[var(--text-muted)]">{t('layout.checkingSession')}</p></main>
  if (!user) return showRegister ? <Register onLogin={setUser} onShowLogin={() => setShowRegister(false)} /> : <Login onLogin={setUser} onShowRegister={() => setShowRegister(true)} />

  const handleNavigate = (target) => {
    if (typeof target === 'string' && target.startsWith('monthly-report:')) {
      const id = Number(target.split(':')[1])
      if (Number.isInteger(id) && id > 0) {
        setMonthlyReportUserId(id)
        setPage('monthly-report')
        return
      }
    }
    setPage(target)
  }

  const resolveContent = () => {
    // Shared pages accessible by any role.
    if (page === 'monthly-report' && monthlyReportUserId) {
      return <MonthlyReportPage userId={monthlyReportUserId} user={user} onBack={() => setPage(user.role === 'ADMIN' ? 'admin' : 'dashboard')} />
    }

    if (user.role === 'ADMIN') {
      return <AdminDashboardPage user={user} onNavigate={handleNavigate} />
    }

    if (user.role === 'LHW') {
      if (page === 'patient-detail' && patientDetailId) return <PatientDetailPage patientId={patientDetailId} onBack={() => setPage('dashboard')} />
      if (page === 'care-missions') return <CareMissionPage user={user} />
      if (page === 'referrals') return <ReferralJourneyPage user={user} />
      if (page === 'nearby') return <NearbyFacilitiesPage />
      return <LhwDashboard user={user} onNavigate={handleNavigate} onViewPatientDetail={(id) => { setPatientDetailId(id); setPage('patient-detail') }} />
    }

    // WOMAN role (default)
    if (page === 'assessment') return <AssessmentPage user={user} onNavigate={handleNavigate} />
    if (page === 'history') return <AssessmentHistory onNavigate={handleNavigate} />
    if (page === 'pregnancy') return <PregnancyPage />
    if (page === 'ai-assistant') return <AiAssistantPage user={user} onNavigate={handleNavigate} />
    if (page === 'checkin') return <WeeklyCheckInPage user={user} onNavigate={handleNavigate} />
    if (page === 'care-missions') return <CareMissionPage user={user} />
    if (page === 'referrals') return <ReferralJourneyPage user={user} />
    if (page === 'nearby') return <NearbyFacilitiesPage />
    if (page === 'profile') return <ProfilePage user={user} />
    return <Dashboard user={user} onNavigate={handleNavigate} />
  }

  const content = resolveContent()

  return <AppLayout user={user} currentPage={page} onNavigate={handleNavigate} onLogout={logout}>{content}</AppLayout>
}

export default App
