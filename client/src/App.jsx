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
import './App.css'

function App() {
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [page, setPage] = useState('dashboard')
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
    }
  }

  if (checkingSession) return <main className="auth-shell"><p className="text-[var(--text-muted)]">{t('layout.checkingSession')}</p></main>
  if (!user) return showRegister ? <Register onLogin={setUser} onShowLogin={() => setShowRegister(false)} /> : <Login onLogin={setUser} onShowRegister={() => setShowRegister(true)} />

  const content = user.role === 'LHW'
    ? page === 'care-missions'
      ? <CareMissionPage user={user} />
      : page === 'referrals'
        ? <ReferralJourneyPage user={user} />
        : page === 'nearby'
          ? <NearbyFacilitiesPage />
          : <LhwDashboard user={user} onNavigate={setPage} />
    : page === 'assessment'
    ? <AssessmentPage user={user} onNavigate={setPage} />
    : page === 'history'
      ? <AssessmentHistory onNavigate={setPage} />
      : page === 'pregnancy'
        ? <PregnancyPage />
        : page === 'ai-assistant'
          ? <AiAssistantPage user={user} onNavigate={setPage} />
          : page === 'checkin'
            ? <WeeklyCheckInPage user={user} onNavigate={setPage} />
            : page === 'care-missions'
            ? <CareMissionPage user={user} />
            : page === 'referrals'
              ? <ReferralJourneyPage user={user} />
              : page === 'nearby'
                ? <NearbyFacilitiesPage />
                : page === 'profile'
                  ? <ProfilePage user={user} />
                  : <Dashboard user={user} onNavigate={setPage} />

  return <AppLayout user={user} currentPage={page} onNavigate={setPage} onLogout={logout}>{content}</AppLayout>
}

export default App
