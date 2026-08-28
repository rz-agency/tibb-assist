import { useState } from 'react'
import { loginUser } from '../api/api'
import StatusMessage from '../components/StatusMessage'

function Login({ onLogin, onShowRegister }) {
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
          <p className="eyebrow">Maternal care support</p>
          <h1 className="page-title">Welcome to Tibb Assist</h1>
          <p className="mt-3 text-slate-600">Sign in to continue your care journey.</p>
        </div>
        <form className="space-y-5" onSubmit={submit}>
          <label className="form-label">Email<input className="form-input" name="email" type="email" value={form.email} onChange={updateField} required /></label>
          <label className="form-label">Password<input className="form-input" name="password" type="password" value={form.password} onChange={updateField} required /></label>
          {error && <StatusMessage>{error}</StatusMessage>}
          <button className="button-primary w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">New to Tibb Assist? <button className="link-button" onClick={onShowRegister}>Create an account</button></p>
      </section>
    </main>
  )
}

export default Login
