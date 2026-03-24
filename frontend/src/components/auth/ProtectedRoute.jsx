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

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center px-6" style={{ background: '#000' }}>
        <div
          className="w-full max-w-md rounded-2xl p-6 text-center"
          style={{ background: '#272C30', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          <h1 className="text-lg font-semibold text-white">Acesso indisponível</h1>
          <p className="mt-2 text-sm text-gray-400">
            Não foi possível iniciar a sessão automática. Verifique se o backend está rodando.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg px-4 py-2 text-sm font-semibold"
            style={{ background: '#12F0C6', color: '#000' }}
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return children
}
