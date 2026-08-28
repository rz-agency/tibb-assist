import { useEffect, useState } from 'react'
import { createPregnancy, getPregnancies, updatePregnancy } from '../api/api'
import StatusMessage from '../components/StatusMessage'

const emptyForm = {
  pregnancyStatus: 'ACTIVE',
  lmpDate: '',
  dueDate: '',
  gestationalWeek: '',
  notes: '',
}

function dateInputValue(value) {
  return value ? value.slice(0, 10) : ''
}

function formFromPregnancy(pregnancy) {
  return {
    pregnancyStatus: pregnancy.pregnancyStatus,
    lmpDate: dateInputValue(pregnancy.lmpDate),
    dueDate: dateInputValue(pregnancy.dueDate),
    gestationalWeek: pregnancy.gestationalWeek ?? '',
    notes: pregnancy.notes ?? '',
  }
}

function PregnancyPage() {
  const [pregnancies, setPregnancies] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadPregnancies = async () => {
    try {
      setError('')
      setPregnancies((await getPregnancies()).pregnancies)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadInitialPregnancies = async () => {
      try {
        setError('')
        setPregnancies((await getPregnancies()).pregnancies)
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setLoading(false)
      }
    }

    loadInitialPregnancies()
  }, [])

  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value })

  const startEdit = (pregnancy) => {
    setEditingId(pregnancy.id)
    setForm(formFromPregnancy(pregnancy))
    setSuccess('')
    setError('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    const details = {
      ...form,
      lmpDate: form.lmpDate || null,
      dueDate: form.dueDate || null,
      gestationalWeek: form.gestationalWeek === '' ? null : Number(form.gestationalWeek),
      notes: form.notes || null,
    }

    try {
      if (editingId) {
        await updatePregnancy(editingId, details)
        setSuccess('Pregnancy information updated.')
      } else {
        await createPregnancy(details)
        setSuccess('Pregnancy information added.')
      }
      setEditingId(null)
      setForm(emptyForm)
      await loadPregnancies()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-slate-600">Loading pregnancy information...</p>

  return <div>
    <div className="mb-8"><p className="eyebrow">Pregnancy profile</p><h1 className="page-title">Your pregnancy</h1><p className="mt-3 text-slate-600">Keep pregnancy information connected to your assessments.</p></div>
    {error && <StatusMessage>{error}</StatusMessage>}
    {success && <StatusMessage tone="success">{success}</StatusMessage>}
    {pregnancies.length === 0 && <section className="content-panel mb-6"><p className="font-semibold text-slate-900">No pregnancy information added yet.</p><p className="mt-2 text-slate-600">Add your pregnancy details to keep your assessments connected to your pregnancy.</p></section>}
    {pregnancies.length > 0 && <section className="mb-6 space-y-4">{pregnancies.map((pregnancy) => <article className="content-panel" key={pregnancy.id}><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="detail-label">Status</p><p className="font-semibold text-slate-900">{pregnancy.pregnancyStatus}</p></div><button className="button-secondary" onClick={() => startEdit(pregnancy)}>Edit</button></div><div className="mt-5 grid gap-4 text-sm sm:grid-cols-2"><div><span className="detail-label">LMP date</span><span>{dateInputValue(pregnancy.lmpDate) || 'Not recorded'}</span></div><div><span className="detail-label">Due date</span><span>{dateInputValue(pregnancy.dueDate) || 'Not recorded'}</span></div><div><span className="detail-label">Gestational week</span><span>{pregnancy.gestationalWeek ?? 'Not recorded'}</span></div></div>{pregnancy.notes && <p className="mt-5 text-sm text-slate-600">Notes: {pregnancy.notes}</p>}</article>)}</section>}
    <section className="content-panel"><h2 className="section-title">{editingId ? 'Edit pregnancy' : 'Add pregnancy'}</h2><form className="mt-6 space-y-5" onSubmit={submit}><div className="grid gap-5 sm:grid-cols-2"><label className="form-label">Status<select className="form-input" name="pregnancyStatus" value={form.pregnancyStatus} onChange={updateField}><option value="ACTIVE">Active</option><option value="COMPLETED">Completed</option><option value="UNKNOWN">Unknown</option></select></label><label className="form-label">Gestational week<input className="form-input" name="gestationalWeek" type="number" value={form.gestationalWeek} onChange={updateField} /></label><label className="form-label">LMP date<input className="form-input" name="lmpDate" type="date" value={form.lmpDate} onChange={updateField} /></label><label className="form-label">Due date<input className="form-input" name="dueDate" type="date" value={form.dueDate} onChange={updateField} /></label></div><label className="form-label">Notes<textarea className="form-input" name="notes" rows="4" value={form.notes} onChange={updateField} /></label><div className="flex flex-wrap gap-3"><button className="button-primary" disabled={saving}>{saving ? 'Saving...' : editingId ? 'Update pregnancy' : 'Add Pregnancy'}</button>{editingId && <button className="button-secondary" type="button" onClick={cancelEdit}>Cancel</button>}</div></form></section>
  </div>
}

export default PregnancyPage
