// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
export function ProcessTabBar({ activeTab, onTabChange }) {
  const tabs = [
    { id: 'interviews', label: 'Manage Interviews' },
    { id: 'knowledge', label: 'Knowledge Base' },
    { id: 'model', label: 'Process Model' }
  ]

  return (
    <div style={{
      display: 'flex',
      gap: '0',
      marginBottom: '20px',
      borderBottom: '2px solid #e0e0e0'
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            padding: '10px 20px',
            background: activeTab === tab.id ? '#1976d2' : 'transparent',
            color: activeTab === tab.id ? 'white' : '#666',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === tab.id ? 'bold' : 'normal'
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
