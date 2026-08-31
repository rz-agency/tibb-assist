import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createEmergencyContact, deleteEmergencyContact, getEmergencyContacts, updateEmergencyContact } from '../api/api'
import StatusMessage from './StatusMessage'

const emptyForm = { name: '', relationship: '', phoneNumber: '', isPrimary: false }

function EmergencyContacts({ patientId }) {
  const { t } = useTranslation()
  const [contacts, setContacts] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadContacts = async () => {
    try {
      setError('')
      const result = await getEmergencyContacts(patientId)
      setContacts(result.emergencyContacts)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    getEmergencyContacts(patientId)
      .then((result) => { if (!cancelled) setContacts(result.emergencyContacts) })
      .catch((requestError) => { if (!cancelled) setError(requestError.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [patientId])

  const updateField = (event) => {
    const { name, value, type, checked } = event.target
    setForm({ ...form, [name]: type === 'checkbox' ? checked : value })
  }

  const startEdit = (contact) => {
    setEditingId(contact.id)
    setForm({ name: contact.name, relationship: contact.relationship, phoneNumber: contact.phoneNumber, isPrimary: contact.isPrimary })
    setShowForm(true)
    setSuccess('')
    setError('')
  }

  const startAdd = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(true)
    setSuccess('')
    setError('')
  }

  const cancelForm = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowForm(false)
  }

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      if (editingId) {
        await updateEmergencyContact(editingId, form)
        setSuccess(t('emergency.contactUpdated'))
      } else {
        await createEmergencyContact(patientId, form)
        setSuccess(t('emergency.contactAdded'))
      }
      cancelForm()
      await loadContacts()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deletingId) return
    try {
      setError('')
      await deleteEmergencyContact(deletingId)
      setSuccess(t('emergency.contactDeleted'))
      setDeletingId(null)
      await loadContacts()
    } catch (requestError) {
      setError(requestError.message)
    }
  }

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="eyebrow">{t('emergency.eyebrow')}</p>
        {!showForm && !loading && <button className="button-secondary" onClick={startAdd}>{t('emergency.addContact')}</button>}
      </div>
      {loading && <p className="mt-3 text-sm text-[var(--text-muted)]">{t('emergency.loading')}</p>}
      {error && <StatusMessage>{error}</StatusMessage>}
      {success && <StatusMessage tone="success">{success}</StatusMessage>}
      {!loading && contacts.length === 0 && !showForm && <p className="mt-3 text-sm text-[var(--text-muted)]">{t('emergency.noContacts')}</p>}
      {!loading && contacts.length > 0 && <div className="mt-3 space-y-3">{contacts.map((contact) => (
        <div className="content-panel" key={contact.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[var(--text-primary)]">{contact.name}{contact.isPrimary && <span className="ms-2 inline-block rounded-full bg-[var(--teal-100)] px-2 py-0.5 text-xs font-bold text-[var(--teal-700)]">{t('emergency.primary')}</span>}</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{contact.relationship}</p>
              <p className="mt-1 text-sm text-[var(--text-primary)]">{contact.phoneNumber}</p>
            </div>
            <div className="flex gap-2">
              <button className="button-secondary" onClick={() => startEdit(contact)}>{t('common.edit')}</button>
              {deletingId === contact.id
                ? <><button className="button-secondary text-red-600" onClick={confirmDelete}>{t('emergency.confirm')}</button><button className="button-secondary" onClick={() => setDeletingId(null)}>{t('common.cancel')}</button></>
                : <button className="button-secondary text-red-600" onClick={() => setDeletingId(contact.id)}>{t('emergency.delete')}</button>}
            </div>
          </div>
        </div>
      ))}</div>}
      {showForm && (
        <section className="content-panel mt-4">
          <h2 className="section-title">{editingId ? t('emergency.editContact') : t('emergency.addContactForm')}</h2>
          <form className="mt-5 space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-label">{t('emergency.name')}<input className="form-input" name="name" value={form.name} onChange={updateField} required /></label>
              <label className="form-label">{t('emergency.relationship')}<input className="form-input" name="relationship" value={form.relationship} onChange={updateField} placeholder={t('emergency.relationshipPlaceholder')} required /></label>
              <label className="form-label">{t('emergency.phoneNumber')}<input className="form-input" name="phoneNumber" value={form.phoneNumber} onChange={updateField} placeholder={t('emergency.phonePlaceholder')} required /></label>
              <label className="form-label mt-auto"><label className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-secondary)]"><input type="checkbox" name="isPrimary" checked={form.isPrimary} onChange={updateField} className="h-4 w-4" />{t('emergency.setAsPrimary')}</label></label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="button-primary" disabled={saving}>{saving ? t('common.saving') : editingId ? t('emergency.updateContact') : t('emergency.addContact')}</button>
              <button className="button-secondary" type="button" onClick={cancelForm}>{t('common.cancel')}</button>
            </div>
          </form>
        </section>
      )}
    </section>
  )
}

export default EmergencyContacts
