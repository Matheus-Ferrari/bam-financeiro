/**
 * csvParser.js — Leitura e normalização do extrato CSV da Nubank.
 *
 * Regras:
 *  - Tudo é processado em memória (FileReader), nunca salvo em disco.
 *  - valor positivo = entrada, negativo = saída.
 *  - normalizedKey = date + "|" + amount + "|" + normalizedDescription
 */

// ── Remoção de acentos ────────────────────────────────────────────────────

export function removeAccents(str) {
  return String(str)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

// ── Palavras genéricas a remover da descrição para comparação ─────────────

const STOP_WORDS = new Set([
  'pix', 'transferencia', 'transferencia para', 'transferencia de',
  'enviado', 'enviada', 'recebido', 'recebida',
  'pagamento', 'compra', 'nubank', 'boleto',
  'credito', 'debito', 'no', 'na', 'de', 'da', 'do', 'para', 'em', 'a',
  'os', 'as', 'um', 'uma', 'e', 'o', 'que',
])

/**
 * Extrai o nome do pagador/beneficiário de descrições de Pix e boleto.
 *
 * Exemplos:
 *   "Transferência enviada pelo Pix - THAIS DOS SANTOS - CPF - NU PAGA..."
 *   → "THAIS DOS SANTOS"
 *
 *   "Pagamento Recebido - ATLAS ENGENHARIA - 12.345..." → "ATLAS ENGENHARIA"
 *   "Pagamento de boleto efetuado - CAIXA ECONOMICA..." → "CAIXA ECONOMICA"
 */
export function extractPixName(description) {
  if (!description) return ''
  const s = description.trim()

  // Divide pelo separador " - " (padrão Nubank)
  const parts = s.split(/\s*[-\u2013]\s*/)

  // "Transferência enviada pelo Pix - NOME - ..." ou "... Pix - NOME - ..."
  const pixIdx = parts.findIndex(p => /\bpix\b/i.test(p))
  if (pixIdx !== -1 && pixIdx + 1 < parts.length) {
    const candidate = parts[pixIdx + 1].trim()
    // Aceita apenas se parecer um nome (só letras e espaços, 2-60 chars)
    if (/^[A-Za-z\u00C0-\u00FF\s]{2,60}$/.test(candidate)) return candidate
  }

  // "Pagamento Recebido - NOME - ..."
  if (/^pagamento\s+recebido/i.test(s) && parts.length >= 2) {
    const candidate = parts[1].trim()
    if (/^[A-Za-z\u00C0-\u00FF\s]{2,60}$/.test(candidate)) return candidate
  }

  // "Pagamento de boleto efetuado - NOME - ..."
  if (/^pagamento\s+de\s+boleto/i.test(s) && parts.length >= 2) {
    const candidate = parts[1].trim()
    if (/^[A-Za-z\u00C0-\u00FF\s]{2,60}$/.test(candidate)) return candidate
  }

  return ''
}

/**
 * Normaliza texto para comparação fuzzy:
 * - remove acentos
 * - minúsculas
 * - remove pontuação e caracteres especiais
 * - remove stop words
 * - colapsa espaços
 */
export function normalizeText(text) {
  if (!text) return ''
  let s = removeAccents(String(text))
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const words = s.split(' ').filter(w => w.length > 1 && !STOP_WORDS.has(w))
  return words.join(' ')
}

// ── Parser CSV simples (sem deps externas) ────────────────────────────────

/**
 * Faz parse de uma string CSV respeitando campos entre aspas.
 * Retorna array de arrays.
 */
function parseCSVString(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  return lines
    .map(line => {
      const row = []
      let current = ''
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const ch = line[i]
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
          else inQuotes = !inQuotes
        } else if (ch === ',' && !inQuotes) {
          row.push(current.trim())
          current = ''
        } else {
          current += ch
        }
      }
      row.push(current.trim())
      return row
    })
    .filter(r => r.some(c => c !== ''))
}

// ── Mapeamento de colunas Nubank ──────────────────────────────────────────

const COL_ALIASES = {
  date:        ['data', 'date'],
  description: ['descricao', 'description', 'historico', 'memo', 'lancamento'],
  amount:      ['valor', 'amount', 'value', 'montante'],
  identifier:  ['identificador', 'identifier', 'id', 'autorizacao', 'autenticacao'],
}

function findColumn(headers, aliases) {
  const normalized = headers.map(h => removeAccents(h).toLowerCase().trim())
  for (const alias of aliases) {
    const idx = normalized.findIndex(h => h.includes(alias))
    if (idx !== -1) return idx
  }
  return -1
}

// ── Parsing de data ───────────────────────────────────────────────────────

function parseDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // DD/MM/YYYY
  const dmyMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`

  // DD/MM/YY
  const dmyShort = s.match(/^(\d{2})\/(\d{2})\/(\d{2})$/)
  if (dmyShort) return `20${dmyShort[3]}-${dmyShort[2]}-${dmyShort[1]}`

  // MM/DD/YYYY (fallback)
  const mdyMatch = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (mdyMatch) return `${mdyMatch[3]}-${mdyMatch[1]}-${mdyMatch[2]}`

  return null
}

// ── Parsing de valor ──────────────────────────────────────────────────────

/**
 * Converte string de valor para float, suportando BRL e en-US:
 *
 * BRL  → "600,00"    "1.200,50"   "-600,00"   "R$ 1.200,50"
 * en-US → "600.00"   "1200.50"    "-600.00"
 *
 * Regra: se contém vírgula → BRL (vírgula é decimal).
 *        se contém apenas pontos → en-US (ponto é decimal, NÃO remover).
 *
 * Bug corrigido: a versão anterior removia TODOS os pontos, transformando
 * "600.00" em "60000". Agora, sem vírgula, o valor é tratado como en-US.
 */
function parseAmount(raw) {
  if (raw == null || raw === '') return NaN
  let s = String(raw)
    .replace(/R\$\s*/i, '')
    .replace(/\s+/g, '')
    .trim()
  if (!s) return NaN

  if (s.includes(',')) {
    // Formato BRL: "1.200,50" → remove milhar, troca vírgula por ponto
    return parseFloat(s.replace(/\./g, '').replace(',', '.'))
  }
  // Formato en-US ou inteiro: "1200.50" / "1200" → não mexe nos pontos
  return parseFloat(s)
}

// ── Função principal de parse ─────────────────────────────────────────────

/**
 * Recebe o conteúdo string do CSV e retorna um objeto com:
 * {
 *   items: NubankItem[],
 *   duplicados: number,
 *   erros: number,
 *   totalEntradas: number,
 *   totalSaidas: number,
 *   saldoLiquido: number,
 * }
 *
 * Cada NubankItem:
 * {
 *   id:                    string (gerado),
 *   date:                  "YYYY-MM-DD",
 *   description:           string,
 *   amount:                number (sempre positivo),
 *   type:                  "entrada" | "saida",
 *   source:                "nubank_csv",
 *   normalizedDescription: string,
 *   normalizedKey:         string,
 *   raw:                   object,
 * }
 */
export function parseNubankCSV(csvText) {
  const rows = parseCSVString(csvText)
  if (rows.length < 2) {
    return { items: [], duplicados: 0, erros: 0, totalEntradas: 0, totalSaidas: 0, saldoLiquido: 0, parseError: 'CSV vazio ou sem cabeçalho' }
  }

  const headers = rows[0]
  const colDate  = findColumn(headers, COL_ALIASES.date)
  const colDesc  = findColumn(headers, COL_ALIASES.description)
  const colAmt   = findColumn(headers, COL_ALIASES.amount)
  const colId    = findColumn(headers, COL_ALIASES.identifier)

  if (colDate === -1 || colDesc === -1 || colAmt === -1) {
    const found = headers.join(', ')
    return {
      items: [], duplicados: 0, erros: 0,
      totalEntradas: 0, totalSaidas: 0, saldoLiquido: 0,
      parseError: `Colunas obrigatórias não encontradas. Colunas detectadas: ${found}`,
    }
  }

  const items = []
  let erros = 0
  const seenKeys = new Set()
  let duplicados = 0

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]
    if (row.every(c => c === '')) continue

    const rawDate  = row[colDate]  ?? ''
    const rawDesc  = row[colDesc]  ?? ''
    const rawAmt   = row[colAmt]   ?? ''
    const rawId    = colId !== -1 ? (row[colId] ?? '') : ''

    const date   = parseDate(rawDate)
    const amount = parseAmount(rawAmt)

    if (!date || isNaN(amount)) {
      erros++
      continue
    }

    const type        = amount >= 0 ? 'entrada' : 'saida'
    const absAmount   = Math.abs(amount)
    const normDesc    = normalizeText(rawDesc)
    const pixName     = normalizeText(extractPixName(rawDesc))
    const normKey     = `${date}|${absAmount.toFixed(2)}|${normDesc}`

    // Detectar duplicados por chave exata
    if (seenKeys.has(normKey)) {
      duplicados++
      continue
    }
    seenKeys.add(normKey)

    // Objeto original (raw)
    const rawObj = {}
    headers.forEach((h, idx) => { rawObj[h] = row[idx] ?? '' })

    items.push({
      id:                    `csv-${i}-${Date.now()}`,
      date,
      description:           rawDesc.trim(),
      amount:                absAmount,
      type,
      source:                'nubank_csv',
      normalizedDescription: normDesc,
      pixName,
      normalizedKey:         normKey,
      identifier:            rawId,
      raw:                   rawObj,
    })
  }

  // Totais
  const totalEntradas = items
    .filter(it => it.type === 'entrada')
    .reduce((s, it) => s + it.amount, 0)
  const totalSaidas = items
    .filter(it => it.type === 'saida')
    .reduce((s, it) => s + it.amount, 0)

  return {
    items,
    duplicados,
    erros,
    totalEntradas: Math.round(totalEntradas * 100) / 100,
    totalSaidas:   Math.round(totalSaidas   * 100) / 100,
    saldoLiquido:  Math.round((totalEntradas - totalSaidas) * 100) / 100,
  }
}

/**
 * Lê um File (input[type=file]) via FileReader e resolve a string.
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target.result)
    reader.onerror = () => reject(new Error('Erro ao ler o arquivo'))
    reader.readAsText(file, 'UTF-8')
  })
}
