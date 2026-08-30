const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'

const LLM_MODEL = 'minimax/minimax-m3:free'
const STT_MODEL = 'openai/whisper-large-v3'

/**
 * Common pregnancy-related symptoms that the AI should recognize even when
 * they are not yet present in the database symptom catalog. These are merged
 * with DB symptoms before being sent to the LLM extraction prompt and before
 * validation in the confirm handler.
 */
const SUPPLEMENTARY_SYMPTOMS = [
  { code: 'abdominal_pain', name: 'Abdominal pain or stomach ache', category: 'general' },
  { code: 'nausea_vomiting', name: 'Nausea or vomiting', category: 'general' },
  { code: 'fever', name: 'Fever or high temperature', category: 'general' },
  { code: 'swelling', name: 'Swelling of feet, hands, or face', category: 'general' },
  { code: 'blurred_vision', name: 'Blurred or disturbed vision', category: 'warning_sign' },
  { code: 'reduced_fetal_movement', name: 'Reduced or absent baby movement', category: 'warning_sign' },
  { code: 'back_pain', name: 'Back pain', category: 'general' },
  { code: 'dizziness', name: 'Dizziness or fainting', category: 'general' },
  { code: 'painful_urination', name: 'Pain or burning during urination', category: 'general' },
  { code: 'vaginal_discharge', name: 'Unusual vaginal discharge', category: 'general' },
  { code: 'contractions', name: 'Contractions or tightening', category: 'warning_sign' },
  { code: 'shortness_of_breath', name: 'Shortness of breath', category: 'general' },
]

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

AVAILABLE SYMPTOMS (you can ONLY use these codes):
${symptomList}

SEVERITY MAPPING:
- The user may describe severity in everyday language. Map it like this:
  - "thoda", "halka", "mild", "light" → MILD
  - "medium", "darmiyani", "thora zyada", "moderate" → MODERATE
  - "bohat", "zyada", "severe", "unbearable", "bardasht nahi" → SEVERE
- IDENTITY ≠ SEVERITY. The symptom CODE is an identifier (e.g. "severe_headache") and the catalog NAME is a label (e.g. "Severe headache"). Neither determines the severity field.
- The severity field must come SOLELY from the user's own words about intensity. Examples:
  - User says "medium sardard" → code: "severe_headache", severity: "MODERATE" (NOT "SEVERE")
  - User says "halka bleeding" → code: "heavy_bleeding", severity: "MILD" (NOT "SEVERE")
  - User says "bohat zyada dard" → code: "abdominal_pain", severity: "SEVERE"
- If the user does NOT mention any severity word, set severity to null. Do NOT guess from the catalog name.

CONVERSATION FLOW:
- Ask about ONE thing at a time. If the user mentions multiple symptoms, acknowledge them ALL, then ask about the next unclear item.
- If the user says they have NO MORE symptoms (e.g. "bas yehi", "no more", "aur kuch nahi", "bas", "that's all"), do NOT ask about more symptoms. Instead, set readyForAssessment to true and list the symptoms you understood.
- When readyForAssessment is true, clearly state in chatReply: "Main ne yeh symptoms note kiye hain. Ab assessment shuru karne ke liye neechay Confirm button dabayein." (I have noted these symptoms. Now press the Confirm button below to start the assessment.) Do NOT ask "what would you like to do next?" or "kya karna hai?" — the app handles that automatically.
- For pregnancy-related warning symptoms (heavy bleeding, severe headache, blurred vision, reduced baby movement, contractions, fever, abdominal pain), acknowledge them with appropriate concern in chatReply. For example: "Pait mein dard aur bukhar pregnancy mein important signs ho sakte hain, main inhein note kar rahi hoon." Do NOT just say "noted" — show that you understand these may need attention.

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
- If the user has stated all their symptoms (or explicitly says no more), set "readyForAssessment" to true. Do NOT keep asking for more.
- When readyForAssessment is true, list the symptoms you understood in the chatReply and tell the user to press the Confirm button.
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

/**
 * Strip severity-prefixed words from database symptom names so the
 * displayed / explained label matches the user's own reported severity.
 *   "Severe headache" → "Headache"
 *   "Heavy bleeding"  → "Bleeding"
 */
function cleanSymptomLabel(name) {
  const cleaned = name.replace(/^(Severe|Heavy)\s+/i, '').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned
}

/**
 * Scan free-text for explicit severity keywords and return MILD / MODERATE / SEVERE.
 * Returns null when no severity keyword is found.
 *
 * IMPORTANT: This function only looks at what the USER said — never at
 * catalog names or codes — so that "severe_headache" (code) does not
 * contaminate the severity field.
 */
function normalizeSeverityFromText(text) {
  if (!text) return null
  const lower = text.toLowerCase()

  // Order matters: check MILD and SEVERE first so that the broader MODERATE
  // patterns do not accidentally match "light" or "severe".
  const MILD_RE = /\b(halka|halki|thoda|thori|thoda sa|mild|light|kam| halka )\b/
  const SEVERE_RE = /\b(severe|bohat|bohot|zyada|buhut|bardasht nahi|unbearable|shiddat|shiddat wala|intense)\b/
  const MODERATE_RE = /\b(medium|moderate|darmiyani|darmiyana|darmiyani|thora zyada|thora zyada|middle)\b/

  if (MILD_RE.test(lower)) return 'MILD'
  if (SEVERE_RE.test(lower)) return 'SEVERE'
  if (MODERATE_RE.test(lower)) return 'MODERATE'
  return null
}

function buildExplanationPrompt(riskLevel, symptomSummary, notedSummary) {
  const notedLine = notedSummary
    ? `\nSymptoms noted but NOT scored by the risk engine: ${notedSummary}\nIMPORTANT: Clearly tell the user these were recorded for reference only and were NOT used to calculate the risk level.`
    : ''

  return `You are a maternal health assistant explaining an assessment result to a pregnant woman in simple Roman Urdu.

The assessment was calculated by a deterministic rule engine (NOT by you). The risk level is final and must not be changed.

CRITICAL RULES:
- Explain the result simply and clearly in Roman Urdu.
- Do NOT diagnose any medical condition.
- Do NOT claim to be a doctor.
- Do NOT provide treatment instructions beyond what is appropriate.
- Do NOT invent emergency procedures.
- Do NOT mention specific medical thresholds (e.g. exact temperatures like "102°F", blood pressure readings, or lab values). These are NOT defined by the app.
- Do NOT contradict or reinterpret the risk level. ${riskLevel} is final.
- For RED: clearly communicate urgency. Say this could be a warning sign and she should contact a doctor or hospital promptly. Be caring but clear about the seriousness.
- For YELLOW: explain that some answers were not clear and recommend consulting a healthcare professional.
- For GREEN: provide gentle reassurance that no current warning signs were detected, but remind her that this is not a medical diagnosis and she should continue routine prenatal care.
- Keep the explanation brief (2-4 sentences).
- Be warm and supportive.

Scored symptoms (used for risk calculation): ${symptomSummary}${notedLine}

The risk level is: ${riskLevel}`
}

async function explainResult(riskLevel, assessment, symptomSummary, notedSummary) {
  const systemPrompt = buildExplanationPrompt(riskLevel, symptomSummary, notedSummary)

  const messages = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Explain this assessment result to me in simple Roman Urdu. The risk level determined by the system is ${riskLevel}. Symptoms scored: ${symptomSummary}.${notedSummary ? ` Also noted but not scored: ${notedSummary}.` : ''}`,
    },
  ]

  return callChatCompletion(messages, { temperature: 0.4, maxTokens: 500 })
}

module.exports = {
  transcribeAudio,
  extractSymptoms,
  explainResult,
  cleanSymptomLabel,
  normalizeSeverityFromText,
  SUPPLEMENTARY_SYMPTOMS,
}
