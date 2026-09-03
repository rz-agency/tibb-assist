const test = require('node:test')
const assert = require('node:assert/strict')
const { calculateRiskAssessment } = require('./riskAssessment')

// Helper: build a single-symptom array.
const s = (code, answerStatus, severity) => ({
  code,
  answerStatus,
  ...(severity ? { severity } : {}),
})

// ─── Heavy bleeding ──────────────────────────────────────────────

test('heavy_bleeding ABSENT → GREEN', () => {
  const r = calculateRiskAssessment([s('heavy_bleeding', 'ABSENT')])
  assert.equal(r.riskLevel, 'GREEN')
  assert.equal(r.isEmergency, false)
})

test('heavy_bleeding UNKNOWN → YELLOW', () => {
  const r = calculateRiskAssessment([s('heavy_bleeding', 'UNKNOWN')])
  assert.equal(r.riskLevel, 'YELLOW')
  assert.equal(r.isEmergency, false)
})

test('heavy_bleeding PRESENT (no severity) → RED, not emergency', () => {
  const r = calculateRiskAssessment([s('heavy_bleeding', 'PRESENT')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, false)
})

test('heavy_bleeding PRESENT MODERATE → RED, not emergency', () => {
  const r = calculateRiskAssessment([s('heavy_bleeding', 'PRESENT', 'MODERATE')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, false)
})

test('heavy_bleeding PRESENT SEVERE → RED + emergency', () => {
  const r = calculateRiskAssessment([s('heavy_bleeding', 'PRESENT', 'SEVERE')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, true)
})

// ─── Severe headache ────────────────────────────────────────────

test('severe_headache ABSENT → GREEN', () => {
  const r = calculateRiskAssessment([s('severe_headache', 'ABSENT')])
  assert.equal(r.riskLevel, 'GREEN')
  assert.equal(r.isEmergency, false)
})

test('severe_headache UNKNOWN → YELLOW', () => {
  const r = calculateRiskAssessment([s('severe_headache', 'UNKNOWN')])
  assert.equal(r.riskLevel, 'YELLOW')
})

test('severe_headache PRESENT MILD → YELLOW', () => {
  const r = calculateRiskAssessment([s('severe_headache', 'PRESENT', 'MILD')])
  assert.equal(r.riskLevel, 'YELLOW')
  assert.equal(r.isEmergency, false)
})

test('severe_headache PRESENT MODERATE → RED, not emergency', () => {
  const r = calculateRiskAssessment([s('severe_headache', 'PRESENT', 'MODERATE')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, false)
})

test('severe_headache PRESENT SEVERE → RED + emergency', () => {
  const r = calculateRiskAssessment([s('severe_headache', 'PRESENT', 'SEVERE')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, true)
})

test('severe_headache PRESENT (no severity) → YELLOW, not emergency', () => {
  const r = calculateRiskAssessment([s('severe_headache', 'PRESENT')])
  assert.equal(r.riskLevel, 'YELLOW')
  assert.equal(r.isEmergency, false)
})

// ─── Abdominal pain ──────────────────────────────────────────────

test('abdominal_pain ABSENT → GREEN', () => {
  const r = calculateRiskAssessment([s('abdominal_pain', 'ABSENT')])
  assert.equal(r.riskLevel, 'GREEN')
})

test('abdominal_pain UNKNOWN → YELLOW', () => {
  const r = calculateRiskAssessment([s('abdominal_pain', 'UNKNOWN')])
  assert.equal(r.riskLevel, 'YELLOW')
})

test('abdominal_pain PRESENT MILD → YELLOW', () => {
  const r = calculateRiskAssessment([s('abdominal_pain', 'PRESENT', 'MILD')])
  assert.equal(r.riskLevel, 'YELLOW')
  assert.equal(r.isEmergency, false)
})

test('abdominal_pain PRESENT MODERATE → RED, not emergency', () => {
  const r = calculateRiskAssessment([s('abdominal_pain', 'PRESENT', 'MODERATE')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, false)
})

test('abdominal_pain PRESENT SEVERE → RED + emergency', () => {
  const r = calculateRiskAssessment([s('abdominal_pain', 'PRESENT', 'SEVERE')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, true)
})

test('abdominal_pain PRESENT (no severity) → YELLOW, not emergency', () => {
  const r = calculateRiskAssessment([s('abdominal_pain', 'PRESENT')])
  assert.equal(r.riskLevel, 'YELLOW')
  assert.equal(r.isEmergency, false)
})

// ─── Fever ───────────────────────────────────────────────────────

test('fever ABSENT → GREEN', () => {
  const r = calculateRiskAssessment([s('fever', 'ABSENT')])
  assert.equal(r.riskLevel, 'GREEN')
})

test('fever UNKNOWN → YELLOW', () => {
  const r = calculateRiskAssessment([s('fever', 'UNKNOWN')])
  assert.equal(r.riskLevel, 'YELLOW')
})

test('fever PRESENT MILD → YELLOW', () => {
  const r = calculateRiskAssessment([s('fever', 'PRESENT', 'MILD')])
  assert.equal(r.riskLevel, 'YELLOW')
  assert.equal(r.isEmergency, false)
})

test('fever PRESENT MODERATE → RED, not emergency', () => {
  const r = calculateRiskAssessment([s('fever', 'PRESENT', 'MODERATE')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, false)
})

test('fever PRESENT SEVERE → RED + emergency', () => {
  const r = calculateRiskAssessment([s('fever', 'PRESENT', 'SEVERE')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, true)
})

test('fever PRESENT (no severity) → YELLOW, not emergency', () => {
  const r = calculateRiskAssessment([s('fever', 'PRESENT')])
  assert.equal(r.riskLevel, 'YELLOW')
  assert.equal(r.isEmergency, false)
})

// ─── Blurred vision (always-RED, always-emergency) ──────────────

test('blurred_vision ABSENT → GREEN', () => {
  const r = calculateRiskAssessment([s('blurred_vision', 'ABSENT')])
  assert.equal(r.riskLevel, 'GREEN')
})

test('blurred_vision UNKNOWN → YELLOW', () => {
  const r = calculateRiskAssessment([s('blurred_vision', 'UNKNOWN')])
  assert.equal(r.riskLevel, 'YELLOW')
})

test('blurred_vision PRESENT MILD → RED + emergency', () => {
  const r = calculateRiskAssessment([s('blurred_vision', 'PRESENT', 'MILD')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, true)
})

test('blurred_vision PRESENT SEVERE → RED + emergency', () => {
  const r = calculateRiskAssessment([s('blurred_vision', 'PRESENT', 'SEVERE')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, true)
})

// ─── Reduced fetal movement (always-RED, always-emergency) ──────

test('reduced_fetal_movement ABSENT → GREEN', () => {
  const r = calculateRiskAssessment([s('reduced_fetal_movement', 'ABSENT')])
  assert.equal(r.riskLevel, 'GREEN')
})

test('reduced_fetal_movement UNKNOWN → YELLOW', () => {
  const r = calculateRiskAssessment([s('reduced_fetal_movement', 'UNKNOWN')])
  assert.equal(r.riskLevel, 'YELLOW')
})

test('reduced_fetal_movement PRESENT any → RED + emergency', () => {
  const r = calculateRiskAssessment([s('reduced_fetal_movement', 'PRESENT', 'MODERATE')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, true)
})

// ─── Convulsions (always-RED, always-emergency) ─────────────────

test('convulsions ABSENT → GREEN', () => {
  const r = calculateRiskAssessment([s('convulsions', 'ABSENT')])
  assert.equal(r.riskLevel, 'GREEN')
})

test('convulsions UNKNOWN → YELLOW', () => {
  const r = calculateRiskAssessment([s('convulsions', 'UNKNOWN')])
  assert.equal(r.riskLevel, 'YELLOW')
})

test('convulsions PRESENT any → RED + emergency', () => {
  const r = calculateRiskAssessment([s('convulsions', 'PRESENT', 'MILD')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, true)
})

// ─── Breathing difficulty ────────────────────────────────────────

test('breathing_difficulty ABSENT → GREEN', () => {
  const r = calculateRiskAssessment([s('breathing_difficulty', 'ABSENT')])
  assert.equal(r.riskLevel, 'GREEN')
})

test('breathing_difficulty UNKNOWN → YELLOW', () => {
  const r = calculateRiskAssessment([s('breathing_difficulty', 'UNKNOWN')])
  assert.equal(r.riskLevel, 'YELLOW')
})

test('breathing_difficulty PRESENT MILD → YELLOW', () => {
  const r = calculateRiskAssessment([s('breathing_difficulty', 'PRESENT', 'MILD')])
  assert.equal(r.riskLevel, 'YELLOW')
  assert.equal(r.isEmergency, false)
})

test('breathing_difficulty PRESENT MODERATE → RED, not emergency', () => {
  const r = calculateRiskAssessment([s('breathing_difficulty', 'PRESENT', 'MODERATE')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, false)
})

test('breathing_difficulty PRESENT SEVERE → RED + emergency', () => {
  const r = calculateRiskAssessment([s('breathing_difficulty', 'PRESENT', 'SEVERE')])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, true)
})

test('breathing_difficulty PRESENT (no severity) → YELLOW, not emergency', () => {
  const r = calculateRiskAssessment([s('breathing_difficulty', 'PRESENT')])
  assert.equal(r.riskLevel, 'YELLOW')
  assert.equal(r.isEmergency, false)
})

// ─── Unknown / unlisted symptoms ────────────────────────────────

test('unlisted symptom code → GREEN (no effect)', () => {
  const r = calculateRiskAssessment([s('nausea_vomiting', 'PRESENT', 'SEVERE')])
  assert.equal(r.riskLevel, 'GREEN')
  assert.equal(r.isEmergency, false)
})

test('empty symptom list → GREEN', () => {
  const r = calculateRiskAssessment([])
  assert.equal(r.riskLevel, 'GREEN')
  assert.equal(r.isEmergency, false)
  assert.equal(r.resultCode, 'ALL_CLEAR')
})

// ─── Aggregation: highest individual risk wins ──────────────────

test('RED beats YELLOW', () => {
  const r = calculateRiskAssessment([
    s('severe_headache', 'PRESENT', 'MILD'), // YELLOW
    s('fever', 'PRESENT', 'MODERATE'),       // RED
  ])
  assert.equal(r.riskLevel, 'RED')
})

test('RED beats GREEN', () => {
  const r = calculateRiskAssessment([
    s('heavy_bleeding', 'ABSENT'),           // GREEN
    s('abdominal_pain', 'PRESENT', 'MODERATE'), // RED
  ])
  assert.equal(r.riskLevel, 'RED')
})

test('YELLOW beats GREEN', () => {
  const r = calculateRiskAssessment([
    s('heavy_bleeding', 'ABSENT'),       // GREEN
    s('fever', 'UNKNOWN'),               // YELLOW
  ])
  assert.equal(r.riskLevel, 'YELLOW')
})

test('emergency flag propagates across multiple symptoms', () => {
  const r = calculateRiskAssessment([
    s('fever', 'PRESENT', 'MODERATE'),      // RED, not emergency
    s('blurred_vision', 'PRESENT', 'MILD'), // RED + emergency
  ])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, true)
})

test('non-emergency RED among multiple symptoms stays non-emergency', () => {
  const r = calculateRiskAssessment([
    s('fever', 'PRESENT', 'MODERATE'),         // RED, not emergency
    s('abdominal_pain', 'PRESENT', 'MODERATE'), // RED, not emergency
  ])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, false)
})

test('YELLOW symptoms do not escalate to RED', () => {
  const r = calculateRiskAssessment([
    s('fever', 'PRESENT', 'MILD'),              // YELLOW
    s('abdominal_pain', 'PRESENT', 'MILD'),      // YELLOW
    s('breathing_difficulty', 'PRESENT', 'MILD'), // YELLOW
  ])
  assert.equal(r.riskLevel, 'YELLOW')
  assert.equal(r.isEmergency, false)
})

// ─── Result codes ────────────────────────────────────────────────

test('GREEN result code is ALL_CLEAR', () => {
  const r = calculateRiskAssessment([
    s('heavy_bleeding', 'ABSENT'),
    s('severe_headache', 'ABSENT'),
  ])
  assert.equal(r.resultCode, 'ALL_CLEAR')
})

test('YELLOW result code is REQUIRES_EVALUATION', () => {
  const r = calculateRiskAssessment([
    s('heavy_bleeding', 'UNKNOWN'),
    s('severe_headache', 'ABSENT'),
  ])
  assert.equal(r.resultCode, 'REQUIRES_EVALUATION')
})

test('RED non-emergency result code is WARNING_SIGN_PRESENT', () => {
  const r = calculateRiskAssessment([
    s('fever', 'PRESENT', 'MODERATE'),
  ])
  assert.equal(r.resultCode, 'WARNING_SIGN_PRESENT')
})

test('RED emergency result code is EMERGENCY_WARNING_SIGN', () => {
  const r = calculateRiskAssessment([
    s('convulsions', 'PRESENT', 'MODERATE'),
  ])
  assert.equal(r.resultCode, 'EMERGENCY_WARNING_SIGN')
})

// ─── Backward-compatible scenarios ──────────────────────────────

test('legacy: heavy_bleeding + severe_headache both ABSENT → GREEN', () => {
  const r = calculateRiskAssessment([
    s('heavy_bleeding', 'ABSENT'),
    s('severe_headache', 'ABSENT'),
  ])
  assert.deepEqual(r, { riskLevel: 'GREEN', resultCode: 'ALL_CLEAR', isEmergency: false })
})

test('legacy: heavy_bleeding PRESENT → RED', () => {
  const r = calculateRiskAssessment([
    s('heavy_bleeding', 'PRESENT'),
    s('severe_headache', 'ABSENT'),
  ])
  assert.equal(r.riskLevel, 'RED')
})

test('legacy: heavy_bleeding UNKNOWN + severe_headache ABSENT → YELLOW', () => {
  const r = calculateRiskAssessment([
    s('heavy_bleeding', 'UNKNOWN'),
    s('severe_headache', 'ABSENT'),
  ])
  assert.equal(r.riskLevel, 'YELLOW')
})

test('legacy: PRESENT takes precedence over UNKNOWN', () => {
  const r = calculateRiskAssessment([
    s('heavy_bleeding', 'PRESENT'),
    s('severe_headache', 'UNKNOWN'),
  ])
  assert.equal(r.riskLevel, 'RED')
})

// ─── Realistic multi-symptom scenario ───────────────────────────

test('realistic: headache MODERATE + abdominal pain SEVERE + fever MILD → RED + emergency', () => {
  const r = calculateRiskAssessment([
    s('severe_headache', 'PRESENT', 'MODERATE'), // RED, not emergency
    s('abdominal_pain', 'PRESENT', 'SEVERE'),    // RED + emergency
    s('fever', 'PRESENT', 'MILD'),               // YELLOW
  ])
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.isEmergency, true)
  assert.equal(r.resultCode, 'EMERGENCY_WARNING_SIGN')
})

test('realistic: all 8 symptoms ABSENT → GREEN', () => {
  const r = calculateRiskAssessment([
    s('heavy_bleeding', 'ABSENT'),
    s('severe_headache', 'ABSENT'),
    s('abdominal_pain', 'ABSENT'),
    s('fever', 'ABSENT'),
    s('blurred_vision', 'ABSENT'),
    s('reduced_fetal_movement', 'ABSENT'),
    s('convulsions', 'ABSENT'),
    s('breathing_difficulty', 'ABSENT'),
  ])
  assert.deepEqual(r, { riskLevel: 'GREEN', resultCode: 'ALL_CLEAR', isEmergency: false })
})

// ─── Gestational-age escalation ───────────────────────────────

test('preterm 36w + contractions PRESENT → RED PRETERM_LABOR_RISK', () => {
  const r = calculateRiskAssessment(
    [s('contractions', 'PRESENT')],
    36,
  )
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.resultCode, 'PRETERM_LABOR_RISK')
  assert.equal(r.isEmergency, true)
})

test('exactly 37w + contractions PRESENT → does NOT trigger preterm_labor_risk', () => {
  const r = calculateRiskAssessment(
    [s('contractions', 'PRESENT')],
    37,
  )
  // contractions is not in the existing RULES table so base risk is GREEN.
  assert.notEqual(r.resultCode, 'PRETERM_LABOR_RISK')
  assert.equal(r.riskLevel, 'GREEN')
})

test('preterm 36w + fluid_leak PRESENT → RED PRETERM_LABOR_RISK', () => {
  const r = calculateRiskAssessment(
    [s('fluid_leak', 'PRESENT')],
    36,
  )
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.resultCode, 'PRETERM_LABOR_RISK')
  assert.equal(r.isEmergency, true)
})

test('preterm 36w + severe_abdominal_pain PRESENT → RED PRETERM_LABOR_RISK', () => {
  const r = calculateRiskAssessment(
    [s('severe_abdominal_pain', 'PRESENT')],
    36,
  )
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.resultCode, 'PRETERM_LABOR_RISK')
})

test('preterm 36w + contractions ABSENT → does NOT trigger preterm_labor_risk', () => {
  const r = calculateRiskAssessment(
    [s('contractions', 'ABSENT')],
    36,
  )
  assert.notEqual(r.resultCode, 'PRETERM_LABOR_RISK')
  assert.equal(r.riskLevel, 'GREEN')
})

test('postterm 43w + all clear → YELLOW POSTTERM_PREGNANCY', () => {
  const r = calculateRiskAssessment(
    [s('heavy_bleeding', 'ABSENT'), s('fever', 'ABSENT')],
    43,
  )
  assert.equal(r.riskLevel, 'YELLOW')
  assert.equal(r.resultCode, 'POSTTERM_PREGNANCY')
})

test('postterm 42w (boundary) → does NOT trigger postterm_pregnancy', () => {
  const r = calculateRiskAssessment(
    [s('heavy_bleeding', 'ABSENT')],
    42,
  )
  assert.notEqual(r.resultCode, 'POSTTERM_PREGNANCY')
  assert.equal(r.riskLevel, 'GREEN')
})

test('postterm 43w + existing RED symptom → stays RED, not downgraded to YELLOW', () => {
  const r = calculateRiskAssessment(
    [s('heavy_bleeding', 'PRESENT', 'SEVERE')],
    43,
  )
  assert.equal(r.riskLevel, 'RED')
  assert.equal(r.resultCode, 'EMERGENCY_WARNING_SIGN')
})

test('gestationalWeeks null → no escalation, backward-compatible', () => {
  const r = calculateRiskAssessment(
    [s('contractions', 'PRESENT')],
    null,
  )
  assert.notEqual(r.resultCode, 'PRETERM_LABOR_RISK')
  assert.equal(r.riskLevel, 'GREEN') // contractions not in RULES table
})

test('no gestationalWeeks argument → backward-compatible (defaults to null)', () => {
  // Calling without the second arg should behave exactly like before.
  const r = calculateRiskAssessment([s('heavy_bleeding', 'ABSENT')])
  assert.deepEqual(r, { riskLevel: 'GREEN', resultCode: 'ALL_CLEAR', isEmergency: false })
})
