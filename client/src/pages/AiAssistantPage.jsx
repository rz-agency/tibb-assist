import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { confirmAiAssessment, createReferral, sendAiMessage } from '../api/api'
import StatusMessage from '../components/StatusMessage'

const RISK_LABEL_KEY = { GREEN: 'assessment.riskGreen', YELLOW: 'assessment.riskYellow', RED: 'assessment.riskRed' }

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition

function getSpeechLang(i18nLang) {
  if (i18nLang === 'ur') return 'ur-PK'
  if (i18nLang === 'en') return 'en-US'
  return i18nLang
}

function cleanSymptomLabel(name) {
  const cleaned = name.replace(/^(Severe|Heavy)\s+/i, '').trim()
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : cleaned
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
  const [selectedFacilityId, setSelectedFacilityId] = useState('')
  const [referralNotes, setReferralNotes] = useState('')
  const [referralSubmitting, setReferralSubmitting] = useState(false)
  const [referralSuccess, setReferralSuccess] = useState('')
  const [referralError, setReferralError] = useState('')
  const [error, setError] = useState('')

  const mediaRecorderRef = useRef(null)
  const recognitionRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const confirmSectionRef = useRef(null)
  const resultSectionRef = useRef(null)
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
      if (result.facilities?.length > 0) {
        setSelectedFacilityId(result.facilities[0].id)
      }
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

  const submitReferral = async (event) => {
    event.preventDefault()
    setReferralError('')
    setReferralSuccess('')
    setReferralSubmitting(true)
    try {
      await createReferral({
        assessmentId: assessment.id,
        facilityId: Number(selectedFacilityId),
        notes: referralNotes || null,
      })
      setReferralSuccess(t('assessment.referralSuccess'))
    } catch (requestError) {
      setReferralError(requestError.message)
    } finally {
      setReferralSubmitting(false)
    }
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
    setReferralSuccess('')
    setReferralError('')
    setError('')
  }

  if (user.role !== 'WOMAN') {
    return <section className="content-panel"><h1 className="section-title">{t('ai.pageTitle')}</h1><p className="mt-3 text-slate-600">{t('ai.entryRestriction')}</p></section>
  }

  const showResult = phase === 'result' && assessment

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <p className="eyebrow">{t('ai.pageTitle')}</p>
        <h1 className="page-title">{t('ai.subtitle')}</h1>
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
                  <p className="mt-1 text-xs text-slate-400">{t('ai.transcribed')}: {msg.transcribed}</p>
                )}
                {isUser && msg.type === 'voice' && (
                  <span className="mt-1 inline-block text-xs text-slate-400">🎤 {t('ai.voiceLabel')}</span>
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

          {showResult && (
            <div className="ai-result-section" ref={resultSectionRef}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="detail-label">{t('assessment.riskLevel')}</p>
                <span className={`risk-${assessment.riskLevel.toLowerCase()}`}>{t(RISK_LABEL_KEY[assessment.riskLevel])}</span>
              </div>
              <p className="text-xs text-slate-500">{t('assessment.calculatedFromAnswers')}</p>
            </div>
            {aiExplanation && <p className="mt-4 text-slate-700">{aiExplanation}</p>}
            {assessment.pregnancy && <p className="mt-3 text-sm text-slate-600">{t('assessment.linkedPregnancy')} {assessment.pregnancy.pregnancyStatus}</p>}

            <div className="mt-6 border-t border-slate-100 pt-5">
              <h2 className="font-semibold text-slate-900">{t('assessment.recordedAnswers')}</h2>
              <ul className="mt-3 space-y-2">
                {assessment.assessmentSymptoms.filter((s) => s.answerStatus !== 'UNKNOWN').map((item) => (
                  <li className="rounded-lg bg-slate-50 px-3 py-2 text-sm" key={item.id}>
                    <span className="font-medium">{cleanSymptomLabel(item.symptom.name)}</span>
                    <span className="ms-2 text-slate-500">{item.answerStatus}{item.severity ? ` · ${item.severity}` : ''}</span>
                  </li>
                ))}
              </ul>
              {notedSymptoms.length > 0 && (
                <div className="mt-4">
                  <h3 className="text-sm font-medium text-slate-700">{t('assessment.notedSymptoms')}</h3>
                  <p className="mt-1 text-xs text-slate-500">{t('assessment.notedDisclaimer')}</p>
                  <ul className="mt-2 space-y-1">
                    {notedSymptoms.filter((s) => s.answerStatus !== 'UNKNOWN').map((s, i) => (
                      <li className="rounded-lg bg-amber-50 px-3 py-2 text-sm" key={i}>
                        <span className="font-medium">{s.name}</span>
                        <span className="ms-2 text-slate-500">{s.answerStatus}{s.severity ? ` · ${s.severity}` : ''}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {facilities.length > 0 && (
              <div className="mt-6 border-t border-slate-100 pt-5">
                <h2 className="font-semibold text-slate-900">{t('assessment.healthcareReferral')}</h2>
                <p className="mt-2 text-sm text-slate-600">{t('assessment.diagnosisDisclaimer')}</p>
                {referralSuccess && <StatusMessage tone="success">{referralSuccess}</StatusMessage>}
                {!referralSuccess && (
                  <form className="mt-4 space-y-3" onSubmit={submitReferral}>
                    <label className="form-label">{t('assessment.selectFacility')}
                      <select className="form-input" value={selectedFacilityId} onChange={(e) => setSelectedFacilityId(e.target.value)}>
                        {facilities.map((f) => <option key={f.id} value={f.id}>{f.name}{f.city ? ` - ${f.city}` : ''}</option>)}
                      </select>
                    </label>
                    <label className="form-label">{t('assessment.notes')} <span className="font-normal text-slate-400">{t('common.optional')}</span>
                      <textarea className="form-input" rows="2" value={referralNotes} onChange={(e) => setReferralNotes(e.target.value)} />
                    </label>
                    {referralError && <StatusMessage>{referralError}</StatusMessage>}
                    <button className="button-secondary" disabled={referralSubmitting}>
                      {referralSubmitting ? t('assessment.creatingReferral') : t('assessment.createReferral')}
                    </button>
                  </form>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button className="button-primary" onClick={() => onNavigate('dashboard')}>{t('assessment.backToDashboard')}</button>
              <button className="button-secondary" onClick={startNew}>{t('ai.startOver')}</button>
            </div>
          </div>
        )}

        {phase === 'ready' && !showResult && (
          <div className="ai-confirm-section" ref={confirmSectionRef}>
            <p className="font-semibold text-slate-900">{t('ai.confirmTitle')}</p>
            {extractedSymptoms.length > 0 && (
              <ul className="mt-3 space-y-1 text-sm">
                {extractedSymptoms.map((s, i) => (
                  <li className="flex items-center gap-2" key={i}>
                    <span className={`inline-block h-2 w-2 rounded-full ${s.answerStatus === 'PRESENT' ? 'bg-red-400' : s.answerStatus === 'ABSENT' ? 'bg-green-400' : 'bg-slate-300'}`} />
                    <span className="font-medium">{s.code.replace(/_/g, ' ')}</span>
                    <span className="text-slate-500">{s.answerStatus}{s.severity ? ` · ${s.severity}` : ''}</span>
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
