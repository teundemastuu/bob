// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { useEffect, useMemo, useState } from 'react'
import * as api from '../../services/api'

export function KnowledgeTab({
  sessions,
  selectedSession,
  onSelectSession,
  onBackToList,
  token,
  processId,
  onStatusChange
}) {
  const [inconsistencies, setInconsistencies] = useState([])
  const [loadingInconsistencies, setLoadingInconsistencies] = useState(false)
  const [resolvingId, setResolvingId] = useState(null)
  const [ignoringId, setIgnoringId] = useState(null)
  const [analystInputs, setAnalystInputs] = useState({})
  const [inconsistenciesModalOpen, setInconsistenciesModalOpen] = useState(false)
  const [showResolved, setShowResolved] = useState(false)
  const [showIgnored, setShowIgnored] = useState(false)
  const [knowledgeGaps, setKnowledgeGaps] = useState([])
  const [loadingKnowledgeGaps, setLoadingKnowledgeGaps] = useState(false)
  const [resolvingGapId, setResolvingGapId] = useState(null)
  const [ignoringGapId, setIgnoringGapId] = useState(null)
  const [gapInputs, setGapInputs] = useState({})
  const [knowledgeGapsModalOpen, setKnowledgeGapsModalOpen] = useState(false)
  const [showResolvedGaps, setShowResolvedGaps] = useState(false)
  const [showIgnoredGaps, setShowIgnoredGaps] = useState(false)

  const compactButtonStyle = {
    width: 'auto',
    display: 'inline-flex',
    marginBottom: 0,
    padding: '8px 14px'
  }

  const unresolvedCount = useMemo(
    () => inconsistencies.filter(item => item.status === 'unresolved').length,
    [inconsistencies]
  )

  const unresolvedGapsCount = useMemo(
    () => knowledgeGaps.filter(item => item.status === 'unresolved').length,
    [knowledgeGaps]
  )

  const sessionsByExpert = sessions.reduce((acc, session) => {
    const expert = session.expert_email || 'Unknown Expert'
    if (!acc[expert]) acc[expert] = []
    acc[expert].push(session)
    return acc
  }, {})

  const statusColor = (status) => {
    if (status === 'completed') return '#4caf50'
    if (status === 'active') return '#2196f3'
    return '#757575'
  }

  const loadPersistedInconsistencies = async (options = {}, silent = true) => {
    if (!token || !processId) return
    try {
      const result = await api.getKnowledgeInconsistencies(token, processId, {
        showResolved: options.showResolved ?? showResolved,
        showIgnored: options.showIgnored ?? showIgnored
      })
      setInconsistencies(result?.items || [])
      const nextInputs = {}
      ;(result?.items || []).forEach((item) => {
        nextInputs[item.id] = item.analyst_input || ''
      })
      setAnalystInputs(nextInputs)
    } catch (e) {
      if (!silent) {
        onStatusChange?.(`Failed to load inconsistencies: ${e.message}`, 'error')
      }
    }
  }

  useEffect(() => {
    loadPersistedInconsistencies({}, true)
  }, [token, processId, showResolved, showIgnored])

  const loadPersistedKnowledgeGaps = async (options = {}, silent = true) => {
    if (!token || !processId) return
    try {
      const result = await api.getKnowledgeGaps(token, processId, {
        showResolved: options.showResolved ?? showResolvedGaps,
        showIgnored: options.showIgnored ?? showIgnoredGaps
      })
      setKnowledgeGaps(result?.items || [])
      const nextInputs = {}
      ;(result?.items || []).forEach((item) => {
        nextInputs[item.id] = item.analyst_input || ''
      })
      setGapInputs(nextInputs)
    } catch (e) {
      if (!silent) {
        onStatusChange?.(`Failed to load knowledge gaps: ${e.message}`, 'error')
      }
    }
  }

  useEffect(() => {
    loadPersistedKnowledgeGaps({}, true)
  }, [token, processId, showResolvedGaps, showIgnoredGaps])

  const detectInconsistencies = async () => {
    if (!token || !processId) return
    try {
      setLoadingInconsistencies(true)
      const result = await api.detectKnowledgeInconsistencies(token, processId)
      await loadPersistedInconsistencies({}, true)
      setInconsistenciesModalOpen(true)
      onStatusChange?.(`Found ${(result?.items || []).length} inconsistenc${(result?.items || []).length === 1 ? 'y' : 'ies'}.`, 'success')
    } catch (e) {
      onStatusChange?.(`Failed to detect inconsistencies: ${e.message}`, 'error')
    } finally {
      setLoadingInconsistencies(false)
    }
  }

  const resolveInconsistency = async (item) => {
    const analystInput = (analystInputs[item.id] || '').trim()
    if (!analystInput) {
      onStatusChange?.('Please provide how to handle this inconsistency before resolving.', 'error')
      return false
    }
    if (!token || !processId) return false

    try {
      setResolvingId(item.id)
      const result = await api.resolveKnowledgeInconsistency(token, {
        process_id: processId,
        inconsistency_id: item.id,
        title: item.title,
        description: item.description,
        evidence: item.evidence || [],
        analyst_input: analystInput
      })

      const resolvedItem = result?.item
      if (resolvedItem) {
        await loadPersistedInconsistencies({}, true)
      }
      onStatusChange?.('Inconsistency resolved.', 'success')
      return true
    } catch (e) {
      onStatusChange?.(`Failed to resolve inconsistency: ${e.message}`, 'error')
      return false
    } finally {
      setResolvingId(null)
    }
  }

  const ignoreInconsistency = async (item) => {
    if (!token || !processId) return
    try {
      setIgnoringId(item.id)
      await api.ignoreKnowledgeInconsistency(token, processId, item.id)
      await loadPersistedInconsistencies({}, true)
      onStatusChange?.('Inconsistency ignored.', 'success')
    } catch (e) {
      onStatusChange?.(`Failed to ignore inconsistency: ${e.message}`, 'error')
    } finally {
      setIgnoringId(null)
    }
  }

  const unignoreInconsistency = async (item) => {
    if (!token || !processId) return
    try {
      setIgnoringId(item.id)
      await api.unignoreKnowledgeInconsistency(token, processId, item.id)
      await loadPersistedInconsistencies({}, true)
      onStatusChange?.('Inconsistency moved back to unresolved.', 'success')
    } catch (e) {
      onStatusChange?.(`Failed to unignore inconsistency: ${e.message}`, 'error')
    } finally {
      setIgnoringId(null)
    }
  }

  const detectKnowledgeGaps = async () => {
    if (!token || !processId) return
    try {
      setLoadingKnowledgeGaps(true)
      const result = await api.detectKnowledgeGaps(token, processId)
      await loadPersistedKnowledgeGaps({}, true)
      setKnowledgeGapsModalOpen(true)
      onStatusChange?.(`Found ${(result?.items || []).length} knowledge gap${(result?.items || []).length === 1 ? '' : 's'}.`, 'success')
    } catch (e) {
      onStatusChange?.(`Failed to detect knowledge gaps: ${e.message}`, 'error')
    } finally {
      setLoadingKnowledgeGaps(false)
    }
  }

  const resolveKnowledgeGap = async (item) => {
    const analystInput = (gapInputs[item.id] || '').trim()
    if (!analystInput) {
      onStatusChange?.('Please provide how to handle this knowledge gap before resolving.', 'error')
      return false
    }
    if (!token || !processId) return false

    try {
      setResolvingGapId(item.id)
      const result = await api.resolveKnowledgeGap(token, {
        process_id: processId,
        gap_id: item.id,
        title: item.title,
        description: item.description,
        evidence: item.evidence || [],
        analyst_input: analystInput
      })

      const resolvedItem = result?.item
      if (resolvedItem) {
        await loadPersistedKnowledgeGaps({}, true)
      }
      onStatusChange?.('Knowledge gap resolved.', 'success')
      return true
    } catch (e) {
      onStatusChange?.(`Failed to resolve knowledge gap: ${e.message}`, 'error')
      return false
    } finally {
      setResolvingGapId(null)
    }
  }

  const ignoreKnowledgeGap = async (item) => {
    if (!token || !processId) return
    try {
      setIgnoringGapId(item.id)
      await api.ignoreKnowledgeGap(token, processId, item.id)
      await loadPersistedKnowledgeGaps({}, true)
      onStatusChange?.('Knowledge gap ignored.', 'success')
    } catch (e) {
      onStatusChange?.(`Failed to ignore knowledge gap: ${e.message}`, 'error')
    } finally {
      setIgnoringGapId(null)
    }
  }

  const unignoreKnowledgeGap = async (item) => {
    if (!token || !processId) return
    try {
      setIgnoringGapId(item.id)
      await api.unignoreKnowledgeGap(token, processId, item.id)
      await loadPersistedKnowledgeGaps({}, true)
      onStatusChange?.('Knowledge gap moved back to unresolved.', 'success')
    } catch (e) {
      onStatusChange?.(`Failed to unignore knowledge gap: ${e.message}`, 'error')
    } finally {
      setIgnoringGapId(null)
    }
  }

  if (selectedSession) {
    return (
      <div className="process-detail">
        <button onClick={onBackToList} style={{marginBottom: '20px'}}>
          ← Back to Interviews
        </button>
        <h3>Interview with {selectedSession.expert_email}</h3>
        <div className="form-group">
          <label>Status</label>
          <p style={{textTransform: 'capitalize'}}>{selectedSession.status}</p>
        </div>
        <div className="form-group">
          <label>Created</label>
          <p>{new Date(selectedSession.created_at).toLocaleString()}</p>
        </div>
        <div className="form-group">
          <label>Questions & Answers</label>
          {selectedSession.qa_items && selectedSession.qa_items.length > 0 ? (
            <div style={{marginTop: '10px'}}>
              {selectedSession.qa_items.map((qa, idx) => (
                <div key={qa.id} style={{
                  marginBottom: '20px',
                  padding: '15px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  backgroundColor: '#f9f9f9'
                }}>
                  <div style={{marginBottom: '10px'}}>
                    <strong style={{color: '#1976d2'}}>Q{idx + 1}:</strong>
                    <p style={{marginTop: '5px', marginLeft: '10px'}}>{qa.question}</p>
                  </div>
                  <div>
                    <strong style={{color: '#388e3c'}}>A{idx + 1}:</strong>
                    <p style={{marginTop: '5px', marginLeft: '10px'}}>{qa.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{color: '#757575', fontStyle: 'italic'}}>No questions answered yet.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="process-detail">
      <div className="form-group" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <label style={{ marginBottom: 0 }}>Interview Inconsistencies</label>
          <button onClick={detectInconsistencies} disabled={loadingInconsistencies} style={compactButtonStyle}>
            {loadingInconsistencies ? 'Checking...' : 'Detect inconsistencies'}
          </button>
        </div>

        {inconsistencies.length === 0 ? (
          <p style={{color: '#757575', fontStyle: 'italic'}}>No detected inconsistencies yet.</p>
        ) : (
          <div>
            <p style={{ margin: '0 0 12px 0', color: '#616161', fontSize: '0.9em' }}>
              {unresolvedCount} unresolved of {inconsistencies.length}
            </p>
            <button onClick={() => setInconsistenciesModalOpen(true)} style={compactButtonStyle}>
              Open detected inconsistencies
            </button>
          </div>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <label style={{ marginBottom: 0 }}>Interview Knowledge Gaps</label>
          <button onClick={detectKnowledgeGaps} disabled={loadingKnowledgeGaps} style={compactButtonStyle}>
            {loadingKnowledgeGaps ? 'Checking...' : 'Detect knowledge gaps'}
          </button>
        </div>

        {knowledgeGaps.length === 0 ? (
          <p style={{color: '#757575', fontStyle: 'italic'}}>No detected knowledge gaps yet.</p>
        ) : (
          <div>
            <p style={{ margin: '0 0 12px 0', color: '#616161', fontSize: '0.9em' }}>
              {unresolvedGapsCount} unresolved of {knowledgeGaps.length}
            </p>
            <button onClick={() => setKnowledgeGapsModalOpen(true)} style={compactButtonStyle}>
              Open detected knowledge gaps
            </button>
          </div>
        )}
      </div>

      <div className="form-group">
        <label>All Interviews</label>
        {sessions.length === 0 ? (
          <p style={{color: '#757575', fontStyle: 'italic'}}>No interviews conducted yet.</p>
        ) : (
          <div style={{marginTop: '10px'}}>
            {Object.entries(sessionsByExpert).map(([expert, expertSessions]) => (
              <div key={expert} style={{marginBottom: '20px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px'}}>
                  <strong>{expert}</strong>
                  <span style={{color: '#757575', fontSize: '0.9em'}}>{expertSessions.length} interview{expertSessions.length !== 1 ? 's' : ''}</span>
                </div>
                {expertSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => onSelectSession(session)}
                    style={{
                      padding: '15px',
                      marginBottom: '10px',
                      border: '1px solid #e0e0e0',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      backgroundColor: '#fff',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#fff'}
                  >
                    <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                      <div>
                        <p style={{margin: '0 0 4px 0', fontSize: '0.95em', color: '#424242'}}>
                          {new Date(session.created_at).toLocaleString()}
                        </p>
                        <p style={{margin: 0, fontSize: '0.9em', color: '#757575'}}>
                          {session.qa_items?.length || 0} Q&A
                        </p>
                      </div>
                      <span style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.85em',
                        backgroundColor: statusColor(session.status),
                        color: '#fff'
                      }}>
                        {session.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {inconsistenciesModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            width: '64%',
            maxWidth: '560px',
            minWidth: '420px',
            maxHeight: '80vh',
            overflowY: 'auto',
            padding: '18px'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Detected inconsistencies</h3>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
              <label style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={showResolved}
                  onChange={(e) => setShowResolved(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Show resolved
              </label>
              <label style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={showIgnored}
                  onChange={(e) => setShowIgnored(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Show ignored
              </label>
            </div>
            <p style={{ margin: '0 0 12px 0', color: '#616161', fontSize: '0.9em' }}>
              {unresolvedCount} unresolved of {inconsistencies.length}
            </p>

            {inconsistencies.length === 0 ? (
              <p style={{color: '#757575', fontStyle: 'italic'}}>No detected inconsistencies.</p>
            ) : (
              inconsistencies.map((item) => (
                <div key={item.id} style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '14px',
                  marginBottom: '12px',
                  backgroundColor: item.status === 'resolved' ? '#f6fff7' : item.status === 'ignored' ? '#f5f5f5' : '#fff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <strong>{item.title}</strong>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {item.is_new && (
                        <span style={{
                          fontSize: '0.82em',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          color: '#fff',
                          backgroundColor: '#1565c0'
                        }}>
                          New
                        </span>
                      )}
                      <span style={{
                        fontSize: '0.82em',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        color: '#fff',
                        backgroundColor: item.status === 'resolved' ? '#2e7d32' : item.status === 'ignored' ? '#616161' : '#ef6c00'
                      }}>
                        {item.status === 'resolved' ? 'Resolved' : item.status === 'ignored' ? 'Ignored' : 'Needs resolution'}
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: '8px 0', color: '#424242' }}>{item.description}</p>

                  {item.evidence?.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <p style={{ margin: '0 0 6px 0', fontWeight: 600, fontSize: '0.9em' }}>Evidence</p>
                      <ul style={{ margin: 0, paddingLeft: '18px' }}>
                        {item.evidence.map((ev, idx) => (
                          <li key={`${item.id}-modal-ev-${idx}`} style={{ marginBottom: '4px', color: '#616161' }}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.9em', marginBottom: '6px', display: 'block' }}>
                      Instruction
                    </label>
                    <textarea
                      value={analystInputs[item.id] || ''}
                      onChange={(e) => setAnalystInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                      rows={4}
                      placeholder="Describe how this inconsistency should be handled. If you do not write an instruction and also not ignore it, it is possible to take this inconsistency into account in the next round of protocol generation."
                      style={{
                        width: '100%',
                        border: '1px solid #d0d0d0',
                        borderRadius: '6px',
                        padding: '8px',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>

                  <button
                    onClick={() => resolveInconsistency(item)}
                    disabled={resolvingId === item.id}
                    style={compactButtonStyle}
                  >
                    {resolvingId === item.id ? 'Saving...' : 'Save instruction'}
                  </button>
                  <button
                    onClick={() => (item.status === 'ignored' ? unignoreInconsistency(item) : ignoreInconsistency(item))}
                    disabled={ignoringId === item.id}
                    style={{ ...compactButtonStyle, marginLeft: '8px', backgroundColor: '#757575' }}
                  >
                    {ignoringId === item.id ? (item.status === 'ignored' ? 'Unignoring...' : 'Ignoring...') : (item.status === 'ignored' ? 'Unignore' : 'Ignore')}
                  </button>
                </div>
              ))
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setInconsistenciesModalOpen(false)}
                style={{ ...compactButtonStyle, backgroundColor: '#757575', color: '#fff' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {knowledgeGapsModalOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1200
        }}>
          <div style={{
            backgroundColor: '#fff',
            borderRadius: '8px',
            width: '64%',
            maxWidth: '560px',
            minWidth: '420px',
            maxHeight: '80vh',
            overflowY: 'auto',
            padding: '18px'
          }}>
            <h3 style={{ marginTop: 0, marginBottom: '10px' }}>Detected knowledge gaps</h3>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', alignItems: 'center' }}>
              <label style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={showResolvedGaps}
                  onChange={(e) => setShowResolvedGaps(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Show resolved
              </label>
              <label style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                <input
                  type="checkbox"
                  checked={showIgnoredGaps}
                  onChange={(e) => setShowIgnoredGaps(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Show ignored
              </label>
            </div>
            <p style={{ margin: '0 0 12px 0', color: '#616161', fontSize: '0.9em' }}>
              {unresolvedGapsCount} unresolved of {knowledgeGaps.length}
            </p>

            {knowledgeGaps.length === 0 ? (
              <p style={{color: '#757575', fontStyle: 'italic'}}>No detected knowledge gaps.</p>
            ) : (
              knowledgeGaps.map((item) => (
                <div key={item.id} style={{
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  padding: '14px',
                  marginBottom: '12px',
                  backgroundColor: item.status === 'resolved' ? '#f6fff7' : item.status === 'ignored' ? '#f5f5f5' : '#fff'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                    <strong>{item.title}</strong>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                      {item.is_new && (
                        <span style={{
                          fontSize: '0.82em',
                          padding: '3px 8px',
                          borderRadius: '999px',
                          color: '#fff',
                          backgroundColor: '#1565c0'
                        }}>
                          New
                        </span>
                      )}
                      <span style={{
                        fontSize: '0.82em',
                        padding: '3px 8px',
                        borderRadius: '999px',
                        color: '#fff',
                        backgroundColor: item.status === 'resolved' ? '#2e7d32' : item.status === 'ignored' ? '#616161' : '#ef6c00'
                      }}>
                        {item.status === 'resolved' ? 'Resolved' : item.status === 'ignored' ? 'Ignored' : 'Needs resolution'}
                      </span>
                    </div>
                  </div>

                  <p style={{ margin: '8px 0', color: '#424242' }}>{item.description}</p>

                  {item.evidence?.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <p style={{ margin: '0 0 6px 0', fontWeight: 600, fontSize: '0.9em' }}>Evidence</p>
                      <ul style={{ margin: 0, paddingLeft: '18px' }}>
                        {item.evidence.map((ev, idx) => (
                          <li key={`${item.id}-modal-gap-ev-${idx}`} style={{ marginBottom: '4px', color: '#616161' }}>{ev}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontWeight: 600, fontSize: '0.9em', marginBottom: '6px', display: 'block' }}>
                      Instruction
                    </label>
                    <textarea
                      value={gapInputs[item.id] || ''}
                      onChange={(e) => setGapInputs(prev => ({ ...prev, [item.id]: e.target.value }))}
                      rows={4}
                      placeholder="Describe how this knowledge gap should be handled for BPMN generation. If you do not write an instruction and also not ignore it, it is possible to take this gap into account in the next round of protocol generation."
                      style={{
                        width: '100%',
                        border: '1px solid #d0d0d0',
                        borderRadius: '6px',
                        padding: '8px',
                        resize: 'vertical',
                        fontFamily: 'inherit'
                      }}
                    />
                  </div>

                  <button
                    onClick={() => resolveKnowledgeGap(item)}
                    disabled={resolvingGapId === item.id}
                    style={compactButtonStyle}
                  >
                    {resolvingGapId === item.id ? 'Saving...' : 'Save instruction'}
                  </button>
                  <button
                    onClick={() => (item.status === 'ignored' ? unignoreKnowledgeGap(item) : ignoreKnowledgeGap(item))}
                    disabled={ignoringGapId === item.id}
                    style={{ ...compactButtonStyle, marginLeft: '8px', backgroundColor: '#757575' }}
                  >
                    {ignoringGapId === item.id ? (item.status === 'ignored' ? 'Unignoring...' : 'Ignoring...') : (item.status === 'ignored' ? 'Unignore' : 'Ignore')}
                  </button>
                </div>
              ))
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setKnowledgeGapsModalOpen(false)}
                style={{ ...compactButtonStyle, backgroundColor: '#757575', color: '#fff' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
