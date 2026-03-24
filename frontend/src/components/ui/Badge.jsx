/**
 * Badge colorido para status e categorias.
 * variant: 'success' | 'warning' | 'error' | 'info' | 'neutral'
 */
const VARIANTS = {
  success: { bg: 'rgba(18,240,198,0.12)', color: '#12F0C6', dot: '#12F0C6' },
  warning: { bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', dot: '#F59E0B' },
  error:   { bg: 'rgba(239,68,68,0.12)',  color: '#EF4444', dot: '#EF4444' },
  info:    { bg: 'rgba(99,102,241,0.12)', color: '#818CF8', dot: '#818CF8' },
  neutral: { bg: 'rgba(255,255,255,0.07)',color: '#9CA3AF', dot: '#9CA3AF' },
}

export default function Badge({ children, variant = 'neutral', dot = false }) {
  const s = VARIANTS[variant] || VARIANTS.neutral
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.color }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />}
      {children}
    </span>
  )
}
