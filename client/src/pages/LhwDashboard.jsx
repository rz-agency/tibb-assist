import { useEffect, useState } from 'react'
import { getAssessment, getAssessments, getLhwProfile } from '../api/api'
import StatusMessage from '../components/StatusMessage'

function formatDate(value) {
  return new Date(value).toLocaleString()
}

function LhwDashboard({ user }) {
  const [profile, setProfile] = useState(null)
  const [assessments, setAssessments] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [selectedAssessment, setSelectedAssessment] = useState(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [lhwProfile, assessmentResult] = await Promise.all([
          getLhwProfile(user.id),
          getAssessments(),
        ])
        setProfile(lhwProfile)
        setAssessments(assessmentResult.assessments)
      } catch (requestError) {
        setError(requestError.message)
      } finally {
        setLoading(false)
      }
    }

    loadDashboard()
  }, [user.id])

  const openAssessment = async (id) => {
    try {
      setError('')
      setDetailLoading(true)
      setSelectedAssessment((await getAssessment(id)).assessment)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDetailLoading(false)
    }
  }

  if (loading) return <p className="text-slate-600">Loading assigned women...</p>
  if (error && !profile) return <StatusMessage>{error}</StatusMessage>

  if (selectedAssessment) {
    return <div>
      <button className="link-button mb-5" onClick={() => setSelectedAssessment(null)}>← Back to assigned women</button>
      {error && <StatusMessage>{error}</StatusMessage>}
      {detailLoading && <p className="text-slate-600">Loading assessment details...</p>}
      <section className="content-panel">
        <p className="eyebrow">Assessment detail</p>
        <h1 className="section-title">{formatDate(selectedAssessment.assessmentDate)}</h1>
        <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
          <div><span className="detail-label">Risk level</span><span className={`risk-${selectedAssessment.riskLevel.toLowerCase()}`}>{selectedAssessment.riskLevel}</span></div>
          <div><span className="detail-label">Input method</span><span>{selectedAssessment.inputMethod}</span></div>
          <div><span className="detail-label">Woman</span><span>{selectedAssessment.patient.fullName}</span></div>
        </div>
        {selectedAssessment.pregnancy && <p className="mt-5 text-sm text-slate-600">Pregnancy: {selectedAssessment.pregnancy.pregnancyStatus}{selectedAssessment.pregnancy.gestationalWeek !== null ? ` · ${selectedAssessment.pregnancy.gestationalWeek} weeks` : ''}</p>}
        <div className="mt-6"><h2 className="font-semibold text-slate-900">Recorded symptoms</h2><ul className="mt-3 space-y-2">{selectedAssessment.assessmentSymptoms.map((item) => <li className="rounded-lg bg-slate-50 px-4 py-3" key={item.id}><span className="font-medium">{item.symptom.name}</span><span className="ml-2 text-sm text-slate-500">{item.answerStatus}{item.severity ? ` · ${item.severity}` : ''}</span>{item.notes && <p className="mt-2 text-sm text-slate-600">Notes: {item.notes}</p>}</li>)}</ul></div>
      </section>
    </div>
  }

  const selectedAssessments = selectedPatient
    ? assessments.filter((assessment) => assessment.patientId === selectedPatient.id)
    : []

  return <div>
    <div className="mb-8"><p className="eyebrow">LHW workspace</p><h1 className="page-title">Assigned women</h1><p className="mt-3 text-slate-600">{profile.fullName} · {user.email}</p></div>
    {error && <StatusMessage>{error}</StatusMessage>}
    {profile.assignedPatients.length === 0 && <section className="content-panel"><p className="text-slate-600">No women are assigned to you yet.</p></section>}
    {profile.assignedPatients.length > 0 && <div className="grid gap-6 lg:grid-cols-[minmax(0,280px)_1fr]">
      <section><h2 className="mb-3 font-semibold text-slate-900">Assigned women</h2><div className="space-y-3">{profile.assignedPatients.map((patient) => <button className="history-item" key={patient.id} onClick={() => { setSelectedPatient(patient); setError('') }}><span><strong>{patient.fullName}</strong><small>{patient.district || patient.villageOrArea || 'Location not recorded'}</small></span></button>)}</div></section>
      <section>{!selectedPatient && <div className="content-panel"><p className="text-slate-600">Select a woman to view her assessments.</p></div>}{selectedPatient && <div><div className="mb-4"><p className="eyebrow">Selected woman</p><h2 className="section-title">{selectedPatient.fullName}</h2></div>{selectedAssessments.length === 0 && <section className="content-panel"><p className="text-slate-600">No assessments have been saved for this woman.</p></section>}{selectedAssessments.length > 0 && <div className="space-y-3">{selectedAssessments.map((assessment) => <button className="history-item" key={assessment.id} onClick={() => openAssessment(assessment.id)}><span><strong>{formatDate(assessment.assessmentDate)}</strong><small>{assessment.assessmentSymptoms.length} symptom records · {assessment.inputMethod}</small></span><span className={`risk-${assessment.riskLevel.toLowerCase()}`}>{assessment.riskLevel}</span></button>)}</div>}</div>}</section>
    </div>}
  </div>
}

export default LhwDashboard
