// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
import { AuthProvider } from './AuthContext'
import { AnalystProvider } from './AnalystContext'
import { ExpertProvider } from './ExpertContext'

export function AppProvider({ children }) {
  return (
    <AuthProvider>
      <AnalystProvider>
        <ExpertProvider>{children}</ExpertProvider>
      </AnalystProvider>
    </AuthProvider>
  )
}
