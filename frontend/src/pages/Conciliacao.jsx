/**
 * Conciliacao.jsx — Conciliação Bancária com extrato CSV da Nubank.
 *
 * Regras:
 *  - Firebase é a única fonte da verdade para conciliados.
 *  - CSV lido apenas em memória (FileReader). Nunca salvo.
 *  - Não altera nenhum lançamento interno (valor, data, cliente, categoria).
 *  - updateDoc só ocorre na coleção `conciliacao`.
 *  - Nenhum dado depende de estado local como persistência.
 */

import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import {
  Upload, RefreshCw, AlertCircle, CheckCircle2, AlertTriangle,
  MinusCircle, XCircle, ChevronDown, ChevronUp, Info, FileText,
  ArrowUpCircle, ArrowDownCircle, Scale, Banknote, GitMerge,
  EyeOff, Sparkles, Trash2, CheckSquare, Zap,
} from 'lucide-react'

import Card           from '../components/ui/Card'
import Badge          from '../components/ui/Badge'
import Button         from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'

import { formatCurrency, formatDate } from '../utils/formatters'
import { parseNubankCSV, readFileAsText, normalizeText } from '../utils/csvParser'
import {
  conciliarLista,
  calcularSaldoInternoRealizado,
  STATUS_CONC,
  STATUS_CONC_LABEL,
} from '../utils/conciliacao'

import { financeiroAPI } from '../services/api'
import { salvarConciliacao } from '../services/conciliacaoFirestore'

// ── Constantes ────────────────────────────────────────────────────────────

const GREEN   = '#12F0C6'
const SURFACE = '#1A1E21'
const BORDER  = 'rgba(255,255,255,0.07)'

const MESES = [
  { v: 1,  l: 'Janeiro'  }, { v: 2,  l: 'Fevereiro' }, { v: 3,  l: 'Março'    },
  { v: 4,  l: 'Abril'    }, { v: 5,  l: 'Maio'      }, { v: 6,  l: 'Junho'    },
  { v: 7,  l: 'Julho'    }, { v: 8,  l: 'Agosto'    }, { v: 9,  l: 'Setembro' },
  { v: 10, l: 'Outubro'  }, { v: 11, l: 'Novembro'  }, { v: 12, l: 'Dezembro' },
]

// Prioridade de ordenação (menor = aparece primeiro)
const SORT_PRIORITY = {
  divergente: 0,
  sem_match:  1,
  match:      2,
  pendente:   3,
  conciliado: 4,
  ajuste:     5,
  ignorado:   6,
  duplicado:  7,
  erro:       8,
}

// Borda esquerda colorida por status efetivo
const ROW_LEFT_COLOR = {
  divergente: '#F59E0B',
  sem_match:  '#EF4444',
  match:      '#818CF8',
  conciliado: GREEN,
  ajuste:     '#818CF8',
  ignorado:   '#1F2937',
  duplicado:  '#374151',
  erro:       '#EF4444',
}

// Retorna o status efetivo: override do usuário ou status automático
function effectiveStatus(resultado, overrides) {
  return overrides[resultado.csvItem.id] ?? resultado.status
}

// Filtros rápidos
const QUICK_FILTERS = [
  { id: '',           label: 'Todos'              },
  { id: 'pendentes',  label: 'Pendentes'          },
  { id: 'divergente', label: 'Divergências'        },
  { id: 'sem_match',  label: 'Sem correspondência' },
  { id: 'match',      label: 'Matches'             },
  { id: 'conciliado', label: 'Conciliados'         },
  { id: 'ignorado',   label: 'Ignorados'           },
  { id: 'ajuste',     label: 'Ajustes'             },
]

// ── KpiCard clicável ──────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, color, sub, onClick, active }) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-1 transition-all"
      style={{
        background: active ? (color + '14') : SURFACE,
        borderColor: active ? (color + '77') : BORDER,
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color: color || GREEN }} />
        <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-lg font-bold" style={{ color: color || GREEN }}>{value}</p>
      {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Badge de status ───────────────────────────────────────────────────────

function StatusBadgeCsv({ status }) {
  const variantMap = {
    [STATUS_CONC.MATCH]:      'success',
    [STATUS_CONC.DIVERGENTE]: 'warning',
    [STATUS_CONC.SEM_MATCH]:  'error',
    [STATUS_CONC.DUPLICADO]:  'neutral',
    [STATUS_CONC.ERRO]:       'error',
    conciliado: 'success',
    ignorado:   'neutral',
    ajuste:     'info',
  }
  const labelMap = {
    ...STATUS_CONC_LABEL,
    conciliado: 'Conciliado ✓',
    ignorado:   'Ignorado',
    ajuste:     'Ajuste simulado',
  }
  return (
    <Badge variant={variantMap[status] || 'neutral'} dot>
      {labelMap[status] || status}
    </Badge>
  )
}

// ── Checkbox com suporte a indeterminate ──────────────────────────────────

function Checkbox({ checked, indeterminate, onChange }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      onClick={e => e.stopPropagation()}
      className="w-3.5 h-3.5 cursor-pointer rounded"
      style={{ accentColor: GREEN }}
    />
  )
}

// ── Barra de ações em massa ───────────────────────────────────────────────

function BulkActionBar({ count, totalVisible, onSelectAll, onClear, onConciliar, onIgnorar, onAjuste }) {
  if (count === 0) return null
  return (
    <div
      className="sticky bottom-6 z-20 rounded-xl border flex items-center gap-3 flex-wrap px-4 py-3 shadow-2xl"
      style={{ background: '#0D1012', borderColor: GREEN + '55', boxShadow: `0 4px 32px ${GREEN}22` }}
    >
      <div className="flex items-center gap-2 mr-2">
        <span className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-black flex-shrink-0"
              style={{ background: GREEN }}>
          {count > 99 ? '99+' : count}
        </span>
        <span className="text-xs text-gray-300 font-medium whitespace-nowrap">
          {count === 1 ? 'item selecionado' : 'itens selecionados'}
        </span>
      </div>

      <div className="h-4 w-px bg-white/10 mx-1 flex-shrink-0" />

      <button
        onClick={onConciliar}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:opacity-90 active:scale-95 whitespace-nowrap"
        style={{ background: GREEN, color: '#000' }}
      >
        <CheckCircle2 size={12} />
        Conciliar selecionados
      </button>

      <button
        onClick={onIgnorar}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-white/5 active:scale-95 whitespace-nowrap"
        style={{ borderColor: '#4B5563', color: '#9CA3AF' }}
      >
        <EyeOff size={12} />
        Ignorar selecionados
      </button>

      <button
        onClick={onAjuste}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all hover:bg-purple-500/10 active:scale-95 whitespace-nowrap"
        style={{ borderColor: '#818CF8', color: '#818CF8' }}
      >
        <Sparkles size={12} />
        Marcar como ajuste
      </button>

      <div className="ml-auto flex items-center gap-3">
        {count < totalVisible && (
          <button onClick={onSelectAll}
            className="text-xs text-gray-500 hover:text-white transition-colors whitespace-nowrap">
            Selecionar todos ({totalVisible})
          </button>
        )}
        <button onClick={onClear}
          className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors whitespace-nowrap">
          <Trash2 size={11} /> Limpar seleção
        </button>
      </div>
    </div>
  )
}

// ── Linha da tabela ───────────────────────────────────────────────────────

function TabelaLinha({ resultado, effStatus, isSelected, onToggleSelect, onAction, isSaving, saveError }) {
  const [open, setOpen] = useState(false)
  const { csvItem, match, divergencia } = resultado

  const valorInt  = match ? (match.amount ?? 0) : null
  const diff      = valorInt != null ? Math.round((csvItem.amount - valorInt) * 100) / 100 : null
  const matchDesc = match ? (match.description ?? '—') : '—'

  const isConciliado = effStatus === 'conciliado'
  const isIgnorado   = effStatus === 'ignorado'
  const isAjuste     = effStatus === 'ajuste'
  const isActed      = isConciliado || isIgnorado || isAjuste

  return (
    <>
      <tr
        className="border-b transition-all group"
        style={{
          borderColor: BORDER,
          background: isSelected ? GREEN + '0D' : (isConciliado ? GREEN + '07' : isIgnorado ? '#0A0A0A' : isAjuste ? '#0D0D1A' : undefined),
          opacity: isIgnorado ? 0.45 : 1,
          borderLeft: `3px solid ${ROW_LEFT_COLOR[effStatus] ?? 'transparent'}`,
        }}
      >
        {/* Checkbox */}
        <td className="pl-3 pr-1 py-2.5 w-8">
          <Checkbox checked={isSelected} onChange={() => onToggleSelect(csvItem.id)} />
        </td>

        <td className="px-3 py-2.5 text-xs text-gray-400 whitespace-nowrap">
          {formatDate(csvItem.date)}
        </td>

        <td className="px-3 py-2.5 text-xs max-w-[180px]">
          <span className="truncate block" title={csvItem.description}
                style={{ color: isConciliado ? GREEN : isIgnorado ? '#4B5563' : '#fff' }}>
            {csvItem.description}
          </span>
        </td>

        <td className="px-3 py-2.5">
          <span className="text-[11px] font-medium"
                style={{ color: csvItem.type === 'entrada' ? GREEN : '#EF4444' }}>
            {csvItem.type === 'entrada' ? '↑ Entrada' : '↓ Saída'}
          </span>
        </td>

        <td className="px-3 py-2.5 text-xs text-right font-mono font-medium"
            style={{ color: csvItem.type === 'entrada' ? GREEN : '#EF4444' }}>
          {csvItem.type === 'saida' ? '-' : ''}{formatCurrency(csvItem.amount)}
        </td>

        <td className="px-3 py-2.5 text-xs text-gray-400 max-w-[160px] truncate" title={matchDesc}>
          {matchDesc}
        </td>

        <td className="px-3 py-2.5 text-xs text-right text-gray-400 font-mono">
          {valorInt != null ? formatCurrency(valorInt) : '—'}
        </td>

        <td className="px-3 py-2.5">
          <StatusBadgeCsv status={effStatus} />
        </td>

        <td className="px-3 py-2.5 text-xs text-right font-mono"
            style={{ color: diff == null ? '#6B7280' : Math.abs(diff) < 0.05 ? GREEN : '#F59E0B' }}>
          {diff != null ? (diff >= 0 ? '+' : '') + formatCurrency(diff) : '—'}
        </td>

        {/* Ações inline (aparecem no hover) */}
        <td className="px-3 py-2.5">
          {isSaving ? (
            <span className="text-[10px] text-gray-500 italic">Salvando…</span>
          ) : saveError ? (
            <span className="text-[10px] text-red-400 max-w-[140px] truncate block" title={saveError}>
              ⚠ {saveError}
            </span>
          ) : isConciliado ? (
            <span className="text-[10px]" style={{ color: GREEN }}>Conciliado ✔</span>
          ) : (
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => onAction(csvItem.id, 'conciliado')}
                className="px-2 py-1 rounded text-[10px] border transition-colors hover:bg-[#12F0C6]/10"
                style={{ borderColor: GREEN + '77', color: GREEN }} title="Conciliar no Firebase">✓</button>
              {!isIgnorado && (
                <button onClick={() => onAction(csvItem.id, 'ignorado')}
                  className="px-2 py-1 rounded text-[10px] border transition-colors hover:bg-white/5"
                  style={{ borderColor: '#4B5563', color: '#6B7280' }} title="Ignorar (temporário)">—</button>
              )}
              {!isAjuste && (
                <button onClick={() => onAction(csvItem.id, 'ajuste')}
                  className="px-2 py-1 rounded text-[10px] border transition-colors hover:bg-purple-500/10"
                  style={{ borderColor: '#818CF877', color: '#818CF8' }} title="Ajuste (visual)">Aj</button>
              )}
              {(isIgnorado || isAjuste) && (
                <button onClick={() => onAction(csvItem.id, 'undo')}
                  className="px-2 py-1 rounded text-[10px] border transition-colors hover:bg-white/5"
                  style={{ borderColor: '#374151', color: '#6B7280' }} title="Desfazer">↩</button>
              )}
            </div>
          )}
        </td>

        {/* Expand divergência */}
        <td className="px-2 py-2.5 w-6">
          {divergencia && (
            <button onClick={() => setOpen(o => !o)}
              className="text-gray-600 hover:text-yellow-400 transition-colors">
              {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>
          )}
        </td>
      </tr>

      {/* Detalhe da divergência */}
      {open && divergencia && (
        <tr style={{ background: '#0F0E09' }}>
          <td colSpan={11} className="px-5 py-3">
            <div className="rounded-lg border p-3" style={{ borderColor: '#F59E0B33', background: '#1C1700' }}>
              <p className="text-[11px] font-semibold text-yellow-400 mb-2 flex items-center gap-1.5">
                <AlertTriangle size={12} /> Detalhes da divergência
              </p>
              <div className="grid grid-cols-3 gap-0 text-[10px]">
                {[
                  ['', 'Extrato (CSV)', 'Interno'],
                  ['Data',      formatDate(divergencia.dataCsv),     `${formatDate(divergencia.dataInterno)}${divergencia.diffDias > 0 ? ` (${divergencia.diffDias}d)` : ''}`],
                  ['Valor',     formatCurrency(divergencia.valorCsv), `${formatCurrency(divergencia.valorInterno)}${divergencia.diffValor !== 0 ? ` (dif: ${formatCurrency(divergencia.diffValor)})` : ''}`],
                  ['Descrição', divergencia.descricaoCsv,             divergencia.descricaoInt],
                ].map(([campo, csv, interno], i) => (
                  <>
                    <div key={`c${i}`} className={`py-1.5 ${i === 0 ? 'text-gray-600 font-semibold border-b' : 'text-gray-500 border-b'}`}
                         style={{ borderColor: BORDER }}>{campo}</div>
                    <div key={`v${i}`} className={`py-1.5 border-b ${i === 0 ? 'text-gray-500 font-semibold' : 'text-gray-300'}`}
                         style={{ borderColor: BORDER }}>{csv}</div>
                    <div key={`i${i}`} className={`py-1.5 border-b`}
                         style={{
                           borderColor: BORDER,
                           color: i === 0 ? '#CA8A04'
                             : i === 1 && divergencia.diffDias > 0 ? '#F59E0B'
                             : i === 2 && Math.abs(divergencia.diffValor) > 0.01 ? '#F59E0B'
                             : '#9CA3AF',
                         }}>{interno}</div>
                  </>
                ))}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════════════

export default function Conciliacao() {
  const fileRef = useRef(null)

  // ── Estado CSV ────────────────────────────────────────────────────────
  const [csvData,    setCsvData]    = useState(null)
  const [csvLoading, setCsvLoading] = useState(false)
  const [csvError,   setCsvError]   = useState(null)
  const [fileName,   setFileName]   = useState(null)

  // ── Lançamentos internos ──────────────────────────────────────────────
  const [lancamentos, setLancamentos] = useState([])
  const [lancLoading, setLancLoading] = useState(false)
  const [lancError,   setLancError]   = useState(null)

  // ── Estado de gravação Firebase ───────────────────────────────────────
  const [savingIds,  setSavingIds]  = useState(new Set())
  const [saveErrors, setSaveErrors] = useState({})

  // ── Filtros de período ────────────────────────────────────────────────
  const anoAtual = new Date().getFullYear()
  const [mesInicio, setMesInicio] = useState(1)
  const [mesFim,    setMesFim]    = useState(new Date().getMonth() + 1)
  const [ano,       setAno]       = useState(anoAtual)

  // ── Filtros de tabela ─────────────────────────────────────────────────
  const [filtroRapido, setFiltroRapido] = useState('')
  const [busca,        setBusca]        = useState('')

  // ── Painel divergências ───────────────────────────────────────────────
  const [showDivergencias, setShowDivergencias] = useState(true)

  // ─────────────────────────────────────────────────────────────────────
  // Estado de conciliação
  //
  // selectedIds  → { [id]: true }  — itens marcados na tabela
  // overrides    → { [id]: 'ignorado'|'ajuste' } — estado de sessão (não persiste)
  //   NOTA: 'conciliado' NÃO está em overrides — vem do Firebase via lancamento.conciliado
  // ignoradosData → metadados dos itens ignorados (sessão)
  // ─────────────────────────────────────────────────────────────────────
  const [selectedIds,   setSelectedIds]   = useState({})
  const [overrides,     setOverrides]     = useState({})  // somente 'ignorado' | 'ajuste'
  const [ignoradosData, setIgnoradosData] = useState({})

  // ── Carregar lançamentos ──────────────────────────────────────────────

  const carregarLancamentos = useCallback(async () => {
    setLancLoading(true)
    setLancError(null)
    try {
      // Usa o mesmo endpoint do Fluxo de Caixa — passa pelo backend (Cloud Functions),
      // nunca chama o Firestore diretamente do cliente.
      const res  = await financeiroAPI.getFluxoCaixa({ ano })
      const list = res.data?.lancamentos ?? []

      // Filtra pelo período selecionado
      const inicio = `${ano}-${String(mesInicio).padStart(2, '0')}-01`
      const fim    = `${ano}-${String(mesFim).padStart(2, '0')}-31`

      // Mapeia do formato da API para o formato LancamentoInterno
      const mapped = list
        .filter(l => {
          const d = String(l.data_competencia || '').slice(0, 10)
          return d >= inicio && d <= fim
        })
        .map(l => {
          const desc = String(l.descricao || '')
          return {
            id:                    String(l.id || ''),
            date:                  String(l.data_competencia || '').slice(0, 10),
            description:           desc,
            amount:                Math.round(Math.abs(Number(l.valor_realizado) || 0) * 100) / 100,
            type:                  l.tipo === 'entrada' ? 'entrada' : 'saida',
            status:                String(l.status || ''),
            origem:                String(l.origem || ''),
            categoria:             String(l.categoria || ''),
            cliente:               String(l.cliente || ''),
            conciliado:            l.status_conciliacao === 'conciliado' || Boolean(l.conciliado),
            conciliacaoId:         l.conciliacaoId ?? null,
            normalizedDescription: normalizeText(desc),
          }
        })

      setLancamentos(mapped)
    } catch (err) {
      setLancError(err?.response?.data?.detail || err?.message || 'Erro ao carregar lançamentos')
    } finally {
      setLancLoading(false)
    }
  }, [mesInicio, mesFim, ano])

  // ── Upload CSV ────────────────────────────────────────────────────────

  const resetActions = useCallback(() => {
    setOverrides({})
    setSelectedIds({})
    setIgnoradosData({})
    setSaveErrors({})
  }, [])

  const handleFile = useCallback(async (file) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setCsvError('Arquivo inválido. Selecione um arquivo .csv')
      return
    }
    setCsvLoading(true)
    setCsvError(null)
    setFileName(file.name)
    resetActions()
    try {
      const text   = await readFileAsText(file)
      const parsed = parseNubankCSV(text)
      if (parsed.parseError) { setCsvError(parsed.parseError); setCsvData(null) }
      else                    setCsvData(parsed)
    } catch (err) {
      setCsvError(err.message || 'Erro ao processar o arquivo')
      setCsvData(null)
    } finally {
      setCsvLoading(false)
    }
  }, [resetActions])

  const onFileChange = e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }
  const onDrop       = e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f) }

  // ── Itens CSV filtrados pelo período selecionado ─────────────────────

  const csvItemsFiltrados = useMemo(() => {
    if (!csvData?.items?.length) return []
    const inicio = `${ano}-${String(mesInicio).padStart(2, '0')}-01`
    const fim    = `${ano}-${String(mesFim).padStart(2, '0')}-31`
    return csvData.items.filter(item => item.date >= inicio && item.date <= fim)
  }, [csvData, mesInicio, mesFim, ano])

  // ── Resultados de matching ────────────────────────────────────────────

  const resultados = useMemo(() => {
    if (!csvItemsFiltrados.length) return []
    // Sem lançamentos: exibe todos os itens do CSV como 'sem_match'
    // para que a tabela fique populada logo após o upload do CSV.
    if (!lancamentos.length) {
      return csvItemsFiltrados.map(item => ({
        csvItem:    item,
        status:     STATUS_CONC.SEM_MATCH,
        match:      null,
        score:      0,
        divergencia: null,
      }))
    }
    return conciliarLista(csvItemsFiltrados, lancamentos)
  }, [csvItemsFiltrados, lancamentos])

  // Resultados enriquecidos com status efetivo
  const resultadosComStatus = useMemo(
    () => resultados.map(r => ({ ...r, effStatus: effectiveStatus(r, overrides) })),
    [resultados, overrides]
  )

  // ── Filtro + ordenação ────────────────────────────────────────────────

  const resultadosFiltrados = useMemo(() => {
    let list = resultadosComStatus

    if (filtroRapido === 'pendentes') {
      list = list.filter(r =>
        r.effStatus === STATUS_CONC.DIVERGENTE ||
        r.effStatus === STATUS_CONC.MATCH ||
        r.effStatus === STATUS_CONC.SEM_MATCH
      )
    } else if (filtroRapido) {
      list = list.filter(r => r.effStatus === filtroRapido)
    }

    if (busca) {
      const q = busca.toLowerCase()
      list = list.filter(r =>
        r.csvItem.description.toLowerCase().includes(q) ||
        (r.match?.description ?? '').toLowerCase().includes(q)
      )
    }

    // Ordenar: divergentes primeiro, depois sem match, matches, conciliados, ignorados
    return [...list].sort((a, b) => {
      const pa = SORT_PRIORITY[a.effStatus] ?? 99
      const pb = SORT_PRIORITY[b.effStatus] ?? 99
      if (pa !== pb) return pa - pb
      return (a.csvItem.date ?? '').localeCompare(b.csvItem.date ?? '')
    })
  }, [resultadosComStatus, filtroRapido, busca])

  // ── Contagens dinâmicas (atualizam com ações do usuário) ──────────────

  const contagens = useMemo(() => {
    let conciliados = 0, ignorados = 0, ajustes = 0,
        pendentes = 0, divergentes = 0, sem_match = 0, matches = 0
    for (const r of resultadosComStatus) {
      switch (r.effStatus) {
        case 'conciliado':          conciliados++; break
        case 'ignorado':            ignorados++;   break
        case 'ajuste':              ajustes++;     break
        case STATUS_CONC.DIVERGENTE: divergentes++; pendentes++; break
        case STATUS_CONC.SEM_MATCH:  sem_match++;  pendentes++; break
        case STATUS_CONC.MATCH:      matches++;    pendentes++; break
        default: break
      }
    }
    return { conciliados, ignorados, ajustes, pendentes, divergentes, sem_match, matches }
  }, [resultadosComStatus])

  const totalAjustesValor = useMemo(
    () => resultadosComStatus.filter(r => r.effStatus === 'ajuste')
      .reduce((s, r) => s + r.csvItem.amount, 0),
    [resultadosComStatus]
  )

  // ── Saldos ────────────────────────────────────────────────────────────

  const saldoInterno = useMemo(() => calcularSaldoInternoRealizado(lancamentos), [lancamentos])

  // Saldo extrato excluindo itens marcados como ignorado
  const saldoExtrato = useMemo(() => {
    if (!resultadosComStatus.length) {
      return csvData
        ? { entradas: csvData.totalEntradas, saidas: csvData.totalSaidas, saldo: csvData.saldoLiquido }
        : null
    }
    let entradas = 0, saidas = 0
    for (const r of resultadosComStatus) {
      if (r.effStatus === 'ignorado') continue
      if (r.csvItem.type === 'entrada') entradas += r.csvItem.amount
      else                              saidas   += r.csvItem.amount
    }
    return {
      entradas: Math.round(entradas * 100) / 100,
      saidas:   Math.round(saidas   * 100) / 100,
      saldo:    Math.round((entradas - saidas) * 100) / 100,
    }
  }, [resultadosComStatus, csvData])

  const diferencaConciliacao = (saldoExtrato && lancamentos.length)
    ? Math.round((saldoExtrato.saldo - saldoInterno.saldo) * 100) / 100
    : null

  // ── Seleção ───────────────────────────────────────────────────────────

  const selectedCount   = Object.keys(selectedIds).length
  const visibleIds      = resultadosFiltrados.map(r => r.csvItem.id)
  const selectedVisible = visibleIds.filter(id => selectedIds[id]).length
  const allVisibleSel   = visibleIds.length > 0 && selectedVisible === visibleIds.length
  const someVisibleSel  = selectedVisible > 0 && !allVisibleSel

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = { ...prev }
      if (next[id]) delete next[id]
      else          next[id] = true
      return next
    })
  }, [])

  // Estabilizar referência dos visibleIds para evitar re-render desnecessário
  const visibleIdsKey = visibleIds.join(',')

  const toggleSelectAll = useCallback(() => {
    const ids = visibleIdsKey.split(',').filter(Boolean)
    if (allVisibleSel) {
      setSelectedIds(prev => { const n = { ...prev }; ids.forEach(id => delete n[id]); return n })
    } else {
      setSelectedIds(prev => { const n = { ...prev }; ids.forEach(id => { n[id] = true }); return n })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allVisibleSel, visibleIdsKey])

  const clearSelection = useCallback(() => setSelectedIds({}), [])

  // ── Aplicar override local (somente 'ignorado' e 'ajuste') ─────────────────
  // NOTA: 'conciliado' não passa por aqui — vem do Firebase via reload.

  const applyOverride = useCallback((ids, action) => {
    const now = new Date().toISOString()

    setOverrides(prev => {
      const next = { ...prev }
      ids.forEach(id => { if (action === 'undo') delete next[id]; else next[id] = action })
      return next
    })

    if (action === 'ignorado') {
      setIgnoradosData(prev => {
        const next = { ...prev }
        ids.forEach(id => {
          const r = resultadosComStatus.find(x => x.csvItem.id === id)
          if (r) next[id] = { csvItem: r.csvItem, ts: now }
        })
        return next
      })
    }
    if (action === 'undo') {
      setIgnoradosData(prev => { const n = { ...prev }; ids.forEach(id => delete n[id]); return n })
    }
  }, [resultadosComStatus])

  // ── Gravação Firebase para ação 'conciliado' ───────────────────────────
  // Fluxo correto: write Firebase → await → reload → UI atualiza.
  // Sem optimistic UI. Sem rollback.

  const executarConciliarFirebase = useCallback(async (ids) => {
    setSavingIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n })
    setSaveErrors(prev => { const n = { ...prev }; ids.forEach(id => delete n[id]); return n })

    const erros = {}
    await Promise.allSettled(
      ids.map(async id => {
        try {
          const r = resultadosComStatus.find(x => x.csvItem.id === id)
          const linkedId = r?.match?.id
          if (!linkedId) {
            erros[id] = 'Sem lançamento vinculado (apenas itens com match podem ser conciliados)'
            return
          }
          await salvarConciliacao({ lancamentoId: linkedId, csvItem: r.csvItem })
        } catch (err) {
          erros[id] = err.message || 'Erro ao salvar no Firebase'
        }
      })
    )

    setSavingIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n })

    if (Object.keys(erros).length) {
      setSaveErrors(prev => ({ ...prev, ...erros }))
    }

    // Firebase é a fonte da verdade — recarrega para refletir status conciliado
    await carregarLancamentos()
  }, [resultadosComStatus, carregarLancamentos])

  // Bulk com confirmação obrigatória
  const bulkConciliar = useCallback(() => {
    const ids = Object.keys(selectedIds).filter(id => {
      const r = resultadosComStatus.find(x => x.csvItem.id === id)
      return Boolean(r?.match?.id) && r?.effStatus !== 'conciliado'
    })
    if (!ids.length) {
      alert('Nenhum item selecionado possui match para conciliar.\nSelecione apenas itens com "Match" ou "Possível match".')
      return
    }
    const ok = window.confirm(
      `Confirmar conciliação de ${ids.length} lançamento(s) no Firebase?\n\nEsta ação grava diretamente no banco.`
    )
    if (!ok) return
    clearSelection()
    executarConciliarFirebase(ids)
  }, [selectedIds, resultadosComStatus, clearSelection, executarConciliarFirebase])

  const bulkIgnorar = useCallback(() => {
    const ids = Object.keys(selectedIds).filter(id => {
      const r = resultadosComStatus.find(x => x.csvItem.id === id)
      return r?.effStatus !== 'ignorado' && r?.effStatus !== 'conciliado'
    })
    if (!ids.length) return
    const ok = window.confirm(`Marcar ${ids.length} item(s) como ignorado(s)?\n\nIsso é temporário (apenas esta sessão).`)
    if (!ok) return
    applyOverride(ids, 'ignorado')
    clearSelection()
  }, [selectedIds, resultadosComStatus, applyOverride, clearSelection])

  const bulkAjuste = useCallback(() => {
    const ids = Object.keys(selectedIds)
    applyOverride(ids, 'ajuste')
    clearSelection()
  }, [selectedIds, applyOverride, clearSelection])

  // Single (linha individual)
  const singleAction = useCallback((id, action) => {
    if (action === 'conciliado') {
      executarConciliarFirebase([id])
    } else {
      applyOverride([id], action)
    }
  }, [applyOverride, executarConciliarFirebase])

  // ── Analisar: recarrega Firebase e reseta estado de sessão ─────────────────

  const analisar = useCallback(async () => {
    resetActions()
    await carregarLancamentos()
  }, [resetActions, carregarLancamentos])

  // Selecionar por status (atalho)
  const selecionarPorStatus = useCallback((status) => {
    const ids = resultadosComStatus.filter(r => r.effStatus === status).map(r => r.csvItem.id)
    setSelectedIds(prev => { const n = { ...prev }; ids.forEach(id => { n[id] = true }); return n })
  }, [resultadosComStatus])

  // ── Dados derivados ───────────────────────────────────────────────────

  const divergencias = useMemo(
    () => resultados.filter(r => r.status === STATUS_CONC.DIVERGENTE && r.divergencia),
    [resultados]
  )

  const hasData = Boolean(csvData?.items?.length)
  const hasCsvPeriodo = csvItemsFiltrados.length > 0
  const hasLanc = lancamentos.length > 0

  const totalAtivos   = resultadosComStatus.filter(r => r.effStatus !== 'ignorado').length
  const pctConciliado = totalAtivos ? Math.round((contagens.conciliados / totalAtivos) * 100) : 0

  // ─────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">

      {/* ── Cabeçalho ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GitMerge size={20} style={{ color: GREEN }} />
            Conciliação Bancária
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Extrato Nubank (CSV) como fonte da verdade. Nenhum dado é alterado nesta etapa.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {hasData && contagens.conciliados > 0 && (
            <span className="text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1.5"
                  style={{ borderColor: GREEN + '44', color: GREEN, background: GREEN + '11' }}>
              <CheckCircle2 size={10} />
              {pctConciliado}% conciliado ({contagens.conciliados}/{totalAtivos})
            </span>
          )}
          <span className="text-[11px] px-2.5 py-1 rounded-full border flex items-center gap-1.5"
                style={{ borderColor: '#12F0C644', color: '#12F0C6', background: '#001A15' }}>
            <Info size={10} />
            Conciliar grava no Firebase • Ignorar/Ajuste só local
          </span>
        </div>
      </div>

      {/* ── Passo 1 ───────────────────────────────────────────────────── */}
      <Card title="Passo 1 — Período dos lançamentos internos">
        <div className="flex flex-wrap items-end gap-3">
          {[
            { label: 'Mês início', value: mesInicio, set: setMesInicio, opts: MESES },
            { label: 'Mês fim',    value: mesFim,    set: setMesFim,    opts: MESES.filter(m => m.v >= mesInicio) },
          ].map(({ label, value, set, opts }) => (
            <div key={label} className="flex flex-col gap-1">
              <label className="text-[11px] text-gray-500">{label}</label>
              <select value={value} onChange={e => set(Number(e.target.value))}
                className="px-3 py-2 rounded-lg text-xs text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50">
                {opts.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
            </div>
          ))}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] text-gray-500">Ano</label>
            <select value={ano} onChange={e => setAno(Number(e.target.value))}
              className="px-3 py-2 rounded-lg text-xs text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50">
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <Button onClick={carregarLancamentos} disabled={lancLoading}
            style={{ background: GREEN, color: '#000' }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold">
            <RefreshCw size={12} className={lancLoading ? 'animate-spin' : ''} />
            Carregar lançamentos
          </Button>
          {hasData && hasLanc && (
            <Button onClick={analisar} disabled={lancLoading}
              style={{ background: '#1A1E21', color: GREEN, border: `1px solid ${GREEN}55` }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold">
              <Zap size={12} className={lancLoading ? 'animate-spin' : ''} />
              Analisar conciliação do período
            </Button>
          )}
          {hasLanc && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <CheckCircle2 size={12} style={{ color: GREEN }} />
              {lancamentos.length} lançamentos carregados
            </span>
          )}
          {hasData && csvItemsFiltrados.length !== csvData.items.length && (
            <span className="text-xs flex items-center gap-1" style={{ color: '#F59E0B' }}>
              <Info size={11} />
              {csvItemsFiltrados.length} de {csvData.items.length} movimentos do CSV no período
            </span>
          )}
          {lancError && (
            <span className="text-xs text-red-400 flex items-center gap-1">
              <AlertCircle size={12} /> {lancError}
            </span>
          )}
        </div>
      </Card>

      {/* ── Passo 2: Upload ───────────────────────────────────────────── */}
      <Card title="Passo 2 — Importar extrato CSV da Nubank">
        <div
          className="relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 transition-colors"
          style={{ borderColor: csvData ? GREEN + '66' : 'rgba(255,255,255,0.12)', background: '#111416' }}
          onDragOver={e => e.preventDefault()} onDrop={onDrop}
        >
          {csvLoading ? <LoadingSpinner /> : csvData ? (
            <>
              <CheckCircle2 size={32} style={{ color: GREEN }} />
              <p className="text-sm font-medium text-white">{fileName}</p>
              <p className="text-xs text-gray-500">{csvData.items.length} movimentos lidos com sucesso
                {csvItemsFiltrados.length !== csvData.items.length && (
                  <span style={{ color: '#F59E0B' }}> • {csvItemsFiltrados.length} no período selecionado</span>
                )}
              </p>
              <button
                onClick={() => { setCsvData(null); setFileName(null); setCsvError(null); resetActions() }}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors mt-1">
                × Remover arquivo
              </button>
            </>
          ) : (
            <>
              <Upload size={32} className="text-gray-600" />
              <div className="text-center">
                <p className="text-sm text-gray-400">Arraste o CSV aqui ou</p>
                <p className="text-xs text-gray-600 mt-0.5">O arquivo é lido apenas em memória, nunca salvo.</p>
              </div>
              <Button onClick={() => fileRef.current?.click()}
                className="px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2"
                style={{ background: GREEN, color: '#000' }}>
                <FileText size={12} /> Selecionar CSV
              </Button>
            </>
          )}
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
        </div>
        {csvError && (
          <div className="mt-3 flex items-start gap-2 text-xs text-red-400 bg-red-900/20 rounded-lg px-3 py-2.5 border border-red-800/30">
            <AlertCircle size={12} className="mt-0.5 flex-shrink-0" /> {csvError}
          </div>
        )}
      </Card>

      {/* ── Cards resumo extrato ──────────────────────────────────────── */}
      {hasData && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <KpiCard icon={Scale}          label="Saldo líquido"  value={formatCurrency(saldoExtrato?.saldo ?? 0)}
            color={saldoExtrato?.saldo >= 0 ? GREEN : '#EF4444'} sub="sem ignorados" />
          <KpiCard icon={ArrowUpCircle}  label="Total entradas" value={formatCurrency(saldoExtrato?.entradas ?? 0)} color={GREEN} />
          <KpiCard icon={ArrowDownCircle} label="Total saídas"  value={formatCurrency(saldoExtrato?.saidas ?? 0)}  color="#EF4444" />
          <KpiCard icon={FileText}       label="Movimentos"     value={csvData.items.length} color="#818CF8" />
          <KpiCard icon={MinusCircle}    label="Duplicados"     value={csvData.duplicados}   color="#6B7280" sub="no parse" />
          <KpiCard icon={AlertCircle}    label="Erros"          value={csvData.erros}
            color={csvData.erros > 0 ? '#EF4444' : '#6B7280'} sub="linhas inválidas" />
        </div>
      )}

      {/* ── Cards de conciliação (dinâmicos, clicáveis) ───────────────── */}
      {hasCsvPeriodo && hasLanc && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { id: 'conciliado', label: 'Conciliados',  value: contagens.conciliados, color: GREEN,      sub: 'ação manual',         icon: CheckCircle2  },
            { id: 'divergente', label: 'Divergências', value: contagens.divergentes, color: '#F59E0B',  sub: 'clique p/ filtrar',   icon: AlertTriangle },
            { id: 'sem_match',  label: 'Sem match',    value: contagens.sem_match,   color: '#EF4444',  sub: 'clique p/ filtrar',   icon: XCircle       },
            { id: 'match',      label: 'Matches',      value: contagens.matches,     color: '#818CF8',  sub: 'clique p/ filtrar',   icon: CheckSquare   },
            { id: 'ignorado',   label: 'Ignorados',    value: contagens.ignorados,   color: '#6B7280',  sub: 'clique p/ filtrar',   icon: EyeOff        },
            { id: 'ajuste',     label: 'Ajustes',      value: contagens.ajustes,     color: '#818CF8',  sub: contagens.ajustes > 0 ? formatCurrency(totalAjustesValor) : 'simulados', icon: Sparkles },
            { id: 'pendentes',  label: 'Pendentes',    value: contagens.pendentes,   color: '#F59E0B',  sub: 'a revisar',           icon: Zap           },
          ].map(c => (
            <KpiCard key={c.id} icon={c.icon} label={c.label} value={c.value} color={c.color} sub={c.sub}
              active={filtroRapido === c.id}
              onClick={() => setFiltroRapido(f => f === c.id ? '' : c.id)} />
          ))}
        </div>
      )}

      {/* ── Painel divergências ───────────────────────────────────────── */}
      {hasCsvPeriodo && hasLanc && divergencias.length > 0 && (
        <Card
          title={`Divergências detectadas (${divergencias.length})`}
          subtitle="Lançamentos que parecem iguais mas têm data, valor ou descrição diferente"
          action={
            <div className="flex items-center gap-2">
              <button onClick={() => selecionarPorStatus(STATUS_CONC.DIVERGENTE)}
                className="text-xs px-2.5 py-1 rounded-lg border transition-all hover:bg-yellow-400/10"
                style={{ borderColor: '#F59E0B44', color: '#F59E0B' }}>
                Selecionar todas
              </button>
              <button onClick={() => setShowDivergencias(v => !v)}
                className="text-gray-500 hover:text-white transition-colors">
                {showDivergencias ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          }
        >
          {showDivergencias && (
            <div className="space-y-3 mt-2">
              {divergencias.map(r => (
                <div key={r.csvItem.id} className="rounded-lg border p-3"
                     style={{ background: '#1C1700', borderColor: '#F59E0B33' }}>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <AlertTriangle size={12} style={{ color: '#F59E0B' }} />
                    <span className="text-xs font-medium text-yellow-400">
                      {formatDate(r.csvItem.date)} — {r.csvItem.description}
                    </span>
                    <span className="ml-auto text-xs font-bold"
                          style={{ color: r.csvItem.type === 'entrada' ? GREEN : '#EF4444' }}>
                      {formatCurrency(r.csvItem.amount)}
                    </span>
                    <button onClick={() => singleAction(r.csvItem.id, 'conciliado')}
                      className="px-2 py-0.5 rounded text-[10px] border transition-colors hover:bg-[#12F0C6]/10"
                      style={{ borderColor: GREEN + '66', color: GREEN }}>
                      Conciliar assim
                    </button>
                  </div>
                  <div className="text-[10px]">
                    {[
                      ['Data',      formatDate(r.divergencia.dataCsv),       `${formatDate(r.divergencia.dataInterno)}${r.divergencia.diffDias > 0 ? ` (${r.divergencia.diffDias}d)` : ''}`,  r.divergencia.diffDias > 0],
                      ['Valor',     formatCurrency(r.divergencia.valorCsv),  `${formatCurrency(r.divergencia.valorInterno)}${r.divergencia.diffValor !== 0 ? ` (dif: ${formatCurrency(r.divergencia.diffValor)})` : ''}`, Math.abs(r.divergencia.diffValor) > 0.01],
                      ['Descrição', r.divergencia.descricaoCsv,              r.divergencia.descricaoInt, false],
                    ].map(([campo, csv, interno, hl]) => (
                      <div key={campo} className="flex items-start gap-2 py-1 border-b" style={{ borderColor: BORDER }}>
                        <span className="w-24 text-gray-500 flex-shrink-0">{campo}</span>
                        <span className="flex-1 text-gray-300">{csv}</span>
                        <span className="flex-1" style={{ color: hl ? '#F59E0B' : '#9CA3AF' }}>{interno}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Saldos + diferença ───────────────────────────────────────── */}
      {hasCsvPeriodo && hasLanc && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border p-5" style={{ background: SURFACE, borderColor: BORDER }}>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Saldo real pelo extrato</p>
            <p className="text-2xl font-bold" style={{ color: saldoExtrato?.saldo >= 0 ? GREEN : '#EF4444' }}>
              {formatCurrency(saldoExtrato?.saldo ?? 0)}
            </p>
            <p className="text-[10px] text-gray-600 mt-1">
              {formatCurrency(saldoExtrato?.entradas ?? 0)} entradas − {formatCurrency(saldoExtrato?.saidas ?? 0)} saídas
              {contagens.ignorados > 0 && ` (${contagens.ignorados} ignorados excluídos)`}
            </p>
          </div>
          <div className="rounded-xl border p-5" style={{ background: SURFACE, borderColor: BORDER }}>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Saldo interno realizado</p>
            <p className="text-2xl font-bold" style={{ color: saldoInterno.saldo >= 0 ? '#818CF8' : '#EF4444' }}>
              {formatCurrency(saldoInterno.saldo)}
            </p>
            <p className="text-[10px] text-gray-600 mt-1">Apenas lançamentos pago/recebido/realizado</p>
          </div>
          <div className="rounded-xl border p-5" style={{
            background: '#111416',
            borderColor: diferencaConciliacao == null ? BORDER
              : Math.abs(diferencaConciliacao) < 0.01 ? GREEN + '44' : '#F59E0B44',
          }}>
            <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1">Diferença de conciliação</p>
            {diferencaConciliacao == null
              ? <p className="text-lg text-gray-600">—</p>
              : <>
                  <p className="text-2xl font-bold"
                     style={{ color: Math.abs(diferencaConciliacao) < 0.01 ? GREEN : '#F59E0B' }}>
                    {diferencaConciliacao >= 0 ? '+' : ''}{formatCurrency(diferencaConciliacao)}
                  </p>
                  <p className="text-[10px] text-gray-600 mt-1">Extrato − Sistema</p>
                </>
            }
          </div>
        </div>
      )}

      {/* ── Simulação de ajuste ───────────────────────────────────────── */}
      {hasCsvPeriodo && hasLanc && diferencaConciliacao != null && Math.abs(diferencaConciliacao) > 0.01 && (
        <div className="rounded-xl border p-5" style={{ background: '#111416', borderColor: '#F59E0B44' }}>
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg flex-shrink-0" style={{ background: '#F59E0B22' }}>
              <Banknote size={18} style={{ color: '#F59E0B' }} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-yellow-400">Simulação de ajuste para bater caixa</p>
              <p className="text-xs text-gray-500 mt-0.5 mb-3">Somente simulação — nenhum lançamento será criado.</p>
              <div className="flex items-center gap-3 flex-wrap">
                {diferencaConciliacao > 0 ? (
                  <span className="flex items-center gap-2 text-sm font-medium" style={{ color: GREEN }}>
                    <ArrowUpCircle size={16} />
                    Entrada de ajuste: <strong>{formatCurrency(Math.abs(diferencaConciliacao))}</strong>
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-sm font-medium text-red-400">
                    <ArrowDownCircle size={16} />
                    Saída de ajuste: <strong>{formatCurrency(Math.abs(diferencaConciliacao))}</strong>
                  </span>
                )}
                <span className="text-xs text-gray-600">
                  ({diferencaConciliacao > 0 ? 'Sistema abaixo do extrato' : 'Sistema acima do extrato'})
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Tabela de conciliação ─────────────────────────────────────── */}
      {hasCsvPeriodo && (
        <Card
          title="Tabela de conciliação"
          subtitle={!hasLanc ? 'Carregue os lançamentos internos (Passo 1) para ver os matches' : undefined}
        >
          {/* Filtros rápidos + busca */}
          <div className="flex items-start gap-2 flex-wrap mb-3">
            <div className="flex items-center gap-1 flex-wrap flex-1">
              {QUICK_FILTERS.map(f => {
                const badge = f.id === 'divergente' ? contagens.divergentes
                  : f.id === 'sem_match' ? contagens.sem_match
                  : f.id === 'pendentes' ? contagens.pendentes
                  : f.id === 'conciliado' ? contagens.conciliados
                  : null
                return (
                  <button key={f.id}
                    onClick={() => setFiltroRapido(prev => prev === f.id ? '' : f.id)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all"
                    style={filtroRapido === f.id
                      ? { background: GREEN, color: '#000' }
                      : { background: '#1A1E21', color: '#6B7280', border: '1px solid rgba(255,255,255,0.06)' }
                    }>
                    {f.label}
                    {badge != null && badge > 0 && (
                      <span className="px-1 rounded text-[9px] font-bold"
                            style={{
                              background: filtroRapido === f.id ? '#00000033' : 'rgba(255,255,255,0.07)',
                              color: filtroRapido === f.id ? '#000' : '#9CA3AF',
                            }}>
                        {badge}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar..."
                className="px-3 py-1.5 rounded-lg text-xs text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50 placeholder:text-gray-600 w-40"
              />
              {selectedCount > 0 && (
                <button onClick={clearSelection}
                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-red-400 transition-colors whitespace-nowrap">
                  <XCircle size={11} /> Limpar ({selectedCount})
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[1020px]">
              <thead>
                <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <th className="pl-3 pr-1 py-2.5 w-8">
                    <Checkbox
                      checked={allVisibleSel}
                      indeterminate={someVisibleSel}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  {['Data','Descrição','Tipo','Valor CSV','Match interno','Valor interno','Status','Diferença','Ações',''].map(h => (
                    <th key={h} className="px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resultadosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-3 py-10 text-center text-xs text-gray-600">
                      {resultados.length === 0
                        ? 'Nenhum movimento. Importe um CSV acima.'
                        : 'Nenhum resultado para os filtros aplicados.'}
                    </td>
                  </tr>
                ) : (
                  resultadosFiltrados.map(r => (
                    <TabelaLinha
                      key={r.csvItem.id}
                      resultado={r}
                      effStatus={r.effStatus}
                      isSelected={Boolean(selectedIds[r.csvItem.id])}
                      onToggleSelect={toggleSelect}
                      onAction={singleAction}
                      isSaving={savingIds.has(r.csvItem.id)}
                      saveError={saveErrors[r.csvItem.id] ?? null}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {resultadosFiltrados.length > 0 && (
            <div className="flex items-center justify-between mt-3">
              <p className="text-[10px] text-gray-600">
                {resultadosFiltrados.length} de {resultados.length} movimentos
                {selectedCount > 0 && (
                  <span style={{ color: GREEN }}> · {selectedCount} selecionados</span>
                )}
              </p>
              {selectedCount > 0 && (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-gray-500">Ações em massa:</span>
                  <button onClick={bulkConciliar}
                    className="px-2.5 py-1 rounded border transition-colors hover:bg-[#12F0C6]/10"
                    style={{ borderColor: GREEN + '66', color: GREEN }}>Conciliar</button>
                  <button onClick={bulkIgnorar}
                    className="px-2.5 py-1 rounded border transition-colors hover:bg-white/5"
                    style={{ borderColor: '#4B5563', color: '#6B7280' }}>Ignorar</button>
                  <button onClick={bulkAjuste}
                    className="px-2.5 py-1 rounded border transition-colors hover:bg-purple-500/10"
                    style={{ borderColor: '#818CF877', color: '#818CF8' }}>Ajuste</button>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* ── Resultado final ───────────────────────────────────────────── */}
      {hasCsvPeriodo && hasLanc && (
        <Card title="Resultado final da conciliação">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-lg border p-3" style={{ background: '#111416', borderColor: GREEN + '44' }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Saldo real banco</p>
              <p className="text-lg font-bold mt-1" style={{ color: GREEN }}>{formatCurrency(saldoExtrato?.saldo ?? 0)}</p>
            </div>
            <div className="rounded-lg border p-3" style={{ background: '#111416', borderColor: BORDER }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Saldo sistema realizado</p>
              <p className="text-lg font-bold mt-1" style={{ color: '#818CF8' }}>{formatCurrency(saldoInterno.saldo)}</p>
            </div>
            <div className="rounded-lg border p-3" style={{
              background: '#111416',
              borderColor: diferencaConciliacao != null && Math.abs(diferencaConciliacao) > 0.01 ? '#F59E0B44' : BORDER,
            }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Diferença banco × sistema</p>
              <p className="text-lg font-bold mt-1"
                 style={{ color: diferencaConciliacao != null && Math.abs(diferencaConciliacao) > 0.01 ? '#F59E0B' : GREEN }}>
                {diferencaConciliacao != null ? (diferencaConciliacao >= 0 ? '+' : '') + formatCurrency(diferencaConciliacao) : '—'}
              </p>
            </div>
            <div className="rounded-lg border p-3" style={{ background: '#111416', borderColor: BORDER }}>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Resumo matching</p>
              <div className="flex flex-col gap-1 mt-1.5">
                <span className="text-[11px]" style={{ color: GREEN }}>✓ {contagens.conciliados} conciliados</span>
                <span className="text-[11px] text-yellow-400">⚠ {contagens.divergentes} divergentes</span>
                <span className="text-[11px] text-red-400">✗ {contagens.sem_match} sem match</span>
                {contagens.ajustes > 0 && (
                  <span className="text-[11px]" style={{ color: '#818CF8' }}>◈ {contagens.ajustes} ajustes simulados</span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ── Barra de bulk actions (sticky) ───────────────────────────── */}
      <BulkActionBar
        count={selectedCount}
        totalVisible={resultadosFiltrados.length}
        onSelectAll={toggleSelectAll}
        onClear={clearSelection}
        onConciliar={bulkConciliar}
        onIgnorar={bulkIgnorar}
        onAjuste={bulkAjuste}
      />

    </div>
  )
}
