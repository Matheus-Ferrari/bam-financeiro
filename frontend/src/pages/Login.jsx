import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, loading: authLoading, login } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  useEffect(() => {
    if (!authLoading && user) navigate('/dashboard', { replace: true })
  }, [user, authLoading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()

    setLoading(true)
    setError('')
    try {
      await login('')
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = !err?.response
        ? 'Não foi possível conectar na API. Verifique se o backend está rodando.'
        : (err?.response?.data?.detail || 'Não foi possível liberar o acesso temporário.')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return null

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#000' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#272C30', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #12F0C6, transparent)' }} />

        <div className="px-8 pt-10 pb-8 space-y-7">
          <div className="flex flex-col items-center gap-4">
            <img
              src="/LogoBam.png"
              alt="BAM Financeiro"
              className="h-12 w-auto object-contain"
            />
            <div className="text-center">
              <p className="text-xs text-gray-500 tracking-widest uppercase">
                Acesso Temporariamente Liberado
              </p>
              <p className="mt-2 text-sm text-gray-300">
                Entre com um clique enquanto o login completo fica em standby.
              </p>
            </div>
          </div>

          <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: loading ? 'rgba(18,240,198,0.6)' : '#12F0C6',
                color: '#000',
                boxShadow: loading ? 'none' : '0 0 20px rgba(18,240,198,0.2)',
              }}
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Entrando...</>
              ) : (
                'Entrar agora'
              )}
            </button>
          </form>

          <p className="text-center text-[10px] text-gray-700">
            Informações financeiras confidenciais · BAM Financeiro
          </p>
        </div>
      </div>
    </div>
  )
}
