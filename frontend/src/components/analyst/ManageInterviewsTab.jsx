// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
function ParticipantCard({ expert, sessionsByExpert, onCreateProtocol, loading }) {
  const sessions = sessionsByExpert || {}

  const completedCount = sessions.completed?.length || 0
  const protocolCreatedSession = sessions.protocol_created?.[0]
  const activeOrPausedSession = sessions.active?.length > 0 || sessions.paused?.length > 0

  const allSessions = sessions.all || []
  const highestRound = allSessions.reduce((max, s) => Math.max(max, s.round_number || 1), 0)
  const highestCompletedRound = allSessions
    .filter((s) => s.status === 'completed')
    .reduce((max, s) => Math.max(max, s.round_number || 1), 0)

  const canCreateProtocol =
    !activeOrPausedSession &&
    !protocolCreatedSession &&
    (highestRound === 0 || highestCompletedRound === highestRound)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      padding: '15px',
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      backgroundColor: '#fafafa'
    }}>
      <div style={{flex: '1 1 auto'}}>
        <div style={{fontWeight: 'bold', marginBottom: '5px'}}>{expert.email}</div>
        <div style={{color: '#757575', fontSize: '14px'}}>
          Role: {expert.role || 'Not specified'}
        </div>

        {protocolCreatedSession && (
          <div style={{color: '#4caf50', fontSize: '12px', marginTop: '5px'}}>
            ✓ Protocol ready (waiting for expert to start)
          </div>
        )}
        {activeOrPausedSession && (
          <div style={{color: '#ff9800', fontSize: '12px', marginTop: '5px'}}>
            • Interview in progress
          </div>
        )}
        {completedCount > 0 && !activeOrPausedSession && (
          <div style={{color: '#4caf50', fontSize: '12px', marginTop: '5px'}}>
            ✓ {completedCount} round{completedCount !== 1 ? 's' : ''} completed
          </div>
        )}
      </div>

      <div style={{display: 'flex', gap: '10px', marginLeft: '20px'}}>
        {canCreateProtocol && (
          <button
            onClick={() => onCreateProtocol(expert.id, expert.email)}
            disabled={loading}
            style={{minWidth: '140px'}}
          >
            Create Protocol
          </button>
        )}
      </div>
    </div>
  )
}

export default function ManageInterviewsTab({ processData, sessionsByExpert, selectedProcess, onCreateProtocol, loading }) {
  return (
    <div>
      <h3 style={{marginBottom: '20px'}}>Participants</h3>
      {processData.experts && processData.experts.length > 0 ? (
        <div style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
          {processData.experts.map((expert) => {
            const expertSessions = sessionsByExpert[expert.id] || {
              all: [],
              protocol_created: [],
              invited: [],
              active: [],
              paused: [],
              completed: []
            }

            return (
              <ParticipantCard
                key={expert.id}
                expert={expert}
                sessionsByExpert={expertSessions}
                onCreateProtocol={onCreateProtocol}
                loading={loading}
              />
            )
          })}
        </div>
      ) : (
        <p style={{color: '#757575', textAlign: 'center', padding: '40px'}}>
          No experts assigned to this process. Add experts in the process details.
        </p>
      )}
    </div>
  )
}
