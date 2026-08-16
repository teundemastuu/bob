// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { useState, useEffect } from 'react'
import * as api from '../../services/api'

export default function ProcessEditModal({ isOpen, process, token, onClose, onSave }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load process data when modal opens
  useEffect(() => {
    if (isOpen && process) {
      setName(process.name || '')
      setDescription(process.description || '')
      setError('')
    }
  }, [isOpen, process])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Process name is required')
      return
    }

    if (!process || !token) {
      setError('Missing process or authentication')
      return
    }

    setLoading(true)
    setError('')

    try {
      await api.updateProcess(token, process.id, name, description)
      onSave()
    } catch (err) {
      setError(err.message || 'Failed to update process')
    } finally {
      setLoading(false)
    }
  }

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
        padding: '30px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ marginTop: 0, marginBottom: '20px' }}>Edit Process</h2>

        {error && (
          <div style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '15px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Process Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError('')
              }}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
              disabled={loading}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                if (error) setError('')
              }}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '14px',
                boxSizing: 'border-box',
                minHeight: '100px',
                fontFamily: 'inherit'
              }}
              disabled={loading}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                padding: '8px 16px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'default' : 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '8px 16px',
                backgroundColor: loading ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loading ? 'default' : 'pointer',
                fontSize: '14px'
              }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
