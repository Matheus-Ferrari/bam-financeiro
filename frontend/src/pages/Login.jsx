import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, loading: authLoading, login } = useAuth()
  const navigate = useNavigate()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  useEffect(() => {
    if (!authLoading && user) navigate('/dashboard', { replace: true })
  }, [user, authLoading, navigate])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!email.trim() || !password.trim()) {
      setError('Preencha o e-mail e a senha.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await login(email.trim(), password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const msg = !err?.response
        ? 'Não foi possível conectar. Verifique se o backend está rodando.'
        : (err?.response?.data?.detail || 'E-mail ou senha incorretos.')
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#000' }}>
      <Loader2 size={24} className="animate-spin text-[#12F0C6]" />
    </div>
  )

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#000' }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: '#1A1D21', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* barra topo */}
        <div className="h-0.5 w-full" style={{ background: 'linear-gradient(90deg, #12F0C6, transparent)' }} />

        <div className="px-8 pt-10 pb-8 space-y-7">
          {/* logo + título */}
          <div className="flex flex-col items-center gap-4">
            <img src={import.meta.env.BASE_URL + 'LogoBam.png'} alt="BAM Financeiro" className="h-12 w-auto object-contain" />
            <div className="text-center">
              <h1 className="text-white font-semibold text-base">BAM Financeiro</h1>
              <p className="text-xs text-gray-500 mt-1">Acesso restrito · Faça login para continuar</p>
            </div>
          </div>

          <div className="h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

          {/* formulário */}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                {error}
              </div>
            )}

            {/* campo email */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium">E-mail</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                  autoFocus
                  className="w-full text-sm text-white placeholder-gray-600 rounded-lg pl-9 pr-4 py-2.5 outline-none transition-all"
                  style={{
                    background: '#272C30',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(18,240,198,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
              </div>
            </div>

            {/* campo senha */}
            <div className="space-y-1.5">
              <label className="text-xs text-gray-400 font-medium">Senha</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full text-sm text-white placeholder-gray-600 rounded-lg pl-9 pr-10 py-2.5 outline-none transition-all"
                  style={{
                    background: '#272C30',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(18,240,198,0.4)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* botão entrar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              style={{
                background: loading ? 'rgba(18,240,198,0.6)' : '#12F0C6',
                color: '#000',
                boxShadow: loading ? 'none' : '0 0 20px rgba(18,240,198,0.15)',
              }}
            >
              {loading ? (
                <><Loader2 size={14} className="animate-spin" /> Entrando...</>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          <p className="text-center text-[10px] text-gray-700">
            Informações financeiras confidenciais · BAM Assessoria
          </p>
        </div>
      </div>
    </div>
  )
}
