function AppLayout({ user, currentPage, onNavigate, onLogout, children }) {
  return (
    <div className="min-h-screen bg-[#f7f4ee] text-slate-800">
      <header className="border-b border-slate-200 bg-white/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <button className="text-left" onClick={() => onNavigate('dashboard')}>
            <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Maternal care</span>
            <span className="text-xl font-bold text-slate-900">Tibb Assist</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">{user.email}</span>
            <button className="button-secondary" onClick={onLogout}>Log out</button>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-8 sm:px-8 lg:flex-row">
        <nav className="flex shrink-0 gap-2 overflow-x-auto lg:w-48 lg:flex-col">
          {(user.role === 'LHW'
            ? [['dashboard', 'Assigned women']]
            : [['dashboard', 'Dashboard'], ['pregnancy', 'Pregnancy'], ['assessment', 'New assessment'], ['history', 'History']]
          ).map(([page, label]) => (
            <button
              key={page}
              className={currentPage === page ? 'nav-item nav-item-active' : 'nav-item'}
              onClick={() => onNavigate(page)}
            >
              {label}
            </button>
          ))}
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}

export default AppLayout
