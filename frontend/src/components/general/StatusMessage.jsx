// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
export function StatusMessage({ message, type }) {
  if (!message) return null
  return (
    <div className={`status ${type}`}>
      {message}
    </div>
  )
}
