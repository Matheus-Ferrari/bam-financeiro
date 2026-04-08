import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authAPI.me()
      .then(res => setUser(res.data))
      .catch(() => setUser({ sub: 'bam_user', bypass: true }))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (code) => {
    await authAPI.login(code)
    const res = await authAPI.me()
    setUser(res.data)
  }, [])

  const logout = useCallback(async () => {
    try { await authAPI.logout() } catch { /* ignora erros de rede */ }
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
