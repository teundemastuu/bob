// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.
export function LoginForm({ email, password, onEmailChange, onPasswordChange, onLogin, loading }) {
  return (
    <div className="form-group">
      <label htmlFor="email">Email</label>
      <input 
        id="email" 
        type="email" 
        value={email} 
        onChange={(e) => onEmailChange(e.target.value)} 
      />
      <label htmlFor="password">Password</label>
      <input 
        id="password" 
        type="password" 
        value={password} 
        onChange={(e) => onPasswordChange(e.target.value)} 
      />
      <button onClick={onLogin} disabled={loading} style={{ marginTop: '10px' }}>
        {loading ? <span className="loading"></span> : 'Login'}
      </button>
    </div>
  )
}

export function RegisterForm({ email, password, role, onEmailChange, onPasswordChange, onRoleChange, onRegister, loading }) {
  return (
    <div className="form-group">
      <label htmlFor="email">Email</label>
      <input 
        id="email" 
        type="email" 
        value={email} 
        onChange={(e) => onEmailChange(e.target.value)} 
      />
      <label htmlFor="password">Password</label>
      <input 
        id="password" 
        type="password" 
        value={password} 
        onChange={(e) => onPasswordChange(e.target.value)} 
      />
      <label htmlFor="role">Role</label>
      <select id="role" value={role} onChange={(e) => onRoleChange(e.target.value)}>
        <option value="expert">Domain Expert</option>
        <option value="analyst">Process Analyst</option>
      </select>
      <button onClick={onRegister} disabled={loading} style={{ marginTop: '10px' }}>
        {loading ? <span className="loading"></span> : 'Register'}
      </button>
    </div>
  )
}
