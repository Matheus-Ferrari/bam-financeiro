/**
 * financeiroUtils.js — helpers de cálculo e lógica financeira centralizados.
 *
 * Centraliza: status, cores, cálculo de saldo, previsto vs realizado,
 * conciliação e helpers de formatação de período.
 */

// ── Status de pagamento ───────────────────────────────────────────────────

export const STATUS_PAGAMENTO = {
  pago:     { label: 'Pago',     badgeVariant: 'success', cor: '#12F0C6' },
  recebido: { label: 'Recebido', badgeVariant: 'success', cor: '#12F0C6' },
  previsto: { label: 'Previsto', badgeVariant: 'info',    cor: '#818CF8' },
  pendente: { label: 'Pendente', badgeVariant: 'warning', cor: '#F59E0B' },
  parcial:  { label: 'Parcial',  badgeVariant: 'warning', cor: '#F59E0B' },
  vencido:  { label: 'Vencido',  badgeVariant: 'error',   cor: '#EF4444' },
  cancelado:{ label: 'Cancelado',badgeVariant: 'neutral', cor: '#6B7280' },
}

export const STATUS_CONCILIACAO = {
  conciliado: { label: 'Conciliado', badgeVariant: 'success', cor: '#12F0C6' },
  pendente:   { label: 'Pendente',   badgeVariant: 'warning', cor: '#F59E0B' },
  divergente: { label: 'Divergente', badgeVariant: 'error',   cor: '#EF4444' },
}

export const ORIGENS = {
  cliente_mensal:    'Cliente Mensal',
  projeto_adicional: 'Proj. Adicional',
  comissao:          'Comissão',
  despesa_fixa:      'Despesa Fixa',
  despesa_variavel:  'Despesa Variável',
  ajuste_manual:     'Ajuste Manual',
  transferencia:     'Transferência',
  tarifa_bancaria:   'Tarifa Bancária',
}

export const TIPO_LANCAMENTO = {
  entrada: { label: 'Entrada', cor: '#12F0C6', badgeVariant: 'success' },
  saida:   { label: 'Saída',   cor: '#EF4444', badgeVariant: 'error'   },
}

// ── Cálculos de saldo ────────────────────────────────────────────────────

/**
 * Calcula saldo inicial + entradas - saídas a partir de uma lista de lançamentos.
 * @param {Array}  lancamentos
 * @param {number} saldoInicial
 */
export function calcularSaldo(lancamentos = [], saldoInicial = 0) {
  const entradas = lancamentos
    .filter(l => l.tipo === 'entrada')
    .reduce((acc, l) => acc + (l.valor_realizado ?? l.valor_previsto ?? 0), 0)
  const saidas = lancamentos
    .filter(l => l.tipo === 'saida')
    .reduce((acc, l) => acc + (l.valor_realizado ?? l.valor_previsto ?? 0), 0)
  return {
    entradas: round2(entradas),
    saidas:   round2(saidas),
    saldo:    round2(saldoInicial + entradas - saidas),
  }
}

/**
 * Calcula divergência entre previsto e realizado.
 */
export function calcularDivergencia(previsto = 0, realizado = 0) {
  return round2(realizado - previsto)
}

/**
 * Retorna o percentual que `parte` representa de `total`.
 */
export function pct(parte, total) {
  if (!total) return 0
  return round2((parte / total) * 100)
}

// ── Cálculo de status automático ─────────────────────────────────────────

/**
 * Determina o status de um lançamento com base nos valores e datas.
 */
export function calcularStatus(lancamento) {
  const { tipo, valor_previsto, valor_realizado, data_vencimento, status } = lancamento
  if (status) return status  // usa o que veio do backend

  const venc = data_vencimento ? new Date(data_vencimento) : null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  if (valor_realizado >= valor_previsto && valor_previsto > 0) {
    return tipo === 'entrada' ? 'recebido' : 'pago'
  }
  if (valor_realizado > 0 && valor_realizado < valor_previsto) {
    return 'parcial'
  }
  if (venc && venc < hoje) return 'vencido'
  return 'previsto'
}

// ── Helpers de data ──────────────────────────────────────────────────────

export function mesAtualNum() {
  return new Date().getMonth() + 1
}

export function anoAtual() {
  return new Date().getFullYear()
}

export function dataHojeISO() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Retorna datas de início e fim de um período pré-definido.
 * period: 'hoje' | 'semana' | 'mes' | 'trimestre' | 'ano'
 */
export function periodoToRange(period) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const iso = (d) => d.toISOString().slice(0, 10)

  switch (period) {
    case 'hoje': {
      return { inicio: iso(hoje), fim: iso(hoje) }
    }
    case 'semana': {
      const dom = new Date(hoje)
      dom.setDate(hoje.getDate() - hoje.getDay())
      const sab = new Date(dom)
      sab.setDate(dom.getDate() + 6)
      return { inicio: iso(dom), fim: iso(sab) }
    }
    case 'mes': {
      const ini = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
      const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0)
      return { inicio: iso(ini), fim: iso(fim) }
    }
    case 'trimestre': {
      const trimestre = Math.floor(hoje.getMonth() / 3)
      const ini = new Date(hoje.getFullYear(), trimestre * 3, 1)
      const fim = new Date(hoje.getFullYear(), trimestre * 3 + 3, 0)
      return { inicio: iso(ini), fim: iso(fim) }
    }
    case 'ano': {
      return {
        inicio: `${hoje.getFullYear()}-01-01`,
        fim:    `${hoje.getFullYear()}-12-31`,
      }
    }
    default:
      return { inicio: null, fim: null }
  }
}

/**
 * Filtra lista de lançamentos por range de datas (campo data_competencia).
 */
export function filtrarPorPeriodo(lancamentos = [], inicio, fim) {
  if (!inicio && !fim) return lancamentos
  return lancamentos.filter(l => {
    const d = l.data_competencia
    if (!d) return true
    if (inicio && d < inicio) return false
    if (fim    && d > fim)    return false
    return true
  })
}

// ── Utilitários gerais ───────────────────────────────────────────────────

export function round2(n) {
  return Math.round((n || 0) * 100) / 100
}

export function statusPagamentoBadge(status) {
  return STATUS_PAGAMENTO[status?.toLowerCase()] ?? STATUS_PAGAMENTO.pendente
}

export function statusConciliacaoBadge(status) {
  return STATUS_CONCILIACAO[status?.toLowerCase()] ?? STATUS_CONCILIACAO.pendente
}

export function origemLabel(origem) {
  return ORIGENS[origem] ?? origem ?? '—'
}

export function tipoLabel(tipo) {
  return TIPO_LANCAMENTO[tipo]?.label ?? tipo ?? '—'
}
