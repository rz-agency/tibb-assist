import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { registerUser } from '../api/api'
import StatusMessage from '../components/StatusMessage'

function Register({ onLogin, onShowLogin }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ email: '', password: '', role: 'WOMAN', fullName: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await registerUser(form)
      onLogin(result.user)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-panel">
        <div className="mb-8">
          <p className="eyebrow">{t('auth.startSimply')}</p>
          <h1 className="page-title">{t('auth.createYourAccount')}</h1>
          <p className="mt-3 text-slate-600">{t('auth.registerSubtitle')}</p>
        </div>
        <form className="space-y-5" onSubmit={submit}>
          {form.role === 'WOMAN' && <label className="form-label">{t('auth.fullName')}<input className="form-input" name="fullName" type="text" value={form.fullName} onChange={updateField} required /></label>}
          <label className="form-label">{t('auth.email')}<input className="form-input" name="email" type="email" value={form.email} onChange={updateField} required /></label>
          <label className="form-label">{t('auth.password')}<input className="form-input" name="password" type="password" minLength="8" value={form.password} onChange={updateField} required /></label>
          <label className="form-label">{t('auth.accountType')}<select className="form-input" name="role" value={form.role} onChange={updateField}><option value="WOMAN">{t('auth.woman')}</option><option value="LHW">{t('auth.ladyHealthWorker')}</option></select></label>
          {error && <StatusMessage>{error}</StatusMessage>}
          <button className="button-primary w-full" disabled={loading}>{loading ? t('auth.creatingAccount') : t('auth.createAccount')}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">{t('auth.alreadyRegistered')} <button className="link-button" onClick={onShowLogin}>{t('auth.signIn')}</button></p>
      </section>
    </main>
  )
}

export default Register
