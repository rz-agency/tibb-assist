import { useEffect, useState } from 'react'
import { getAssessment, getAssessments } from '../api/api'
import StatusMessage from '../components/StatusMessage'

function formatDate(value) {
  return new Date(value).toLocaleString()
}

function AssessmentHistory({ onNavigate }) {
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
    return <div><button className="link-button mb-5" onClick={() => setSelected(null)}>← Back to history</button>{detailLoading && <p className="text-slate-600">Loading assessment details...</p>}{error && <StatusMessage>{error}</StatusMessage>}<section className="content-panel"><p className="eyebrow">Assessment detail</p><h1 className="section-title">{formatDate(selected.assessmentDate)}</h1><div className="mt-5 grid gap-3 text-sm sm:grid-cols-3"><div><span className="detail-label">Risk level</span><span className={`risk-${selected.riskLevel.toLowerCase()}`}>{selected.riskLevel}</span></div><div><span className="detail-label">Input method</span><span>{selected.inputMethod}</span></div><div><span className="detail-label">Patient</span><span>{selected.patient.fullName}</span></div></div>{selected.pregnancy && <p className="mt-5 text-sm text-slate-600">Pregnancy: {selected.pregnancy.pregnancyStatus}{selected.pregnancy.gestationalWeek !== null ? ` · ${selected.pregnancy.gestationalWeek} weeks` : ''}</p>}<div className="mt-6"><h2 className="font-semibold text-slate-900">Recorded symptoms</h2><ul className="mt-3 space-y-2">{selected.assessmentSymptoms.map((item) => <li className="rounded-lg bg-slate-50 px-4 py-3" key={item.id}><span className="font-medium">{item.symptom.name}</span><span className="ml-2 text-sm text-slate-500">{item.answerStatus}{item.severity ? ` · ${item.severity}` : ''}</span>{item.notes && <p className="mt-2 text-sm text-slate-600">Notes: {item.notes}</p>}</li>)}</ul></div></section></div>
  }

  return <div><div className="mb-8"><p className="eyebrow">Your records</p><h1 className="page-title">Assessment history</h1><p className="mt-3 text-slate-600">Review previously saved symptom assessments.</p></div>{error && <StatusMessage>{error}</StatusMessage>}{loading && <p className="text-slate-600">Loading history...</p>}{detailLoading && <p className="text-slate-600">Loading assessment details...</p>}{!loading && !error && assessments.length === 0 && <section className="content-panel"><p className="text-slate-600">No assessments have been saved yet.</p><button className="button-primary mt-5" onClick={() => onNavigate('assessment')}>Start an assessment</button></section>}{!loading && assessments.length > 0 && <div className="space-y-3">{assessments.map((assessment) => <button className="history-item" key={assessment.id} onClick={() => openAssessment(assessment.id)}><span><strong>{formatDate(assessment.assessmentDate)}</strong><small>{assessment.assessmentSymptoms.length} symptom records · {assessment.inputMethod}{assessment.pregnancy ? ` · ${assessment.pregnancy.pregnancyStatus} pregnancy` : ''}</small></span><span className={`risk-${assessment.riskLevel.toLowerCase()}`}>{assessment.riskLevel}</span></button>)}</div>}</div>
}

export default AssessmentHistory
