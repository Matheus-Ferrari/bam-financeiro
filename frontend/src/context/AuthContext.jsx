import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { authAPI } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)

  // Ao iniciar, só verifica se já existe sessão ativa — não faz login automático
  useEffect(() => {
    authAPI.me()
      .then(res => setUser(res.data))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    await authAPI.login(email, password)
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
