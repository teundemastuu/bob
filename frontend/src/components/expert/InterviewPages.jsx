// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
export function InterviewPage({ sessionId, stepIndex, question, introText, answer, onAnswerChange, onSubmit, onPause, onMicToggle, isRecording, loading }) {
  return (
    <div className="page">
      <h1>Interview</h1>
      <div className="session-info">
        <p><strong>Session ID:</strong> {sessionId}</p>
      </div>
      <div className="progress">
        Question {stepIndex + 1}
      </div>
      {stepIndex === 0 && (
        <div style={{ marginBottom: '12px', padding: '10px 12px', borderRadius: '6px', backgroundColor: '#eef6ff', color: '#1e3a5f' }}>
          {introText}
        </div>
      )}
      <div className="form-group">
        <label htmlFor="answerInput">{question}</label>
        <textarea
          id="answerInput"
          placeholder="Your answer..."
          value={answer}
          onChange={(e) => onAnswerChange(e.target.value)}
        ></textarea>
        {isRecording && (
          <p style={{color: '#f44336', fontSize: '0.9em', marginTop: '5px'}}>
            🔴 Recording... Click the button again to stop
          </p>
        )}
      </div>
      <div className="actions">
        <button 
          onClick={onMicToggle}
          className={isRecording ? '' : 'secondary'}
          disabled={loading}
          style={isRecording ? {backgroundColor: '#f44336', borderColor: '#f44336', color: '#fff'} : {}}
        >
          {isRecording ? '🔴 Stop Recording' : '🎤 Voice Input'}
        </button>
        <button onClick={onSubmit} disabled={loading}>
          {loading ? <span className="loading"></span> : 'Submit Answer'}
        </button>
        <button onClick={onPause} className="secondary" disabled={loading}>
          Pause Interview
        </button>
      </div>
    </div>
  )
}

export function CompletedPage({ sessionId, stepIndex, onStartNew }) {
  return (
    <div className="page">
      <h1>Interview Complete</h1>
      <div className="status success">
        <p>✓ Thank you for completing the interview!</p>
      </div>
      <div className="session-info">
        <p><strong>Session ID:</strong> {sessionId}</p>
        <p><strong>Questions Answered:</strong> {stepIndex}</p>
      </div>
      <button onClick={onStartNew}>Return to Processes</button>
    </div>
  )
}
