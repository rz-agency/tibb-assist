const test = require('node:test')
const assert = require('node:assert/strict')

// ---------- AI assistant message() tests (mocked prisma + qwenService) ----------
//
// We test the message() handler directly by providing mock prisma and
// qwenService modules via require cache manipulation (same technique as
// careMissionAccess.test.js, patientController.test.js and
// emergencyActionLog.test.js). This keeps the tests fast, deterministic and
// network-free, and lets us verify that urgentIntentDetected passes through
// to the API response without touching any risk logic.

const mockPrisma = {
  symptom: {
    findMany: async () => [],
  },
}

const mockQwenService = {
  extractSymptoms: async () => { throw new Error('Mock not configured') },
  transcribeAudio: async () => { throw new Error('Mock not configured') },
  cleanSymptomLabel: (name) => name,
  normalizeSeverityFromText: () => null,
  explainResult: async () => '',
  SUPPLEMENTARY_SYMPTOMS: [],
}

// Replace prisma and qwenService in the require cache before importing the
// controller so it (and its transitive dependencies) pick up the mocks.
const prismaPath = require.resolve('../lib/prisma')
require.cache[prismaPath] = {
  id: prismaPath,
  filename: prismaPath,
  loaded: true,
  exports: mockPrisma,
}

const qwenPath = require.resolve('../lib/qwenService')
require.cache[qwenPath] = {
  id: qwenPath,
  filename: qwenPath,
  loaded: true,
  exports: mockQwenService,
}

const { message } = require('../controllers/aiAssistantController')

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.body = payload
      return this
    },
  }
}

function mockRequest(messageText) {
  return {
    body: { message: messageText, conversationHistory: [] },
  }
}

function setExtractionResult(result) {
  mockQwenService.extractSymptoms = async () => result
}

// ---------- urgentIntentDetected pass-through ----------

test('message: urgent intent flag passes through in the conversation phase', async () => {
  setExtractionResult({
    chatReply: 'Aap foran madad le sakti hain.',
    extractedSymptoms: [{ code: 'abdominal_pain', answerStatus: 'PRESENT', severity: 'SEVERE', notes: 'bohat dard' }],
    needsClarification: false,
    clarificationQuestion: null,
    readyForAssessment: false,
    urgentIntentDetected: true,
  })

  const res = mockRes()
  await message(mockRequest('ambulance bulao, bohat zyada dard hai'), res)

  assert.equal(res.body.phase, 'conversation')
  assert.equal(res.body.urgentIntentDetected, true)
  assert.equal(res.body.userInput, 'ambulance bulao, bohat zyada dard hai')
  assert.equal(res.body.assistantReply, 'Aap foran madad le sakti hain.')
  assert.equal(res.body.readyForAssessment, false)
  assert.equal(res.body.extractedSymptoms.length, 1)
})

test('message: no urgent intent passes through as false', async () => {
  setExtractionResult({
    chatReply: 'Theek hai.',
    extractedSymptoms: [],
    needsClarification: false,
    clarificationQuestion: null,
    readyForAssessment: false,
    urgentIntentDetected: false,
  })

  const res = mockRes()
  await message(mockRequest('halka sardard hai'), res)

  assert.equal(res.body.phase, 'conversation')
  assert.equal(res.body.urgentIntentDetected, false)
})

test('message: urgent intent flag passes through in the ready phase (urgency never blocks the flow)', async () => {
  setExtractionResult({
    chatReply: 'Main ne yeh symptoms note kiye hain.',
    extractedSymptoms: [{ code: 'abdominal_pain', answerStatus: 'PRESENT', severity: 'SEVERE', notes: null }],
    needsClarification: false,
    clarificationQuestion: null,
    readyForAssessment: true,
    urgentIntentDetected: true,
  })

  const res = mockRes()
  await message(mockRequest('bohat zyada dard, bas yehi'), res)

  assert.equal(res.body.phase, 'ready')
  assert.equal(res.body.readyForAssessment, true)
  assert.equal(res.body.urgentIntentDetected, true)
})

test('message: urgent intent flag passes through in the needsClarification phase', async () => {
  setExtractionResult({
    chatReply: 'Zara wazahat karein.',
    extractedSymptoms: [],
    needsClarification: true,
    clarificationQuestion: 'Dard kitna ho raha hai?',
    readyForAssessment: false,
    urgentIntentDetected: true,
  })

  const res = mockRes()
  await message(mockRequest('pani chala gaya lagta hai'), res)

  assert.equal(res.body.needsClarification, true)
  assert.equal(res.body.clarificationQuestion, 'Dard kitna ho raha hai?')
  assert.equal(res.body.urgentIntentDetected, true)
})

test('message: response never exposes a risk level (risk is decided only by the rule engine after confirm)', async () => {
  setExtractionResult({
    chatReply: 'Theek hai.',
    extractedSymptoms: [],
    needsClarification: false,
    clarificationQuestion: null,
    readyForAssessment: false,
    urgentIntentDetected: true,
  })

  const res = mockRes()
  await message(mockRequest('koi bhi message'), res)

  assert.equal('riskLevel' in res.body, false)
})

// ---------- Existing validation behavior unchanged ----------

test('message: missing message and audio returns 400', async () => {
  const res = mockRes()
  await message({ body: {} }, res)
  assert.equal(res.statusCode, 400)
})
