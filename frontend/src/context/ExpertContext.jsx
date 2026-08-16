// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { createContext, useContext, useEffect, useState } from 'react'
import * as api from '../services/api'
import { useAuth } from './AuthContext'

const ExpertContext = createContext()

export function useExpert() {
  return useContext(ExpertContext)
}

export function ExpertProvider({ children }) {
  const { token, user } = useAuth()

  const [mySessions, setMySessions] = useState([])
  const [pausedSessions, setPausedSessions] = useState([])
  const [sessionsLoading, setSessionsLoading] = useState(false)

  useEffect(() => {
    if (!token || !user || user.role !== 'expert') return

    const loadMySessions = async () => {
      try {
        setSessionsLoading(true)
        const data = await api.getMySessions(token)
        setMySessions(data)
        setPausedSessions(data.filter(s => s.status === 'paused'))
      } catch (e) {
        // Error loading sessions
      } finally {
        setSessionsLoading(false)
      }
    }

    loadMySessions()
  }, [token, user])

  const value = {
    mySessions,
    setMySessions,
    pausedSessions,
    setPausedSessions,
    sessionsLoading
  }

  return <ExpertContext.Provider value={value}>{children}</ExpertContext.Provider>
}
