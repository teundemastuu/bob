// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import InterviewCompletionEvaluationModal from '../components/expert/InterviewCompletionEvaluationModal'
import * as api from '../services/api'

export default function CompletedPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { token, showStatus } = useAuth()

  const [evaluationModalOpen, setEvaluationModalOpen] = useState(false)
  const [evaluationTarget, setEvaluationTarget] = useState(null)
  const [evaluationSaving, setEvaluationSaving] = useState(false)

  useEffect(() => {
    const loadSession = async () => {
      if (!token || !sessionId) return
      try {
        const sessions = await api.getMySessions(token)
        const current = sessions.find((item) => item.id === sessionId)
        if (current) {
          setEvaluationTarget(current)
          setEvaluationModalOpen(true)
        }
      } catch (e) {
        // Non-blocking: the page still works without the prompt
      }
    }

    loadSession()
  }, [token, sessionId])

  const handleSubmitEvaluation = async (payload) => {
    if (!token || !evaluationTarget) return false
    try {
      setEvaluationSaving(true)
      await api.submitInterviewCompletionEvaluation(token, {
        session_id: evaluationTarget.id,
        interview_questions_understandable: payload.interview_questions_understandable,
        interview_relevant_to_role: payload.interview_relevant_to_role,
        interview_helped_explain_part: payload.interview_helped_explain_part,
        evaluation_motivation: payload.evaluation_motivation || '',
      })
      showStatus?.('Interview evaluation saved', 'success')
      setEvaluationModalOpen(false)
      setEvaluationTarget(null)
      return true
    } catch (e) {
      showStatus?.(`Error saving interview evaluation: ${e.message}`, 'error')
      return false
    } finally {
      setEvaluationSaving(false)
    }
  }

  const handleCloseEvaluation = () => {
    setEvaluationModalOpen(false)
    setEvaluationTarget(null)
  }

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Interview Completed</h1>
      <p style={{ fontSize: '18px', marginTop: '20px' }}>
        Thank you for completing the interview! Your responses have been saved.
      </p>
      <button 
        onClick={() => navigate('/sessions')} 
        style={{ marginTop: '30px', padding: '10px 20px', fontSize: '16px' }}
      >
        Return to Processes
      </button>

      <InterviewCompletionEvaluationModal
        open={evaluationModalOpen}
        target={evaluationTarget}
        loading={evaluationSaving}
        onSubmit={handleSubmitEvaluation}
        onClose={handleCloseEvaluation}
      />
    </div>
  )
}
