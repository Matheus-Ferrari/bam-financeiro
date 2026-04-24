import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authAPI } from '../services/api'
import { TOKEN_KEY, USER_KEY } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  // Ao iniciar, restaura sessão do sessionStorage sem bater na API
  useEffect(() => {
    const stored = sessionStorage.getItem(USER_KEY)
    if (stored) {
      try { setUser(JSON.parse(stored)) } catch { /* ignora */ }
    }
    setLoading(false)
  }, [])

  const login = useCallback(async (email, password) => {
    const res = await authAPI.login(email, password)
    const { token, user: userData } = res.data
    sessionStorage.setItem(TOKEN_KEY, token)
    sessionStorage.setItem(USER_KEY, JSON.stringify({ usuario: userData }))
    setUser({ usuario: userData })
  }, [])

  const logout = useCallback(async () => {
    try { await authAPI.logout() } catch { /* ignora erros de rede */ }
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(USER_KEY)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
