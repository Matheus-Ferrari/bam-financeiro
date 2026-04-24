/**
 * conciliacao.js — Lógica de matching entre movimentos CSV e lançamentos internos.
 *
 * Sem efeitos colaterais. Tudo read-only.
 */

import { normalizeText } from './csvParser'

// ── Constantes ────────────────────────────────────────────────────────────

const DATE_TOLERANCE_DAYS = 3
const VALUE_TOLERANCE     = 0.05  // R$ 0,05 de tolerância por default

// ── Status de conciliação por movimento ───────────────────────────────────

export const STATUS_CONC = {
  MATCH:       'match',
  DIVERGENTE:  'divergente',
  SEM_MATCH:   'sem_match',
  DUPLICADO:   'duplicado',
  ERRO:        'erro',
}

export const STATUS_CONC_LABEL = {
  [STATUS_CONC.MATCH]:      'Match encontrado',
  [STATUS_CONC.DIVERGENTE]: 'Possível divergência',
  [STATUS_CONC.SEM_MATCH]:  'Sem correspondência',
  [STATUS_CONC.DUPLICADO]:  'Duplicado ignorado',
  [STATUS_CONC.ERRO]:       'Erro',
}

export const STATUS_CONC_COLOR = {
  [STATUS_CONC.MATCH]:      '#12F0C6',
  [STATUS_CONC.DIVERGENTE]: '#F59E0B',
  [STATUS_CONC.SEM_MATCH]:  '#EF4444',
  [STATUS_CONC.DUPLICADO]:  '#6B7280',
  [STATUS_CONC.ERRO]:       '#EF4444',
}

// ── Helpers de data ───────────────────────────────────────────────────────

function dateDiffDays(a, b) {
  const da = new Date(a)
  const db = new Date(b)
  return Math.abs((da - db) / 86_400_000)
}

// ── Helpers de texto ──────────────────────────────────────────────────────

/**
 * Pontuação de similaridade entre dois textos normalizados (0–1).
 * Usa interseção de palavras / união.
 */
function textSimilarity(a, b) {
  if (!a && !b) return 1
  if (!a || !b) return 0
  const wa = new Set(a.split(' ').filter(Boolean))
  const wb = new Set(b.split(' ').filter(Boolean))
  const intersection = [...wa].filter(w => wb.has(w)).length
  const union        = new Set([...wa, ...wb]).size
  if (union === 0) return 0
  return intersection / union
}

// ── Mapeamento de tipo ────────────────────────────────────────────────────

/**
 * Retorna true se o tipo do CSV e o tipo interno são compatíveis.
 * entrada (CSV) ↔ entrada (interno)
 * saida   (CSV) ↔ saida   (interno)
 */
function tiposCompativeis(csvType, internalType) {
  if (!internalType) return true // sem tipo definido, aceita
  const t = String(internalType).toLowerCase()
  if (csvType === 'entrada') return t === 'entrada' || t === 'credito' || t === 'receita'
  if (csvType === 'saida')   return t === 'saida'   || t === 'debito'  || t === 'despesa'
  return false
}

// ── Status de pagamento que conta como "realizado" ────────────────────────

const STATUS_REALIZADO = new Set(['pago', 'recebido', 'realizado', 'conciliado', 'parcial'])

export function isRealizado(lancamento) {
  const s = String(lancamento?.status_pagamento ?? lancamento?.status ?? '').toLowerCase()
  return STATUS_REALIZADO.has(s)
}

// ── Matching principal ────────────────────────────────────────────────────

/**
 * Tenta casar um item CSV com a melhor contraparte interna.
 * Retorna { status, match, divergencia } onde:
 *  - match:      lançamento interno mais próximo (ou null)
 *  - divergencia: objeto com detalhes das diferenças (ou null)
 */
export function matchItem(csvItem, lancamentos = []) {
  const candidatos = lancamentos.filter(l =>
    tiposCompativeis(csvItem.type, l.type)
  )

  let melhorScore = -1
  let melhorMatch = null

  for (const l of candidatos) {
    // Valor interno (campo normalizado)
    const valorInterno = l.amount ?? 0
    const dataCsv      = csvItem.date
    const dataInterno  = l.date ?? ''

    // 1. Diferença de valor
    const diffValor = Math.abs(csvItem.amount - valorInterno)
    if (diffValor > csvItem.amount * 0.15 + 1) continue  // >15% + R$1 → descarta

    // 2. Diferença de data
    const diffDias = dataInterno ? dateDiffDays(dataCsv, dataInterno) : 99
    if (diffDias > DATE_TOLERANCE_DAYS + 2) continue  // até 5 dias de folga para candidatos

    // 3. Similaridade textual
    const normInterno = l.normalizedDescription ?? normalizeText(l.description ?? '')
    const simTexto    = textSimilarity(csvItem.normalizedDescription, normInterno)

    // Score composto (quanto menor diff, maior score)
    const scoreValor = Math.max(0, 1 - diffValor / (csvItem.amount || 1))
    const scoreData  = Math.max(0, 1 - diffDias / (DATE_TOLERANCE_DAYS + 2))
    const score      = scoreValor * 0.45 + scoreData * 0.25 + simTexto * 0.30

    if (score > melhorScore) {
      melhorScore = score
      melhorMatch = { lancamento: l, score, diffValor, diffDias, simTexto }
    }
  }

  // Sem candidato suficientemente bom
  if (!melhorMatch || melhorScore < 0.25) {
    return { status: STATUS_CONC.SEM_MATCH, match: null, divergencia: null }
  }

  // Se o melhor match já foi conciliado no Firebase → Firebase é a fonte da verdade
  if (melhorMatch.lancamento.conciliado) {
    return { status: 'conciliado', match: melhorMatch.lancamento, divergencia: null }
  }

  const { lancamento, diffValor, diffDias } = melhorMatch
  const valorInterno = lancamento.amount ?? 0
  const dataInterno  = lancamento.date ?? ''

  // Match exato: valor OK + data OK
  const valorOk = diffValor <= VALUE_TOLERANCE
  const dataOk  = diffDias  <= DATE_TOLERANCE_DAYS

  if (valorOk && dataOk) {
    return { status: STATUS_CONC.MATCH, match: lancamento, divergencia: null }
  }

  // Divergência: parecido mas com diferença
  const divergencia = {
    dataCsv:       csvItem.date,
    dataInterno,
    valorCsv:      csvItem.amount,
    valorInterno,
    diffValor:     Math.round((csvItem.amount - valorInterno) * 100) / 100,
    diffDias,
    descricaoCsv:  csvItem.description,
    descricaoInt:  lancamento.description ?? '',
    clienteInt:    lancamento.cliente    ?? '',
    categoriaInt:  lancamento.categoria  ?? '',
    origemInt:     lancamento.origem     ?? '',
  }

  return { status: STATUS_CONC.DIVERGENTE, match: lancamento, divergencia }
}

// ── Conciliar lista inteira ───────────────────────────────────────────────

/**
 * Recebe items CSV + lançamentos internos.
 * Retorna array de ResultadoConciliacao:
 * {
 *   csvItem,
 *   status,
 *   match,        // lançamento interno (ou null)
 *   divergencia,  // detalhes de divergência (ou null)
 * }
 */
export function conciliarLista(csvItems = [], lancamentos = []) {
  return csvItems.map(csvItem => {
    const { status, match, divergencia } = matchItem(csvItem, lancamentos)
    return { csvItem, status, match, divergencia }
  })
}

// ── Cálculo de saldo realizado interno ───────────────────────────────────

/**
 * Calcula o saldo interno somente dos lançamentos realizados.
 * saldo = entradas realizadas - saídas realizadas
 */
export function calcularSaldoInternoRealizado(lancamentos = []) {
  let entradas = 0
  let saidas   = 0
  for (const l of lancamentos) {
    if (!isRealizado(l)) continue
    const v = l.amount ?? 0
    if (l.type === 'entrada') entradas += v
    else                      saidas   += v
  }
  return {
    entradas: Math.round(entradas * 100) / 100,
    saidas:   Math.round(saidas   * 100) / 100,
    saldo:    Math.round((entradas - saidas) * 100) / 100,
  }
}

// ── Resumo estatístico ────────────────────────────────────────────────────

/**
 * Conta resultados por status.
 */
export function resumoConciliacao(resultados = []) {
  const counts = {
    [STATUS_CONC.MATCH]:      0,
    [STATUS_CONC.DIVERGENTE]: 0,
    [STATUS_CONC.SEM_MATCH]:  0,
    [STATUS_CONC.DUPLICADO]:  0,
    [STATUS_CONC.ERRO]:       0,
  }
  for (const r of resultados) counts[r.status] = (counts[r.status] ?? 0) + 1
  return counts
}
