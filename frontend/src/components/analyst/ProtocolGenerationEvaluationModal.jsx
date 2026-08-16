// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { useState } from 'react'
import { createPortal } from 'react-dom'

const ratingOptions = ['1 Strongly Disagree', '2 Disagree', '3 Neutral', '4 Agree', '5 Strongly Agree', 'na']

const defaultRatings = {
  role_relevance: '3 Neutral',
  follow_up_quality: '3 Neutral',
  building: '3 Neutral',
  ready_for_use: '3 Neutral',
}

function RatingRow({ label, value, onChange, disabled }) {
  return (
    <div style={{ marginBottom: '10px' }}>
      <div style={{ fontSize: '13px', marginBottom: '6px', color: '#334155' }}>{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '8px',
          border: '1px solid #cbd5e1',
          borderRadius: '6px',
          background: '#fff',
        }}
      >
        {ratingOptions.map((n) => (
          <option key={n} value={String(n)}>{n === 'na' ? 'N.A.' : n}</option>
        ))}
      </select>
    </div>
  )
}

export default function ProtocolGenerationEvaluationModal({
  open,
  target,
  loading,
  onSubmit,
  onClose,
}) {
  const [ratings, setRatings] = useState(defaultRatings)
  const [motivation, setMotivation] = useState('')

  if (!open) return null

  const submit = async () => {
    const saved = await onSubmit?.({ ...ratings, evaluation_motivation: motivation.trim() })
    if (saved) {
      setRatings(defaultRatings)
      setMotivation('')
    }
  }

  const close = () => {
    setRatings(defaultRatings)
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
      <div style={{ fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Protocol Evaluation</div>
      <div style={{ fontSize: '12px', color: '#475569', marginBottom: '10px' }}>
        {target?.expertEmail || 'Expert'} • Round {target?.roundNumber || 1}
      </div>

      <RatingRow
        label="The generated protocol is relevant for the role of the domain expert in this
process."
        value={ratings.role_relevance}
        onChange={(v) => setRatings((prev) => ({ ...prev, role_relevance: v }))}
        disabled={loading}
      />
      <RatingRow
        label="The proposed follow-up scenarios are useful."
        value={ratings.follow_up_quality}
        onChange={(v) => setRatings((prev) => ({ ...prev, follow_up_quality: v }))}
        disabled={loading}
      />
      <RatingRow
        label="The generated protocol appropriately built upon the information already
gathered from previous interviews."
        value={ratings.building}
        onChange={(v) => setRatings((prev) => ({ ...prev, building: v }))}
        disabled={loading}
      />
      <RatingRow
        label="The generated protocol is ready for use."
        value={ratings.ready_for_use}
        onChange={(v) => setRatings((prev) => ({ ...prev, ready_for_use: v }))}
        disabled={loading}
      />

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
