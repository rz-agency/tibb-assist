const test = require('node:test')
const assert = require('node:assert/strict')
const { calculateRiskAssessment } = require('./riskAssessment')

const absentAnswers = [
  { code: 'heavy_bleeding', category: 'warning_sign', answerStatus: 'ABSENT' },
  { code: 'severe_headache', category: 'warning_sign', answerStatus: 'ABSENT' },
]

test('all required symptoms absent returns GREEN', () => {
  assert.deepEqual(calculateRiskAssessment(absentAnswers), {
    riskLevel: 'GREEN',
    resultCode: 'ALL_REQUIRED_SYMPTOMS_ABSENT',
  })
})

test('heavy bleeding present returns RED', () => {
  assert.equal(calculateRiskAssessment([
    { ...absentAnswers[0], answerStatus: 'PRESENT' },
    absentAnswers[1],
  ]).riskLevel, 'RED')
})

test('severe headache present returns RED', () => {
  assert.equal(calculateRiskAssessment([
    absentAnswers[0],
    { ...absentAnswers[1], answerStatus: 'PRESENT' },
  ]).riskLevel, 'RED')
})

test('both symptoms present returns RED', () => {
  assert.equal(calculateRiskAssessment(absentAnswers.map((symptom) => ({
    ...symptom,
    answerStatus: 'PRESENT',
  }))).riskLevel, 'RED')
})

test('unknown without a present symptom returns YELLOW', () => {
  assert.equal(calculateRiskAssessment([
    { ...absentAnswers[0], answerStatus: 'UNKNOWN' },
    absentAnswers[1],
  ]).riskLevel, 'YELLOW')
})

test('present takes precedence over unknown', () => {
  assert.equal(calculateRiskAssessment([
    { ...absentAnswers[0], answerStatus: 'PRESENT' },
    { ...absentAnswers[1], answerStatus: 'UNKNOWN' },
  ]).riskLevel, 'RED')
})