import { useTranslation } from 'react-i18next'
import LanguageSwitcher from './LanguageSwitcher'
import { BrandMark } from './Illustrations'

function AppLayout({ user, currentPage, onNavigate, onLogout, children }) {
  const { t } = useTranslation()

  const navItems = user.role === 'LHW'
    ? [
        ['dashboard', t('layout.navAssignedWomen')],
        ['care-missions', t('layout.navCareMissions')],
        ['referrals', t('layout.navReferrals')],
        ['nearby', t('layout.navNearby')],
      ]
    : [
        ['dashboard', t('layout.navDashboard')],
        ['ai-assistant', t('layout.navAiAssistant')],
        ['care-missions', t('layout.navCareMissions')],
        ['referrals', t('layout.navReferrals')],
        ['pregnancy', t('layout.navPregnancy')],
        ['checkin', t('layout.navCheckIn')],
        ['assessment', t('layout.navNewAssessment')],
        ['history', t('layout.navHistory')],
        ['nearby', t('layout.navNearby')],
        ['profile', t('layout.navProfile')],
      ]

  return (
    <div className="min-h-screen text-[var(--text-primary)]" style={{ background: 'var(--bg-page)' }}>
      {/* ── Header ────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b backdrop-blur-md" style={{ borderColor: 'var(--border-soft)', background: 'rgba(250,248,244,0.88)' }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <button className="flex items-center gap-3 text-start" onClick={() => onNavigate('dashboard')}>
            <BrandMark size={32} />
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-[var(--tracking-wider)]" style={{ color: 'var(--teal-700)' }}>{t('layout.maternalCare')}</span>
              <span className="text-xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--teal-900)' }}>{t('layout.tibbAssist')}</span>
            </div>
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-[var(--text-muted)] sm:inline">{user.email}</span>
            <LanguageSwitcher />
            <button className="button-secondary" onClick={onLogout}>{t('layout.logOut')}</button>
          </div>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────── */}
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 lg:flex-row">
        {/* Sidebar */}
        <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-52 lg:flex-col">
          {navItems.map(([page, label]) => (
            <button
              key={page}
              className={currentPage === page ? 'nav-item nav-item-active' : 'nav-item'}
              onClick={() => onNavigate(page)}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}

export default AppLayout
