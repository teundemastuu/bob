// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { useState, useCallback, useEffect } from 'react'
import { getProcesses, createProcess, updateProcess, deleteProcess } from '../services/api'

export function useProcesses(token, { enabled = true } = {}) {
  const [processes, setProcesses] = useState([])
  const [selectedProcess, setSelectedProcess] = useState(null)
  const [loading, setLoading] = useState(false)

  const loadProcesses = useCallback(async () => {
    if (!token || !enabled) {
      setProcesses([])
      setSelectedProcess(null)
      return
    }
    try {
      setLoading(true)
      const data = await getProcesses(token)
      setProcesses(data)
      if (data.length > 0 && !selectedProcess) { // Auto-select first process if none selected, note that this does not initiate page switches
        setSelectedProcess(data[0].id)
      }
    } catch (error) {
      if (error.status === 401) {
        setProcesses([])
        setSelectedProcess(null)
      }
    } finally {
      setLoading(false)
    }
  }, [token, enabled, selectedProcess])

  useEffect(() => {
    loadProcesses()
  }, [token, enabled])

  const handleCreateProcess = useCallback(async (name, description, expertAssignments) => {
    try {
      setLoading(true)
      const newProcess = await createProcess(token, name, description, expertAssignments)
      setProcesses((prev) => [newProcess, ...prev])
      setSelectedProcess(newProcess.id)
      return newProcess
    } finally {
      setLoading(false)
    }
  }, [token])

  const handleUpdateProcess = useCallback(async (processId, name, description) => {
    try {
      setLoading(true)
      const updatedProcess = await updateProcess(token, processId, name, description)
      setProcesses((prev) => prev.map((p) => p.id === processId ? updatedProcess : p)) // Processes is a list 
      return updatedProcess
    } finally {
      setLoading(false)
    }
  }, [token])

  const handleDeleteProcess = useCallback(async (processId) => {
    try {
      setLoading(true)
      await deleteProcess(token, processId)
      setProcesses((prev) => prev.filter((p) => p.id !== processId))
    } finally {
      setLoading(false)
    }
  }, [token])

  return {
    processes,
    selectedProcess,
    setSelectedProcess,
    loading,
    loadProcesses,
    createProcess: handleCreateProcess,
    updateProcess: handleUpdateProcess,
    deleteProcess: handleDeleteProcess
  }
}
