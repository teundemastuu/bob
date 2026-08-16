// Initial code drafted in discussion with GitHub Copilot (April 2026) 
// Modified and validated by Teun de Mast.

export default {
  // Auth
  getToken: () => localStorage.getItem('token') || '',
  setToken: (token) => localStorage.setItem('token', token),
  clearToken: () => localStorage.removeItem('token'),
  
  getUser: () => {
    const u = localStorage.getItem('user')
    return u ? JSON.parse(u) : null
  },
  setUser: (user) => localStorage.setItem('user', JSON.stringify(user)),
  clearUser: () => localStorage.removeItem('user')
}
