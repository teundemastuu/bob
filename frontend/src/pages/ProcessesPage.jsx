// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useAnalyst } from '../context/AnalystContext'
import { ProcessList } from '../components/analyst/ProcessComponents'
import { CreateProcessModal } from '../components/analyst/CreateProcessModal'
import { StatusMessage } from '../components/general/StatusMessage'

export default function ProcessListPage() {
  const { user, token, logout, authLoading, status, showStatus } = useAuth()
  const {
    processes,
    createProcess,
    deleteProcess,
    experts,
    processLoading
  } = useAnalyst()
  const loading = authLoading || processLoading

  const navigate = useNavigate()

  useEffect(() => {
    if (user?.role === 'expert') {
      navigate('/sessions')
    }
  }, [user, navigate])

  // Create process form state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newProcessName, setNewProcessName] = useState('')
  const [newProcessDescription, setNewProcessDescription] = useState('')
  const [selectedExperts, setSelectedExperts] = useState([])
  const [expertRoles, setExpertRoles] = useState({})

  const handleSelectProcess = (processId) => {
    navigate(`/process/${processId}`)
  }


  const handleDeleteProcess = async (processId) => {
    if (!confirm('Are you sure you want to delete this process?')) return
    try {
      await deleteProcess(processId)
      showStatus('Process deleted successfully', 'success')
    } catch (e) {
      showStatus(`Error: ${e.message}`, 'error')
    }
  }

  const handleCreateProcess = async () => {
    if (!newProcessName.trim() || !newProcessDescription.trim() || selectedExperts.length === 0) {
      showStatus('Please fill all fields and select at least one expert', 'error')
      return
    }
    try {
      const newProcess = await createProcess(newProcessName, newProcessDescription, selectedExperts.map((id) => ({ expert_id: id, role: expertRoles[id] || 'member' })))
      setNewProcessName('')
      setNewProcessDescription('')
      setSelectedExperts([])
      setExpertRoles({})
      setShowCreateModal(false)
      showStatus('Process created successfully', 'success')
      // Navigate to the newly created process
      if (newProcess && newProcess.id) {
        navigate(`/process/${newProcess.id}`)
      }
    } catch (e) {
      showStatus(`Error: ${e.message}`, 'error')
    }
  }

  return (
    <div style={{ padding: '20px' }}>
      <StatusMessage message={status.message} type={status.type} />

      {loading ? (
        <div>Loading...</div>
      ) : (
        <>
          <ProcessList
            processes={processes}
            userName={user?.email || ''}
            token={token}
            onViewDetails={handleSelectProcess}
            onDelete={handleDeleteProcess}
            onCreateNew={() => setShowCreateModal(true)}
            onLogout={logout}
            loading={false}
          />

          {/* Developer-only debug UI removed */}
        </>
      )}

      {showCreateModal && user?.role === 'analyst' && (
        <CreateProcessModal
          isOpen={showCreateModal}
          name={newProcessName}
          description={newProcessDescription}
          experts={experts}
          selectedExperts={selectedExperts}
          expertRoles={expertRoles}
          onNameChange={setNewProcessName}
          onDescriptionChange={setNewProcessDescription}
          onToggleExpert={(expertId) => {
            setSelectedExperts((prev) => prev.includes(expertId) ? prev.filter((id) => id !== expertId) : [...prev, expertId])
            setExpertRoles((prev) => ({ ...prev, [expertId]: prev[expertId] || 'member' }))
          }}
          onRoleChange={(expertId, value) => setExpertRoles((prev) => ({ ...prev, [expertId]: value }))}
          onCreate={handleCreateProcess}
          onClose={() => setShowCreateModal(false)}
          loading={loading}
        />
      )}
    </div>
  )
}

