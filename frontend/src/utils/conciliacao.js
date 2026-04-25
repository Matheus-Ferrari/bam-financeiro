/**
 * conciliacao.js — Lógica de matching entre movimentos CSV e lançamentos internos.
 *
 * Sem efeitos colaterais. Tudo read-only.
 */

import { normalizeText } from './csvParser'

// ── Constantes ────────────────────────────────────────────────────────────

const DATE_TOLERANCE_DAYS    = 3
const DATE_CANDIDATE_WINDOW  = 45   // candidatos aceitos com até 45 dias de diferença
const VALUE_TOLERANCE        = 0.05 // R$ 0,05 de tolerância por default

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
 * Distância de Levenshtein entre duas strings curtas.
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    }
  }
  return dp[m][n]
}

/**
 * Verifica se duas palavras são similares:
 * - igualdade exata: 1.0
 * - prefixo compartilhado de ≥5 chars: 0.80  (ex: "patri" em "patrik" e "patrick")
 * - uma contém a outra (mín 2 chars): 0.65  (ex: "fe" em "fernanda")
 * - levenshtein ≤2 para palavras ≥5 chars: 0.70  (ex: "eletrotec" vs "electrotec")
 */
function wordsSimilar(a, b) {
  if (a === b) return 1.0
  const shorter = a.length <= b.length ? a : b
  const longer  = a.length <= b.length ? b : a
  const prefixLen = Math.min(shorter.length, 5)
  if (prefixLen >= 3 && longer.startsWith(shorter.slice(0, prefixLen))) return 0.80
  if (shorter.length >= 2 && longer.includes(shorter)) return 0.65
  if (shorter.length >= 5 && levenshtein(a, b) <= 2) return 0.70
  return 0
}

/**
 * Pontuação de similaridade entre dois textos normalizados (0–1).
 * Usa interseção de palavras / união, com crédito parcial por prefixo/conteúdo.
 */
function textSimilarity(a, b) {
  if (!a && !b) return 1
  if (!a || !b) return 0
  const wa = [...new Set(a.split(' ').filter(Boolean))]
  const wb = [...new Set(b.split(' ').filter(Boolean))]

  let totalScore = 0
  const usedB = new Set()

  for (const wordA of wa) {
    let best = 0
    let bestJ = -1
    for (let j = 0; j < wb.length; j++) {
      if (usedB.has(j)) continue
      const s = wordsSimilar(wordA, wb[j])
      if (s > best) { best = s; bestJ = j }
    }
    if (bestJ !== -1 && best > 0) {
      usedB.add(bestJ)
      totalScore += best
    }
  }

  const union = new Set([...wa, ...wb]).size
  return union === 0 ? 0 : totalScore / union
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

  // Texto de comparação: nome extraído do Pix > descrição completa
  const csvTextRef = (csvItem.pixName && csvItem.pixName.length > 1)
    ? csvItem.pixName
    : csvItem.normalizedDescription

  let melhorScore = -1
  let melhorMatch = null

  for (const l of candidatos) {
    const valorInterno = l.amount ?? 0
    const dataCsv      = csvItem.date
    const dataInterno  = l.date ?? ''

    // 1. Diferença de valor — descarta se muito diferente (tolerância 35%)
    const diffValor = Math.abs(csvItem.amount - valorInterno)
    if (diffValor > csvItem.amount * 0.35 + 5) continue

    // 2. Diferença de data — janela ampliada para 45 dias
    const diffDias = dataInterno ? dateDiffDays(dataCsv, dataInterno) : 99
    if (diffDias > DATE_CANDIDATE_WINDOW) continue

    // 3. Similaridade textual usando nome do Pix (ou descrição normalizada)
    //    Também compara contra l.cliente normalizado (ex: CSV "eletrotec" vs interno cliente "Electrotec")
    const normInterno  = l.normalizedDescription ?? normalizeText(l.description ?? '')
    const normCliente  = normalizeText(l.cliente ?? '')
    const simTextoDesc   = textSimilarity(csvTextRef, normInterno)
    const simTextoClient = normCliente ? textSimilarity(csvTextRef, normCliente) : 0
    const simTexto       = Math.max(simTextoDesc, simTextoClient)

    // 4. Rejeitar false positives: texto sem qualquer sobreposição
    //    só aceita se valor E data forem exatos (match cirúrgico)
    const valorExato = diffValor < VALUE_TOLERANCE
    const dataExata  = diffDias  < 1
    if (simTexto < 0.08 && !(valorExato && dataExata)) continue

    // Score: texto é o critério principal agora
    const scoreValor = Math.max(0, 1 - diffValor / (csvItem.amount || 1))
    const scoreData  = Math.max(0, 1 - diffDias  / DATE_CANDIDATE_WINDOW)
    const score      = scoreValor * 0.40 + scoreData * 0.15 + simTexto * 0.45

    if (score > melhorScore) {
      melhorScore = score
      melhorMatch = { lancamento: l, score, diffValor, diffDias, simTexto }
    }
  }

  // Sem candidato suficientemente bom
  if (!melhorMatch || melhorScore < 0.28) {
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
