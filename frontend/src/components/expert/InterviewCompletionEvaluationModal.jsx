// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { useState } from 'react'
import { createPortal } from 'react-dom'

const ratingOptions = ['1 Strongly Disagree', '2 Disagree', '3 Neutral', '4 Agree', '5 Strongly Agree', 'na']

const defaultRating = '3 Neutral'

export default function InterviewCompletionEvaluationModal({
  open,
  target,
  loading,
  onSubmit,
  onClose,
}) {
  const [rating, setRating] = useState(defaultRating)
  const [roleRating, setRoleRating] = useState(defaultRating)
  const [explainRating, setExplainRating] = useState(defaultRating)
  const [motivation, setMotivation] = useState('')

  if (!open) return null

  const submit = async () => {
    const saved = await onSubmit?.({
      interview_questions_understandable: rating,
      interview_relevant_to_role: roleRating,
      interview_helped_explain_part: explainRating,
      evaluation_motivation: motivation.trim(),
    })
    if (saved) {
      setRating(defaultRating)
      setRoleRating(defaultRating)
      setExplainRating(defaultRating)
      setMotivation('')
    }
  }

  const close = () => {
    setRating(defaultRating)
    setRoleRating(defaultRating)
    setExplainRating(defaultRating)
    setMotivation('')
    onClose?.()
  }

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        right: '12px',
        top: '100px',
        width: 'min(320px, calc(100vw - 24px))',
        zIndex: 2100,
        background: '#f8fafc',
        border: '1px solid #dbeafe',
        borderRadius: '10px',
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
        padding: '14px',
      }}
    >
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Interview evaluation</div>
      <div style={{ fontSize: '12px', color: '#475569', marginBottom: '10px' }}>
        {target?.processName || 'Process'} • Round {target?.roundNumber || 1}
      </div>

      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '13px', marginBottom: '6px', color: '#334155' }}>
          The interview questions were understandable.
        </div>
        <select
          value={rating}
          onChange={(e) => setRating(e.target.value)}
          disabled={loading}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#fff',
          }}
        >
          {ratingOptions.map((option) => (
            <option key={option} value={String(option)}>{option === 'na' ? 'N.A.' : option}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '13px', marginBottom: '6px', color: '#334155' }}>
          The interview questions were relevant to my role in the process.
        </div>
        <select
          value={roleRating}
          onChange={(e) => setRoleRating(e.target.value)}
          disabled={loading}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#fff',
          }}
        >
          {ratingOptions.map((option) => (
            <option key={option} value={String(option)}>{option === 'na' ? 'N.A.' : option}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '13px', marginBottom: '6px', color: '#334155' }}>
          The interview helped me explain my part of the process effectively.
        </div>
        <select
          value={explainRating}
          onChange={(e) => setExplainRating(e.target.value)}
          disabled={loading}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#fff',
          }}
        >
          {ratingOptions.map((option) => (
            <option key={option} value={String(option)}>{option === 'na' ? 'N.A.' : option}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '13px', marginBottom: '6px', color: '#334155' }}>
          Optional motivation
        </div>
        <textarea
          value={motivation}
          onChange={(e) => setMotivation(e.target.value)}
          placeholder="Why did you rate it this way?"
          disabled={loading}
          rows={3}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            background: '#fff',
            resize: 'vertical',
            minHeight: '80px',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
        <button
          onClick={submit}
          disabled={loading}
          style={{ flex: 1, marginBottom: 0, padding: '8px 12px' }}
        >
          {loading ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={close}
          className="secondary"
          disabled={loading}
          style={{ width: '90px', marginBottom: 0, padding: '8px 12px' }}
        >
          Skip
        </button>
      </div>
    </div>
  )

  if (typeof document === 'undefined') {
    return modalContent
  }

  return createPortal(modalContent, document.body)
}