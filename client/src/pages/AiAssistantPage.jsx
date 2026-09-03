import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { confirmAiAssessment, sendAiMessage } from '../api/api'
import StatusMessage from '../components/StatusMessage'
import EmergencyPanel from '../components/EmergencyPanel'
import AssessmentResultSection from '../components/AssessmentResultSection'

const RISK_LABEL_KEY = { GREEN: 'assessment.riskGreen', YELLOW: 'assessment.riskYellow', RED: 'assessment.riskRed' }

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition

function getSpeechLang(i18nLang) {
  if (i18nLang === 'ur') return 'ur-PK'
  if (i18nLang === 'en') return 'en-US'
  return i18nLang
}

function AiAssistantPage({ user, onNavigate }) {
  const { t, i18n } = useTranslation()

  const [messages, setMessages] = useState([])
  const [phase, setPhase] = useState('idle')
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [extractedSymptoms, setExtractedSymptoms] = useState([])
  const [isConfirming, setIsConfirming] = useState(false)
  const [assessment, setAssessment] = useState(null)
  const [aiExplanation, setAiExplanation] = useState('')
  const [notedSymptoms, setNotedSymptoms] = useState([])
  const [facilities, setFacilities] = useState([])
  const [ageRiskNote, setAgeRiskNote] = useState(null)
  const [error, setError] = useState('')
  // Emergency intent: set when the AI detects an urgent help request in the
  // woman's message. UI trigger only — completely independent of the risk level.
  const [urgentIntent, setUrgentIntent] = useState(false)

  const mediaRecorderRef = useRef(null)
  const recognitionRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const confirmSectionRef = useRef(null)
  const inputRef = useRef(null)

  const greetingShown = useRef(false)

  useEffect(() => {
    if (!greetingShown.current) {
      greetingShown.current = true
      setMessages([{ role: 'assistant', content: t('ai.greeting'), type: 'text' }])
    }
  }, [t])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const container = messagesContainerRef.current
    if (!container) return
    if (phase === 'ready' || phase === 'result') {
      // Use requestAnimationFrame so the DOM has settled after React renders
      // the confirm/result section before we measure and scroll.
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight
      })
    }
  }, [phase, assessment])

  const startRecording = async () => {
    setError('')

    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI()
      recognition.lang = getSpeechLang(i18n.language)
      recognition.continuous = false
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        setIsRecording(false)
        if (transcript && transcript.trim()) {
          handleSend(transcript, null)
        } else {
          setError(t('ai.recordingFailed'))
        }
      }

      recognition.onerror = (event) => {
        setIsRecording(false)
        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          setError(t('ai.micPermissionDenied'))
        } else {
          setError(t('ai.recordingFailed'))
        }
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      try {
        recognition.start()
        recognitionRef.current = recognition
        setIsRecording(true)
      } catch {
        setError(t('ai.micPermissionDenied'))
      }
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0]?.type || 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        if (audioBlob.size < 100) {
          setError(t('ai.recordingFailed'))
          setIsRecording(false)
          return
        }
        await handleSend('', audioBlob)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      setError(t('ai.micPermissionDenied'))
    }
  }

  const stopRecording = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop()
    }
    setIsRecording(false)
  }

  const handleSend = async (text, audioBlob) => {
    const messageText = text || inputText.trim()
    if (!messageText && !audioBlob) return

    // When the assessment is ready and the user sends an affirmation,
    // auto-trigger the confirm flow instead of sending another LLM message.
    const AFFIRMATION_RE = /^(yes|yep|yeah|haan|han|ji|ji haan|bilkul|ok|okay|hmm|sure|confirm|proceed|start)/i
    if (phase === 'ready' && !audioBlob && AFFIRMATION_RE.test(messageText)) {
      handleConfirm()
      return
    }

    setError('')
    setIsSending(true)

    const userMessage = {
      role: 'user',
      content: messageText || t('ai.voiceInput'),
      type: audioBlob ? 'voice' : 'text',
    }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    if (!audioBlob) setInputText('')

    const conversationHistory = updatedMessages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .filter((m) => m.type !== 'system')
      .map((m) => ({ role: m.role, content: m.content }))

    try {
      const result = await sendAiMessage(
        messageText || null,
        conversationHistory.slice(0, -1),
        audioBlob || null,
      )

      if (result.transcribedText) {
        userMessage.transcribed = result.transcribedText
        userMessage.content = result.transcribedText
      }

      const assistantMessage = { role: 'assistant', content: result.assistantReply, type: 'text' }
      setMessages([...updatedMessages, assistantMessage])

      if (result.extractedSymptoms) {
        setExtractedSymptoms(result.extractedSymptoms)
      }

      // Once urgency is detected, keep the emergency panel available for the
      // rest of the conversation — it is additive and never hides on its own.
      if (result.urgentIntentDetected) {
        setUrgentIntent(true)
      }

      if (result.readyForAssessment) {
        setPhase('ready')
      } else {
        // Text-based safety net: when the AI's chat reply tells the user to
        // confirm AND extracted symptoms already include meaningful status
        // (PRESENT or ABSENT), advance to 'ready' regardless of the
        // readyForAssessment flag — the LLM extraction sometimes disagrees
        // with its own conversational text.
        const hasClearSymptoms = result.extractedSymptoms?.some(
          (s) => s.answerStatus === 'PRESENT' || s.answerStatus === 'ABSENT',
        )
        const aiSaysConfirm = /confirm|button|assessment shuru|shuru|dabay|press|start|tayyar|ready/i.test(result.assistantReply || '')

        if (hasClearSymptoms && aiSaysConfirm) {
          setPhase('ready')
        } else {
          setPhase('conversation')
        }
      }
    } catch (requestError) {
      setError(requestError.message)
      const fallbackMsg = {
        role: 'assistant',
        content: t('ai.serviceUnavailable'),
        type: 'system',
      }
      setMessages([...updatedMessages, fallbackMsg])
    } finally {
      setIsSending(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    handleSend(inputText.trim(), null)
  }

  const handleConfirm = async () => {
    setError('')
    setIsConfirming(true)
    try {
      const result = await confirmAiAssessment(extractedSymptoms)
      setAssessment(result.assessment)
      setAiExplanation(result.aiExplanation)
      setNotedSymptoms(result.notedSymptoms || [])
      setFacilities(result.facilities || [])
      setAgeRiskNote(result.ageRiskNote || null)
      setPhase('result')

      setMessages((prev) => [
        ...prev,
        { role: 'system', content: `${t('assessment.assessmentCompleted')} — ${t(RISK_LABEL_KEY[result.riskLevel])}`, type: 'system' },
      ])
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsConfirming(false)
    }
  }

  const handleCancelAssessment = () => {
    setPhase('conversation')
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: t('ai.assessmentCancelled'), type: 'text' },
    ])
  }

  const startNew = () => {
    setMessages([{ role: 'assistant', content: t('ai.greeting'), type: 'text' }])
    setPhase('idle')
    setInputText('')
    setExtractedSymptoms([])
    setAssessment(null)
    setAiExplanation('')
    setNotedSymptoms([])
    setFacilities([])
    setAgeRiskNote(null)
    setError('')
    setUrgentIntent(false)
  }

  if (user.role !== 'WOMAN') {
    return <section className="content-panel text-center"><h1 className="section-title">{t('ai.pageTitle')}</h1><p className="mt-3 text-[var(--text-secondary)]">{t('ai.entryRestriction')}</p></section>
  }

  const showResult = phase === 'result' && assessment

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="eyebrow">{t('ai.pageTitle')}</p>
        <h1 className="page-title">{t('ai.subtitle')}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">{t('ai.chatHelper', { defaultValue: 'Tell me how you\u2019re feeling in your own words.' })}</p>
      </div>

      <div className="ai-chat-panel">
        <div className="ai-messages" ref={messagesContainerRef}>
          {messages.map((msg, index) => {
            if (msg.type === 'system') {
              return <div className="ai-system-msg" key={index}><p>{msg.content}</p></div>
            }
            const isUser = msg.role === 'user'
            return (
              <div className={`ai-bubble ${isUser ? 'ai-bubble-user' : 'ai-bubble-assistant'}`} key={index}>
                <p>{msg.content}</p>
                {msg.transcribed && msg.type === 'voice' && (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">{t('ai.transcribed')}: {msg.transcribed}</p>
                )}
                {isUser && msg.type === 'voice' && (
                  <span className="mt-1 inline-block text-xs text-[var(--text-muted)]">{t('ai.voiceLabel')}</span>
                )}
              </div>
            )
          })}
          {isSending && (
            <div className="ai-bubble ai-bubble-assistant">
              <p className="ai-typing"><span /><span /><span /></p>
            </div>
          )}
          {isRecording && (
            <div className="ai-bubble ai-bubble-assistant">
              <p className="flex items-center gap-2 text-red-600"><span className="ai-recording-dot" />{t('ai.recording')}</p>
            </div>
          )}

          {error && <StatusMessage>{error}</StatusMessage>}

          {urgentIntent && (!showResult || assessment.riskLevel !== 'RED') && (
            <div className="ai-urgent-intent">
              <p className="text-sm text-[var(--text-secondary)]">{t('ai.urgentIntentNotice')}</p>
              <EmergencyPanel user={user} assessmentId={assessment?.id} onNavigate={onNavigate} />
            </div>
          )}

          {showResult && (
            <AssessmentResultSection
              assessment={assessment}
              aiExplanation={aiExplanation}
              notedSymptoms={notedSymptoms}
              facilities={facilities}
              user={user}
              onNavigate={onNavigate}
              onRestart={startNew}
              ageRiskNote={ageRiskNote}
            />
          )}

        {phase === 'ready' && !showResult && (
          <div className="ai-confirm-section" ref={confirmSectionRef}>
            <p className="font-semibold text-[var(--text-primary)]">{t('ai.confirmTitle')}</p>
            {extractedSymptoms.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {extractedSymptoms.map((s, i) => (
                  <li className="flex items-center gap-2" key={i}>
                    <span className={`inline-block h-2 w-2 rounded-full ${s.answerStatus === 'PRESENT' ? 'bg-[var(--coral-400)]' : s.answerStatus === 'ABSENT' ? 'bg-[var(--teal-400)]' : 'bg-[var(--border-soft)]'}`} />
                    <span className="font-medium text-[var(--text-primary)]">{s.code.replace(/_/g, ' ')}</span>
                    <span className="text-[var(--text-muted)]">{s.answerStatus}{s.severity ? ` · ${s.severity}` : ''}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              <button className="button-primary" disabled={isConfirming} onClick={handleConfirm}>
                {isConfirming ? t('ai.processing') : t('ai.confirmButton')}
              </button>
              <button className="button-secondary" onClick={handleCancelAssessment}>{t('common.cancel')}</button>
            </div>
          </div>
        )}

          <div ref={messagesEndRef} />
        </div>

        {!showResult && phase !== 'ready' && (
          <form className="ai-input-bar" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              className="form-input ai-text-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={t('ai.inputPlaceholder')}
              disabled={isSending || isRecording}
            />
            <button
              type="button"
              className={`ai-mic-btn ${isRecording ? 'ai-mic-recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isSending}
              aria-label={isRecording ? t('ai.stopRecording') : t('ai.startRecording')}
            >
              {isRecording ? '⏹' : '🎤'}
            </button>
            <button className="button-primary ai-send-btn" type="submit" disabled={isSending || isRecording || !inputText.trim()}>
              {t('ai.sendButton')}
            </button>
          </form>
        )}
      </div>

      {error && error.includes('unavailable') && (
        <div className="mt-4 text-center">
          <button className="link-button" onClick={() => onNavigate('assessment')}>{t('ai.useManualAssessment')}</button>
        </div>
      )}
    </div>
  )
}

export default AiAssistantPage
