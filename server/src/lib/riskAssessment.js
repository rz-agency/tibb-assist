// Risk level priority: higher index wins when aggregating.
const RISK_PRIORITY = { GREEN: 0, YELLOW: 1, RED: 2 }

/**
 * Per-symptom risk matrix. Each rule maps (answerStatus, severity) → riskLevel.
 *
 * Rules:
 *   - Heavy bleeding:      ABSENT=GREEN, UNKNOWN=YELLOW, PRESENT=RED; SEVERE → emergency
 *   - Severe headache:     ABSENT=GREEN, UNKNOWN=YELLOW, MILD=YELLOW, MODERATE=RED, SEVERE=RED+emergency
 *   - Abdominal pain:      ABSENT=GREEN, UNKNOWN/MILD=YELLOW, MODERATE=RED, SEVERE=RED+emergency
 *   - Fever:               ABSENT=GREEN, UNKNOWN/MILD=YELLOW, MODERATE=RED, SEVERE=RED+emergency
 *   - Blurred vision:      ABSENT=GREEN, UNKNOWN=YELLOW, PRESENT=RED+emergency
 *   - Reduced fetal movement: ABSENT=GREEN, UNKNOWN=YELLOW, PRESENT=RED+emergency
 *   - Convulsions/fits:    ABSENT=GREEN, UNKNOWN=YELLOW, PRESENT=RED+emergency
 *   - Breathing difficulty: ABSENT=GREEN, UNKNOWN/MILD=YELLOW, MODERATE=RED, SEVERE=RED+emergency
 */
const RULES = {
  heavy_bleeding: {
    ABSENT: 'GREEN',
    UNKNOWN: 'YELLOW',
    PRESENT: 'RED',
    emergencySeverity: ['SEVERE'],
  },
  severe_headache: {
    ABSENT: 'GREEN',
    UNKNOWN: 'YELLOW',
    MILD: 'YELLOW',
    MODERATE: 'RED',
    SEVERE: 'RED',
    emergencySeverity: ['SEVERE'],
  },
  abdominal_pain: {
    ABSENT: 'GREEN',
    UNKNOWN: 'YELLOW',
    MILD: 'YELLOW',
    MODERATE: 'RED',
    SEVERE: 'RED',
    emergencySeverity: ['SEVERE'],
  },
  fever: {
    ABSENT: 'GREEN',
    UNKNOWN: 'YELLOW',
    MILD: 'YELLOW',
    MODERATE: 'RED',
    SEVERE: 'RED',
    emergencySeverity: ['SEVERE'],
  },
  blurred_vision: {
    ABSENT: 'GREEN',
    UNKNOWN: 'YELLOW',
    PRESENT: 'RED',
    emergencySeverity: ['MILD', 'MODERATE', 'SEVERE'],
  },
  reduced_fetal_movement: {
    ABSENT: 'GREEN',
    UNKNOWN: 'YELLOW',
    PRESENT: 'RED',
    emergencySeverity: ['MILD', 'MODERATE', 'SEVERE'],
  },
  convulsions: {
    ABSENT: 'GREEN',
    UNKNOWN: 'YELLOW',
    PRESENT: 'RED',
    emergencySeverity: ['MILD', 'MODERATE', 'SEVERE'],
  },
  breathing_difficulty: {
    ABSENT: 'GREEN',
    UNKNOWN: 'YELLOW',
    MILD: 'YELLOW',
    MODERATE: 'RED',
    SEVERE: 'RED',
    emergencySeverity: ['SEVERE'],
  },
}

function evaluateSymptom(code, answerStatus, severity) {
  const rule = RULES[code]
  if (!rule) {
    // Symptom not in the risk matrix — no effect on triage.
    return { riskLevel: 'GREEN', isEmergency: false }
  }

  let riskLevel
  if (answerStatus === 'ABSENT') {
    riskLevel = 'GREEN'
  } else if (answerStatus === 'UNKNOWN') {
    riskLevel = rule.UNKNOWN || 'GREEN'
  } else if (answerStatus === 'PRESENT') {
    // Severity-sensitive rules look up MILD/MODERATE/SEVERE;
    // always-RED rules (blurred vision, etc.) use the PRESENT key.
    riskLevel = (severity && rule[severity]) || rule.PRESENT || 'RED'
  } else {
    riskLevel = 'GREEN'
  }

  const isEmergency = answerStatus === 'PRESENT'
    && severity
    && Array.isArray(rule.emergencySeverity)
    && rule.emergencySeverity.includes(severity)

  return { riskLevel, isEmergency }
}

function calculateRiskAssessment(symptomAnswers) {
  let highestRisk = 'GREEN'
  let isEmergency = false
  let resultCode = 'ALL_CLEAR'

  for (const symptom of symptomAnswers) {
    const { riskLevel, isEmergency: symptomEmergency } = evaluateSymptom(
      symptom.code,
      symptom.answerStatus,
      symptom.severity || null,
    )

    if (RISK_PRIORITY[riskLevel] > RISK_PRIORITY[highestRisk]) {
      highestRisk = riskLevel
    }
    if (symptomEmergency) {
      isEmergency = true
    }
  }

  // Assign a result code describing WHY the final level was chosen.
  if (highestRisk === 'RED') {
    resultCode = isEmergency ? 'EMERGENCY_WARNING_SIGN' : 'WARNING_SIGN_PRESENT'
  } else if (highestRisk === 'YELLOW') {
    resultCode = 'REQUIRES_EVALUATION'
  } else {
    resultCode = 'ALL_CLEAR'
  }

  return { riskLevel: highestRisk, resultCode, isEmergency }
}

module.exports = {
  calculateRiskAssessment,
}
