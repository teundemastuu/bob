// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.

import { Outlet, Navigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useAuth } from './context/AuthContext'
import './App.css'

function ProtectedRoute({ children }) { // To ensure only authenticated users can access certain routes
  const { isAuthenticated, authLoading } = useAuth()
  
  if (authLoading) {
    return <div style={{ padding: '20px' }}>Loading...</div>
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }
  
  return children || <Outlet />
}

export default function App() {
  const location = useLocation()
  const { clearStatus } = useAuth()

  useEffect(() => {
    clearStatus()
  }, [location.pathname, clearStatus])

  return <Outlet />
}

export { ProtectedRoute }
