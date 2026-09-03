import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createPregnancy, getPregnancies, updatePregnancy } from '../api/api'
import StatusMessage from '../components/StatusMessage'
import { BabyIcon } from '../components/Illustrations'

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

/** Client-side preview only — the server independently calculates dueDate from LMP. */
function previewDueDate(lmpDateString) {
  if (!lmpDateString) return null
  const parts = lmpDateString.split('-')
  if (parts.length !== 3) return null
  const due = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])))
  if (Number.isNaN(due.getTime())) return null
  due.setUTCDate(due.getUTCDate() + 280)
  return due.toISOString().slice(0, 10)
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
  const { t } = useTranslation()
  const [pregnancies, setPregnancies] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const formSectionRef = useRef(null)

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
    // The add/edit form lives at the bottom of the page — bring it into
    // view so clicking "Edit" visibly opens the form.
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
        setSuccess(t('pregnancy.infoUpdated'))
      } else {
        await createPregnancy(details)
        setSuccess(t('pregnancy.infoAdded'))
      }
      setEditingId(null)
      setForm(emptyForm)
      await loadPregnancies()
      // The form sits below the record cards — return to the top so the
      // success message and the refreshed record are visible after saving.
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-[var(--text-muted)]">{t('pregnancy.loadingInfo')}</p>

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">{t('pregnancy.profileEyebrow')}</p>
        <h1 className="page-title">{t('pregnancy.pageTitle')}</h1>
        <p className="mt-3 text-[var(--text-secondary)]">{t('pregnancy.subtitle')}</p>
      </div>

      {error && <StatusMessage>{error}</StatusMessage>}
      {success && <StatusMessage tone="success">{success}</StatusMessage>}

      {pregnancies.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon"><BabyIcon size={32} /></div>
          <p className="font-semibold text-[var(--text-primary)]">{t('pregnancy.noInfoAdded')}</p>
          <p className="text-sm text-[var(--text-secondary)]">{t('pregnancy.addDescription')}</p>
        </div>
      )}

      {/* ── Pregnancy cards ──────────────────────────────── */}
      {pregnancies.length > 0 && (
        <div className="space-y-4">
          {pregnancies.map((pregnancy) => {
            // Prefer the server's live-computed week (derived from LMP on every
            // request); the stored gestationalWeek column is only a manual
            // fallback for records without an LMP date.
            const gw = pregnancy.gestationalWeeks ?? pregnancy.gestationalWeek
            const progress = gw != null ? Math.min(gw / 40 * 100, 100) : null

            return (
              <article className="content-panel" key={pregnancy.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="detail-label">{t('pregnancy.status')}</p>
                    <p className="text-lg font-semibold text-[var(--text-primary)]">{pregnancy.pregnancyStatus}</p>
                  </div>
                  <button className="button-secondary" onClick={() => startEdit(pregnancy)}>{t('common.edit')}</button>
                </div>

                {/* Progress bar */}
                {progress != null && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span>{t('pregnancy.gestationalWeek')}: {gw}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="cm-progress-bar mt-1">
                      <div className="cm-progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                )}

                <div className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                  <div>
                    <span className="detail-label">{t('pregnancy.lmpDate')}</span>
                    <span>{dateInputValue(pregnancy.lmpDate) || t('common.notRecorded')}</span>
                  </div>
                  <div>
                    <span className="detail-label">{t('pregnancy.dueDate')}</span>
                    <span>{dateInputValue(pregnancy.dueDate) || t('common.notRecorded')}</span>
                  </div>
                  <div>
                    <span className="detail-label">{t('pregnancy.gestationalWeek')}</span>
                    <span>{pregnancy.gestationalWeeks ?? pregnancy.gestationalWeek ?? t('common.notRecorded')}</span>
                  </div>
                </div>
                {pregnancy.notes && <p className="mt-5 text-sm text-[var(--text-secondary)]">{t('pregnancy.notesPrefix')} {pregnancy.notes}</p>}
              </article>
            )
          })}
        </div>
      )}

      {/* ── Add/Edit form ────────────────────────────────── */}
      <section
        ref={formSectionRef}
        className={`content-panel${editingId ? ' panel-editing' : ''}`}
        style={{ scrollMarginTop: '84px' }}
      >
        <h2 className="section-title">{editingId ? t('pregnancy.editPregnancy') : t('pregnancy.addPregnancy')}</h2>
        <form className="mt-6 space-y-5" onSubmit={submit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="form-label">{t('pregnancy.status')}
              <select className="form-input" name="pregnancyStatus" value={form.pregnancyStatus} onChange={updateField}>
                <option value="ACTIVE">{t('pregnancy.active')}</option>
                <option value="COMPLETED">{t('pregnancy.completed')}</option>
                <option value="UNKNOWN">{t('pregnancy.unknown')}</option>
              </select>
            </label>
            <label className="form-label">{t('pregnancy.gestationalWeek')}
              <input className="form-input" name="gestationalWeek" type="number" value={form.gestationalWeek} onChange={updateField} />
            </label>
            <label className="form-label">{t('pregnancy.lmpDate')}
              <input className="form-input" name="lmpDate" type="date" value={form.lmpDate} onChange={updateField} />
              {form.lmpDate && previewDueDate(form.lmpDate) && (
                <p className="mt-1.5 rounded-lg bg-[var(--amber-50)] px-3 py-1.5 text-xs font-medium text-[var(--amber-700)]" style={{ border: '1px solid var(--amber-200)' }}>
                  <span className="block text-[10px] font-normal uppercase tracking-wide text-[var(--amber-600)]">{t('pregnancy.estimatedDueDate')}</span>
                  {t('pregnancy.dueDatePreview', { date: previewDueDate(form.lmpDate) })}
                </p>
              )}
            </label>
            <label className="form-label">{t('pregnancy.dueDate')}
              <input className="form-input" name="dueDate" type="date" value={form.dueDate} onChange={updateField} />
            </label>
          </div>
          <label className="form-label">{t('assessment.notes')}
            <textarea className="form-input" name="notes" rows="4" value={form.notes} onChange={updateField} />
          </label>
          <div className="flex flex-wrap gap-3">
            <button className="button-primary" disabled={saving}>
              {saving ? t('common.saving') : editingId ? t('pregnancy.updatePregnancy') : t('pregnancy.addPregnancyButton')}
            </button>
            {editingId && <button className="button-secondary" type="button" onClick={cancelEdit}>{t('common.cancel')}</button>}
          </div>
        </form>
      </section>
    </div>
  )
}

export default PregnancyPage
