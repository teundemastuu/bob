// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoginForm, RegisterForm } from '../components/general/AuthForms'
import { useState } from 'react'
import { StatusMessage } from '../components/general/StatusMessage'

export default function AuthPage() {
  const { isAuthenticated, user, handleLogin, handleRegister, showStatus, authLoading, status } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('analyst@example.com')
  const [password, setPassword] = useState('password123')
  const [role, setRole] = useState('analyst')

  if (isAuthenticated) {
    return <Navigate to={user?.role === 'expert' ? '/sessions' : '/processes'} replace />
  }

  const handleAuthLogin = async () => {
    try {
      await handleLogin(email, password)
      showStatus('Logged in successfully', 'success')
    } catch (e) {
      showStatus(`Login error: ${e.message}`, 'error')
    }
  }

  const handleAuthRegister = async () => {
    try {
      await handleRegister(email, password, role)
      showStatus('Registration successful. Please login.', 'success')
      setMode('login')
    } catch (e) {
      showStatus(`Registration error: ${e.message}`, 'error')
    }
  }

  return ( // Logo stuff
    <div style={{ padding: '20px', maxWidth: '400px', margin: '50px auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: '2px', color: '#1b1f3b' }}>
          <span style={{ fontSize: '42px', fontWeight: 850 }}>B</span>
          <span style={{ fontSize: '12px', color: '#555' }}>uilding</span>
          <span style={{ fontSize: '42px', fontWeight: 850, marginLeft: '2px' }}>O</span>
          <span style={{ fontSize: '12px', color: '#555' }}>f</span>
          <span style={{ fontSize: '42px', fontWeight: 850, marginLeft: '2px' }}>B</span>
          <span style={{ fontSize: '12px', color: '#555' }}>PMNdiagrams</span>
        </div>
      </div>
      <StatusMessage message={status.message} type={status.type} />
      
      {mode === 'login' && (  // if mode is login show login form, in jsx you can use && for conditional rendering
        <>
          <LoginForm
            email={email}
            password={password}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onLogin={handleAuthLogin}
            loading={authLoading}
          />
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p>
              Don't have an account?{' '}
              <button 
                onClick={() => setMode('register')}
                style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Register here
              </button>
            </p>
          </div>
        </>
      )}

      {mode === 'register' && (
        <>
          <RegisterForm
            email={email}
            password={password}
            role={role}
            onEmailChange={setEmail}
            onPasswordChange={setPassword}
            onRoleChange={setRole}
            onRegister={handleAuthRegister}
            loading={authLoading}
          />
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <p>
              Already have an account?{' '}
              <button 
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: '#2196F3', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Login here
              </button>
            </p>
          </div>
        </>
      )}
    </div>
  )
}
