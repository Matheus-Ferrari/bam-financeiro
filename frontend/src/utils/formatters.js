/**
 * Formata número para moeda brasileira: R$ 1.234,56
 */
export const formatCurrency = (value) => {
  if (value == null || isNaN(value)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value)
}

/**
 * Formato compacto: R$ 1,5M / R$ 150k
 */
export const formatCompact = (value) => {
  if (value == null || isNaN(value)) return '—'
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 1_000)     return `${sign}R$ ${(abs / 1_000).toFixed(1).replace('.', ',')}k`
  return formatCurrency(value)
}

/**
 * Percentual com "+" em positivos: +12,5%
 */
export const formatPercent = (value, decimals = 1, showSign = false) => {
  if (value == null || isNaN(value)) return '—'
  const fmt = `${Math.abs(value).toFixed(decimals).replace('.', ',')}%`
  if (!showSign) return fmt
  return value >= 0 ? `+${fmt}` : `-${fmt}`
}
