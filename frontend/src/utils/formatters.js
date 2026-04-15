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

/**
 * Formata data ISO (YYYY-MM-DD) para DD/MM/YYYY sem problemas de fuso horário.
 * Ex: '2026-04-15' → '15/04/2026'
 */
export const formatDate = (value) => {
  if (!value) return '—'
  const [yyyy, mm, dd] = String(value).slice(0, 10).split('-')
  if (!yyyy || !mm || !dd) return String(value)
  return `${dd}/${mm}/${yyyy}`
}

/**
 * Formata data ISO para mês/ano curto: 'Abr/26'
 */
export const formatMonthYear = (value) => {
  if (!value) return '—'
  const MESES = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  const [yyyy, mm] = String(value).slice(0, 10).split('-')
  if (!yyyy || !mm) return String(value)
  const m = parseInt(mm, 10)
  return `${MESES[m - 1] ?? mm}/${String(yyyy).slice(2)}`
}
