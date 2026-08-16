// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useExpert } from '../context/ExpertContext'
import { InterviewPage as InterviewPageComponent } from '../components/expert/InterviewPages'
import { StatusMessage } from '../components/general/StatusMessage'
import { useSpeechRecognition } from '../hooks/useSpeechRecognition'
import * as api from '../services/api'

export default function InterviewPage() {
  const { sessionId: urlSessionId } = useParams()
  const navigate = useNavigate()
  
  const { token, status, showStatus } = useAuth()
  const { setMySessions, setPausedSessions } = useExpert()

  // Interview state - all local to this component
  const [sessionId, setSessionId] = useState(null)
  const [question, setQuestion] = useState(null)
  const [stepId, setStepId] = useState(null)
  const [answer, setAnswer] = useState('')
  const [stepIndex, setStepIndex] = useState(0)
  const [processName, setProcessName] = useState('')
  const [protocolIntro, setProtocolIntro] = useState('')
  const [sessionLoaded, setSessionLoaded] = useState(false)
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(false)
  
  // Speech recognition
  const { isRecording, toggleRecording } = useSpeechRecognition()
  
  // Prevent concurrent session creation (React 18 Strict Mode double-invoke)
  const isCreatingSession = useRef(false)
  const isResumingSession = useRef(false)
  
  // Callback to append new speech to existing answer text
  const handleSpeechResult = (newText) => {
    setAnswer(prev => {
      const separator = prev && !prev.endsWith(' ') ? ' ' : ''
      return prev + separator + newText.trim()
    })
  }


  const refreshSessions = async () => {
    const updated = await api.getMySessions(token)
    setMySessions(updated)
    setPausedSessions(updated.filter((s) => s.status === 'paused'))
    return updated
  }

  const initializeSession = async (session) => {
    setSessionId(session.id)
    setProcessName(session.process_name || '')
    setProtocolIntro(session.interview_intro || '')
    setStepIndex(session.current_step_index || 0)
    try {
      setIsLoadingQuestion(true)
      const nextQ = await api.getNextQuestion(token, session.id)
      if (nextQ?.message) {
        showStatus(nextQ.message, 'info')
      }
      setQuestion(nextQ.question)
      setStepId(nextQ.step_id || null)
      setAnswer('')
      return nextQ
    } finally {
      setIsLoadingQuestion(false)
    }
  }

  const initializeSessionById = async (id) => {
    setSessionId(id)
    try {
      setIsLoadingQuestion(true)
      const nextQ = await api.getNextQuestion(token, id)
      if (nextQ?.message) {
        showStatus(nextQ.message, 'info')
      }
      setQuestion(nextQ.question)
      setStepId(nextQ.step_id || null)
      setAnswer('')
      setStepIndex(nextQ.current_step_index || 0)
      return nextQ
    } finally {
      setIsLoadingQuestion(false)
    }
  }

  const introText = (protocolIntro || '').trim() || (processName
    ? `Welcome to this interview round for "${processName}". In this round, please focus on concrete steps, decisions, and handovers from your role.`
    : 'Welcome to this interview round. Please focus on concrete steps, decisions, and handovers from your role.')

  // Load session from URL if not in context
  useEffect(() => {
    // Prevent loading the same session twice
    if (sessionLoaded) return

    const loadSession = async () => {
      try {
        setSessionLoaded(true)
        const mySessions = await api.getMySessions(token)
        
        // First check if urlSessionId is a session ID (for resuming paused sessions)
        const existingSessionById = mySessions.find(s => s.id === urlSessionId)
        
        if (existingSessionById) {
          // Found a session by ID - activate if not already active
          if (existingSessionById.status !== 'active') {
            // Prevent double-invoke from React StrictMode
            if (isResumingSession.current) {
              return
            }
            isResumingSession.current = true
            
            try {
              if (existingSessionById.status === 'paused') {
                await api.resumeSession(token, existingSessionById.id)
                await initializeSession(existingSessionById)
                return
              } else if (existingSessionById.status === 'protocol_created') {
                await api.activateSession(token, existingSessionById.id)
              }
            } catch (e) {
              // If activation fails because already active (concurrent tabs), that's OK
              if (e.status !== 400) {
                showStatus(`Error activating session: ${e.message}`, 'error')
                navigate('/sessions')
                return
              }
            } finally {
              isResumingSession.current = false
            }
          }
          
          await initializeSession(existingSessionById)
        } else {
          // urlSessionId might be a protocol_created session ID
          const protocolSession = mySessions.find(s => s.id === urlSessionId && s.status === 'protocol_created')
          
          if (protocolSession) {
            // Activate the protocol_created session
            // Prevent duplicate creation if already in progress
            if (isCreatingSession.current) {
              return
            }

            isCreatingSession.current = true
            try {
              setProcessName(protocolSession.process_name || '')
              setProtocolIntro(protocolSession.interview_intro || '')
              const data = await api.activateSession(token, protocolSession.id)
              await initializeSessionById(data.session_id)

              // Refresh sessions so dashboard hides the protocol_created and shows the active session
              try {
                await refreshSessions()
              } catch (refreshError) {
                // Non-blocking; UI will still proceed
              }
            } finally {
              isCreatingSession.current = false
            }
          } else {
            // Not a session ID or protocol_created session
            showStatus('No active session found', 'error')
            navigate('/sessions')
          }
        }
      } catch (e) {
        console.error('[InterviewPage] loadSession error:', e)
        showStatus(`Error loading session: ${e.message}`, 'error')
        navigate('/sessions')
      }
    }

    if (urlSessionId && token && !sessionLoaded) {
      loadSession()
    }
  }, [urlSessionId, token, sessionLoaded, showStatus, navigate, setMySessions, setPausedSessions])

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) {
      showStatus('Please enter an answer', 'error')
      return
    }

    try {
      setIsLoadingQuestion(true)
      // Submit answer (increments step)
      const data = await api.submitAnswer(token, sessionId, {
        text: answer,
        step_id: stepId,
        question
      })
      
      // Get next question
      const nextQ = await api.getNextQuestion(token, sessionId)
      if (nextQ?.message) {
        showStatus(nextQ.message, 'info')
      }
      
      if (nextQ.done) {
        // Refresh from server to reflect backend status updates
        try {
          const latest = await refreshSessions()
          setMySessions(latest)
          setPausedSessions(latest.filter(s => s.status === 'paused'))
        } catch (refreshErr) {
          // If refresh fails, keep local completion state
        }
        navigate(`/interview/${sessionId}/completed`)
      } else {
        setQuestion(nextQ.question)
        setStepId(nextQ.step_id || null)
        setAnswer('')
        setStepIndex(nextQ.current_step_index)
      }
    } catch (e) {
      showStatus(`Error: ${e.message}`, 'error')
    } finally {
      setIsLoadingQuestion(false)
    }
  }

  const handlePauseSession = async () => {
    if (!sessionId) return
    
    try {
      await api.pauseSession(token, sessionId)
      
      // Refresh sessions from server to ensure we have the correct state
      try {
        await refreshSessions()
      } catch (refreshErr) {
        // Non-blocking; UI will proceed to redirect
      }
      
      showStatus('Session paused', 'success')
      navigate('/sessions')
    } catch (e) {
      showStatus(`Error pausing session: ${e.message}`, 'error')
    }
  }

  if (!sessionId || !question) {
    return <div style={{ padding: '20px' }}>Loading interview...</div>
  }

  return (
    <div style={{ padding: '20px' }}>
      <StatusMessage message={status.message} type={status.type} />
      
      <InterviewPageComponent
        sessionId={sessionId}
        stepIndex={stepIndex}
        question={question}
        introText={introText}
        answer={answer}
        onAnswerChange={setAnswer}
        onSubmit={handleSubmitAnswer}
        onPause={handlePauseSession}
        onMicToggle={() => {
          toggleRecording(handleSpeechResult)
        }}
        isRecording={isRecording}
        loading={isLoadingQuestion}
      />
    </div>
  )
}
