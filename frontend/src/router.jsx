// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { createBrowserRouter } from 'react-router-dom'
import App, { ProtectedRoute } from './App'
import { AppProvider } from './context/AppContext'
import { ErrorBoundary } from './components/general/ErrorBoundary'
import AuthPage from './pages/AuthPage'
import ProcessListPage from './pages/ProcessesPage'
import ProcessDetailPage from './pages/ProcessDetailPage'
import InterviewPage from './pages/InterviewPage'
import CompletedPage from './pages/CompletedPage'
import SessionsPage from './pages/SessionsPage'
// LLM debug pages removed

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ErrorBoundary><AppProvider><App /></AppProvider></ErrorBoundary>, // ErrorBoundary ensures the app doesn't crash
    children: [
      {
        index: true,
        element: <AuthPage />
      },
      {
        path: 'processes',
        element: <ProtectedRoute><ProcessListPage /></ProtectedRoute>
      },
      {
        path: 'process/:processId',
        element: <ProtectedRoute><ProcessDetailPage /></ProtectedRoute>
      },
      {
        path: 'sessions',
        element: <ProtectedRoute><SessionsPage /></ProtectedRoute>
      },
      {
        path: 'interview/:sessionId',
        element: <ProtectedRoute><InterviewPage /></ProtectedRoute>
      },
      {
        path: 'interview/:sessionId/completed',
        element: <ProtectedRoute><CompletedPage /></ProtectedRoute>
      },
      // LLM debug routes removed
    ]
  }
])
