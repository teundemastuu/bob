// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useExpert } from '../context/ExpertContext'
import { SessionList } from '../components/expert/SessionComponents'
import { StatusMessage } from '../components/general/StatusMessage'

export default function SessionsPage() {
  const { user, logout, authLoading, status } = useAuth()
  const { mySessions, sessionsLoading } = useExpert()

  const loading = authLoading || sessionsLoading
  const navigate = useNavigate()

  useEffect(() => {
    if (user?.role === 'analyst') {
      navigate('/processes')
    }
  }, [user, navigate])

  const handleOpenSession = (session) => {
    navigate(`/interview/${session.id}`)
  }

  return (
    <div style={{ padding: '20px' }}>
      <StatusMessage message={status.message} type={status.type} />

      {loading ? (
        <div>Loading...</div>
      ) : (
        <SessionList
          userName={user?.email || ''}
          onLogout={logout}
          loading={false}
          mySessions={mySessions}
          onOpenSession={handleOpenSession}
        />
      )}
    </div>
  )
}
