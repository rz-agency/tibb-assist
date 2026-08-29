import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getAssessment, getAssessments } from '../api/api'
import StatusMessage from '../components/StatusMessage'

const RISK_LABEL_KEY = { GREEN: 'assessment.riskGreen', YELLOW: 'assessment.riskYellow', RED: 'assessment.riskRed' }

function formatDate(value) {
  return new Date(value).toLocaleString()
}

function AssessmentHistory({ onNavigate }) {
  const { t } = useTranslation()
  const [assessments, setAssessments] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getAssessments().then((result) => setAssessments(result.assessments)).catch((requestError) => setError(requestError.message)).finally(() => setLoading(false))
  }, [])

  const openAssessment = async (id) => {
    try {
      setError('')
      setDetailLoading(true)
      setSelected((await getAssessment(id)).assessment)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDetailLoading(false)
    }
  }

  if (selected) {
    return <div><button className="link-button mb-5" onClick={() => setSelected(null)}>{t('history.backToHistory')}</button>{detailLoading && <p className="text-slate-600">{t('history.loadingDetails')}</p>}{error && <StatusMessage>{error}</StatusMessage>}<section className="content-panel"><p className="eyebrow">{t('history.detailEyebrow')}</p><h1 className="section-title">{formatDate(selected.assessmentDate)}</h1><div className="mt-5 grid gap-3 text-sm sm:grid-cols-3"><div><span className="detail-label">{t('assessment.riskLevel')}</span><span className={`risk-${selected.riskLevel.toLowerCase()}`}>{t(RISK_LABEL_KEY[selected.riskLevel])}</span></div><div><span className="detail-label">{t('history.inputMethod')}</span><span>{selected.inputMethod}</span></div><div><span className="detail-label">{t('history.patient')}</span><span>{selected.patient.fullName}</span></div></div>{selected.pregnancy && <p className="mt-5 text-sm text-slate-600">{t('history.pregnancyPrefix')} {selected.pregnancy.pregnancyStatus}{selected.pregnancy.gestationalWeek !== null ? ` · ${selected.pregnancy.gestationalWeek} ${t('assessment.weeks')}` : ''}</p>}<div className="mt-6"><h2 className="font-semibold text-slate-900">{t('history.recordedSymptoms')}</h2><ul className="mt-3 space-y-2">{selected.assessmentSymptoms.map((item) => <li className="rounded-lg bg-slate-50 px-4 py-3" key={item.id}><span className="font-medium">{item.symptom.name}</span><span className="ml-2 text-sm text-slate-500">{item.answerStatus}{item.severity ? ` · ${item.severity}` : ''}</span>{item.notes && <p className="mt-2 text-sm text-slate-600">{t('history.notesPrefix')} {item.notes}</p>}</li>)}</ul></div></section></div>
  }

  return <div><div className="mb-8"><p className="eyebrow">{t('history.yourRecords')}</p><h1 className="page-title">{t('history.pageTitle')}</h1><p className="mt-3 text-slate-600">{t('history.subtitle')}</p></div>{error && <StatusMessage>{error}</StatusMessage>}{loading && <p className="text-slate-600">{t('history.loadingHistory')}</p>}{detailLoading && <p className="text-slate-600">{t('history.loadingDetails')}</p>}{!loading && !error && assessments.length === 0 && <section className="content-panel"><p className="text-slate-600">{t('history.noAssessments')}</p><button className="button-primary mt-5" onClick={() => onNavigate('assessment')}>{t('history.startAssessment')}</button></section>}{!loading && assessments.length > 0 && <div className="space-y-3">{assessments.map((assessment) => <button className="history-item" key={assessment.id} onClick={() => openAssessment(assessment.id)}><span><strong>{formatDate(assessment.assessmentDate)}</strong><small>{t('history.symptomRecords', { count: assessment.assessmentSymptoms.length })} · {assessment.inputMethod}{assessment.pregnancy ? ` · ${t('history.pregnancySuffix', { status: assessment.pregnancy.pregnancyStatus })}` : ''}</small></span><span className={`risk-${assessment.riskLevel.toLowerCase()}`}>{t(RISK_LABEL_KEY[assessment.riskLevel])}</span></button>)}</div>}</div>
}

export default AssessmentHistory
