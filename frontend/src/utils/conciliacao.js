/**
 * conciliacao.js — Lógica de matching entre movimentos CSV e lançamentos internos.
 *
 * Estratégia:
 *  1. Para cada par (csv × interno) compatível, calcula um score (0–1).
 *  2. Aloca pares de forma GLOBAL e um-para-um (greedy por score):
 *     cada item do CSV é casado com no máximo UM lançamento interno
 *     e cada lançamento interno é consumido por no máximo UM item do CSV.
 *  3. Match exato (valor ≤ R$0,05 e data ≤ 3 dias) sempre é aceito,
 *     mesmo sem similaridade textual (ex.: pagamento de boleto recorrente).
 *
 * Sem efeitos colaterais. Tudo read-only.
 */

import { normalizeText } from './csvParser'

// ── Constantes ────────────────────────────────────────────────────────────

const DATE_TOLERANCE_DAYS    = 3        // diferença aceita como "data exata"
const DATE_CANDIDATE_WINDOW  = 45       // candidatos aceitos com até 45 dias de diferença
const VALUE_TOLERANCE        = 0.05     // R$ 0,05 → considerado "valor exato"
const VALUE_RELATIVE_TOL     = 0.05     // 5% de diferença relativa máxima para candidato
const VALUE_ABSOLUTE_TOL     = 2.00     // ou no mínimo R$ 2,00
const SCORE_MIN_GENERIC      = 0.32     // score mínimo para aceitar match com texto
const SCORE_MIN_VALUE_EXACT  = 0.20     // score mínimo quando valor é exato
const BOLETO_DATE_WINDOW     = 20       // janela maior para boletos recorrentes (sem nome)

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
 * Verifica se duas palavras são similares. Retorna score 0–1.
 * - igualdade exata: 1.0
 * - uma contém a outra (≥3 chars): 0.85  (ex.: "patrick" contém "patri")
 * - prefixo compartilhado de ≥4 chars: 0.80  (ex.: "patri" em "patrik" e "patrick")
 * - levenshtein ≤2 para palavras ≥5 chars: 0.75  (ex.: "patrik" vs "patrick")
 */
function wordsSimilar(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1.0
  const shorter = a.length <= b.length ? a : b
  const longer  = a.length <= b.length ? b : a

  if (shorter.length >= 3 && longer.includes(shorter)) return 0.85

  const prefixLen = Math.min(shorter.length, 5)
  if (prefixLen >= 4 && longer.startsWith(shorter.slice(0, prefixLen))) return 0.80

  if (shorter.length >= 5 && levenshtein(a, b) <= 2) return 0.75

  return 0
}

/**
 * Pontuação de similaridade entre dois textos normalizados (0–1).
 * Normaliza pelo lado MENOR — assim "patrick" (1 palavra) vs
 * "vendedor patrik" (2 palavras) dá score alto se a palavra menor encaixa.
 */
function textSimilarity(a, b) {
  if (!a && !b) return 1
  if (!a || !b) return 0
  const wa = [...new Set(a.split(' ').filter(Boolean))]
  const wb = [...new Set(b.split(' ').filter(Boolean))]
  if (!wa.length || !wb.length) return 0

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

  const minSize = Math.min(wa.length, wb.length)
  return minSize === 0 ? 0 : totalScore / minSize
}

// ── Detecção de "boleto/genérico" ─────────────────────────────────────────

/**
 * Detecta se a descrição CSV é genérica (ex.: "Pagamento de boleto efetuado")
 * sem nome de beneficiário identificável. Nesse caso afrouxamos as regras
 * textuais e confiamos em valor + data.
 */
function isCsvGenericoSemNome(csvItem) {
  const pixName = (csvItem.pixName || '').trim()
  if (pixName.length >= 3) return false
  const desc = (csvItem.description || '').toLowerCase()
  return /boleto|debito automatico|tarifa|encargo|imposto|tributo|iof|juros|cobranca/.test(desc)
}

// ── Mapeamento de tipo ────────────────────────────────────────────────────

/**
 * Retorna true se o tipo do CSV e o tipo interno são compatíveis.
 */
function tiposCompativeis(csvType, internalType) {
  if (!internalType) return true
  const t = String(internalType).toLowerCase()
  if (csvType === 'entrada') return t === 'entrada' || t === 'credito' || t === 'receita' || t === 'recebimento'
  if (csvType === 'saida')   return t === 'saida'   || t === 'debito'  || t === 'despesa'  || t === 'pagamento'
  return false
}

// ── Status de pagamento que conta como "realizado" ────────────────────────

const STATUS_REALIZADO = new Set(['pago', 'recebido', 'realizado', 'conciliado', 'parcial'])

export function isRealizado(lancamento) {
  const s = String(lancamento?.status_pagamento ?? lancamento?.status ?? '').toLowerCase()
  return STATUS_REALIZADO.has(s)
}

// ── Cálculo de score de um par (csv × interno) ────────────────────────────

/**
 * Avalia um par. Retorna `null` se o par não for nem candidato.
 * Caso contrário retorna { score, diffValor, diffDias, simTexto, valorExato, dataExata }.
 */
function avaliarPar(csvItem, lanc) {
  if (!tiposCompativeis(csvItem.type, lanc.type)) return null

  const valorInterno = lanc.amount ?? 0
  const dataInterno  = lanc.date ?? ''

  const diffValor = Math.abs(csvItem.amount - valorInterno)
  const diffDias  = dataInterno ? dateDiffDays(csvItem.date, dataInterno) : 999

  const valorExato = diffValor <= VALUE_TOLERANCE
  const dataExata  = diffDias  <= DATE_TOLERANCE_DAYS

  // 1. Filtro de valor: aceita se for exato ou dentro de tolerância relativa/absoluta
  const tolValor = Math.max(VALUE_ABSOLUTE_TOL, csvItem.amount * VALUE_RELATIVE_TOL)
  if (!valorExato && diffValor > tolValor) return null

  // 2. Filtro de data: 45 dias por padrão; boletos genéricos só até 20 dias
  const generico = isCsvGenericoSemNome(csvItem)
  const janelaData = generico ? BOLETO_DATE_WINDOW : DATE_CANDIDATE_WINDOW
  if (diffDias > janelaData) return null

  // 3. Similaridade textual
  const csvTextRef = (csvItem.pixName && csvItem.pixName.length > 1)
    ? csvItem.pixName
    : csvItem.normalizedDescription
  const normInterno = lanc.normalizedDescription ?? normalizeText(lanc.description ?? '')
  const normCliente = normalizeText(lanc.cliente ?? '')
  const simDesc    = textSimilarity(csvTextRef, normInterno)
  const simCliente = normCliente ? textSimilarity(csvTextRef, normCliente) : 0
  const simTexto   = Math.max(simDesc, simCliente)

  // 4. Filtro anti-falso-positivo
  //    - valor + data exatos          → aceita sempre
  //    - valor exato (recorrente)     → aceita até 20d sem texto
  //    - caso geral                   → exige simTexto ≥ 0.10
  if (!(valorExato && dataExata)) {
    if (valorExato && diffDias <= BOLETO_DATE_WINDOW) {
      // OK — recorrente / boleto
    } else if (simTexto < 0.10) {
      return null
    }
  }

  // 5. Score final (0–1)
  const scoreValor = valorExato ? 1.0 : Math.max(0, 1 - diffValor / Math.max(csvItem.amount, 1))
  const scoreData  = Math.max(0, 1 - diffDias / DATE_CANDIDATE_WINDOW)
  let score = scoreValor * 0.45 + scoreData * 0.20 + simTexto * 0.35

  if (valorExato && dataExata)            score = Math.max(score, 0.85)
  else if (valorExato && simTexto >= 0.30) score = Math.max(score, 0.70)

  return { score, diffValor, diffDias, simTexto, valorExato, dataExata }
}

// ── Matching principal (alocação global um-para-um) ──────────────────────

/**
 * Recebe items CSV + lançamentos internos.
 * Retorna array de ResultadoConciliacao:
 * {
 *   csvItem,
 *   status,
 *   match,        // lançamento interno (ou null)
 *   divergencia,  // detalhes de divergência (ou null)
 *   score,        // score do match (debug)
 * }
 *
 * Algoritmo:
 *  1. Constrói TODOS os pares candidatos com score.
 *  2. Ordena por score desc (desempate: valor exato > data exata > menor diffDias).
 *  3. Aloca greedy um-para-um: cada CSV ↔ no máximo 1 interno e vice-versa.
 *  4. csvItems sem alocação → SEM_MATCH.
 */
export function conciliarLista(csvItems = [], lancamentos = []) {
  if (!lancamentos.length) {
    return csvItems.map(csvItem => ({
      csvItem,
      status:      STATUS_CONC.SEM_MATCH,
      match:       null,
      score:       0,
      divergencia: null,
    }))
  }

  // 1. Gerar pares candidatos
  const pares = []
  for (let i = 0; i < csvItems.length; i++) {
    const csv = csvItems[i]
    for (let j = 0; j < lancamentos.length; j++) {
      const lanc = lancamentos[j]
      const info = avaliarPar(csv, lanc)
      if (!info) continue
      const minScore = info.valorExato ? SCORE_MIN_VALUE_EXACT : SCORE_MIN_GENERIC
      if (info.score < minScore) continue
      pares.push({ i, j, ...info })
    }
  }

  // 2. Ordenar
  pares.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    if (a.valorExato !== b.valorExato) return a.valorExato ? -1 : 1
    if (a.dataExata !== b.dataExata) return a.dataExata ? -1 : 1
    return a.diffDias - b.diffDias
  })

  // 3. Alocação greedy um-para-um
  const csvUsed  = new Array(csvItems.length).fill(false)
  const lancUsed = new Array(lancamentos.length).fill(false)
  const assigned = new Map()

  for (const par of pares) {
    if (csvUsed[par.i] || lancUsed[par.j]) continue
    csvUsed[par.i]  = true
    lancUsed[par.j] = true
    assigned.set(par.i, par)
  }

  // 4. Construir resultados
  return csvItems.map((csvItem, i) => {
    const par = assigned.get(i)
    if (!par) {
      return { csvItem, status: STATUS_CONC.SEM_MATCH, match: null, score: 0, divergencia: null }
    }
    const lanc = lancamentos[par.j]

    if (lanc.conciliado) {
      return { csvItem, status: 'conciliado', match: lanc, score: par.score, divergencia: null }
    }

    if (par.valorExato && par.dataExata) {
      return { csvItem, status: STATUS_CONC.MATCH, match: lanc, score: par.score, divergencia: null }
    }

    const divergencia = {
      dataCsv:       csvItem.date,
      dataInterno:   lanc.date ?? '',
      valorCsv:      csvItem.amount,
      valorInterno:  lanc.amount ?? 0,
      diffValor:     Math.round((csvItem.amount - (lanc.amount ?? 0)) * 100) / 100,
      diffDias:      par.diffDias,
      descricaoCsv:  csvItem.description,
      descricaoInt:  lanc.description ?? '',
      clienteInt:    lanc.cliente    ?? '',
      categoriaInt:  lanc.categoria  ?? '',
      origemInt:     lanc.origem     ?? '',
    }

    return { csvItem, status: STATUS_CONC.DIVERGENTE, match: lanc, score: par.score, divergencia }
  })
}

/**
 * Mantida para retrocompatibilidade — agora um wrapper sobre `conciliarLista`.
 * Não deve ser usada para lotes (não trata exclusividade entre csvItems).
 */
export function matchItem(csvItem, lancamentos = []) {
  const [resultado] = conciliarLista([csvItem], lancamentos)
  return {
    status:      resultado?.status ?? STATUS_CONC.SEM_MATCH,
    match:       resultado?.match ?? null,
    divergencia: resultado?.divergencia ?? null,
  }
}

// ── Cálculo de saldo realizado interno ───────────────────────────────────

/**
 * Calcula o saldo interno somente dos lançamentos realizados.
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
