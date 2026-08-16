// Initial code drafted in discussion with GitHub Copilot (April 2026)
// Modified and validated by Teun de Mast.
import { useState, useRef, useCallback } from 'react'

export function useSpeechRecognition() {
  const [isRecording, setIsRecording] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)
  const finalTranscriptRef = useRef('')

  const startRecording = useCallback((onResult) => {
    // Check browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognition) {
      console.error('[useSpeechRecognition] Speech recognition API not available')
      alert('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.')
      return
    }

    try {
      finalTranscriptRef.current = ''
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onstart = () => {
        setIsRecording(true)
        setTranscript('')
      }

      recognition.onresult = (event) => {
        let interimTranscript = ''
        let newFinalTranscript = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            newFinalTranscript += transcript + ' '
          } else {
            interimTranscript += transcript
          }
        }

        if (newFinalTranscript) {
          finalTranscriptRef.current += newFinalTranscript
        }

        const fullTranscript = finalTranscriptRef.current + interimTranscript
        setTranscript(fullTranscript)

        if (onResult && newFinalTranscript) {
          onResult(newFinalTranscript)
        }
      }

      recognition.onerror = (event) => {
        console.error('[useSpeechRecognition] Error event:', event.error, event.message)
        setIsRecording(false)
        if (event.error === 'not-allowed') {
          alert('Microphone access denied. Please allow microphone access in your browser settings.')
        } else if (event.error === 'no-speech') {
          // Silently handle no speech detected
        } else {
          alert(`Speech recognition error: ${event.error}`)
        }
      }

      recognition.onend = () => {
        setIsRecording(false)
      }

      recognition.start()
      recognitionRef.current = recognition
    } catch (error) {
      console.error('[useSpeechRecognition] Error starting recognition:', error)
      alert('Failed to start speech recognition. Please check your microphone permissions.')
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    setIsRecording(false)
    finalTranscriptRef.current = ''
  }, [])

  const toggleRecording = useCallback((onResult) => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording(onResult)
    }
  }, [isRecording, startRecording, stopRecording])

  return {
    isRecording,
    transcript,
    startRecording,
    stopRecording,
    toggleRecording
  }
}
