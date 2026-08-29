import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { loginUser } from '../api/api'
import StatusMessage from '../components/StatusMessage'

function Login({ onLogin, onShowRegister }) {
  const { t } = useTranslation()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value })

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await loginUser(form)
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
          <p className="eyebrow">{t('auth.maternalCareSupport')}</p>
          <h1 className="page-title">{t('auth.welcomeToTibbAssist')}</h1>
          <p className="mt-3 text-slate-600">{t('auth.signInSubtitle')}</p>
        </div>
        <form className="space-y-5" onSubmit={submit}>
          <label className="form-label">{t('auth.email')}<input className="form-input" name="email" type="email" value={form.email} onChange={updateField} required /></label>
          <label className="form-label">{t('auth.password')}<input className="form-input" name="password" type="password" value={form.password} onChange={updateField} required /></label>
          {error && <StatusMessage>{error}</StatusMessage>}
          <button className="button-primary w-full" disabled={loading}>{loading ? t('auth.signingIn') : t('auth.signIn')}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">{t('auth.newToTibbAssist')} <button className="link-button" onClick={onShowRegister}>{t('auth.createAnAccount')}</button></p>
      </section>
    </main>
  )
}

export default Login
