// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { useCallback, useEffect, useRef, useState } from 'react'
import * as api from '../services/api'

export function useProcessSessions({ token, processId, enabled, showStatus, refreshKey }) {
  const [sessions, setSessions] = useState([])
  const [sessionsByExpert, setSessionsByExpert] = useState({})
  const [loading, setLoading] = useState(false)
  const requestRef = useRef(0)

  const buildSessionsByExpert = useCallback((data) => {
    const byExpert = {}
    data.forEach((session) => {
      if (!byExpert[session.expert_id]) { // Initialize structure for this expert if not exists
        byExpert[session.expert_id] = {
          all: [],
          protocol_created: [],
          active: [],
          paused: [],
          completed: []
        }
      }
      byExpert[session.expert_id].all.push(session)
      byExpert[session.expert_id][session.status].push(session)
    })
    return byExpert
  }, [])

  const refresh = useCallback(async () => {
    if (!enabled || !token || !processId) return
    const requestId = ++requestRef.current
    try {
      setLoading(true)
      const data = await api.getProcessSessions(token, processId)
      if (requestRef.current !== requestId) return
      setSessions(data)
      setSessionsByExpert(buildSessionsByExpert(data))
    } catch (e) {
      if (requestRef.current !== requestId) return
      showStatus?.(`Error loading sessions: ${e.message}`, 'error')
    } finally {
      if (requestRef.current === requestId) {
        setLoading(false)
      }
    }
  }, [enabled, token, processId, buildSessionsByExpert, showStatus])

  useEffect(() => {
    requestRef.current += 1
    setSessions([])
    setSessionsByExpert({})
    setLoading(false)
  }, [processId, enabled, token])

  useEffect(() => {
    refresh()
  }, [refresh, refreshKey])

  return { sessions, sessionsByExpert, refresh, loading }
}
