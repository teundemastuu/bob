// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { createContext, useContext, useState, useCallback } from 'react'
import * as api from '../services/api'
import storage from '../utils/storage'

const AuthContext = createContext()

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(storage.getToken())
  const [user, setUser] = useState(storage.getUser())
  const [authLoading, setAuthLoading] = useState(false)
  const [status, setStatus] = useState({ message: '', type: '' })

  const handleLogin = useCallback(async (email, password) => {
    try {
      setAuthLoading(true)
      const data = await api.login(email, password)
      storage.setToken(data.access_token)
      storage.setUser(data.user)
      setToken(data.access_token)
      setUser(data.user)
      return data
    } finally {
      setAuthLoading(false)
    }
  }, [])

  const handleRegister = useCallback(async (email, password, role) => {
    try {
      setAuthLoading(true)
      const data = await api.register(email, password, role)
      return data
    } finally {
      setAuthLoading(false)
    }
  }, [])

  const logout = useCallback(() => { // Clear auth state and storage on logout
    storage.clearToken()
    storage.clearUser()
    setToken('')
    setUser(null)
  }, [])

  const showStatus = useCallback((message, type = 'info') => {
    setStatus({ message, type })
  }, [])

  const clearStatus = useCallback(() => {
    setStatus({ message: '', type: '' })
  }, [])

  const isAuthenticated = !!token && !!user // !! to convert to boolean
 
  const value = {
    token,
    user,
    isAuthenticated,
    handleLogin,
    handleRegister,
    logout,
    authLoading,
    status,
    showStatus,
    clearStatus
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
