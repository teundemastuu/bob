// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import React, { useEffect, useState } from 'react'

export default function ProtocolModal({
  open,
  protocol,
  feedback,
  onFeedbackChange,
  category,
  onCategoryChange,
  length,
  onLengthChange,
  followupCount,
  onFollowupCountChange,
  additionalInfo,
  onAdditionalInfoChange,
  unresolvedInconsistencies,
  selectedInconsistencyIds,
  onSelectedInconsistencyIdsChange,
  unresolvedKnowledgeGaps,
  selectedGapIds,
  onSelectedGapIdsChange,
  onSubmitFeedback,
  onGenerateAgain,
  onGenerate,
  onSaveDraft,
  allowDynamicFollowup,
  onAllowDynamicFollowupChange,
  onProceed,
  onCancel,
  loading,
  feedbackSending,
  roundNumber,
  expertEmail,
}) {
  if (!open) return null

  const [showGenerationParams, setShowGenerationParams] = useState(!protocol)
  const [openFollowups, setOpenFollowups] = useState({})
  const [isEditing, setIsEditing] = useState(false)
  const [editableProtocol, setEditableProtocol] = useState(protocol || null)
  const [showInconsistencies, setShowInconsistencies] = useState(false)
  const [showKnowledgeGaps, setShowKnowledgeGaps] = useState(false)

  useEffect(() => {
    setShowGenerationParams(!protocol)
    setEditableProtocol(protocol || null)
    setIsEditing(false)
    setShowInconsistencies(false)
    setShowKnowledgeGaps(false)
  }, [protocol])

  const purpose = protocol?.purpose || null
  const questions = protocol?.questions || []
  const expertIntro = protocol?.expert_intro || ''
  const editablePurpose = editableProtocol?.purpose || null
  const editableQuestions = editableProtocol?.questions || []
  const editableExpertIntro = editableProtocol?.expert_intro || ''

  const renderBoldText = (text) => {
    if (!text) return null
    const parts = String(text).split(/\*\*(.+?)\*\*/g)
    return parts.map((part, index) =>
      index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>
    )
  }

  const updateEditable = (path, value) => {
    setEditableProtocol((prev) => {
      const base = prev ? JSON.parse(JSON.stringify(prev)) : { expert_intro: '', purpose: {}, questions: [] }
      let cursor = base
      for (let i = 0; i < path.length - 1; i += 1) {
        const key = path[i]
        if (cursor[key] === undefined) {
          cursor[key] = typeof path[i + 1] === 'number' ? [] : {}
        }
        cursor = cursor[key]
      }
      cursor[path[path.length - 1]] = value
      return base
    })
  }

  return (
    <div style={styles.backdrop}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <div>
            <div style={styles.title}>Review Protocol</div>
            <div style={styles.subtitle}>
              Target: {expertEmail || 'Expert'} • Round {roundNumber || 1}
            </div>
          </div>
          
        </div>

        <div style={styles.content}>
          {protocol && !showGenerationParams && (
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <button
                onClick={() => {
                  onGenerateAgain?.()
                  setShowGenerationParams(true)
                }}
                className="secondary"
                disabled={loading}
              >
                Generate again
              </button>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="secondary"
                  disabled={loading}
                >
                  Edit protocol
                </button>
              )}
              {isEditing && (
                <>
                  <button
                    onClick={() => onSaveDraft?.(editableProtocol)}
                    className="secondary"
                    disabled={loading || !protocol}
                  >
                    Save edits
                  </button>
                  <button
                    onClick={() => {
                      setEditableProtocol(protocol || null)
                      setIsEditing(false)
                    }}
                    className="secondary"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
          )}

          {showGenerationParams && (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <div style={styles.sectionLabel}>
                    Category
                    <span
                      style={styles.infoIcon}
                      title="Discovery: Explore unknown process parts and focus on selected knowledge gaps. Validation: verify the current model and resolve selected inconsistencies."
                      aria-label="Category info"
                    >
                      i
                    </span>
                  </div>
                  <select
                    value={category}
                    onChange={(e) => onCategoryChange(e.target.value)}
                    style={styles.select}
                    disabled={loading}
                  >
                    <option value="discovery">Discovery</option>
                    <option value="validation">Validation</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.sectionLabel}>Length</div>
                  <select
                    value={length}
                    onChange={(e) => onLengthChange(e.target.value)}
                    style={styles.select}
                    disabled={loading}
                  >
                    <option value="short">Short</option>
                    <option value="medium">Medium</option>
                    <option value="long">Long</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={styles.sectionLabel}>
                    Follow-ups
                    <span
                      style={styles.infoIcon}
                      title="Follow-ups are the number of possible follow-up scenarios the LLM should consider."
                      aria-label="Follow-ups info"
                    >
                      i
                    </span>
                  </div>
                  <select
                    value={followupCount}
                    onChange={(e) => onFollowupCountChange(Number(e.target.value))}
                    style={styles.select}
                    disabled={loading}
                  >
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <div style={styles.sectionLabel}>Additional protocol generation wishes</div>
                <textarea
                  value={additionalInfo}
                  onChange={(e) => onAdditionalInfoChange(e.target.value)}
                  placeholder="Any extra context to consider during protocol generation..."
                  style={styles.textarea}
                  rows={3}
                  disabled={loading}
                />
              </div>

              {category === 'validation' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={styles.sectionLabel}>Unresolved inconsistencies to target in this interview</div>
                  {!unresolvedInconsistencies?.length && (
                    <div style={styles.stepBody}>No unresolved inconsistencies detected.</div>
                  )}
                  {!!unresolvedInconsistencies?.length && (
                    <>
                      <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setShowInconsistencies((prev) => !prev)}
                          style={styles.followupToggle}
                          disabled={loading}
                        >
                          {showInconsistencies ? 'Unshow inconsistencies' : 'Show inconsistencies'}
                        </button>
                        <span style={styles.stepBody}>Selected: {selectedInconsistencyIds?.length || 0}</span>
                      </div>
                      {showInconsistencies && (
                        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px' }}>
                          {unresolvedInconsistencies.map((item) => {
                            const checked = selectedInconsistencyIds?.includes(item.id)
                            return (
                              <label key={item.id} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...(selectedInconsistencyIds || []), item.id]
                                      : (selectedInconsistencyIds || []).filter((id) => id !== item.id)
                                    onSelectedInconsistencyIdsChange(next)
                                  }}
                                  disabled={loading}
                                  style={{ marginRight: '8px' }}
                                />
                                <strong>{item.title}</strong>
                                <div style={styles.stepBody}>{item.description}</div>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {category === 'discovery' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={styles.sectionLabel}>Unresolved knowledge gaps to target in this interview</div>
                  {!unresolvedKnowledgeGaps?.length && (
                    <div style={styles.stepBody}>No unresolved knowledge gaps detected.</div>
                  )}
                  {!!unresolvedKnowledgeGaps?.length && (
                    <>
                      <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <button
                          type="button"
                          onClick={() => setShowKnowledgeGaps((prev) => !prev)}
                          style={styles.followupToggle}
                          disabled={loading}
                        >
                          {showKnowledgeGaps ? 'Unshow knowledge gaps' : 'Show knowledge gaps'}
                        </button>
                        <span style={styles.stepBody}>Selected: {selectedGapIds?.length || 0}</span>
                      </div>
                      {showKnowledgeGaps && (
                        <div style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid #d1d5db', borderRadius: '6px', padding: '8px' }}>
                          {unresolvedKnowledgeGaps.map((item) => {
                            const checked = selectedGapIds?.includes(item.id)
                            return (
                              <label key={item.id} style={{ display: 'block', marginBottom: '8px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={(e) => {
                                    const next = e.target.checked
                                      ? [...(selectedGapIds || []), item.id]
                                      : (selectedGapIds || []).filter((id) => id !== item.id)
                                    onSelectedGapIdsChange(next)
                                  }}
                                  disabled={loading}
                                  style={{ marginRight: '8px' }}
                                />
                                <strong>{item.title}</strong>
                                <div style={styles.stepBody}>{item.description}</div>
                              </label>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              <div style={styles.sectionLabel}>Protocol Steps</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button onClick={onGenerate} className="secondary" disabled={loading}>
                  {loading ? 'Generating…' : 'Generate Protocol'}
                </button>
              </div>
            </>
          )}
          <div style={styles.stepsBox}>
            {loading && <div>Loading protocol…</div>}
            {!loading && !protocol && <div>No protocol yet. Click Generate to create a draft.</div>}
            {!loading && protocol && !purpose && questions.length === 0 && (
              <div>No content found in protocol.</div>
            )}

            {!loading && !isEditing && !!expertIntro && (
              <div style={styles.stepCard}>
                <div style={styles.stepTitle}>Expert introduction</div>
                <div style={styles.stepBody}>{renderBoldText(expertIntro)}</div>
              </div>
            )}

            {!loading && isEditing && (
              <div style={styles.stepCard}>
                <div style={styles.stepTitle}>Expert introduction</div>
                <div style={styles.stepBody}>
                  <textarea
                    value={editableExpertIntro}
                    onChange={(e) => updateEditable(['expert_intro'], e.target.value)}
                    style={styles.textarea}
                    rows={3}
                  />
                </div>
              </div>
            )}

            {!loading && purpose && !isEditing && (
              <div style={styles.stepCard}>
                <div style={styles.stepTitle}>Purpose</div>
                {purpose.goal && (
                  <div style={styles.stepBody}><strong>Goal:</strong> {renderBoldText(purpose.goal)}</div>
                )}
                {purpose.known && (
                  <div style={styles.stepBody}><strong>Known:</strong> {renderBoldText(purpose.known)}</div>
                )}
                {purpose.unknown && (
                  <div style={styles.stepBody}><strong>Unknown:</strong> {renderBoldText(purpose.unknown)}</div>
                )}
              </div>
            )}

            {!loading && editablePurpose && isEditing && (
              <div style={styles.stepCard}>
                <div style={styles.stepTitle}>Purpose</div>
                <div style={styles.stepBody}>
                  <strong>Goal:</strong>
                  <textarea
                    value={editablePurpose.goal || ''}
                    onChange={(e) => updateEditable(['purpose', 'goal'], e.target.value)}
                    style={styles.textarea}
                    rows={2}
                  />
                </div>
                <div style={styles.stepBody}>
                  <strong>Known:</strong>
                  <textarea
                    value={editablePurpose.known || ''}
                    onChange={(e) => updateEditable(['purpose', 'known'], e.target.value)}
                    style={styles.textarea}
                    rows={2}
                  />
                </div>
                <div style={styles.stepBody}>
                  <strong>Unknown:</strong>
                  <textarea
                    value={editablePurpose.unknown || ''}
                    onChange={(e) => updateEditable(['purpose', 'unknown'], e.target.value)}
                    style={styles.textarea}
                    rows={2}
                  />
                </div>
              </div>
            )}

            {!loading && !isEditing && questions.map((q, idx) => (
              <div key={q.id || idx} style={styles.stepCard}>
                <div style={styles.stepTitle}>Question {idx + 1}</div>
                {q.question && (
                  <div style={styles.stepBody}>
                    <strong>Question:</strong> {renderBoldText(q.question)}
                    {q.reason && (
                      <span style={styles.infoIcon} title={q.reason} aria-label="Reason">
                        i
                      </span>
                    )}
                  </div>
                )}
                {Array.isArray(q.followups) && q.followups.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenFollowups((prev) => ({
                          ...prev,
                          [q.id || idx]: !prev[q.id || idx]
                        }))
                      }
                      style={styles.followupToggle}
                    >
                      {openFollowups[q.id || idx] ? 'Unshow follow-ups' : 'Show follow-ups'}
                    </button>
                    {openFollowups[q.id || idx] && (
                      <div style={{ marginTop: '8px' }}>
                        <div style={styles.sectionLabel}>Follow-ups</div>
                        {q.followups.map((f, fIdx) => (
                          <div key={f.id || fIdx} style={{ marginBottom: '8px' }}>
                            {f.scenario && (
                              <div style={styles.stepBody}><strong>Scenario:</strong> {renderBoldText(f.scenario)}</div>
                            )}
                            {f.question && (
                              <div style={styles.stepBody}>
                                <strong>Question:</strong> {renderBoldText(f.question)}
                                {f.reason && (
                                  <span style={styles.infoIcon} title={f.reason} aria-label="Reason">
                                    i
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {!loading && isEditing && editableQuestions.map((q, idx) => (
              <div key={q.id || idx} style={styles.stepCard}>
                <div style={styles.stepTitle}>Question {idx + 1}</div>
                <div style={styles.stepBody}>
                  <strong>Question:</strong>
                  <textarea
                    value={q.question || ''}
                    onChange={(e) => updateEditable(['questions', idx, 'question'], e.target.value)}
                    style={styles.textarea}
                    rows={2}
                  />
                </div>
                <div style={styles.stepBody}>
                  <strong>Reason:</strong>
                  <textarea
                    value={q.reason || ''}
                    onChange={(e) => updateEditable(['questions', idx, 'reason'], e.target.value)}
                    style={styles.textarea}
                    rows={2}
                  />
                </div>
                {Array.isArray(q.followups) && q.followups.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={styles.sectionLabel}>Follow-ups</div>
                    {q.followups.map((f, fIdx) => (
                      <div key={f.id || fIdx} style={{ marginBottom: '8px' }}>
                        <div style={styles.stepBody}>
                          <strong>Scenario:</strong>
                          <textarea
                            value={f.scenario || ''}
                            onChange={(e) => updateEditable(['questions', idx, 'followups', fIdx, 'scenario'], e.target.value)}
                            style={styles.textarea}
                            rows={2}
                          />
                        </div>
                        <div style={styles.stepBody}>
                          <strong>Question:</strong>
                          <textarea
                            value={f.question || ''}
                            onChange={(e) => updateEditable(['questions', idx, 'followups', fIdx, 'question'], e.target.value)}
                            style={styles.textarea}
                            rows={2}
                          />
                        </div>
                        <div style={styles.stepBody}>
                          <strong>Reason:</strong>
                          <textarea
                            value={f.reason || ''}
                            onChange={(e) => updateEditable(['questions', idx, 'followups', fIdx, 'reason'], e.target.value)}
                            style={styles.textarea}
                            rows={2}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {protocol && !showGenerationParams && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ marginBottom: '12px' }}>
                <label style={styles.optionRow}>
                  <input
                    type="checkbox"
                    checked={!!allowDynamicFollowup}
                    onChange={(e) => onAllowDynamicFollowupChange?.(e.target.checked)}
                    disabled={loading || isEditing}
                    style={{ marginRight: '8px' }}
                  />
                  <span style={styles.stepBody}>
                    Allow the LLM to ask its own follow-up question when no scenario follow-up applies.
                  </span>
                </label>
              </div>
              <div style={styles.sectionLabel}>Feedback (optional)</div>
              <textarea
                value={feedback}
                onChange={(e) => onFeedbackChange(e.target.value)}
                placeholder="Add requested changes to this protocol..."
                style={styles.textarea}
                rows={4}
              />
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={onSubmitFeedback}
                  className="secondary"
                  disabled={loading || feedbackSending || !feedback.trim() || showGenerationParams || isEditing}
                >
                  {feedbackSending ? 'Sending…' : 'Send Feedback'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={styles.footer}>
          <button onClick={onCancel} className="secondary" disabled={loading || feedbackSending}>Cancel</button>
          <button onClick={onProceed} disabled={loading || !protocol}>
            {loading ? 'Creating…' : 'Proceed'}
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '16px',
  },
  modal: {
    background: '#fff',
    borderRadius: '10px',
    width: 'min(900px, 100%)',
    maxHeight: '90vh',
    boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px 12px',
    borderBottom: '1px solid #eee',
  },
  title: { fontSize: '18px', fontWeight: 700 },
  subtitle: { fontSize: '13px', color: '#666', marginTop: '4px' },
  content: { padding: '14px 20px 4px', overflowY: 'auto' },
  sectionLabel: { fontSize: '13px', fontWeight: 600, color: '#555', marginBottom: '6px' },
  stepsBox: {
    border: '1px solid #e5e5e5',
    borderRadius: '8px',
    padding: '12px',
    maxHeight: '45vh',
    overflowY: 'auto',
    background: '#fafafa',
  },
  stepCard: {
    padding: '10px',
    borderRadius: '6px',
    background: '#fff',
    border: '1px solid #eee',
    marginBottom: '8px',
  },
  stepTitle: { fontWeight: 600, marginBottom: '6px' },
  stepBody: { color: '#444', lineHeight: 1.4 },
  infoIcon: {
    marginLeft: '8px',
    cursor: 'help',
    color: '#2c3e50',
    fontSize: '11px',
    fontWeight: 700,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '1px solid #cfd6dd',
    background: '#f5f7f9',
    verticalAlign: 'middle',
  },
  followupToggle: {
    background: 'transparent',
    border: 'none',
    padding: 0,
    color: '#2c3e50',
    fontSize: '13px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  textarea: {
    width: '100%',
    resize: 'vertical',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    fontSize: '14px',
  },
  select: {
    width: '100%',
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    fontSize: '14px',
    background: '#fff',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    padding: '12px 20px 16px',
    borderTop: '1px solid #eee',
  },
  optionRow: {
    display: 'flex',
    alignItems: 'flex-start',
    cursor: 'pointer',
  },
}
