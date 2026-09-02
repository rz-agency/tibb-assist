const apiRequest = async (path, options = {}) => {
  const response = await fetch(`/api${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error || 'The request could not be completed.')
  }

  return data
}

export const registerUser = (details) => apiRequest('/auth/register', {
  method: 'POST',
  body: JSON.stringify(details),
})

export const loginUser = (details) => apiRequest('/auth/login', {
  method: 'POST',
  body: JSON.stringify(details),
})

export const logoutUser = () => apiRequest('/auth/logout', { method: 'POST' })

export const getCurrentUser = () => apiRequest('/auth/me')

export const getSymptoms = () => apiRequest('/symptoms')

export const getAssessments = () => apiRequest('/assessments')

export const createAssessment = (details) => apiRequest('/assessments', {
  method: 'POST',
  body: JSON.stringify(details),
})

export const getAssessment = (id) => apiRequest(`/assessments/${id}`)

export const getPatientProfile = (userId) => apiRequest(`/patients/${userId}/profile`)

export const updatePatientProfile = (userId, details) => apiRequest(`/patients/${userId}/profile`, {
  method: 'PUT',
  body: JSON.stringify(details),
})

export const getLhwProfile = (userId) => apiRequest(`/lhws/${userId}/profile`)

export const updateLhwProfile = (userId, details) => apiRequest(`/lhws/${userId}/profile`, {
  method: 'PUT',
  body: JSON.stringify(details),
})

export const getUnassignedPatients = () => apiRequest('/patients/unassigned')

export const assignPatientToLhw = (patientId, lhwId) =>
  apiRequest(`/patients/${patientId}/assign-lhw`, {
    method: 'PATCH',
    body: JSON.stringify({ lhwId }),
  })

export const getFacilities = () => apiRequest('/facilities')

export const getNearbyFacilities = (lat, lng, radius = 5000) =>
  apiRequest(`/facilities/nearby?lat=${lat}&lng=${lng}&radius=${radius}`).then(
    (response) => response.facilities,
  )

export const getPregnancies = () => apiRequest('/pregnancies')

export const createPregnancy = (details) => apiRequest('/pregnancies', {
  method: 'POST',
  body: JSON.stringify(details),
})

export const updatePregnancy = (id, details) => apiRequest(`/pregnancies/${id}`, {
  method: 'PUT',
  body: JSON.stringify(details),
})

export const getReferrals = (includeCompleted = false) =>
  apiRequest(`/referrals${includeCompleted ? '?includeCompleted=true' : ''}`)

export const getReferral = (id) => apiRequest(`/referrals/${id}`)

export const createReferral = (details) => apiRequest('/referrals', {
  method: 'POST',
  body: JSON.stringify(details),
})

export const updateReferralStatus = (id, status, note) =>
  apiRequest(`/referrals/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(note ? { status, note } : { status }),
  })

export const getEmergencyContacts = (patientId) => apiRequest(`/patients/${patientId}/emergency-contacts`)

export const createEmergencyContact = (patientId, details) => apiRequest(`/patients/${patientId}/emergency-contacts`, {
  method: 'POST',
  body: JSON.stringify(details),
})

export const updateEmergencyContact = (id, details) => apiRequest(`/emergency-contacts/${id}`, {
  method: 'PUT',
  body: JSON.stringify(details),
})

export const deleteEmergencyContact = (id) => apiRequest(`/emergency-contacts/${id}`, {
  method: 'DELETE',
})

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export const sendAiMessage = async (message, conversationHistory = [], audioBlob = null) => {
  const body = { message, conversationHistory }
  if (audioBlob) {
    body.audio = await blobToBase64(audioBlob)
  }
  return apiRequest('/ai-assistant/message', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export const confirmAiAssessment = (extractedSymptoms) => apiRequest('/ai-assistant/confirm', {
  method: 'POST',
  body: JSON.stringify({ extractedSymptoms }),
})

export const getCareMissions = (includeCompleted = false) =>
  apiRequest(`/care-missions${includeCompleted ? '?includeCompleted=true' : ''}`)

export const getCareMission = (id) => apiRequest(`/care-missions/${id}`)

export const updateChecklistItem = (missionId, itemId, isCompleted) =>
  apiRequest(`/care-missions/${missionId}/checklist-items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isCompleted }),
  })
