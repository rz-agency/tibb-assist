import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getCheckInDue, getCheckInQuestions, submitCheckIn } from '../api/api'
import AssessmentResultSection from '../components/AssessmentResultSection'
import StatusMessage from '../components/StatusMessage'

/**
 * Weekly pregnancy check-in: a short set of questions tailored to the current
 * gestational week. Concerning answers (or a filled free-text note) are routed
 * through the EXISTING assessment pipeline on the server — the result below is
 * the same shared result display a normal assessment uses.
 *
 * Reachable any time via the nav (not just the dashboard "due" banner): when
 * this week's check-in is already done, a completed state is shown with an
 * option to do it again anyway.
 */
function WeeklyCheckInPage({ user, onNavigate }) {
  const { t } = useTranslation()

  const [questionSet, setQuestionSet] = useState(null)
  const [answers, setAnswers] = useState({})
  const [freeTextNote, setFreeTextNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [result, setResult] = useState(null)
  // Whether this week's check-in is already done (from /checkins/due). null
  // means unknown — a failed status check must never block the page.
  const [dueInfo, setDueInfo] = useState(null)
  // Escape hatch that shows the form even when this week is already done.
  const [redoAnyway, setRedoAnyway] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loadQuestions = getCheckInQuestions()
      .then((data) => { if (!cancelled) setQuestionSet(data) })
      .catch((requestError) => { if (!cancelled) setLoadError(requestError.message) })
    const loadDue = getCheckInDue()
      .then((data) => { if (!cancelled) setDueInfo(data) })
      .catch(() => {})
    Promise.all([loadQuestions, loadDue]).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  if (user.role !== 'WOMAN') {
    return (
      <section className="content-panel text-center">
        <h1 className="section-title">{t('checkIn.eyebrow')}</h1>
        <p className="mt-3 text-[var(--text-secondary)]">{t('ai.entryRestriction')}</p>
      </section>
    )
  }

  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">{t('checkIn.loading')}</p>
  }

  if (loadError) {
    // No active pregnancy (or no LMP date) — a calm prompt plus a way to fix it.
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <h1 className="page-title">{t('checkIn.eyebrow')}</h1>
        </div>
        <div className="content-panel">
          <StatusMessage>{loadError}</StatusMessage>
          <button className="button-secondary mt-4" onClick={() => onNavigate('pregnancy')}>
            {t('checkIn.goToPregnancy')}
          </button>
        </div>
      </div>
    )
  }

  // A routed check-in produced an assessment — show the SAME result view a
  // normal assessment shows (including the RED EmergencyPanel).
  if (result?.assessment) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <p className="eyebrow">{t('checkIn.eyebrow')}</p>
          <h1 className="page-title">{t('checkIn.pageTitle', { week: result.checkIn.gestationalWeekAtCheckIn })}</h1>
        </div>
        <div className="content-panel checkin-result-wrap">
          <AssessmentResultSection
            assessment={result.assessment}
            aiExplanation={result.aiExplanation || ''}
            notedSymptoms={result.notedSymptoms || []}
            facilities={result.facilities || []}
            user={user}
            onNavigate={onNavigate}
            ageRiskNote={result.ageRiskNote || null}
          />
        </div>
      </div>
    )
  }

  // Not routed (or routing failed) — calm summary + any visit advisories.
  if (result) {
    const advisories = (result.checkIn.answers || []).filter((answer) => answer.tag === 'MENTION_AT_VISIT')
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <p className="eyebrow">{t('checkIn.eyebrow')}</p>
          <h1 className="page-title">{t('checkIn.pageTitle', { week: result.checkIn.gestationalWeekAtCheckIn })}</h1>
        </div>
        <div className="content-panel">
          <h2 className="font-semibold text-[var(--text-primary)]">{t('checkIn.summaryTitle')}</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {t('checkIn.summaryBody', { week: result.checkIn.gestationalWeekAtCheckIn })}
          </p>
          {result.routingFailed && (
            <div className="mt-4">
              <StatusMessage>{t('checkIn.routingFailedNote')}</StatusMessage>
            </div>
          )}
          {advisories.length > 0 && (
            <div className="mt-5 border-t border-[var(--border-soft)] pt-4">
              <h3 className="text-sm font-medium text-[var(--text-secondary)]">{t('checkIn.advisoryTitle')}</h3>
              <ul className="mt-2 space-y-2">
                {advisories.map((answer) => (
                  <li className="rounded-lg border border-[var(--amber-200)] bg-[var(--amber-50)] px-3 py-2 text-sm" key={answer.optionId}>
                    {t(`checkIn.advisory.${answer.optionId}`)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="button-primary" onClick={() => onNavigate('dashboard')}>{t('assessment.backToDashboard')}</button>
            {result.routingFailed && (
              <button className="button-secondary" onClick={() => onNavigate('assessment')}>{t('checkIn.useStandardAssessment')}</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // This week's check-in is already saved (she came here via the nav rather
  // than the "due" banner) — a calm completed state instead of the form. The
  // gestationalWeek guard distinguishes "done this week" from the
  // no-pregnancy context, which loadError above already handles.
  if (questionSet && dueInfo?.due === false && dueInfo.gestationalWeek != null && !redoAnyway) {
    const completedWeek = dueInfo.gestationalWeek ?? questionSet.gestationalWeek
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <p className="eyebrow">{t('checkIn.eyebrow')}</p>
          <h1 className="page-title">{t('checkIn.pageTitle', { week: completedWeek })}</h1>
        </div>
        <div className="content-panel">
          <h2 className="font-semibold text-[var(--text-primary)]">{t('checkIn.completedTitle')}</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('checkIn.completedBody', { week: completedWeek })}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="button-primary" onClick={() => onNavigate('dashboard')}>{t('assessment.backToDashboard')}</button>
            <button className="button-secondary" onClick={() => setRedoAnyway(true)}>{t('checkIn.completedRedo')}</button>
          </div>
        </div>
      </div>
    )
  }

  const allAnswered = questionSet.questions.every((question) => answers[question.id])

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!allAnswered || submitting) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const payload = questionSet.questions.map((question) => ({
        questionId: question.id,
        optionId: answers[question.id],
      }))
      const trimmedNote = freeTextNote.trim()
      const data = await submitCheckIn(payload, trimmedNote || null)
      setResult(data)
    } catch (requestError) {
      setSubmitError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="eyebrow">{t('checkIn.eyebrow')}</p>
        <h1 className="page-title">{t('checkIn.pageTitle', { week: questionSet.gestationalWeek })}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('checkIn.pageIntro')}</p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {questionSet.milestones.map((milestone) => (
          <p className="tinted-card text-sm text-[var(--text-secondary)]" key={milestone}>
            {t(`checkIn.milestone.${milestone}`)}
          </p>
        ))}

        {questionSet.questions.map((question) => (
          <div className="content-panel" key={question.id}>
            <p className="font-semibold text-[var(--text-primary)]">{t(`checkIn.questions.${question.id}.text`)}</p>
            <div className="mt-3 grid gap-2">
              {question.options.map((option) => {
                const selected = answers[question.id] === option.id
                return (
                  <button
                    type="button"
                    key={option.id}
                    className={`checkin-option ${selected ? 'checkin-option-selected' : ''}`}
                    onClick={() => setAnswers((prev) => ({ ...prev, [question.id]: option.id }))}
                    aria-pressed={selected}
                    disabled={submitting}
                  >
                    {t(`checkIn.questions.${question.id}.options.${option.id}`)}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <div className="content-panel">
          <label className="form-label">{t('checkIn.freeTextLabel')}
            <textarea
              className="form-input"
              rows="3"
              maxLength={2000}
              value={freeTextNote}
              onChange={(event) => setFreeTextNote(event.target.value)}
              disabled={submitting}
            />
          </label>
          <p className="mt-1 text-xs text-[var(--text-muted)]">{t('checkIn.freeTextHint')}</p>
        </div>

        {submitError && <StatusMessage>{submitError}</StatusMessage>}
        {!allAnswered && !submitting && (
          <p className="text-xs text-[var(--text-muted)]">{t('checkIn.incompleteHint')}</p>
        )}
        <button className="button-primary" disabled={!allAnswered || submitting}>
          {submitting ? t('checkIn.submitting') : t('checkIn.submit')}
        </button>
      </form>
    </div>
  )
}

export default WeeklyCheckInPage
