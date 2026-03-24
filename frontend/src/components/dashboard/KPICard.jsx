import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { formatCompact, formatPercent } from '../../utils/formatters'

/**
 * Card de KPI com ícone, valor principal e variação.
 * Props: title, value (number), format='currency'|'percent'|'number',
 *        icon (Lucide), trend (number %), color, loading
 */
export default function KPICard({ title, value, formatted, trend, icon: Icon, color = '#12F0C6', subtitle, loading }) {
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus
  const trendColor = trend > 0 ? '#12F0C6' : trend < 0 ? '#EF4444' : '#9CA3AF'

  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-3 relative overflow-hidden transition-all hover:border-opacity-30"
      style={{ background: '#272C30', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      {/* Glow de fundo sutil */}
      <div
        className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 blur-2xl pointer-events-none"
        style={{ background: color, transform: 'translate(30%, -30%)' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
               style={{ background: `${color}18` }}>
            <Icon size={15} style={{ color }} />
          </div>
        )}
      </div>

      {/* Valor */}
      {loading ? (
        <div className="h-8 w-32 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
      ) : (
        <p className="text-2xl font-bold text-white tracking-tight leading-none">
          {formatted ?? '—'}
        </p>
      )}

      {/* Rodapé */}
      <div className="flex items-center gap-2">
        {trend != null && (
          <div className="flex items-center gap-1">
            <TrendIcon size={12} style={{ color: trendColor }} />
            <span className="text-xs font-medium" style={{ color: trendColor }}>
              {formatPercent(Math.abs(trend), 1, false)} vs mês ant.
            </span>
          </div>
        )}
        {subtitle && <span className="text-xs text-gray-600">{subtitle}</span>}
      </div>
    </div>
  )
}
