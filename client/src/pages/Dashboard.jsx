import { useEffect, useState } from 'react'
import { getPatientProfile } from '../api/api'
import StatusMessage from '../components/StatusMessage'

function Dashboard({ user, onNavigate }) {
  const [pregnancy, setPregnancy] = useState(null)
  const [pregnancyLoading, setPregnancyLoading] = useState(true)
  const [pregnancyError, setPregnancyError] = useState('')

  useEffect(() => {
    getPatientProfile(user.id)
      .then((profile) => setPregnancy(profile.pregnancies.find((item) => item.pregnancyStatus === 'ACTIVE') || profile.pregnancies[0] || null))
      .catch((requestError) => setPregnancyError(requestError.message))
      .finally(() => setPregnancyLoading(false))
  }, [user.id])

  return (
    <div>
      <div className="mb-8">
        <p className="eyebrow">Your care space</p>
        <h1 className="page-title">Good to see you</h1>
        <p className="mt-3 text-slate-600">Use this simple workspace to record and review assessments.</p>
      </div>
      <section className="profile-strip">
        <div><p className="text-sm text-slate-500">Signed in as</p><p className="font-semibold text-slate-900">{user.email}</p></div>
        <span className="role-badge">{user.role}</span>
      </section>
      <section className="content-panel mt-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Pregnancy</p>{pregnancyLoading && <p className="text-slate-600">Loading pregnancy information...</p>}{!pregnancyLoading && !pregnancyError && pregnancy && <><p className="font-semibold text-slate-900">{pregnancy.pregnancyStatus} pregnancy</p>{pregnancy.gestationalWeek !== null && <p className="mt-1 text-sm text-slate-600">{pregnancy.gestationalWeek} weeks</p>}{pregnancy.dueDate && <p className="mt-1 text-sm text-slate-600">Due: {pregnancy.dueDate.slice(0, 10)}</p>}</>}{!pregnancyLoading && !pregnancyError && !pregnancy && <p className="text-slate-600">No pregnancy information added.</p>}{pregnancyError && <StatusMessage>{pregnancyError}</StatusMessage>}</div><button className="button-secondary" onClick={() => onNavigate('pregnancy')}>{pregnancy ? 'View pregnancy' : 'Add pregnancy details'}</button></div></section>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <button className="action-card" onClick={() => onNavigate('assessment')}><span className="action-icon">+</span><strong>Start assessment</strong><span>Record symptom answers</span></button>
        <button className="action-card" onClick={() => onNavigate('history')}><span className="action-icon">≡</span><strong>Assessment history</strong><span>Review previous records</span></button>
        <div className="action-card action-card-muted"><span className="action-icon">○</span><strong>Profile</strong><span>Profile tools are coming next.</span></div>
      </div>
    </div>
  )
}

export default Dashboard
