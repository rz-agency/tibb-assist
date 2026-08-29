const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

const LLM_MODEL = 'minimax/minimax-m3:free'
const STT_MODEL = 'openai/whisper-large-v3'

function getApiKey() {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) {
    throw new Error('OPENROUTER_API_KEY environment variable is not configured.')
  }
  return key
}

function buildHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getApiKey()}`,
    'HTTP-Referer': 'https://tibb-assist.app',
    'X-Title': 'Tibb Assist',
  }
}

async function callChatCompletion(messages, options = {}) {
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model: options.model || LLM_MODEL,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 2000,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    const error = new Error(`OpenRouter LLM API returned ${response.status}`)
    error.status = response.status
    error.detail = errorText
    throw error
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

async function transcribeAudio(base64Audio) {
  const match = base64Audio.match(/^data:([^;]+);base64,(.+)$/)
  const audioData = match ? match[2] : base64Audio
  const mimeType = match ? match[1] : 'audio/webm'

  const formatMap = {
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
  }
  const format = formatMap[mimeType] || 'webm'

  const response = await fetch(`${OPENROUTER_BASE_URL}/audio/transcriptions`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify({
      model: STT_MODEL,
      input_audio: {
        data: audioData,
        format,
      },
      language: 'ur',
    }),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    const error = new Error(`OpenRouter STT API returned ${response.status}`)
    error.status = response.status
    error.detail = errorText
    throw error
  }

  const data = await response.json()
  return data.text || ''
}

function buildExtractionPrompt(symptomCatalog) {
  const symptomList = symptomCatalog
    .map((s) => `- ${s.code} (name: "${s.name}", category: ${s.category || 'general'})`)
    .join('\n')

  return `You are a maternal health symptom extraction assistant embedded in a healthcare application called Tibb Assist.

Your ONLY job is to understand what a pregnant woman says (in Urdu, English, or Roman Urdu) and extract structured symptom information.

CRITICAL RULES:
- You MUST NOT diagnose any medical condition.
- You MUST NOT assign or suggest any risk level (GREEN, YELLOW, RED).
- You MUST NOT prescribe medication or treatment.
- You MUST NOT invent symptoms that are not in the provided catalog.
- You MUST only extract symptoms that the user has actually mentioned or clearly implied.
- If the user's message is ambiguous, set needsClarification to true.
- Answer status and severity must be based ONLY on what the user explicitly says.

AVAILABLE SYMPTOMS (from database — you can ONLY use these):
${symptomList}

For each message, respond with a JSON object in this EXACT format:
{
  "chatReply": "Your conversational response in Roman Urdu (friendly, supportive, brief)",
  "extractedSymptoms": [
    {
      "code": "symptom_code_from_catalog",
      "answerStatus": "PRESENT or ABSENT or UNKNOWN",
      "severity": "MILD or MODERATE or SEVERE or null",
      "notes": "brief note about what user said"
    }
  ],
  "needsClarification": false,
  "clarificationQuestion": null,
  "readyForAssessment": false
}

Rules for the response:
- "chatReply" is always required. Be warm, supportive, and conversational in Roman Urdu.
- "extractedSymptoms" should contain ALL symptoms mentioned so far in the conversation with their best-determined status.
- If the user mentions a symptom but you cannot determine its status (present/absent) or severity, set "needsClarification" to true and ask in "clarificationQuestion".
- If you have enough information about ALL catalog symptoms (or the user has clearly stated what they are experiencing), set "readyForAssessment" to true and ask the user to confirm they want to proceed with the assessment.
- When readyForAssessment is true, list the symptoms you understood in the chatReply so the user can verify.
- NEVER include any risk level or medical diagnosis in chatReply.
- If the user's message is not about health/symptoms, gently redirect to the symptom check context in chatReply.`
}

async function extractSymptoms(userMessage, conversationHistory, symptomCatalog) {
  const systemPrompt = buildExtractionPrompt(symptomCatalog)

  const messages = [{ role: 'system', content: systemPrompt }]

  for (const msg of conversationHistory) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content })
    } else if (msg.role === 'assistant') {
      messages.push({ role: 'assistant', content: msg.content })
    }
  }

  messages.push({ role: 'user', content: userMessage })

  const response = await callChatCompletion(messages, { temperature: 0.2 })

  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      chatReply: response,
      extractedSymptoms: [],
      needsClarification: false,
      readyForAssessment: false,
    }
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return {
      chatReply: parsed.chatReply || '',
      extractedSymptoms: Array.isArray(parsed.extractedSymptoms) ? parsed.extractedSymptoms : [],
      needsClarification: !!parsed.needsClarification,
      clarificationQuestion: parsed.clarificationQuestion || null,
      readyForAssessment: !!parsed.readyForAssessment,
    }
  } catch {
    return {
      chatReply: response,
      extractedSymptoms: [],
      needsClarification: false,
      readyForAssessment: false,
    }
  }
}

function buildExplanationPrompt(riskLevel, symptomSummary) {
  return `You are a maternal health assistant explaining an assessment result to a pregnant woman in simple Roman Urdu.

The assessment was calculated by a deterministic rule engine (NOT by you). The risk level is final and must not be changed.

CRITICAL RULES:
- Explain the result simply and clearly in Roman Urdu.
- Do NOT diagnose any medical condition.
- Do NOT claim to be a doctor.
- Do NOT provide treatment instructions beyond what is appropriate.
- Do NOT invent emergency procedures.
- For RED: clearly communicate urgency. Say this could be a warning sign and she should contact a doctor or hospital promptly. Be caring but clear about the seriousness.
- For YELLOW: explain that some answers were not clear and recommend consulting a healthcare professional.
- For GREEN: provide gentle reassurance that no current warning signs were detected, but remind her that this is not a medical diagnosis and she should continue routine prenatal care.
- Keep the explanation brief (2-4 sentences).
- Be warm and supportive.

The risk level is: ${riskLevel}
Detected symptoms: ${symptomSummary}`
}

async function explainResult(riskLevel, assessment, symptomSummary) {
  const systemPrompt = buildExplanationPrompt(riskLevel, symptomSummary)

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Explain this assessment result to me in simple Roman Urdu. The risk level determined by the system is ${riskLevel}. Symptoms found: ${symptomSummary}.`,
    },
  ]

  return callChatCompletion(messages, { temperature: 0.4, maxTokens: 500 })
}

module.exports = {
  transcribeAudio,
  extractSymptoms,
  explainResult,
}
