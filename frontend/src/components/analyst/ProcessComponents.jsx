// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { useState } from 'react'
import * as api from '../../services/api'

export function ProcessHeader({ userName, onOpenProfile }) {
  return (
    <div className="session-info">
      <h1>
        Process Management
      </h1>
      <div className="actions">
        <p><strong>{userName}</strong> (Analyst)</p>
        <button className="secondary" onClick={onOpenProfile}>Profile</button>
      </div>
    </div>
  )
}

export function ProcessCard({ process, onViewDetails, onDelete, loading }) {
  const statusLabel = process.protocol_creatable ? 'Protocol can be created' : 'Protocol cannot be created'
  const statusColor = process.protocol_creatable ? '#2e7d32' : '#ef6c00'

  return (
    <div className="process-card">
      <h3>{process.name}</h3>
      <div className="process-meta">
        <span>{process.experts?.length || 0} expert(s)</span>
        <span>{new Date(process.created_at).toLocaleDateString()}</span>
      </div>
      <div style={{ marginTop: '6px', marginBottom: '10px', fontSize: '13px', color: statusColor, fontWeight: 600 }}>
        {statusLabel}
      </div>
      <div className="actions">
        <button onClick={() => onViewDetails(process.id)}>View Details</button>
        {onDelete && (
          <button className="delete-btn" onClick={() => onDelete(process.id)} disabled={loading}>Delete</button>
        )}
      </div>
    </div>
  )
}

function ProfileModal({ isOpen, onClose, onLogout, onSaveKey, onDeleteKey, saving, error, openaiKey, onOpenAIKeyChange, hasOpenAIKey }) {
  if (!isOpen) return null
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '28px',
        maxWidth: '560px',
        width: '90%',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>Profile</h2>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '12px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>LLM settings</div>
          <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', color: '#555' }}>
            OpenAI API key
          </label>
          {hasOpenAIKey && (
            <div style={{ fontSize: '12px', color: '#2e7d32', marginBottom: '6px' }}>
              A key is saved for this account.
            </div>
          )}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              type="text"
              value={openaiKey}
              onChange={(e) => onOpenAIKeyChange(e.target.value)}
              placeholder="Enter your OpenAI API key"
              style={{
                flex: 1,
                width: 'auto',
                minWidth: 0,
                height: '42px',
                padding: '10px 12px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              disabled={saving}
            />
            <button
              type="button"
              onClick={onSaveKey}
              disabled={saving || !openaiKey.trim()}
              style={{
                width: 'auto',
                padding: '2px 6px',
                backgroundColor: saving ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'default' : 'pointer',
                fontSize: '11px',
                minWidth: '60px',
                height: '28px'
              }}
            >
              {saving ? 'Saving...' : 'Save key'}
            </button>
            <button
              type="button"
              onClick={onDeleteKey}
              disabled={saving || !hasOpenAIKey}
              style={{
                width: 'auto',
                padding: '2px 6px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: saving ? 'default' : 'pointer',
                fontSize: '11px',
                minWidth: '60px',
                height: '28px'
              }}
            >
              Delete
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="secondary"
            onClick={onLogout}
            disabled={saving}
            style={{
              padding: '8px 16px',
              borderRadius: '4px',
              fontSize: '14px'
            }}
          >
            Logout
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'default' : 'pointer',
              fontSize: '14px',
              minWidth: '90px'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProcessList({ processes, userName, token, onViewDetails, onDelete, onCreateNew, onLogout, loading }) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [openaiKey, setOpenaiKey] = useState('')
  const [hasOpenAIKey, setHasOpenAIKey] = useState(false)
  const [savingKey, setSavingKey] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const normalizedSearch = searchTerm.trim().toLowerCase()
  const filteredProcesses = normalizedSearch
    ? processes.filter((process) => {
        const name = (process.name || '').toLowerCase()
        return name.includes(normalizedSearch)
      })
    : processes

  const loadOpenAIKey = async () => {
    if (!token) return
    try {
      const res = await api.getOpenAIKeyStatus(token)
      setHasOpenAIKey(!!res?.has_key)
      setOpenaiKey('')
    } catch (e) {
      setProfileError(e.message || 'Failed to load key')
    }
  }

  const handleOpenProfile = async () => {
    setProfileError('')
    setProfileOpen(true)
    await loadOpenAIKey()
  }

  const handleSaveKey = async () => {
    if (!token) {
      setProfileError('Missing authentication')
      return
    }
    if (!openaiKey.trim()) {
      setProfileError('API key is required')
      return
    }
    try {
      setSavingKey(true)
      setProfileError('')
      await api.saveOpenAIKey(token, openaiKey.trim())
      setHasOpenAIKey(true)
      setOpenaiKey('')
    } catch (e) {
      setProfileError(e.message || 'Failed to save key')
    } finally {
      setSavingKey(false)
    }
  }

  const handleDeleteKey = async () => {
    if (!token) {
      setProfileError('Missing authentication')
      return
    }
    try {
      setSavingKey(true)
      setProfileError('')
      await api.deleteOpenAIKey(token)
      setOpenaiKey('')
      setHasOpenAIKey(false)
    } catch (e) {
      setProfileError(e.message || 'Failed to delete key')
    } finally {
      setSavingKey(false)
    }
  }

  return (
    <div className="page">
      <ProcessHeader userName={userName || ''} onOpenProfile={handleOpenProfile} />
      
      <button onClick={onCreateNew} disabled={loading} style={{marginBottom: '20px'}}>
        Create New Process
      </button>

      <div style={{ marginBottom: '16px' }}>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search processes by name..."
          style={{
            width: '100%',
            maxWidth: '420px',
            padding: '10px 12px',
            border: '1px solid #d0d0d0',
            borderRadius: '6px',
            fontSize: '14px'
          }}
        />
      </div>

      {filteredProcesses.length === 0 ? (
        <p style={{color: '#757575', textAlign: 'center', padding: '40px'}}>
          {processes.length === 0
            ? 'No processes yet. Create your first process!'
            : 'No processes match your search.'}
        </p>
      ) : (
        <div className="process-grid">
          {filteredProcesses.map((p) => (
            <ProcessCard
              key={p.id}
              process={p}
              onViewDetails={onViewDetails}
              onDelete={onDelete}
              loading={loading}
            />
          ))}
        </div>
      )}

      <ProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={onLogout || (() => {})}
        onSaveKey={handleSaveKey}
        onDeleteKey={handleDeleteKey}
        hasOpenAIKey={hasOpenAIKey}
        saving={savingKey}
        error={profileError}
        openaiKey={openaiKey}
        onOpenAIKeyChange={setOpenaiKey}
      />
    </div>
  )
}

