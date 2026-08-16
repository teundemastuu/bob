// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
export function CreateProcessModal({ isOpen, name, description, experts, selectedExperts, expertRoles, onNameChange, onDescriptionChange, onToggleExpert, onRoleChange, onCreate, onClose, loading }) {
  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Create New Process</h2>
        <div className="form-group">
          <label htmlFor="processName">Process Name</label>
          <input
            id="processName"
            type="text"
            placeholder="e.g., Maintenance Process"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="processDescription">Initial Process Description</label>
          <textarea
            id="processDescription"
            placeholder="Provide all the information you have about the process..."
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
          ></textarea>
        </div>
        <div className="form-group">
          <label>Select Domain Experts</label>
          <div className="expert-list">
            {experts.map((expert) => (
              <div key={expert.id} className="checkbox-label" style={{alignItems: 'center'}}>
                <input
                  type="checkbox"
                  checked={selectedExperts.includes(expert.id)}
                  onChange={() => onToggleExpert(expert.id)}
                  style={{marginRight: '10px'}}
                />
                <span style={{flex: '1 1 auto'}}>{expert.email}</span>
                <input
                  type="text"
                  placeholder="Role (e.g., Reviewer)"
                  value={expertRoles[expert.id] || ''}
                  onChange={(e) => onRoleChange(expert.id, e.target.value)}
                  disabled={!selectedExperts.includes(expert.id)}
                  style={{marginLeft: '10px', flex: '0 0 200px'}}
                />
              </div>
            ))}
          </div>
        </div>
        <div className="actions">
          <button onClick={onCreate} disabled={loading}>
            {loading ? <span className="loading"></span> : 'Create Process'}
          </button>
          <button className="secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
