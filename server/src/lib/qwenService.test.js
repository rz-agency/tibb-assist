const test = require('node:test')
const assert = require('node:assert/strict')
const { cleanSymptomLabel, normalizeSeverityFromText } = require('./qwenService')

// ─── cleanSymptomLabel ──────────────────────────────────────────

test('"Severe headache" → "Headache"', () => {
  assert.equal(cleanSymptomLabel('Severe headache'), 'Headache')
})

test('"Heavy bleeding" → "Bleeding"', () => {
  assert.equal(cleanSymptomLabel('Heavy bleeding'), 'Bleeding')
})

test('"Fever or high temperature" → unchanged', () => {
  assert.equal(cleanSymptomLabel('Fever or high temperature'), 'Fever or high temperature')
})

test('"Abdominal pain or stomach ache" → unchanged', () => {
  assert.equal(cleanSymptomLabel('Abdominal pain or stomach ache'), 'Abdominal pain or stomach ache')
})

test('"Blurred or disturbed vision" → unchanged', () => {
  assert.equal(cleanSymptomLabel('Blurred or disturbed vision'), 'Blurred or disturbed vision')
})

test('"Back pain" → unchanged', () => {
  assert.equal(cleanSymptomLabel('Back pain'), 'Back pain')
})

test('case-insensitive: "severe headache" → "Headache"', () => {
  assert.equal(cleanSymptomLabel('severe headache'), 'Headache')
})

test('case-insensitive: "heavy bleeding" → "Bleeding"', () => {
  assert.equal(cleanSymptomLabel('heavy bleeding'), 'Bleeding')
})

test('does not strip "severe" from middle of name', () => {
  assert.equal(cleanSymptomLabel('Pain severe lower back'), 'Pain severe lower back')
})

test('empty string → empty string', () => {
  assert.equal(cleanSymptomLabel(''), '')
})

// ─── normalizeSeverityFromText ──────────────────────────────────

test('"medium" → MODERATE', () => {
  assert.equal(normalizeSeverityFromText('medium'), 'MODERATE')
})

test('"moderate" → MODERATE', () => {
  assert.equal(normalizeSeverityFromText('moderate pain'), 'MODERATE')
})

test('"darmiyani" → MODERATE', () => {
  assert.equal(normalizeSeverityFromText('darmiyani dard'), 'MODERATE')
})

test('"mild" → MILD', () => {
  assert.equal(normalizeSeverityFromText('mild headache'), 'MILD')
})

test('"halka" → MILD', () => {
  assert.equal(normalizeSeverityFromText('halka dard'), 'MILD')
})

test('"thori" → MILD', () => {
  assert.equal(normalizeSeverityFromText('thori takleef'), 'MILD')
})

test('"light" → MILD', () => {
  assert.equal(normalizeSeverityFromText('light pain'), 'MILD')
})

test('"severe" → SEVERE', () => {
  assert.equal(normalizeSeverityFromText('severe headache'), 'SEVERE')
})

test('"bohat zyada" → SEVERE', () => {
  assert.equal(normalizeSeverityFromText('bohat zyada dard'), 'SEVERE')
})

test('"unbearable" → SEVERE', () => {
  assert.equal(normalizeSeverityFromText('unbearable pain'), 'SEVERE')
})

test('no severity keyword → null', () => {
  assert.equal(normalizeSeverityFromText('mujhy sardard horaha hai'), null)
})

test('empty string → null', () => {
  assert.equal(normalizeSeverityFromText(''), null)
})

test('null input → null', () => {
  assert.equal(normalizeSeverityFromText(null), null)
})

test('case-insensitive: "MEDIUM" → MODERATE', () => {
  assert.equal(normalizeSeverityFromText('MEDIUM fever'), 'MODERATE')
})

test('Roman Urdu: "bukhar bhi medium hy" → MODERATE', () => {
  assert.equal(normalizeSeverityFromText('bukhar bhi medium hy'), 'MODERATE')
})
