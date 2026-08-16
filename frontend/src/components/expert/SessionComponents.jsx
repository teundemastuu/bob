// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
const filterSessionsByStatus = (sessions = [], statuses = []) =>
  sessions.filter((s) => statuses.includes(s.status))

function SessionHeader({ userName, onLogout }) {
  return (
    <div className="session-info">
      <h1>My Sessions</h1>
      <div className="actions">
        <p><strong>{userName}</strong> (Expert)</p>
        <button className="secondary" onClick={onLogout}>Logout</button>
      </div>
    </div>
  )
}

export function SessionList({ userName, onLogout, loading, mySessions, onOpenSession }) {
  const protocolCreatedSessions = filterSessionsByStatus(mySessions, ['protocol_created'])
  const activeSessions = filterSessionsByStatus(mySessions, ['active', 'paused'])

  const showEmptyState =
    protocolCreatedSessions.length === 0 && (!mySessions || mySessions.filter((s) => s.status !== 'completed').length === 0)

  return (
    <div className="page">
      <SessionHeader userName={userName || ''} onLogout={onLogout || (() => {})} />

      {protocolCreatedSessions.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Ready to Start</h2>
          <div className="process-grid">
            {protocolCreatedSessions.map((session) => (
              <div key={session.id} className="process-card" style={{ backgroundColor: '#e8f5e9' }}>
                <h3>{session.process_name || 'Interview'}</h3>
                <div className="process-meta">
                  <span>Protocol ready</span>
                </div>
                <div className="actions">
                  <button onClick={() => onOpenSession(session)} style={{ backgroundColor: '#4CAF50', color: 'white' }}>
                    Start Interview
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeSessions.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ fontSize: '18px', marginBottom: '15px' }}>Active Sessions</h2>
          <div className="process-grid">
            {activeSessions.map((session) => (
              <div key={session.id} className="process-card" style={{ backgroundColor: '#fff3e0' }}>
                <h3>{session.process_name || 'Interview Session'}</h3>
                <div className="process-meta">
                  <span>Status: {session.status}</span>
                  <span>Current step: {Math.max(1, (session.current_step_index ?? 0) + 1)}</span>
                </div>
                <div className="actions">
                  <button onClick={() => onOpenSession(session)} style={{ backgroundColor: '#FF9800', color: 'white' }}>
                    {session.status === 'paused' ? 'Resume Interview' : 'Continue Interview'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showEmptyState && (
        <p style={{color: '#757575', textAlign: 'center', padding: '40px'}}>
          No active sessions. You'll see interviews here when they're ready to start.
        </p>
      )}
    </div>
  )
}
