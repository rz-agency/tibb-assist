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

export const getLhwProfile = (userId) => apiRequest(`/lhws/${userId}/profile`)

export const getFacilities = () => apiRequest('/facilities')

export const getPregnancies = () => apiRequest('/pregnancies')

export const createPregnancy = (details) => apiRequest('/pregnancies', {
  method: 'POST',
  body: JSON.stringify(details),
})

export const updatePregnancy = (id, details) => apiRequest(`/pregnancies/${id}`, {
  method: 'PUT',
  body: JSON.stringify(details),
})

export const getReferrals = () => apiRequest('/referrals')

export const createReferral = (details) => apiRequest('/referrals', {
  method: 'POST',
  body: JSON.stringify(details),
})
