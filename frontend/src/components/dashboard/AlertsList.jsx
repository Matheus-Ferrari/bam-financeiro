import { CheckCircle, AlertTriangle, TrendingUp, TrendingDown, Info } from 'lucide-react'
import LoadingSpinner from '../ui/LoadingSpinner'
import EmptyState from '../ui/EmptyState'

const ICON_MAP = {
  CheckCircle:  CheckCircle,
  AlertTriangle: AlertTriangle,
  TrendingUp:   TrendingUp,
  TrendingDown: TrendingDown,
  Info:         Info,
}

const TIPO_STYLE = {
  success: { color: '#12F0C6', bg: 'rgba(18,240,198,0.08)',  border: 'rgba(18,240,198,0.20)' },
  warning: { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.20)' },
  error:   { color: '#EF4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.20)'  },
  info:    { color: '#818CF8', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.20)' },
}

export default function AlertsList({ data, loading, error }) {
  if (loading) return <LoadingSpinner label="Carregando alertas..." />
  if (error)   return <p className="text-xs text-red-400">{error}</p>

  const alertas = data?.alertas ?? []
  if (!alertas.length) return <EmptyState title="Nenhum alerta" description="Tudo certo com as métricas." />

  return (
    <div className="space-y-2">
      {alertas.map((alerta, i) => {
        const s    = TIPO_STYLE[alerta.tipo] || TIPO_STYLE.info
        const Icon = ICON_MAP[alerta.icone] || Info
        return (
          <div
            key={i}
            className="flex items-start gap-3 rounded-lg p-3 border"
            style={{ background: s.bg, borderColor: s.border }}
          >
            <div className="flex-shrink-0 mt-0.5">
              <Icon size={14} style={{ color: s.color }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold" style={{ color: s.color }}>{alerta.titulo}</p>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{alerta.descricao}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
