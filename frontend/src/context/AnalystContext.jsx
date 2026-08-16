// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { createContext, useContext, useEffect, useState } from 'react'
import { useProcesses } from '../hooks/useProcesses.js'
import * as api from '../services/api'
import { useAuth } from './AuthContext'

const AnalystContext = createContext()

export function useAnalyst() {
  return useContext(AnalystContext)
}

export function AnalystProvider({ children }) {
  const { token, user, showStatus } = useAuth()

  const isAnalyst = user?.role === 'analyst'

  const {
    processes,
    selectedProcess,
    setSelectedProcess,
    loading: processLoading,
    createProcess,
    updateProcess,
    deleteProcess,
    loadProcesses
  } = useProcesses(token, { enabled: isAnalyst })

  const [experts, setExperts] = useState([])

  useEffect(() => {
    if (!token || !isAnalyst) return

    const loadExperts = async () => {
      try {
        const data = await api.getExperts(token)
        setExperts(data)
      } catch (e) {
        showStatus(`Error loading experts: ${e.message}`, 'error')
      }
    }

    loadExperts()
  }, [token, isAnalyst, showStatus])

  const value = {
    processes,
    selectedProcess,
    setSelectedProcess,
    createProcess,
    updateProcess,
    deleteProcess,
    loadProcesses,
    processLoading,
    experts
  }

  return <AnalystContext.Provider value={value}>{children}</AnalystContext.Provider>
}
