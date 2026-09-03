import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getPatientProfile, updatePatientProfile } from '../api/api'
import { setLanguage } from '../i18n/config'
import StatusMessage from '../components/StatusMessage'

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const PK_PHONE_RE = /^(\+92|0092|0)3[0-9]{9}$/

function isValidPakistaniPhone(value) {
  if (!value) return true
  const digits = String(value).replace(/[\s-]/g, '')
  return PK_PHONE_RE.test(digits)
}

function computeAgeFromDate(dateStr) {
  if (!dateStr) return null
  const dob = new Date(dateStr)
  if (isNaN(dob.getTime())) return null
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age >= 0 ? age : null
}

function ProfilePage({ user }) {
  const { t, i18n } = useTranslation()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [formErrors, setFormErrors] = useState({})
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    dateOfBirth: '',
    address: '',
    bloodGroup: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    preferredLanguage: 'ur',
    villageOrArea: '',
    district: '',
    province: '',
  })

  useEffect(() => {
    getPatientProfile(user.id)
      .then((data) => {
        setProfile(data)
        const dob = data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : ''
        setForm({
          fullName: data.fullName || '',
          phone: data.phone || '',
          dateOfBirth: dob,
          address: data.address || '',
          bloodGroup: data.bloodGroup || '',
          emergencyContactName: data.emergencyContactName || '',
          emergencyContactPhone: data.emergencyContactPhone || '',
          emergencyContactRelation: data.emergencyContactRelation || '',
          preferredLanguage: data.preferredLanguage || 'ur',
          villageOrArea: data.villageOrArea || '',
          district: data.district || '',
          province: data.province || '',
        })
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [user.id])

  function hydrateForm(data) {
    const dob = data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : ''
    setForm({
      fullName: data.fullName || '',
      phone: data.phone || '',
      dateOfBirth: dob,
      address: data.address || '',
      bloodGroup: data.bloodGroup || '',
      emergencyContactName: data.emergencyContactName || '',
      emergencyContactPhone: data.emergencyContactPhone || '',
      emergencyContactRelation: data.emergencyContactRelation || '',
      preferredLanguage: data.preferredLanguage || i18n.language || 'ur',
      villageOrArea: data.villageOrArea || '',
      district: data.district || '',
      province: data.province || '',
    })
  }

  function startEdit() {
    if (profile) hydrateForm(profile)
    setEditing(true)
    setSuccess('')
    setSubmitError('')
    setFormErrors({})
  }

  function cancelEdit() {
    setEditing(false)
    setSubmitError('')
    setFormErrors({})
  }

  function updateField(event) {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
    // Clear field-level error on change
    if (formErrors[name]) {
      setFormErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  function handleLanguageChange(event) {
    const lang = event.target.value
    setForm((prev) => ({ ...prev, preferredLanguage: lang }))
    setLanguage(lang)
  }

  function validate() {
    const errors = {}
    if (!form.fullName.trim()) errors.fullName = t('profile.fullNameRequired')
    if (form.phone && !isValidPakistaniPhone(form.phone)) errors.phone = t('profile.invalidPhone')
    if (form.emergencyContactPhone && !isValidPakistaniPhone(form.emergencyContactPhone)) {
      errors.emergencyContactPhone = t('profile.invalidPhone')
    }
    if (form.dateOfBirth) {
      const age = computeAgeFromDate(form.dateOfBirth)
      if (age === null || age < 12 || age > 60) errors.dateOfBirth = t('profile.ageOutOfRange')
    }
    if (form.bloodGroup && !BLOOD_GROUPS.includes(form.bloodGroup)) {
      errors.bloodGroup = t('profile.invalidBloodGroup')
    }
    return errors
  }

  async function save(event) {
    event.preventDefault()
    const errors = validate()
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    setSaving(true)
    setSuccess('')
    setSubmitError('')
    try {
      const payload = {
        fullName: form.fullName.trim(),
        phone: form.phone || null,
        dateOfBirth: form.dateOfBirth || null,
        address: form.address || null,
        bloodGroup: form.bloodGroup || null,
        emergencyContactName: form.emergencyContactName || null,
        emergencyContactPhone: form.emergencyContactPhone || null,
        emergencyContactRelation: form.emergencyContactRelation || null,
        preferredLanguage: form.preferredLanguage || 'ur',
        villageOrArea: form.villageOrArea || null,
        district: form.district || null,
        province: form.province || null,
      }
      const updated = await updatePatientProfile(user.id, payload)
      setProfile(updated)
      setSuccess(t('common.profileUpdated'))
      setEditing(false)
    } catch (err) {
      setSubmitError(err.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">{t('profile.loading')}</p>
  }
  if (error) {
    return <StatusMessage>{error}</StatusMessage>
  }
  if (!profile) {
    return <StatusMessage>{t('profile.notFound')}</StatusMessage>
  }

  const computedAge = profile.computedAge ?? profile.age ?? null

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow">{t('profile.eyebrow')}</p>
        <h1 className="page-title">{t('profile.pageTitle')}</h1>
        <p className="mt-2 text-[var(--text-secondary)]">{t('profile.subtitle')}</p>
      </div>

      {success && <StatusMessage tone="success">{success}</StatusMessage>}

      {/* ── View mode ────────────────────────────────────── */}
      {!editing && (
        <section className="content-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{profile.fullName}</p>
              {computedAge !== null && (
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  {t('profile.ageDisplay', { age: computedAge, defaultValue: `Age: ${computedAge}` })}
                </p>
              )}
            </div>
            <button className="button-secondary" onClick={startEdit}>{t('common.editProfile')}</button>
          </div>

          <div className="mt-5 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
            {profile.phone && (
              <div><span className="detail-label">{t('profile.phoneLabel')}</span><span>{profile.phone}</span></div>
            )}
            {profile.dateOfBirth && (
              <div><span className="detail-label">{t('profile.dobLabel')}</span><span>{profile.dateOfBirth.slice(0, 10)}</span></div>
            )}
            {profile.bloodGroup && (
              <div><span className="detail-label">{t('profile.bloodGroupLabel')}</span><span>{profile.bloodGroup}</span></div>
            )}
            {profile.preferredLanguage && (
              <div><span className="detail-label">{t('profile.languageLabel')}</span><span>{profile.preferredLanguage === 'ur' ? t('profile.urdu') : t('profile.english')}</span></div>
            )}
            {profile.address && (
              <div className="sm:col-span-2"><span className="detail-label">{t('profile.addressLabel')}</span><span>{profile.address}</span></div>
            )}
            {profile.villageOrArea && (
              <div><span className="detail-label">{t('dashboard.areaLabel')}</span><span>{profile.villageOrArea}</span></div>
            )}
            {profile.district && (
              <div><span className="detail-label">{t('dashboard.districtLabel')}</span><span>{profile.district}</span></div>
            )}
            {profile.province && (
              <div><span className="detail-label">{t('dashboard.provinceLabel')}</span><span>{profile.province}</span></div>
            )}
          </div>

          {/* Emergency contact info */}
          {(profile.emergencyContactName || profile.emergencyContactPhone) && (
            <div className="mt-6 border-t border-[var(--border-soft)] pt-5">
              <p className="eyebrow">{t('profile.emergencyContactSection')}</p>
              <div className="mt-3 grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
                {profile.emergencyContactName && (
                  <div><span className="detail-label">{t('profile.ecName')}</span><span>{profile.emergencyContactName}</span></div>
                )}
                {profile.emergencyContactPhone && (
                  <div><span className="detail-label">{t('profile.ecPhone')}</span><span>{profile.emergencyContactPhone}</span></div>
                )}
                {profile.emergencyContactRelation && (
                  <div><span className="detail-label">{t('profile.ecRelation')}</span><span>{profile.emergencyContactRelation}</span></div>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── Edit mode ────────────────────────────────────── */}
      {editing && (
        <section className="content-panel">
          <form className="space-y-5" onSubmit={save}>
            <p className="eyebrow">{t('profile.editTitle')}</p>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="form-label">
                {t('profile.formFullName')} *
                <input className="form-input" name="fullName" value={form.fullName} onChange={updateField} required />
                {formErrors.fullName && <span className="form-error">{formErrors.fullName}</span>}
              </label>

              <label className="form-label">
                {t('profile.formPhone')}
                <input className="form-input" name="phone" value={form.phone} onChange={updateField} placeholder="03XXXXXXXXX" />
                {formErrors.phone && <span className="form-error">{formErrors.phone}</span>}
              </label>

              <label className="form-label">
                {t('profile.formDob')}
                <input className="form-input" name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={updateField} />
                {formErrors.dateOfBirth && <span className="form-error">{formErrors.dateOfBirth}</span>}
                {form.dateOfBirth && computeAgeFromDate(form.dateOfBirth) !== null && (
                  <span className="form-hint">
                    {t('profile.agePreview', { age: computeAgeFromDate(form.dateOfBirth), defaultValue: `Age: ${computeAgeFromDate(form.dateOfBirth)}` })}
                  </span>
                )}
              </label>

              <label className="form-label">
                {t('profile.formBloodGroup')}
                <select className="form-input" name="bloodGroup" value={form.bloodGroup} onChange={updateField}>
                  <option value="">{t('profile.selectBloodGroup', { defaultValue: 'Select...' })}</option>
                  {BLOOD_GROUPS.map((bg) => <option key={bg} value={bg}>{bg}</option>)}
                </select>
                {formErrors.bloodGroup && <span className="form-error">{formErrors.bloodGroup}</span>}
              </label>

              <label className="form-label">
                {t('profile.formLanguage')}
                <select className="form-input" name="preferredLanguage" value={form.preferredLanguage} onChange={handleLanguageChange}>
                  <option value="ur">{t('profile.urdu')}</option>
                  <option value="en">{t('profile.english')}</option>
                </select>
              </label>

              <label className="form-label">
                {t('profile.formAddress')}
                <input className="form-input" name="address" value={form.address} onChange={updateField} />
              </label>

              <label className="form-label">
                {t('dashboard.formVillageArea')}
                <input className="form-input" name="villageOrArea" value={form.villageOrArea} onChange={updateField} />
              </label>

              <label className="form-label">
                {t('dashboard.formDistrict')}
                <input className="form-input" name="district" value={form.district} onChange={updateField} />
              </label>

              <label className="form-label">
                {t('dashboard.formProvince')}
                <input className="form-input" name="province" value={form.province} onChange={updateField} />
              </label>
            </div>

            {/* Emergency contact fields */}
            <div className="border-t border-[var(--border-soft)] pt-5">
              <p className="eyebrow">{t('profile.emergencyContactSection')}</p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <label className="form-label">
                  {t('profile.formEcName')}
                  <input className="form-input" name="emergencyContactName" value={form.emergencyContactName} onChange={updateField} />
                </label>

                <label className="form-label">
                  {t('profile.formEcPhone')}
                  <input className="form-input" name="emergencyContactPhone" value={form.emergencyContactPhone} onChange={updateField} placeholder="03XXXXXXXXX" />
                  {formErrors.emergencyContactPhone && <span className="form-error">{formErrors.emergencyContactPhone}</span>}
                </label>

                <label className="form-label">
                  {t('profile.formEcRelation')}
                  <input className="form-input" name="emergencyContactRelation" value={form.emergencyContactRelation} onChange={updateField} placeholder={t('emergency.relationshipPlaceholder')} />
                </label>
              </div>
            </div>

            {submitError && <StatusMessage>{submitError}</StatusMessage>}

            <div className="flex flex-wrap gap-3">
              <button className="button-primary" disabled={saving}>
                {saving ? t('common.saving') : t('common.saveProfile')}
              </button>
              <button className="button-secondary" type="button" onClick={cancelEdit}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  )
}

export default ProfilePage
