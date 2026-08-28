import { useState } from 'react'
import { registerUser } from '../api/api'
import StatusMessage from '../components/StatusMessage'

function Register({ onLogin, onShowLogin }) {
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
          <p className="eyebrow">Start simply</p>
          <h1 className="page-title">Create your account</h1>
          <p className="mt-3 text-slate-600">Choose how you will use this early project version.</p>
        </div>
        <form className="space-y-5" onSubmit={submit}>
          {form.role === 'WOMAN' && <label className="form-label">Full name<input className="form-input" name="fullName" type="text" value={form.fullName} onChange={updateField} required /></label>}
          <label className="form-label">Email<input className="form-input" name="email" type="email" value={form.email} onChange={updateField} required /></label>
          <label className="form-label">Password<input className="form-input" name="password" type="password" minLength="8" value={form.password} onChange={updateField} required /></label>
          <label className="form-label">Account type<select className="form-input" name="role" value={form.role} onChange={updateField}><option value="WOMAN">Woman</option><option value="LHW">Lady Health Worker</option></select></label>
          {error && <StatusMessage>{error}</StatusMessage>}
          <button className="button-primary w-full" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">Already registered? <button className="link-button" onClick={onShowLogin}>Sign in</button></p>
      </section>
    </main>
  )
}

export default Register
