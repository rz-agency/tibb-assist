import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCareMissions, getPatientProfile, logEmergencyAction } from '../api/api'

const RESCUE_1122_PHONE_NUMBER = '1122'

/**
 * Emergency Voice Mode — calm call panel shown alongside RED assessment results.
 *
 * Every action is a user-confirmed tel: link. Tapping a button opens the
 * phone's dialer and logs a fire-and-forget "call initiated" entry on the
 * Care Mission timeline. Nothing is ever called, sent, or dispatched
 * automatically by the app.
 */
function EmergencyPanel({ user, assessmentId, onNavigate }) {
  const { t } = useTranslation()
  const [missionId, setMissionId] = useState(null)
  const [primaryContact, setPrimaryContact] = useState(null)
  const [assignedLhw, setAssignedLhw] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadPanelData = async () => {
      try {
        const [profile, missionsResult] = await Promise.all([
          getPatientProfile(user.id),
          getCareMissions(true).catch(() => ({ careMissions: [] })),
        ])

        if (cancelled) return

        const contacts = profile.emergencyContacts || []
        setPrimaryContact(contacts.find((contact) => contact.isPrimary) || contacts[0] || null)
        setAssignedLhw(profile.assignedLhw || null)

        const mission = missionsResult.careMissions.find((entry) => entry.assessment?.id === assessmentId)
        setMissionId(mission ? mission.id : null)
      } catch {
        // Call buttons stay usable without profile data; logging is skipped.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadPanelData()
    return () => { cancelled = true }
  }, [user.id, assessmentId])

  // Fire-and-forget: never blocks the tel: link opened by the anchor itself.
  const initiateCall = (actionType) => {
    if (!missionId) return
    logEmergencyAction(missionId, actionType).catch(() => {})
  }

  return (
    <section className="emergency-panel">
      <p className="eyebrow">{t('emergencyPanel.eyebrow')}</p>
      <h2 className="section-title">{t('emergencyPanel.title')}</h2>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('emergencyPanel.disclaimer')}</p>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">{t('emergencyPanel.loading')}</p>
      ) : (
        <div className="mt-5 space-y-3">
          <a className="emergency-call-button" href={`tel:${RESCUE_1122_PHONE_NUMBER}`} onClick={() => initiateCall('CALLED_RESCUE_1122')}>
            {t('emergencyPanel.callRescue1122')}
          </a>

          {primaryContact ? (
            <a className="emergency-call-button" href={`tel:${primaryContact.phoneNumber}`} onClick={() => initiateCall('CALLED_EMERGENCY_CONTACT')}>
              {t('emergencyPanel.callContact', { name: primaryContact.name })}
              <small>{t('emergencyPanel.primaryContactLabel')}{primaryContact.relationship ? ` · ${primaryContact.relationship}` : ''}</small>
            </a>
          ) : (
            <div className="emergency-no-contact">
              <p className="text-sm text-[var(--text-secondary)]">{t('emergencyPanel.noContactPrompt')}</p>
              {onNavigate && <button className="link-button" onClick={() => onNavigate('dashboard')}>{t('emergencyPanel.addContactLink')}</button>}
            </div>
          )}

          {assignedLhw?.phone && (
            <a className="emergency-call-button" href={`tel:${assignedLhw.phone}`} onClick={() => initiateCall('CALLED_LHW')}>
              {t('emergencyPanel.callLhw', { name: assignedLhw.fullName })}
            </a>
          )}
        </div>
      )}
    </section>
  )
}

export default EmergencyPanel
