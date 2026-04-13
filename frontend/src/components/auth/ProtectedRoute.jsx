import { useAuth } from '../../context/AuthContext'
import LoadingSpinner from '../ui/LoadingSpinner'

/**
 * Protege qualquer rota e exibe fallback se a autenticação silenciosa falhar.
 * Enquanto verifica a sessão exibe um spinner de tela cheia.
 */
export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: '#000' }}>
        <LoadingSpinner label="Verificando acesso..." />
      </div>
    )
  }

  return children
}
