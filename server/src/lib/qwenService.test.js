const test = require('node:test')
const assert = require('node:assert/strict')
const { cleanSymptomLabel, extractSymptoms, normalizeSeverityFromText } = require('./qwenService')

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

// ─── extractSymptoms: urgency intent detection ──────────────────
//
// extractSymptoms() reaches the OpenRouter LLM through global fetch, so these
// tests stub fetch with canned LLM responses. This keeps them deterministic
// and network-free while exercising the real parsing path.

process.env.OPENROUTER_API_KEY = 'test-key'

let lastFetchBody = null
function mockLlmResponse(llmContent) {
  lastFetchBody = null
  global.fetch = async (url, options) => {
    lastFetchBody = JSON.parse(options.body)
    return {
      ok: true,
      json: async () => ({ choices: [{ message: { content: llmContent } }] }),
    }
  }
}

const CATALOG = [{ code: 'abdominal_pain', name: 'Abdominal pain', category: 'general' }]

test('extractSymptoms: urgent message returns urgentIntentDetected true with existing fields unchanged', async () => {
  const llmPayload = {
    chatReply: 'Main aap ki takleef samajh rahi hoon.',
    extractedSymptoms: [{ code: 'abdominal_pain', answerStatus: 'PRESENT', severity: 'SEVERE', notes: 'bohat zyada dard' }],
    needsClarification: false,
    clarificationQuestion: null,
    readyForAssessment: false,
    urgentIntentDetected: true,
  }
  mockLlmResponse(JSON.stringify(llmPayload))

  const result = await extractSymptoms('Ambulance bulao, bohat zyada dard ho raha hai', [], CATALOG)

  assert.equal(result.urgentIntentDetected, true)
  assert.equal(result.chatReply, 'Main aap ki takleef samajh rahi hoon.')
  assert.deepEqual(result.extractedSymptoms, llmPayload.extractedSymptoms)
  assert.equal(result.needsClarification, false)
  assert.equal(result.clarificationQuestion, null)
  assert.equal(result.readyForAssessment, false)
  // The urgency flag is a UI trigger only — the extraction result must never
  // carry or imply a risk level.
  assert.equal('riskLevel' in result, false)
})

test('extractSymptoms: ordinary mild symptom message keeps urgentIntentDetected false', async () => {
  const extracted = [{ code: 'abdominal_pain', answerStatus: 'PRESENT', severity: 'MILD', notes: 'halka dard' }]
  mockLlmResponse(JSON.stringify({
    chatReply: 'Theek hai, main note kar rahi hoon.',
    extractedSymptoms: extracted,
    needsClarification: false,
    clarificationQuestion: null,
    readyForAssessment: false,
    urgentIntentDetected: false,
  }))

  const result = await extractSymptoms('halka dard hai bas', [], CATALOG)

  assert.equal(result.urgentIntentDetected, false)
  assert.equal(result.chatReply, 'Theek hai, main note kar rahi hoon.')
  assert.deepEqual(result.extractedSymptoms, extracted)
  assert.equal(result.readyForAssessment, false)
})

test('extractSymptoms: LLM response without urgentIntentDetected defaults to false', async () => {
  mockLlmResponse(JSON.stringify({
    chatReply: 'Aur kuch?',
    extractedSymptoms: [],
    needsClarification: false,
    clarificationQuestion: null,
    readyForAssessment: false,
  }))

  const result = await extractSymptoms('mujhe thora bukhar hai', [], CATALOG)

  assert.equal(result.urgentIntentDetected, false)
})

test('extractSymptoms: urgency flag never blocks the normal flow (readyForAssessment can be true at the same time)', async () => {
  mockLlmResponse(JSON.stringify({
    chatReply: 'Main ne yeh symptoms note kiye hain.',
    extractedSymptoms: [],
    needsClarification: false,
    clarificationQuestion: null,
    readyForAssessment: true,
    urgentIntentDetected: true,
  }))

  const result = await extractSymptoms('bohat zyada dard tha, bas yehi', [], CATALOG)

  assert.equal(result.readyForAssessment, true)
  assert.equal(result.urgentIntentDetected, true)
})

test('extractSymptoms: non-JSON LLM response falls back with urgentIntentDetected false', async () => {
  mockLlmResponse('Sorry, I cannot answer in JSON right now.')

  const result = await extractSymptoms('dard ho raha hai', [], CATALOG)

  assert.equal(result.urgentIntentDetected, false)
  assert.equal(result.chatReply, 'Sorry, I cannot answer in JSON right now.')
  assert.deepEqual(result.extractedSymptoms, [])
})

test('extractSymptoms: broken JSON from LLM falls back with urgentIntentDetected false', async () => {
  mockLlmResponse('{ "chatReply": "broken')

  const result = await extractSymptoms('dard ho raha hai', [], CATALOG)

  assert.equal(result.urgentIntentDetected, false)
  assert.deepEqual(result.extractedSymptoms, [])
})

test('extractSymptoms: system prompt instructs the LLM to detect urgency trigger concepts', async () => {
  mockLlmResponse(JSON.stringify({ chatReply: 'ok' }))
  await extractSymptoms('koi message', [], CATALOG)

  const systemPrompt = lastFetchBody.messages[0].content
  assert.equal(lastFetchBody.messages[0].role, 'system')
  assert.match(systemPrompt, /URGENCY INTENT DETECTION/)
  assert.match(systemPrompt, /urgentIntentDetected/)
  assert.match(systemPrompt, /contractions/i)
  assert.match(systemPrompt, /[Ww]ater breaking|fluid leak/)
  assert.match(systemPrompt, /ambulance/)
  // The prompt must keep the flag strictly separate from risk levels.
  assert.match(systemPrompt, /NOT a risk level/)
})

test('extractSymptoms: the urgent user message is sent to the LLM unchanged', async () => {
  mockLlmResponse(JSON.stringify({ chatReply: 'ok', urgentIntentDetected: true }))
  const urgentMessage = 'Mera pani chala gaya, please kisi ko call karo'

  await extractSymptoms(urgentMessage, [], CATALOG)

  assert.equal(lastFetchBody.messages.at(-1).content, urgentMessage)
  assert.equal(lastFetchBody.messages.at(-1).role, 'user')
})
