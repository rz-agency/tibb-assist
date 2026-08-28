const requiredWarningSignCodes = ['heavy_bleeding', 'severe_headache']

function calculateRiskAssessment(symptomAnswers) {
  const answersByCode = new Map(symptomAnswers.map((symptom) => [symptom.code, symptom.answerStatus]))
  const hasPresentWarningSign = symptomAnswers.some((symptom) => (
    symptom.category === 'warning_sign' && symptom.answerStatus === 'PRESENT'
  ))

  if (hasPresentWarningSign) {
    return { riskLevel: 'RED', resultCode: 'WARNING_SIGN_PRESENT' }
  }

  const hasUnknownRequiredSymptom = requiredWarningSignCodes.some((code) => (
    answersByCode.get(code) !== 'ABSENT'
  ))

  if (hasUnknownRequiredSymptom) {
    return { riskLevel: 'YELLOW', resultCode: 'REQUIRED_SYMPTOM_UNKNOWN' }
  }

  return { riskLevel: 'GREEN', resultCode: 'ALL_REQUIRED_SYMPTOMS_ABSENT' }
}

module.exports = {
  calculateRiskAssessment,
}