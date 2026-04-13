import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  CalendarCheck, RefreshCw, Save, Plus, Trash2, Edit3, ChevronDown, ChevronUp,
  TrendingUp, TrendingDown, Scissors, ShoppingBag, Users,
  Award, CheckCircle2, Clock, AlertTriangle, FileText,
  ArrowUpCircle, ArrowDownCircle, MinusCircle, Target, PiggyBank,
  Landmark, Shield, Pencil, CreditCard,
} from 'lucide-react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import Modal from '../components/modals/Modal'
import { useFechamento, useReceitas, useDespesas, useDespesasLocais, useComissoes } from '../hooks/useFinanceiro'
import { fechamentoAPI, clientesAPI, comissoesAPI, despesasLocaisAPI } from '../services/api'
import { formatCurrency } from '../utils/formatters'

/* ── Constantes visuais ─────────────────────────────────────────────── */
const INPUT_CLS = 'w-full px-3 py-2 rounded-lg text-sm text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50 placeholder:text-gray-600'
const SELECT_CLS = INPUT_CLS
const TEXTAREA_CLS = INPUT_CLS + ' min-h-[80px] resize-y'
const GREEN = '#12F0C6'

const MESES = [
  'Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'
]

function competenciaAtual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function competenciaLabel(c) {
  if (!c) return ''
  const [a, m] = c.split('-')
  return `${MESES[parseInt(m, 10) - 1]}/${a}`
}

/* ── KPI Card inline (mesmo padrão do Dashboard) ─────────────────── */
function KPI({ icon: Icon, label, value, color = GREEN, sub }) {
  return (
    <div className="rounded-xl p-4 relative overflow-hidden"
         style={{ background: '#272C30', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"
           style={{ background: color, opacity: 0.08 }} />
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}14` }}>
          <Icon size={14} style={{ color }} />
        </div>
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

/* ── Status badges ────────────────────────────────────────────────── */
const STATUS_DESP = {
  previsto:   { label: 'Previsto',   variant: 'info' },
  confirmado: { label: 'Confirmado', variant: 'warning' },
  pago:       { label: 'Pago',       variant: 'success' },
  adiado:     { label: 'Adiado',     variant: 'neutral' },
}

const STATUS_COM = {
  pendente:  { label: 'Pendente',  variant: 'warning' },
  aprovado:  { label: 'Aprovado',  variant: 'info' },
  pago:      { label: 'Pago',      variant: 'success' },
  a_definir: { label: 'A Definir', variant: 'neutral' },
}

const PRIORIDADE_MAP = {
  alta:  { label: 'Alta',  variant: 'error' },
  media: { label: 'Média', variant: 'warning' },
  baixa: { label: 'Baixa', variant: 'neutral' },
}

const ACOES_CLIENTE = [
  { value: 'cobrado',   label: 'Cobrado hoje' },
  { value: 'prometeu',  label: 'Prometeu pagar' },
  { value: 'pago',      label: 'Pago' },
  { value: 'atraso',    label: 'Em atraso' },
  { value: 'negociar',  label: 'Negociar depois' },
]

/* ── Seção colapsável ─────────────────────────────────────────────── */
function Section({ title, icon: Icon, children, badge, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#272C30', border: '1px solid rgba(255,255,255,0.07)' }}>
      <button onClick={() => setOpen(o => !o)}
              className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        <Icon size={18} style={{ color: GREEN }} />
        <span className="text-sm font-semibold text-white flex-1">{title}</span>
        {badge}
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>
      {open && <div className="px-5 pb-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>{children}</div>}
    </div>
  )
}

/* ── Linha editável inline ────────────────────────────────────────── */
function InlineRow({ cols, data, onRemove, onEdit }) {
  return (
    <tr className="hover:bg-white/[0.025] transition-colors">
      {cols.map((col) => (
        <td key={col.key} className={`px-3 py-2.5 text-xs ${col.align === 'right' ? 'text-right' : ''}`}>
          {col.render ? col.render(data[col.key], data) : (
            <span className="text-gray-300">{data[col.key] ?? '—'}</span>
          )}
        </td>
      ))}
      <td className="px-3 py-2.5 text-right whitespace-nowrap">
        <button onClick={() => onEdit(data)} className="p-1 text-gray-500 hover:text-white transition"><Edit3 size={13} /></button>
        <button onClick={() => onRemove(data)} className="p-1 text-gray-500 hover:text-red-400 transition ml-1"><Trash2 size={13} /></button>
      </td>
    </tr>
  )
}

function MiniTable({ columns, data, onAdd, onEdit, onRemove, addLabel = 'Adicionar' }) {
  return (
    <div className="mt-3">
      <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
        <table className="w-full text-left">
          <thead>
            <tr style={{ background: 'rgba(0,0,0,0.3)' }}>
              {columns.map(c => (
                <th key={c.key} className={`px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.label}
                </th>
              ))}
              <th className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
            {data.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="px-3 py-6 text-center text-xs text-gray-600">Nenhum item registrado</td></tr>
            )}
            {data.map((row, i) => <InlineRow key={row._idx ?? i} cols={columns} data={row} onEdit={onEdit} onRemove={onRemove} />)}
          </tbody>
        </table>
      </div>
      <button onClick={onAdd}
              className="mt-3 flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-lg hover:bg-white/5 transition"
              style={{ color: GREEN }}>
        <Plus size={14} /> {addLabel}
      </button>
    </div>
  )
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
   PÁGINA PRINCIPAL — FECHAMENTO DO MÊS
   â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
export default function FechamentoMes() {
  const [competencia, setCompetencia] = useState(competenciaAtual())
  const { data, loading, refetch } = useFechamento(competencia)
  const { data: dataReceitas }                                     = useReceitas()
  const { data: dataDespGlobal }                                   = useDespesas()
  const { data: dataDespLocais, refetch: refetchDespLocais }       = useDespesasLocais()
  const { data: dataComissoesFull, refetch: refetchComissoesFull } = useComissoes()

  const [despesas, setDespesas]   = useState([])
  const [reducoes, setReducoes]   = useState([])
  const [novos, setNovos]         = useState([])
  const [anotacoes, setAnotacoes] = useState({ decisoes: '', proximos_passos: '', pendencias: '', observacoes: '' })
  const [saving, setSaving]       = useState(false)
  const [saved, setSaved]         = useState(false)

  // Clientes — overrides e manuais por competência
  const [cliOv, setCliOv]   = useState({})   // { [id]: partialOverride }
  const [cliMn, setCliMn]   = useState([])   // clientes adicionados manualmente
  const [cliModal, setCliModal] = useState(null) // { mode: 'new'|'edit', id?: string }
  const [cliForm, setCliForm]   = useState({})

  // Saldo em conta (localStorage, por competência)
  const [saldoConta, setSaldoConta]       = useState(0)
  const [reservaMinima, setReservaMinima] = useState(0)
  const [editandoCaixa, setEditandoCaixa] = useState(false)
  const [tmpSaldo, setTmpSaldo]           = useState('')
  const [tmpReserva, setTmpReserva]       = useState('')
  const [dataSaldoFiltro, setDataSaldoFiltro] = useState('')

  // Hub unificado
  const [abaHub, setAbaHub]               = useState('receitas')
  const [hubSearch, setHubSearch]         = useState('')
  const [hubMostrarTodos, setHubMostrarTodos] = useState(false)
  const [hubFiltroStatus, setHubFiltroStatus]       = useState('')
  const [hubFiltroCategoria, setHubFiltroCategoria] = useState('')
  const [faturaCartao, setFaturaCartao]   = useState(() => parseFloat(localStorage.getItem('bam-fatura-cartao') || '1700'))
  const [editandoFatura, setEditandoFatura] = useState(false)
  const [tmpFatura, setTmpFatura]         = useState('')
  const [hubModal, setHubModal]           = useState(null)
  const [hubForm, setHubForm]             = useState({})
  const [hubSaving, setHubSaving]         = useState(false)
  const [hubFormErr, setHubFormErr]       = useState('')

  // Modal state
  const [modal, setModal]       = useState(null) // { type, item?, index? }
  const [form, setForm]         = useState({})

  // Dados do backend
  const fech = data?.fechamento
  const resumo = data?.resumo ?? {}
  const clientesPagos = data?.clientes_pagos ?? []
  const clientesPend  = data?.clientes_pendentes ?? []
  const comissoesMes  = data?.comissoes_mes ?? []

  // Sincronizar com dados do backend
  useEffect(() => {
    if (fech) {
      setDespesas(fech.despesas_previstas || [])
      setReducoes(fech.reducoes || [])
      setNovos(fech.novos_gastos || [])
      setAnotacoes(fech.anotacoes || { decisoes: '', proximos_passos: '', pendencias: '', observacoes: '' })
    } else {
      setDespesas([])
      setReducoes([])
      setNovos([])
      setAnotacoes({ decisoes: '', proximos_passos: '', pendencias: '', observacoes: '' })
    }
  }, [fech])

  // Carregar clientes extras (atrasados) do backend ao receber dados
  useEffect(() => {
    const ov = JSON.parse(localStorage.getItem(`bam-cov-${competencia}`) || '{}')
    setCliOv(ov)
    // Fonte primária: clientes_extras retornados separadamente pelo backend
    const extras = data?.clientes_extras ?? []
    setCliMn(extras)
  }, [competencia, data])

  // Carregar saldo e reserva do localStorage ao trocar competência
  useEffect(() => {
    const s = parseFloat(localStorage.getItem(`bam-saldo-${competencia}`) || '0')
    const r = parseFloat(localStorage.getItem(`bam-reserva-${competencia}`) || '0')
    setSaldoConta(s)
    setReservaMinima(r)
  }, [competencia])

  /* ── Cálculos locais (recalcula ao editar itens) ─────────────── */
  const totalDespConfirmadas = despesas.filter(d => d.status === 'confirmado' || d.status === 'pago').reduce((s, d) => s + (parseFloat(d.valor) || 0), 0)
  const totalDespPrevistas   = despesas.filter(d => d.status === 'previsto').reduce((s, d) => s + (parseFloat(d.valor) || 0), 0)
  const totalReducoes        = reducoes.reduce((s, r) => s + (parseFloat(r.valor) || 0), 0)
  const totalNovos           = novos.reduce((s, g) => s + (parseFloat(g.valor) || 0), 0)
  const totalComissoes       = comissoesMes.reduce((s, c) => s + (parseFloat(c.valor) || 0), 0)

  // ── Clientes mesclados: backend + overrides locais + manuais ──
  const allClientes = useMemo(() => {
    const backend = [...(data?.clientes_pagos ?? []), ...(data?.clientes_pendentes ?? [])]
    const base    = backend
      .map(c => ({ ...c, ...(cliOv[c.id] || {}) }))
      .filter(c => !cliOv[c.id]?._hidden)
    const manuais = cliMn.map(c => ({ ...c, ...(cliOv[c.id] || {}) }))
    return [...base, ...manuais]
  }, [data, cliOv, cliMn])

  const clientesPagosLocal = allClientes.filter(c => c.status_pagamento === 'pago')
  const clientesPendLocal  = allClientes.filter(c => c.status_pagamento !== 'pago')
  const clientesPendAtual  = clientesPendLocal.filter(c => c.origem !== 'atraso')
  const clientesPendAtraso = clientesPendLocal.filter(c => c.origem === 'atraso')
  const hasCliOv           = Object.keys(cliOv).length > 0 || cliMn.length > 0

  // Receita — SEMPRE usa dados locais dos clientes (resumo do backend pode retornar 0)
  // recConfirmada = clientes com status 'pago' (já recebido, está no saldoConta)
  // recPendente   = clientes ainda não pagos (entrada futura, não está no saldoConta)
  const recConfirmada = clientesPagosLocal.reduce((s, c) => s + parseFloat(c.valor_recebido || c.valor_mensal || c.valor || 0), 0)
  const recPendente   = clientesPendLocal.reduce((s, c)  => s + parseFloat(c.valor_mensal  || c.valor_previsto || c.valor || 0), 0)

  const lucroProjetado = recConfirmada + recPendente - totalDespConfirmadas - totalDespPrevistas - totalNovos + totalReducoes - totalComissoes
  const cenarioConservador = recConfirmada - totalDespConfirmadas - totalDespPrevistas - totalNovos + totalReducoes - totalComissoes
  const cenarioRealista    = recConfirmada + recPendente * 0.6 - totalDespConfirmadas - totalDespPrevistas - totalNovos + totalReducoes - totalComissoes
  const cenarioOtimista    = recConfirmada + recPendente - totalDespConfirmadas - totalDespPrevistas - totalNovos + totalReducoes - totalComissoes

  // ── FONTE ÚNICA DE VERDADE: fluxo diário do mês ──────────────
  // Modelo: saldoConta = saldo atual em conta (inclui recConfirmada já recebido)
  // Portanto: entradas futuras = apenas pendentes; saídas futuras = não pagas
  const fluxoDiario = useMemo(() => {
    if (saldoConta <= 0) return []
    const [ano, mes] = competencia.split('-')
    const diasNoMes = new Date(parseInt(ano), parseInt(mes), 0).getDate()
    const entradasPorDia = {}
    const saidasPorDia   = {}
    // Entradas futuras: clientes pendentes com dia de vencimento
    for (const c of clientesPendLocal) {
      if (c.dia_pagamento) {
        const dia = String(Math.min(parseInt(c.dia_pagamento), diasNoMes)).padStart(2, '0')
        entradasPorDia[dia] = (entradasPorDia[dia] || 0) + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0)
      }
    }
    // Saídas futuras: despesas com vencimento, excluindo já pagas/adiadas
    for (const d of despesas) {
      if (d.vencimento && d.status !== 'pago' && d.status !== 'adiado') {
        const diaPart = d.vencimento.split('-')[2]
        saidasPorDia[diaPart] = (saidasPorDia[diaPart] || 0) + parseFloat(d.valor || 0)
      }
    }
    // Sem data definida: novos gastos + comissões → último dia do mês
    const lastDia = String(diasNoMes).padStart(2, '0')
    const novosTot = novos.reduce((s, g) => s + parseFloat(g.valor || 0), 0)
    if (novosTot > 0)       saidasPorDia[lastDia]   = (saidasPorDia[lastDia]   || 0) + novosTot
    if (totalComissoes > 0) saidasPorDia[lastDia]   = (saidasPorDia[lastDia]   || 0) + totalComissoes
    if (totalReducoes > 0)  entradasPorDia[lastDia] = (entradasPorDia[lastDia] || 0) + totalReducoes
    // Construir linha do tempo
    let running = saldoConta
    return Array.from({ length: diasNoMes }, (_, i) => {
      const dia     = String(i + 1).padStart(2, '0')
      const entrada = entradasPorDia[dia] || 0
      const saida   = saidasPorDia[dia]   || 0
      running = running + entrada - saida
      return { dia, diaN: i + 1, saldo: running, entrada, saida }
    })
  }, [saldoConta, competencia, clientesPendLocal, despesas, novos, totalComissoes, totalReducoes])

  // Caixa real — derivado do fluxo diário quando disponível
  const saidasRestantes    = totalDespConfirmadas + totalDespPrevistas + totalNovos + totalComissoes
  const entradasRestantes  = recPendente
  const saldoFinalFluxo    = fluxoDiario.length > 0 ? fluxoDiario[fluxoDiario.length - 1].saldo : null
  const saldoFinalPrevisto = saldoConta > 0
    ? (saldoFinalFluxo ?? (saldoConta + entradasRestantes - saidasRestantes + totalReducoes))
    : (recConfirmada + recPendente - totalDespConfirmadas - totalDespPrevistas - totalNovos + totalReducoes - totalComissoes)
  const folga = saldoFinalPrevisto - reservaMinima

  // Saldo filtrado por data — usa fluxoDiario como fonte única
  // saldoConta já contém recConfirmada → só adicionar entradas futuras (pendentes)
  const saldoFiltrado = useMemo(() => {
    if (!dataSaldoFiltro || saldoConta === 0) return null
    const [fAno, fMes, fDia] = dataSaldoFiltro.split('-')
    const [cAno, cMes] = competencia.split('-')
    if (fAno !== cAno || fMes !== cMes) return null
    if (fluxoDiario.length === 0) {
      // fallback sem fluxo diário: pendentes + despesas não pagas até a data
      const recPendFiltro = clientesPendLocal
        .filter(c => {
          if (!c.dia_pagamento) return false
          const d = `${cAno}-${cMes}-${String(c.dia_pagamento).padStart(2, '0')}`
          return d <= dataSaldoFiltro
        })
        .reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
      const saidasFiltro = despesas
        .filter(d => d.vencimento && d.vencimento <= dataSaldoFiltro && d.status !== 'pago' && d.status !== 'adiado')
        .reduce((s, d) => s + parseFloat(d.valor || 0), 0)
      return saldoConta + recPendFiltro - saidasFiltro
    }
    const diaNum = parseInt(fDia, 10)
    return fluxoDiario[Math.min(diaNum, fluxoDiario.length) - 1]?.saldo ?? null
  }, [dataSaldoFiltro, saldoConta, fluxoDiario, clientesPendLocal, despesas, competencia])

  const insightsData = useMemo(() => {
    if (fluxoDiario.length === 0 || saldoConta <= 0)
      return { alertas: [], piorDia: null, piorValor: 0, melhorDia: null, melhorValor: 0 }
    const [, mes] = competencia.split('-')
    let piorDia = null, piorValor = Infinity, melhorDia = null, melhorValor = -Infinity
    const primeiroAlerta = fluxoDiario.find(d => d.saldo < 1000)
    for (const item of fluxoDiario) {
      if (item.saldo < piorValor)  { piorValor  = item.saldo; piorDia  = `${item.dia}/${mes}` }
      if (item.saldo > melhorValor) { melhorValor = item.saldo; melhorDia = `${item.dia}/${mes}` }
    }
    const saldoFinal = fluxoDiario[fluxoDiario.length - 1].saldo
    const alertas = []
    if (primeiroAlerta) {
      alertas.push({
        type: primeiroAlerta.saldo < 0 ? 'error' : 'warning',
        text: primeiroAlerta.saldo < 0
          ? ` Saldo negativo (${formatCurrency(primeiroAlerta.saldo)}) projetado no dia ${primeiroAlerta.dia}/${mes} — mais saídas do que entradas acumuladas até esse ponto`
          : `âš ï¸ Saldo baixo (${formatCurrency(primeiroAlerta.saldo)}) projetado no dia ${primeiroAlerta.dia}/${mes}`,
      })
      const hasIncoming = fluxoDiario.slice(primeiroAlerta.diaN).some(d => d.entrada > 0)
      if (hasIncoming) alertas.push({ type: 'info', text: ' Entradas futuras previstas após essa data irão normalizar o caixa' })
    }
    if (saldoFinal > 0) alertas.push({ type: 'success', text: `âœ… O mês fecha positivo em ${formatCurrency(saldoFinal)}` })
    else                alertas.push({ type: 'error',   text: ` Pode ser necessário uso de crédito — déficit de ${formatCurrency(Math.abs(saldoFinal))}` })
    return {
      alertas,
      piorDia, piorValor: piorValor === Infinity ? 0 : piorValor,
      melhorDia, melhorValor: melhorValor === -Infinity ? 0 : melhorValor,
    }
  }, [fluxoDiario, saldoConta, competencia])

  const caixaCenarios = [
    { label: 'Conservador', desc: 'Nenhum pendente paga',          value: saldoConta - saidasRestantes + totalReducoes,                      color: '#818CF8', icon: Scissors },
    { label: 'Realista',    desc: '60% dos pendentes pagam',       value: saldoConta + recPendente * 0.6 - saidasRestantes + totalReducoes,  color: '#F59E0B', icon: Target },
    { label: 'Otimista',    desc: 'Todos os pendentes pagam',      value: saldoConta + recPendente - saidasRestantes + totalReducoes,        color: GREEN,     icon: TrendingUp },
  ]

  // ── Lucro Real & Projeção Próximo Mês ─────────────────────────
  // Filtrar despesas fixas pela competência atual (evitar somar todos os meses)
  const despLocaisDoMes        = (dataDespLocais?.despesas ?? []).filter(d => d.competencia === competencia)
  const despFixasMesTotal      = despLocaisDoMes.length > 0
    ? despLocaisDoMes.reduce((s, d) => s + (d.valor ?? 0), 0)
    : (dataDespLocais?.total ?? 0)
  const despFixasMesPendente   = despLocaisDoMes.length > 0
    ? despLocaisDoMes.filter(d => d.status !== 'pago').reduce((s, d) => s + (d.valor ?? 0), 0)
    : (dataDespLocais?.total_pendente ?? 0)
  const totalDespLocaisPendMes = despFixasMesPendente
  const despProxMesFonteParcial = despLocaisDoMes.length === 0 && (dataDespLocais?.despesas ?? []).length > 0

  // Lucro Real = saldo final projetado - cartão - despesas fixas ainda não pagas
  const lucroReal = saldoFinalPrevisto - faturaCartao - totalDespLocaisPendMes

  // Projeção Próximo Mês — usa TUDO do fechamento + fixas + cartão (sem dupla contagem)
  // Despesas do fechamento = confirmadas + previstas + novos gastos + comissões - reduções
  const despFechamentoMes  = totalDespConfirmadas + totalDespPrevistas + totalNovos + totalComissoes - totalReducoes
  // Despesas fixas que NÃO estão já listadas no fechamento (para não duplicar)
  // Só somamos as fixas se o total fechamento não as incluir (usuário decide na entrada de dados)
  // Exibimos os dois valores separados para transparência
  const receitaProxMes   = recConfirmada + recPendente
  const despesaProxMes   = despFechamentoMes  // base = o que está no fechamento
  const despesaComFixas  = despesaProxMes + despFixasMesTotal + faturaCartao  // tudo junto
  const resultadoProxMes = receitaProxMes - despesaComFixas

  /* ── Salvar ──────────────────────────────────────────────────── */
  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await fechamentoAPI.save({
        competencia,
        despesas_previstas: despesas,
        reducoes,
        novos_gastos: novos,
        anotacoes,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      refetch()
    } catch (e) {
      console.error('Erro ao salvar fechamento:', e)
    } finally {
      setSaving(false)
    }
  }, [competencia, despesas, reducoes, novos, anotacoes, refetch])

  /* ── Helpers CRUD locais ─────────────────────────────────────── */
  const openModal = (type, item = null, index = null) => {
    setForm(item ? { ...item } : {})
    setModal({ type, item, index })
  }

  const saveModal = () => {
    if (!modal) return
    const { type, index } = modal
    if (type === 'despesa') {
      if (index !== null) {
        setDespesas(d => d.map((it, i) => i === index ? { ...form } : it))
      } else {
        setDespesas(d => [...d, { ...form }])
      }
    } else if (type === 'reducao') {
      if (index !== null) {
        setReducoes(r => r.map((it, i) => i === index ? { ...form } : it))
      } else {
        setReducoes(r => [...r, { ...form }])
      }
    } else if (type === 'novo') {
      if (index !== null) {
        setNovos(n => n.map((it, i) => i === index ? { ...form } : it))
      } else {
        setNovos(n => [...n, { ...form }])
      }
    }
    setModal(null)
  }

  const removeItem = (type, index) => {
    if (type === 'despesa') setDespesas(d => d.filter((_, i) => i !== index))
    if (type === 'reducao') setReducoes(r => r.filter((_, i) => i !== index))
    if (type === 'novo')    setNovos(n => n.filter((_, i) => i !== index))
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  /* ── Saldo em conta ─────────────────────────────────────────── */
  const abrirEdicaoCaixa = () => {
    setTmpSaldo(saldoConta > 0 ? String(saldoConta) : '')
    setTmpReserva(reservaMinima > 0 ? String(reservaMinima) : '')
    setEditandoCaixa(true)
  }

  const salvarCaixa = () => {
    const s = Math.max(0, parseFloat(tmpSaldo) || 0)
    const r = Math.max(0, parseFloat(tmpReserva) || 0)
    localStorage.setItem(`bam-saldo-${competencia}`, s)
    localStorage.setItem(`bam-reserva-${competencia}`, r)
    setSaldoConta(s)
    setReservaMinima(r)
    setEditandoCaixa(false)
  }

  const salvarFatura = () => {
    const f = Math.max(0, parseFloat(tmpFatura) || 0)
    localStorage.setItem('bam-fatura-cartao', String(f))
    setFaturaCartao(f)
    setEditandoFatura(false)
  }

  const openHubModal = (type, item = null) => {
    const defDespLocal = { nome: '', categoria: 'Licenças / Ferramentas', valor: '', competencia, status: 'pendente', observacoes: '' }
    const defComissao  = { nome: '', responsavel: '', regra: '', valor: '', competencia, status: 'pendente', observacoes: '' }
    const def = type === 'desplocal' ? defDespLocal : defComissao
    setHubForm(item ? { ...def, ...item, valor: String(item.valor ?? '') } : def)
    setHubFormErr('')
    setHubModal({ type, mode: item ? 'edit' : 'new', item })
  }

  const saveHubModal = async () => {
    if (!hubForm.nome?.trim()) { setHubFormErr('Nome é obrigatório.'); return }
    setHubSaving(true)
    try {
      const payload = { ...hubForm, valor: hubForm.valor === '' ? 0 : Number(hubForm.valor) }
      if (hubModal.type === 'desplocal') {
        hubModal.item ? await despesasLocaisAPI.update(hubModal.item.id, payload)
                      : await despesasLocaisAPI.create(payload)
        refetchDespLocais()
      } else {
        hubModal.item ? await comissoesAPI.update(hubModal.item.id, payload)
                      : await comissoesAPI.create(payload)
        refetchComissoesFull()
      }
      setHubModal(null)
    } catch (e) {
      setHubFormErr(e?.response?.data?.detail || 'Erro ao salvar.')
    } finally { setHubSaving(false) }
  }

  const removeHubItem = async (type, id) => {
    try {
      if (type === 'desplocal') { await despesasLocaisAPI.remove(id); refetchDespLocais() }
      else { await comissoesAPI.remove(id); refetchComissoesFull() }
    } catch { /* silencioso */ }
  }

  const toggleHubStatus = async (type, item) => {
    const novo = item.status === 'pago' ? 'pendente' : 'pago'
    try {
      if (type === 'desplocal') { await despesasLocaisAPI.update(item.id, { status: novo }); refetchDespLocais() }
      else { await comissoesAPI.update(item.id, { status: novo }); refetchComissoesFull() }
    } catch { /* silencioso */ }
  }

  /* ── Helpers persistência local de clientes ─────────────────── */
  const persistCliOv = useCallback((nov) => {
    setCliOv(nov)
    localStorage.setItem(`bam-cov-${competencia}`, JSON.stringify(nov))
  }, [competencia])

  const persistCliMn = useCallback(async (nmn) => {
    setCliMn(nmn)
    // Salvar no backend — cria fechamento se ainda não existir
    let fechId = data?.fechamento?.id
    try {
      if (!fechId) {
        const res = await fechamentoAPI.save({
          competencia,
          despesas_previstas: [], reducoes: [], novos_gastos: [],
          clientes_extras: nmn,
        })
        fechId = res.data?.id
      } else {
        await fechamentoAPI.saveClientesExtras(fechId, nmn)
      }
      refetch()
    } catch { /* silencioso */ }
  }, [competencia, data, refetch])

  const openCliModal = (mode, cliente = null) => {
    const def = { nome: '', valor: '', status_pagamento: 'pendente', cobranca_status: 'sem_cobrar',
                  origem: 'atual', observacao_pagamento: '', dia_pagamento: '', data_pagamento: '' }
    setCliForm(cliente
      ? { ...def, ...cliente, valor: String(parseFloat(cliente.valor_mensal || cliente.valor_previsto || cliente.valor || 0) || '') }
      : def)
    setCliModal({ mode, id: cliente?.id })
  }

  const saveCliModal = () => {
    if (!cliModal) return
    const { mode, id } = cliModal
    const valor = parseFloat(cliForm.valor) || 0
    const payload = {
      ...cliForm,
      valor_mensal:   valor,
      valor_previsto: valor,
      valor_recebido: cliForm.status_pagamento === 'pago' ? valor : 0,
    }
    if (mode === 'new') {
      const newItem = { ...payload, id: `manual-${Date.now()}`, status: 'ativo' }
      persistCliMn([...cliMn, newItem])
    } else {
      const isManual = cliMn.some(c => c.id === id)
      if (isManual) {
        persistCliMn(cliMn.map(c => c.id === id ? { ...c, ...payload } : c))
      } else {
        // Salva no backend (clientes.json) para persistir definitivamente
        clientesAPI.update(id, {
          valor_mensal:        payload.valor_mensal,
          valor_previsto:      payload.valor_previsto,
          valor_recebido:      payload.valor_recebido,
          status_pagamento:    payload.status_pagamento,
          cobranca_status:     payload.cobranca_status,
          dia_pagamento:       payload.dia_pagamento || null,
          data_pagamento:      payload.data_pagamento || null,
          observacao_pagamento: payload.observacao_pagamento || '',
          origem:              payload.origem || 'atual',
        }).then(() => refetch()).catch(e => console.error('Erro ao salvar cliente:', e))
        // Atualiza também o override local para resposta imediata na tela
        persistCliOv({ ...cliOv, [id]: { ...(cliOv[id] || {}), ...payload } })
      }
    }
    setCliModal(null)
  }

  const removeCli = (cliente) => {
    if (cliMn.some(c => c.id === cliente.id)) {
      persistCliMn(cliMn.filter(c => c.id !== cliente.id))
    } else {
      persistCliOv({ ...cliOv, [cliente.id]: { ...(cliOv[cliente.id] || {}), _hidden: true } })
    }
  }

  const aplicarAcaoCli = (cliente, acao) => {
    const valor = parseFloat(cliente.valor_mensal || cliente.valor_previsto || cliente.valor || 0)
    let patch = {}
    if      (acao === 'pago')     patch = { status_pagamento: 'pago', valor_recebido: valor, data_pagamento: new Date().toISOString().split('T')[0] }
    else if (acao === 'cobrado')  patch = { cobranca_status: 'cobrado' }
    else if (acao === 'prometeu') patch = { cobranca_status: 'prometeu_pagar' }
    else if (acao === 'atraso')   patch = { status_pagamento: 'vencido', origem: 'atraso' }
    else if (acao === 'negociar') patch = { cobranca_status: 'negociar' }
    if (cliMn.some(c => c.id === cliente.id)) {
      persistCliMn(cliMn.map(c => c.id === cliente.id ? { ...c, ...patch } : c))
    } else {
      persistCliOv({ ...cliOv, [cliente.id]: { ...(cliOv[cliente.id] || {}), ...patch } })
      clientesAPI.update(cliente.id, patch).then(() => refetch()).catch(() => {})
    }
  }

  /* ── Seletor de competência ──────────────────────────────────── */
  const competenciaOptions = []
  const agora = new Date()
  for (let i = -3; i <= 3; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth() + i, 1)
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    competenciaOptions.push({ value: v, label: competenciaLabel(v) })
  }

  /* ── Colunas das tabelas ─────────────────────────────────────── */
  const colsDespesas = [
    { key: 'descricao', label: 'Descrição', render: v => <span className="text-white font-medium">{v || '—'}</span> },
    { key: 'categoria', label: 'Categoria' },
    { key: 'valor', label: 'Valor', align: 'right', render: v => <span className="text-white font-medium">{formatCurrency(v)}</span> },
    { key: 'vencimento', label: 'Vencimento' },
    { key: 'status', label: 'Status', render: v => { const s = STATUS_DESP[v] || STATUS_DESP.previsto; return <Badge variant={s.variant} dot>{s.label}</Badge> } },
    { key: 'observacao', label: 'Obs.' },
  ]

  const colsReducoes = [
    { key: 'descricao', label: 'Descrição', render: v => <span className="text-white font-medium">{v || '—'}</span> },
    { key: 'categoria', label: 'Categoria' },
    { key: 'valor', label: 'Valor Reduzido', align: 'right', render: v => <span style={{ color: GREEN }} className="font-medium">{formatCurrency(v)}</span> },
    { key: 'impacto_mensal', label: 'Impacto Mensal', align: 'right', render: v => v ? formatCurrency(v) : '—' },
    { key: 'observacao', label: 'Obs.' },
  ]

  const colsNovos = [
    { key: 'descricao', label: 'Descrição', render: v => <span className="text-white font-medium">{v || '—'}</span> },
    { key: 'tipo', label: 'Tipo', render: v => <Badge variant="info" dot>{v === 'investimento' ? 'Investimento' : v === 'comissao' ? 'Comissão' : v === 'ajuste' ? 'Ajuste' : 'Novo gasto'}</Badge> },
    { key: 'valor', label: 'Valor', align: 'right', render: v => <span className="text-white font-medium">{formatCurrency(v)}</span> },
    { key: 'prioridade', label: 'Prioridade', render: v => { const p = PRIORIDADE_MAP[v] || PRIORIDADE_MAP.media; return <Badge variant={p.variant} dot>{p.label}</Badge> } },
    { key: 'observacao', label: 'Obs.' },
  ]

  /* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
     RENDER
     â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */
  return (
    <div className="space-y-6 animate-fade-in">

      {/* ── 1) CABEÇALHO ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <CalendarCheck size={24} style={{ color: GREEN }} />
            Fechamento do Mês
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Conferência final de receitas, despesas, pendências e resultado projetado
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select value={competencia} onChange={e => setCompetencia(e.target.value)}
                  className={SELECT_CLS} style={{ width: 140 }}>
            {competenciaOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <Button variant="secondary" size="sm" onClick={refetch} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Atualizar
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            <Save size={14} /> {saving ? 'Salvando…' : saved ? 'Salvo âœ“' : 'Salvar'}
          </Button>
        </div>
      </div>

      {/* ── SALDO ATUAL EM CONTA ─────────────────────────────── */}
      <div className="relative rounded-2xl overflow-hidden p-5 lg:p-6"
           style={{ background: 'linear-gradient(135deg, #0D1012 0%, #172022 100%)', border: '1px solid rgba(18,240,198,0.18)' }}>
        <div className="absolute top-0 left-0 w-72 h-72 rounded-full blur-3xl pointer-events-none"
             style={{ background: GREEN, opacity: 0.04, transform: 'translate(-40%, -40%)' }} />
        <div className="relative flex flex-col lg:flex-row lg:items-stretch gap-6">

          {/* Coluna 1 — Saldo Atual */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Landmark size={15} style={{ color: GREEN }} />
              <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">Saldo Atual em Conta</span>
            </div>
            {editandoCaixa ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input type="number" step="0.01"
                         className="flex-1 max-w-xs px-3 py-2 rounded-lg text-xl font-bold text-white bg-black/40 border border-[#12F0C6]/40 focus:outline-none focus:border-[#12F0C6]/70 placeholder:text-gray-600"
                         value={tmpSaldo} onChange={e => setTmpSaldo(e.target.value)}
                         placeholder="ex: 17000" autoFocus
                         onKeyDown={e => e.key === 'Enter' && salvarCaixa()} />
                </div>
                <div className="flex items-center gap-2">
                  <Shield size={12} className="text-gray-500 flex-shrink-0" />
                  <input type="number" step="0.01"
                         className="flex-1 max-w-xs px-3 py-1.5 rounded-lg text-sm text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/40 placeholder:text-gray-600"
                         value={tmpReserva} onChange={e => setTmpReserva(e.target.value)}
                         placeholder="Reserva mínima desejada (ex: 15000)" />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button variant="primary" size="sm" onClick={salvarCaixa}>Salvar</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditandoCaixa(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-4xl font-black tracking-tight" style={{ color: saldoConta > 0 ? 'white' : undefined }}>
                  {saldoConta > 0 ? formatCurrency(saldoConta) : <span className="text-gray-600 text-2xl">Não informado</span>}
                </p>
                <button onClick={abrirEdicaoCaixa}
                        className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-white/20 hover:bg-white/5">
                  <Pencil size={11} /> {saldoConta > 0 ? 'Editar saldo' : 'Informar saldo de hoje'}
                </button>
              </div>
            )}
          </div>

          {/* Divisor */}
          <div className="hidden lg:block w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

          {/* Coluna 2 — Fluxo restante */}
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Fluxo Restante do Mês</p>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-gray-400">
                  <ArrowUpCircle size={13} style={{ color: GREEN }} /> Entradas previstas
                </span>
                <span className="text-sm font-bold" style={{ color: GREEN }}>+ {formatCurrency(entradasRestantes)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-xs text-gray-400">
                  <ArrowDownCircle size={13} style={{ color: '#EF4444' }} /> Saídas previstas
                </span>
                <span className="text-sm font-bold text-red-400">- {formatCurrency(saidasRestantes)}</span>
              </div>
              {totalReducoes > 0 && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs text-gray-400">
                    <Scissors size={13} style={{ color: GREEN }} /> Economias realizadas
                  </span>
                  <span className="text-sm font-bold" style={{ color: GREEN }}>+ {formatCurrency(totalReducoes)}</span>
                </div>
              )}
              <div className="pt-2 mt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Resultado líquido previsto</span>
                  <span className="text-sm font-bold" style={{ color: (entradasRestantes - saidasRestantes + totalReducoes) >= 0 ? GREEN : '#EF4444' }}>
                    {formatCurrency(entradasRestantes - saidasRestantes + totalReducoes)}
                  </span>
                </div>
                {saldoFinalFluxo !== null && Math.abs(saldoFinalFluxo - (saldoConta + entradasRestantes - saidasRestantes + totalReducoes)) > 1 && (
                  <p className="text-[10px] text-gray-600 mt-1">
                    â„¹ï¸ Fluxo diário (com datas): {formatCurrency(saldoFinalFluxo)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Divisor */}
          <div className="hidden lg:block w-px" style={{ background: 'rgba(255,255,255,0.06)' }} />

          {/* Coluna 3 — Saldo Final + Reserva */}
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Saldo Final Previsto em Conta</p>
              <div className="flex items-center gap-1.5">
                <input type="date" value={dataSaldoFiltro} onChange={e => setDataSaldoFiltro(e.target.value)}
                       title="Saldo projetado até esta data"
                       className="text-xs bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-gray-400 focus:outline-none focus:border-[#12F0C6]/40" />
                {dataSaldoFiltro && (
                  <button onClick={() => setDataSaldoFiltro('')}
                          className="text-[11px] text-gray-600 hover:text-gray-400 transition" title="Limpar filtro">âœ•</button>
                )}
              </div>
            </div>
            <p className="text-3xl font-black tracking-tight"
               style={{ color: saldoConta > 0 ? ((saldoFiltrado ?? saldoFinalPrevisto) >= 0 ? GREEN : '#EF4444') : '#374151' }}>
              {saldoConta > 0 ? formatCurrency(saldoFiltrado ?? saldoFinalPrevisto) : <span className="text-gray-700 text-xl">—</span>}
            </p>
            {dataSaldoFiltro && saldoFiltrado !== null && (
              <div className="mt-1">
                <p className="text-[11px] text-gray-500">
                  Projeção até {new Date(dataSaldoFiltro + 'T12:00').toLocaleDateString('pt-BR')}
                </p>
                {saldoFiltrado < 0 && (
                  <div className="mt-2 p-2.5 rounded-lg text-[11px] leading-relaxed"
                       style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>
                     Seu caixa fica negativo neste dia pois há mais saídas do que entradas acumuladas até este ponto do mês.
                    {fluxoDiario.slice(parseInt(dataSaldoFiltro.split('-')[2])).some(d => d.entrada > 0)
                      ? <span style={{ color: '#F59E0B' }}> Entradas futuras previstas irão normalizar o saldo após esta data.</span>
                      : null}
                  </div>
                )}
                {saldoFiltrado >= 0 && saldoFiltrado < 1000 && (
                  <p className="text-[11px] text-yellow-500 mt-1">âš ï¸ Saldo baixo nesta data</p>
                )}
              </div>
            )}
            {saldoConta === 0 && (
              <p className="text-xs text-gray-600 mt-1">Informe o saldo atual para calcular</p>
            )}
            {saldoConta > 0 && reservaMinima > 0 && (()=> {
              const displaySaldo = saldoFiltrado ?? saldoFinalPrevisto
              const f = displaySaldo - reservaMinima
              return (
                <div className="mt-3 p-2.5 rounded-lg"
                     style={{ background: f >= 0 ? 'rgba(18,240,198,0.06)' : 'rgba(239,68,68,0.06)', border: `1px solid ${f >= 0 ? 'rgba(18,240,198,0.15)' : 'rgba(239,68,68,0.2)'}` }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Shield size={11} /> Reserva mínima
                    </span>
                    <span className="text-xs text-gray-400">{formatCurrency(reservaMinima)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold" style={{ color: f >= 0 ? GREEN : '#EF4444' }}>
                      {f >= 0 ? 'âœ“ Meta coberta' : 'âš  Déficit previsto'}
                    </span>
                    <span className="text-sm font-bold" style={{ color: f >= 0 ? GREEN : '#EF4444' }}>
                      {f >= 0 ? '+' : ''}{formatCurrency(f)}
                    </span>
                  </div>
                </div>
              )
            })()}
            {saldoConta > 0 && reservaMinima === 0 && (
              <button onClick={abrirEdicaoCaixa}
                      className="mt-2 text-[11px] text-gray-600 hover:text-gray-400 transition flex items-center gap-1">
                <Shield size={10} /> + Definir reserva mínima
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 2) CARDS RESUMO ───────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI icon={TrendingUp}     label="Receita Confirmada" value={formatCurrency(recConfirmada)} color={GREEN} />
        <KPI icon={Clock}          label="Receita Pendente"   value={formatCurrency(recPendente)}   color="#F59E0B" />
        <KPI icon={TrendingDown}   label="Desp. Confirmadas"  value={formatCurrency(totalDespConfirmadas)} color="#EF4444" />
        <KPI icon={AlertTriangle}  label="Desp. Previstas"    value={formatCurrency(totalDespPrevistas)}   color="#F59E0B" />
        <KPI icon={Scissors}       label="Reduções Realizadas" value={formatCurrency(totalReducoes)} color={GREEN} sub="Economia do mês" />
        <KPI icon={ShoppingBag}    label="Novos Gastos"       value={formatCurrency(totalNovos)}    color="#EF4444" />
        <KPI icon={Award}          label="Comissões Previstas" value={formatCurrency(totalComissoes)} color="#818CF8" />
        <KPI icon={Target}         label="Lucro Projetado"    value={formatCurrency(lucroProjetado)}
             color={lucroProjetado >= 0 ? GREEN : '#EF4444'}
             sub={lucroProjetado >= 0 ? 'Positivo' : 'Negativo'} />
      </div>

      {/* ── 4) CLIENTES PAGOS E PENDENTES ─────────────────────── */}
      <Section title="Clientes Pagos e Pendentes" icon={Users}
               badge={
                 <span className="flex items-center gap-2 text-xs">
                   <Badge variant="success" dot>{clientesPagosLocal.length} pagos</Badge>
                   <Badge variant="warning" dot>{clientesPendAtual.length} pendentes</Badge>
                   {clientesPendAtraso.length > 0 && <Badge variant="error" dot>{clientesPendAtraso.length} atrasados</Badge>}
                 </span>
               }>

        {/* Resumo 6 cards */}
        <div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
          {[
            { label: 'Pagos',       value: clientesPagosLocal.length,  color: GREEN,     fmt: false },
            { label: 'Pendentes',   value: clientesPendAtual.length,   color: '#F59E0B', fmt: false },
            { label: 'Atrasados',   value: clientesPendAtraso.length,  color: '#EF4444', fmt: false },
            { label: 'Recebido',    value: recConfirmada,               color: GREEN,     fmt: true  },
            { label: 'Em Aberto',   value: recPendente,                 color: '#F59E0B', fmt: true  },
            {
              label: '% Recebido',
              value: (() => { const t = recConfirmada + recPendente; return t > 0 ? `${Math.round(recConfirmada / t * 100)}%` : '—' })(),
              color: (() => { const t = recConfirmada + recPendente; const p = t > 0 ? recConfirmada / t : 0; return p >= 0.7 ? GREEN : p >= 0.35 ? '#F59E0B' : '#EF4444' })(),
              fmt: false,
            },
          ].map((item, i) => (
            <div key={i} className="rounded-lg p-3 text-center" style={{ background: `${item.color}0D`, border: `1px solid ${item.color}26` }}>
              <p className="text-base font-bold" style={{ color: item.color }}>{item.fmt ? formatCurrency(item.value) : item.value}</p>
              <p className="text-[10px] text-gray-500 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>

        {/* Barra de ações */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-gray-500">
            {hasCliOv
              ? <span style={{ color: '#F59E0B' }}>â— Dados com ajustes manuais nesta competência</span>
              : 'Espelhando base de clientes cadastrados'}
          </p>
          <button onClick={() => openCliModal('new')}
                  className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-white/5 transition border border-white/10"
                  style={{ color: GREEN }}>
            <Plus size={13} /> Adicionar cliente
          </button>
        </div>

        {/* 2 colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* ── Pagos ── */}
          <div className="rounded-lg p-4" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 size={14} style={{ color: GREEN }} /> Pagos no mês ({clientesPagosLocal.length})
              </h4>
              <button onClick={() => openCliModal('new', { status_pagamento: 'pago', data_pagamento: new Date().toISOString().split('T')[0] })}
                      className="text-[11px] flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/5 transition"
                      style={{ color: GREEN }}>
                <Plus size={11} /> Registrar
              </button>
            </div>
            {clientesPagosLocal.length === 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-gray-500">Nenhum pagamento confirmado neste mês</p>
                <p className="text-[11px] text-gray-600 mt-1">Use "Registrar" ou marque um pendente como pago</p>
              </div>
            )}
            <div className="space-y-2">
              {clientesPagosLocal.map(c => (
                <div key={c.id} className="px-3 py-2.5 rounded-lg group relative"
                     style={{ background: 'rgba(18,240,198,0.04)', border: '1px solid rgba(18,240,198,0.1)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm text-white font-medium">{c.nome}</p>
                        {String(c.id).startsWith('manual-') && <Badge variant="neutral">manual</Badge>}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {c.data_pagamento ? `Pago em ${new Date(c.data_pagamento + 'T12:00').toLocaleDateString('pt-BR')}` : 'Pago'}
                        {c.responsavel ? ` · ${c.responsavel}` : ''}
                      </p>
                      {c.observacao_pagamento && <p className="text-[11px] text-gray-600 mt-0.5 italic">{c.observacao_pagamento}</p>}
                    </div>
                    <span className="text-sm font-bold whitespace-nowrap" style={{ color: GREEN }}>
                      {formatCurrency(parseFloat(c.valor_recebido || c.valor_mensal || c.valor || 0))}
                    </span>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                    <button onClick={() => openCliModal('edit', c)} className="p-1 rounded hover:bg-white/10" title="Editar"><Edit3 size={12} className="text-gray-400" /></button>
                    <button onClick={() => removeCli(c)} className="p-1 rounded hover:bg-white/10" title="Remover"><Trash2 size={12} className="text-red-400" /></button>
                  </div>
                </div>
              ))}
            </div>
            {clientesPagosLocal.length > 0 && (
              <div className="mt-3 pt-3 border-t flex justify-between items-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <span className="text-xs text-gray-500">Total recebido</span>
                <span className="text-sm font-bold" style={{ color: GREEN }}>
                  {formatCurrency(clientesPagosLocal.reduce((s, c) => s + parseFloat(c.valor_recebido || c.valor_mensal || c.valor || 0), 0))}
                </span>
              </div>
            )}
          </div>

          {/* ── Pendentes + Atrasados ── */}
          <div className="rounded-lg p-4 space-y-4" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)' }}>
            {clientesPendLocal.length === 0 && (
              <p className="text-xs text-gray-600 text-center py-6">Todos os clientes estão em dia</p>
            )}

            {/* Este mês */}
            {clientesPendAtual.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-600 mb-2 flex items-center gap-1.5">
                  <Clock size={11} className="text-yellow-500" /> Este mês ({clientesPendAtual.length})
                </p>
                <div className="space-y-2">
                  {clientesPendAtual.map(c => {
                    const valor = parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0)
                    return (
                      <div key={c.id} className="px-3 py-2.5 rounded-lg group"
                           style={{ background: 'rgba(245,158,11,0.03)', border: '1px solid rgba(245,158,11,0.08)' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-sm text-white font-medium">{c.nome}</p>
                              {String(c.id).startsWith('manual-') && <Badge variant="neutral">manual</Badge>}
                              {c.cobranca_status === 'cobrado' && <Badge variant="info" dot>Cobrado</Badge>}
                              {c.cobranca_status === 'prometeu_pagar' && <Badge variant="success" dot>Prometeu</Badge>}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                              {c.dia_pagamento ? `Venc. dia ${c.dia_pagamento}` : 'Sem vencimento'}
                              {c.observacao_pagamento ? ` · ${c.observacao_pagamento}` : ''}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-yellow-500 whitespace-nowrap">{formatCurrency(valor)}</span>
                        </div>
                        <div className="mt-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap items-center">
                          <button onClick={() => aplicarAcaoCli(c, 'pago')} className="text-[11px] px-2 py-1 rounded-md transition" style={{ background: 'rgba(18,240,198,0.1)', color: GREEN }}>âœ“ Pago</button>
                          <button onClick={() => aplicarAcaoCli(c, 'cobrado')} className="text-[11px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition text-gray-300">Cobrado</button>
                          <button onClick={() => aplicarAcaoCli(c, 'prometeu')} className="text-[11px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition text-gray-300">Prometeu</button>
                          <button onClick={() => aplicarAcaoCli(c, 'atraso')} className="text-[11px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition text-red-400/70">Atrasado</button>
                          <button onClick={() => openCliModal('edit', c)} className="p-1 rounded hover:bg-white/10 ml-auto" title="Editar"><Edit3 size={12} className="text-gray-500" /></button>
                          <button onClick={() => removeCli(c)} className="p-1 rounded hover:bg-white/10" title="Remover"><Trash2 size={12} className="text-red-400/70" /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Atrasados */}
            {clientesPendAtraso.length > 0 && (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-red-400/60 mb-2 flex items-center gap-1.5">
                  <AlertTriangle size={11} /> Atrasados — meses anteriores ({clientesPendAtraso.length})
                </p>
                <div className="space-y-2">
                  {clientesPendAtraso.map(c => {
                    const valor = parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0)
                    const ultRec = parseFloat(c.valor_recebido || 0)
                    const temHist = ultRec > 0 && c.data_pagamento && !c.data_pagamento.startsWith(competencia)
                    return (
                      <div key={c.id} className="px-3 py-2.5 rounded-lg group"
                           style={{ background: 'rgba(239,68,68,0.03)', border: '1px solid rgba(239,68,68,0.12)' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white font-medium">{c.nome}</p>
                            {temHist && (
                              <p className="text-[11px] text-gray-600 mt-0.5 italic">
                                Último: {formatCurrency(ultRec)} em {new Date(c.data_pagamento + 'T12:00').toLocaleDateString('pt-BR')}
                              </p>
                            )}
                            {c.observacao_pagamento && <p className="text-[11px] text-gray-600 mt-0.5 italic">{c.observacao_pagamento}</p>}
                          </div>
                          <span className="text-sm font-bold text-red-400 whitespace-nowrap">{formatCurrency(valor)}</span>
                        </div>
                        <div className="mt-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity flex-wrap items-center">
                          <button onClick={() => aplicarAcaoCli(c, 'pago')} className="text-[11px] px-2 py-1 rounded-md transition" style={{ background: 'rgba(18,240,198,0.1)', color: GREEN }}>âœ“ Pago</button>
                          <button onClick={() => aplicarAcaoCli(c, 'cobrado')} className="text-[11px] px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 transition text-gray-300">Cobrado</button>
                          <button onClick={() => openCliModal('edit', c)} className="p-1 rounded hover:bg-white/10 ml-auto" title="Editar"><Edit3 size={12} className="text-gray-500" /></button>
                          <button onClick={() => removeCli(c)} className="p-1 rounded hover:bg-white/10" title="Remover"><Trash2 size={12} className="text-red-400/70" /></button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {clientesPendLocal.length > 0 && (
              <div className="pt-3 border-t flex justify-between items-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <span className="text-xs text-gray-500">Total em aberto</span>
                <span className="text-sm font-bold text-yellow-500">
                  {formatCurrency(clientesPendLocal.reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0))}
                </span>
              </div>
            )}
          </div>
        </div>
      </Section>

      {/* ── 2b) HUB RECEITAS & DESPESAS ──────────────────────── */}
      <Section title="Receitas & Despesas — Visão Unificada" icon={FileText}
               badge={<Badge variant="neutral">Hub financeiro</Badge>}>
        {/* Tabs */}
        <div className="flex items-center gap-2 mt-3 mb-5 flex-wrap">
          {[
            { key: 'receitas',  label: 'Receitas'},
            { key: 'despesas',  label: 'Despesas'},
            { key: 'fixas',     label: 'Despesas Fixas'},
            { key: 'comissoes', label: 'Comissões'},
          ].map(aba => (
            <button key={aba.key} onClick={() => { setAbaHub(aba.key); setHubSearch(''); setHubFiltroStatus(''); setHubFiltroCategoria('') }}
                    className="px-4 py-2 text-sm font-medium rounded-lg transition-all"
                    style={abaHub === aba.key ? { background: GREEN, color: '#000' } : { color: '#9CA3AF', background: 'rgba(255,255,255,0.05)' }}>
              {aba.label}
            </button>
          ))}
          <input
            className="ml-auto text-xs rounded-lg px-3 py-2 bg-black/40 border border-white/10 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#12F0C6]/50"
            placeholder="Buscar..." value={hubSearch} onChange={e => setHubSearch(e.target.value)}
            style={{ width: 180 }}
          />
        </div>

        {/* TAB: Receitas */}
        {abaHub === 'receitas' && (() => {
          const [_rAno, _rMes] = competencia.split('-')
          const mesFiltroRec = `${MESES[parseInt(_rMes, 10) - 1]}/${_rAno.slice(2)}`
          const todosRec = dataReceitas?.lancamentos ?? []
          // Mês atual: usa clientes do fechamento (status correto)
          const fechRec = allClientes.map(c => ({
            descricao: c.nome,
            categoria: c.servico || c.categoria || 'Cliente',
            cliente:   c.nome,
            valor:     parseFloat(c.valor_recebido || c.valor_mensal || c.valor_previsto || c.valor || 0),
            mes:       mesFiltroRec,
            status:    c.status_pagamento === 'pago' ? 'pago' : (c.origem === 'atraso' ? 'atraso' : 'pendente'),
            data_pagamento: c.data_pagamento,
          }))
          const baseRec = hubMostrarTodos ? todosRec : fechRec
          const catsRec = [...new Set(baseRec.map(r => r.categoria).filter(Boolean))].sort()
          const statusesRec = [...new Set(baseRec.map(r => (r.status || '').toLowerCase()).filter(Boolean))].sort()
          const lnc = baseRec.filter(r => {
            if (hubSearch && !r.descricao?.toLowerCase().includes(hubSearch.toLowerCase()) && !r.cliente?.toLowerCase().includes(hubSearch.toLowerCase())) return false
            if (hubFiltroStatus && (r.status || '').toLowerCase() !== hubFiltroStatus) return false
            if (hubFiltroCategoria && r.categoria !== hubFiltroCategoria) return false
            return true
          })
          const total = lnc.reduce((s, r) => s + (r.valor ?? 0), 0)
          const selStyle = { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#D1D5DB', borderRadius: 8, padding: '6px 28px 6px 10px', fontSize: 12, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', minWidth: 120 }
          return (
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(18,240,198,0.06)', border: '1px solid rgba(18,240,198,0.12)' }}>
                  <p className="text-[10px] text-gray-500">Total</p>
                  <p className="text-sm font-bold" style={{ color: GREEN }}>{formatCurrency(total)}</p>
                </div>
                <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] text-gray-500">Registros</p>
                  <p className="text-sm font-bold text-white">{lnc.length}</p>
                </div>
                {!hubMostrarTodos && (
                  <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] text-gray-500">Mês</p>
                    <p className="text-sm font-bold" style={{ color: '#12F0C6' }}>{mesFiltroRec}</p>
                  </div>
                )}
                {/* Filtro Status */}
                <div style={{ position: 'relative' }}>
                  <select value={hubFiltroStatus} onChange={e => setHubFiltroStatus(e.target.value)} style={selStyle}>
                    <option value="">Status</option>
                    {statusesRec.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: 10 }}>▼</span>
                </div>
                {/* Filtro Categoria */}
                <div style={{ position: 'relative' }}>
                  <select value={hubFiltroCategoria} onChange={e => setHubFiltroCategoria(e.target.value)} style={selStyle}>
                    <option value="">Categoria</option>
                    {catsRec.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: 10 }}>▼</span>
                </div>
                {(hubFiltroStatus || hubFiltroCategoria) && (
                  <button onClick={() => { setHubFiltroStatus(''); setHubFiltroCategoria('') }}
                          className="text-xs px-2 py-1.5 rounded-lg border transition"
                          style={{ background: 'rgba(239,68,68,0.08)', color: '#F87171', borderColor: 'rgba(239,68,68,0.2)' }}>
                    Limpar filtros
                  </button>
                )}
                <button onClick={() => setHubMostrarTodos(v => !v)}
                        className="ml-auto text-xs px-3 py-2 rounded-lg border transition"
                        style={hubMostrarTodos
                          ? { background: 'rgba(18,240,198,0.1)', color: '#12F0C6', borderColor: 'rgba(18,240,198,0.3)' }
                          : { background: 'rgba(255,255,255,0.03)', color: '#9CA3AF', borderColor: 'rgba(255,255,255,0.1)' }}>
                  {hubMostrarTodos ? '✓ Todos os meses' : 'Ver todos os meses'}
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                <table className="w-full text-left">
                  <thead><tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                    {(hubMostrarTodos
                      ? ['Mês','Descrição','Categoria','Cliente','Status','Valor']
                      : ['Cliente','Serviço','Valor','Status','Pagamento']
                    ).map(h => (
                      <th key={h} className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                    {lnc.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-xs text-gray-600">Nenhum registro</td></tr>}
                    {lnc.map((r, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        {hubMostrarTodos ? (<>
                          <td className="px-3 py-2.5 text-xs text-gray-400">{r.mes}</td>
                          <td className="px-3 py-2.5 text-xs text-white font-medium">{r.descricao}</td>
                          <td className="px-3 py-2.5"><Badge variant="info">{r.categoria}</Badge></td>
                          <td className="px-3 py-2.5 text-xs text-gray-300">{r.cliente}</td>
                          <td className="px-3 py-2.5"><Badge variant={r.status === 'Recebido' ? 'success' : r.status === 'Cancelado' ? 'error' : 'warning'} dot>{r.status}</Badge></td>
                          <td className="px-3 py-2.5 text-xs font-semibold text-right" style={{ color: GREEN }}>{formatCurrency(r.valor)}</td>
                        </>) : (<>
                          <td className="px-3 py-2.5 text-xs text-white font-medium">{r.cliente}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-300">{r.categoria}</td>
                          <td className="px-3 py-2.5 text-xs font-semibold text-right" style={{ color: GREEN }}>{formatCurrency(r.valor)}</td>
                          <td className="px-3 py-2.5">
                            {(() => {
                              const s = (r.status || '').toLowerCase()
                              if (s === 'pago')    return <Badge variant="success" dot>Pago</Badge>
                              if (s === 'atraso')  return <Badge variant="error" dot>Atrasado</Badge>
                              return <Badge variant="warning" dot>Pendente</Badge>
                            })()}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-gray-400">{r.data_pagamento || '—'}</td>
                        </>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        {/* TAB: Despesas */}
        {abaHub === 'despesas' && (() => {
          const [_ano, _mes] = competencia.split('-')
          const mesFiltro = `${MESES[parseInt(_mes, 10) - 1]}/${_ano.slice(2)}`
          const todosExcel = dataDespGlobal?.lancamentos ?? []
          // Mês atual: usa despesas do fechamento (status correto + itens completos)
          // Outros meses: usa Excel
          const fechDesp = despesas.map(d => ({
            descricao:    d.descricao,
            categoria:    d.categoria,
            centro_custo: '',
            valor:        parseFloat(d.valor) || 0,
            mes:          mesFiltro,
            status:       d.status,
            vencimento:   d.vencimento,
            observacao:   d.observacao,
          }))
          const baseDesp = hubMostrarTodos ? todosExcel : fechDesp
          const catsDesp = [...new Set(baseDesp.map(d => d.categoria).filter(Boolean))].sort()
          const statusesDesp = [...new Set(baseDesp.map(d => (d.status || '').toLowerCase()).filter(Boolean))].sort()
          const lnc = baseDesp.filter(d => {
            if (hubSearch && !d.descricao?.toLowerCase().includes(hubSearch.toLowerCase()) && !d.categoria?.toLowerCase().includes(hubSearch.toLowerCase())) return false
            if (hubFiltroStatus && (d.status || '').toLowerCase() !== hubFiltroStatus) return false
            if (hubFiltroCategoria && d.categoria !== hubFiltroCategoria) return false
            return true
          })
          const total = lnc.reduce((s, d) => s + (d.valor ?? 0), 0)
          const selStyleD = { background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: '#D1D5DB', borderRadius: 8, padding: '6px 28px 6px 10px', fontSize: 12, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', minWidth: 120 }
          return (
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}>
                  <p className="text-[10px] text-gray-500">Total</p>
                  <p className="text-sm font-bold text-red-400">{formatCurrency(total)}</p>
                </div>
                <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] text-gray-500">Registros</p>
                  <p className="text-sm font-bold text-white">{lnc.length}</p>
                </div>
                {!hubMostrarTodos && (
                  <div className="rounded-lg px-4 py-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] text-gray-500">Mês selecionado</p>
                    <p className="text-sm font-bold" style={{ color: '#12F0C6' }}>{mesFiltro}</p>
                  </div>
                )}
                {/* Filtro Status */}
                <div style={{ position: 'relative' }}>
                  <select value={hubFiltroStatus} onChange={e => setHubFiltroStatus(e.target.value)} style={selStyleD}>
                    <option value="">Status</option>
                    {statusesDesp.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: 10 }}>▼</span>
                </div>
                {/* Filtro Categoria */}
                <div style={{ position: 'relative' }}>
                  <select value={hubFiltroCategoria} onChange={e => setHubFiltroCategoria(e.target.value)} style={selStyleD}>
                    <option value="">Categoria</option>
                    {catsDesp.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9CA3AF', fontSize: 10 }}>▼</span>
                </div>
                {(hubFiltroStatus || hubFiltroCategoria) && (
                  <button onClick={() => { setHubFiltroStatus(''); setHubFiltroCategoria('') }}
                          className="text-xs px-2 py-1.5 rounded-lg border transition"
                          style={{ background: 'rgba(239,68,68,0.08)', color: '#F87171', borderColor: 'rgba(239,68,68,0.2)' }}>
                    Limpar filtros
                  </button>
                )}
                <button onClick={() => setHubMostrarTodos(v => !v)}
                        className="ml-auto text-xs px-3 py-2 rounded-lg border transition"
                        style={hubMostrarTodos
                          ? { background: 'rgba(18,240,198,0.1)', color: '#12F0C6', borderColor: 'rgba(18,240,198,0.3)' }
                          : { background: 'rgba(255,255,255,0.03)', color: '#9CA3AF', borderColor: 'rgba(255,255,255,0.1)' }}>
                  {hubMostrarTodos ? '✓ Todos os meses' : 'Ver todos os meses'}
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                <table className="w-full text-left">
                  <thead><tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                    {(hubMostrarTodos
                      ? ['Mês','Descrição','Categoria','Centro de Custo','Valor','Status']
                      : ['Descrição','Categoria','Vencimento','Valor','Status','Obs.']
                    ).map(h => (
                      <th key={h} className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                    {lnc.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-gray-600">Nenhum registro</td></tr>}
                    {lnc.map((d, i) => (
                      <tr key={i} className="hover:bg-white/[0.02]">
                        {hubMostrarTodos ? (<>
                          <td className="px-3 py-2.5 text-xs text-gray-400">{d.mes}</td>
                          <td className="px-3 py-2.5 text-xs text-white font-medium">{d.descricao}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-300">{d.categoria}</td>
                          <td className="px-3 py-2.5"><Badge variant="neutral">{d.centro_custo}</Badge></td>
                        </>) : (<>
                          <td className="px-3 py-2.5 text-xs text-white font-medium">{d.descricao}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-300">{d.categoria}</td>
                          <td className="px-3 py-2.5 text-xs text-gray-400">{d.vencimento || '—'}</td>
                        </>)}
                        <td className="px-3 py-2.5 text-xs font-semibold text-right text-white">{formatCurrency(d.valor)}</td>
                        <td className="px-3 py-2.5">
                          {(() => {
                            const s = (d.status || '').toLowerCase().trim()
                            if (s === 'pago')       return <Badge variant="success" dot>Pago</Badge>
                            if (s === 'confirmado') return <Badge variant="info" dot>Confirmado</Badge>
                            if (s === 'adiado')     return <Badge variant="warning" dot>Adiado</Badge>
                            return <Badge variant="neutral" dot>Previsto</Badge>
                          })()}
                        </td>
                        {!hubMostrarTodos && <td className="px-3 py-2.5 text-xs text-gray-500">{d.observacao || '—'}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        {/* TAB: Despesas Fixas */}
        {abaHub === 'fixas' && (() => {
          const lista = (dataDespLocais?.despesas ?? []).filter(d =>
            !hubSearch || d.nome?.toLowerCase().includes(hubSearch.toLowerCase()) || d.categoria?.toLowerCase().includes(hubSearch.toLowerCase())
          )
          return (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex gap-3 flex-wrap">
                  {[
                    { label: 'Total',    v: dataDespLocais?.total          ?? 0, color: '#EF4444' },
                    { label: 'Pendente', v: dataDespLocais?.total_pendente ?? 0, color: '#F59E0B' },
                    { label: 'Pago',     v: dataDespLocais?.total_pago     ?? 0, color: GREEN },
                  ].map(k => (
                    <div key={k.label} className="rounded-lg px-4 py-2" style={{ background: `${k.color}10`, border: `1px solid ${k.color}20` }}>
                      <p className="text-[10px] text-gray-500">{k.label}</p>
                      <p className="text-sm font-bold" style={{ color: k.color }}>{formatCurrency(k.v)}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => openHubModal('desplocal')}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition"
                        style={{ color: GREEN }}>
                  <Plus size={13} /> Nova Despesa Fixa
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                <table className="w-full text-left">
                  <thead><tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                    {['Nome','Categoria','Competência','Valor','Status',''].map(h => (
                      <th key={h} className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                    {lista.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-xs text-gray-600">Nenhum registro</td></tr>}
                    {lista.map((d, i) => (
                      <tr key={d.id ?? i} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-xs text-white font-medium">{d.nome}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-400">{d.categoria}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-400">{d.competencia}</td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-white">{formatCurrency(d.valor)}</td>
                        <td className="px-3 py-2.5">
                          <button onClick={() => toggleHubStatus('desplocal', d)}
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition"
                                  style={d.status === 'pago' ? { background: 'rgba(18,240,198,0.1)', color: GREEN } : { background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                            {d.status === 'pago' ? 'âœ“ Pago' : 'â— Pendente'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button onClick={() => openHubModal('desplocal', d)} className="p-1 text-gray-500 hover:text-white transition mr-1"><Edit3 size={13} /></button>
                          <button onClick={() => removeHubItem('desplocal', d.id)} className="p-1 text-gray-500 hover:text-red-400 transition"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}

        {/* TAB: Comissões */}
        {abaHub === 'comissoes' && (() => {
          const lista = (dataComissoesFull?.comissoes ?? []).filter(c =>
            !hubSearch || c.nome?.toLowerCase().includes(hubSearch.toLowerCase()) || c.responsavel?.toLowerCase().includes(hubSearch.toLowerCase())
          )
          return (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex gap-3 flex-wrap">
                  {[
                    { label: 'Total',    v: dataComissoesFull?.total          ?? 0, color: '#818CF8' },
                    { label: 'Pendente', v: dataComissoesFull?.total_pendente ?? 0, color: '#F59E0B' },
                    { label: 'Pago',     v: dataComissoesFull?.total_pago     ?? 0, color: GREEN },
                  ].map(k => (
                    <div key={k.label} className="rounded-lg px-4 py-2" style={{ background: `${k.color}10`, border: `1px solid ${k.color}20` }}>
                      <p className="text-[10px] text-gray-500">{k.label}</p>
                      <p className="text-sm font-bold" style={{ color: k.color }}>{formatCurrency(k.v)}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => openHubModal('comissao')}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-white/10 hover:bg-white/5 transition"
                        style={{ color: GREEN }}>
                  <Plus size={13} /> Nova Comissão
                </button>
              </div>
              <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
                <table className="w-full text-left">
                  <thead><tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                    {['Nome','Responsável','Regra','Competência','Valor','Status',''].map(h => (
                      <th key={h} className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                    {lista.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-xs text-gray-600">Nenhum registro</td></tr>}
                    {lista.map((c, i) => (
                      <tr key={c.id ?? i} className="hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-xs text-white font-medium">{c.nome}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-300">{c.responsavel}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-400">{c.regra || '—'}</td>
                        <td className="px-3 py-2.5 text-xs text-gray-400">{c.competencia}</td>
                        <td className="px-3 py-2.5 text-xs font-semibold text-white">{formatCurrency(c.valor)}</td>
                        <td className="px-3 py-2.5">
                          <button onClick={() => toggleHubStatus('comissao', c)}
                                  className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md transition"
                                  style={c.status === 'pago' ? { background: 'rgba(18,240,198,0.1)', color: GREEN } : { background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                            {c.status === 'pago' ? 'âœ“ Pago' : 'â— Pendente'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button onClick={() => openHubModal('comissao', c)} className="p-1 text-gray-500 hover:text-white transition mr-1"><Edit3 size={13} /></button>
                          <button onClick={() => removeHubItem('comissao', c.id)} className="p-1 text-gray-500 hover:text-red-400 transition"><Trash2 size={13} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}
      </Section>

      {/* ── INSIGHTS FINANCEIROS ─────────────────────────────── */}
      <Section title="Insights Financeiros" icon={Target} defaultOpen={saldoConta > 0}>
        {saldoConta <= 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm text-gray-500">Informe o saldo atual em conta para gerar insights automáticos</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {insightsData.alertas.length === 0 && (
              <p className="text-xs text-gray-600 py-4 text-center">Nenhum insight disponível para este mês</p>
            )}
            {insightsData.alertas.map((alert, i) => {
              const cfg = {
                success: { bg: 'rgba(18,240,198,0.07)',  border: 'rgba(18,240,198,0.22)', color: GREEN,     icon: 'âœ…' },
                warning: { bg: 'rgba(245,158,11,0.07)',  border: 'rgba(245,158,11,0.22)', color: '#F59E0B', icon: 'âš ï¸' },
                info:    { bg: 'rgba(99,102,241,0.07)',  border: 'rgba(99,102,241,0.22)', color: '#818CF8', icon: '' },
                error:   { bg: 'rgba(239,68,68,0.07)',   border: 'rgba(239,68,68,0.22)',  color: '#EF4444', icon: '' },
              }
              const c = cfg[alert.type] || cfg.info
              return (
                <div key={i} className="flex items-center gap-3 rounded-lg px-4 py-3"
                     style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                  <span className="text-base flex-shrink-0">{c.icon}</span>
                  <p className="text-sm" style={{ color: c.color }}>{alert.text}</p>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* ── LUCRO REAL PROJETADO ─────────────────────────────── */}
      <Section title="Lucro Real Projetado" icon={PiggyBank} defaultOpen={true}>
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Composição */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Composição</h4>
            {[
              { label: 'Saldo Final Previsto',  value: saldoFinalPrevisto,       icon: Target,      color: saldoFinalPrevisto >= 0 ? GREEN : '#EF4444', sign: '' },
              { label: 'Fatura Cartão',          value: faturaCartao,             icon: CreditCard,  color: '#EF4444', sign: '(-) ' },
              { label: 'Desp. Fixas Pendentes',  value: totalDespLocaisPendMes,   icon: Scissors,    color: '#F59E0B', sign: '(-) ' },
            ].map((row, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg"
                   style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="flex items-center gap-2 text-xs text-gray-300">
                  <row.icon size={13} style={{ color: row.color }} />
                  {row.sign}{row.label}
                </span>
                <span className="text-sm font-semibold" style={{ color: row.color }}>{formatCurrency(row.value)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-3 rounded-lg"
                 style={{ background: lucroReal >= 0 ? 'rgba(18,240,198,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${lucroReal >= 0 ? 'rgba(18,240,198,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
              <span className="text-sm font-bold text-white">(=) Lucro Real</span>
              <span className="text-lg font-bold" style={{ color: lucroReal >= 0 ? GREEN : '#EF4444' }}>{formatCurrency(lucroReal)}</span>
            </div>
            <p className="text-[11px] text-gray-600">Valor considerando obrigações futuras (cartão + despesas fixas pendentes de {competencia})</p>
            {despProxMesFonteParcial && (
              <p className="text-[11px] text-yellow-600 mt-1">âš ï¸ Algumas despesas fixas podem não estar incluídas — sem registro para esta competência</p>
            )}
          </div>

          {/* Fatura do cartão (editável) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Fatura Prevista do Cartão</h4>
              {!editandoFatura && (
                <button onClick={() => { setTmpFatura(String(faturaCartao)); setEditandoFatura(true) }}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition px-2 py-1 rounded border border-white/10 hover:border-white/20">
                  <Pencil size={11} /> Editar
                </button>
              )}
            </div>
            {editandoFatura ? (
              <div className="space-y-2">
                <input type="number" step="0.01" className={INPUT_CLS}
                       value={tmpFatura} onChange={e => setTmpFatura(e.target.value)}
                       placeholder="Ex: 1700" autoFocus
                       onKeyDown={e => e.key === 'Enter' && salvarFatura()} />
                <div className="flex gap-2">
                  <Button variant="primary" size="sm" onClick={salvarFatura}>Salvar</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditandoFatura(false)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-5 text-center"
                   style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                <p className="text-3xl font-black text-red-400">{formatCurrency(faturaCartao)}</p>
                <p className="text-xs text-gray-600 mt-1">valor padrão editável</p>
              </div>
            )}
            <div className="rounded-lg p-3 flex items-center justify-between"
                 style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.12)' }}>
              <p className="text-[11px] text-gray-500">Despesas Fixas Pendentes</p>
              <p className="text-sm font-bold text-yellow-400">{formatCurrency(totalDespLocaisPendMes)}</p>
            </div>
          </div>
        </div>
      </Section>

      {/* ── PROJEÇÃO PRÓXIMO MÊS ─────────────────────────────── */}
      <Section title="Projeção Próximo Mês" icon={TrendingUp} defaultOpen={true}>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl p-5 text-center"
               style={{ background: 'rgba(18,240,198,0.05)', border: '1px solid rgba(18,240,198,0.15)' }}>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Receita Prevista</p>
            <p className="text-2xl font-black" style={{ color: GREEN }}>{formatCurrency(receitaProxMes)}</p>
            <p className="text-[10px] text-gray-600 mt-1">{clientesPagosLocal.length} pagos + {clientesPendLocal.length} pendentes</p>
          </div>
          <div className="rounded-xl p-5 text-center"
               style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Despesa Total Prevista</p>
            <p className="text-2xl font-black text-red-400">{formatCurrency(despesaComFixas)}</p>
            <p className="text-[10px] text-gray-600 mt-1">fechamento + fixas + cartão</p>
          </div>
          <div className="rounded-xl p-5 text-center"
               style={{ background: resultadoProxMes >= 0 ? 'rgba(18,240,198,0.05)' : 'rgba(239,68,68,0.05)', border: `1px solid ${resultadoProxMes >= 0 ? 'rgba(18,240,198,0.15)' : 'rgba(239,68,68,0.15)'}` }}>
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Resultado Estimado</p>
            <p className="text-2xl font-black" style={{ color: resultadoProxMes >= 0 ? GREEN : '#EF4444' }}>{formatCurrency(resultadoProxMes)}</p>
            <p className="text-[10px] text-gray-600 mt-1">{resultadoProxMes >= 0 ? 'mês positivo' : 'âš ï¸ mês negativo'}</p>
          </div>
        </div>

        {/* Detalhamento por categoria */}
        <div className="mt-4 rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-4 py-2.5" style={{ background: 'rgba(0,0,0,0.3)' }}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider"> Detalhamento das despesas previstas</p>
          </div>
          <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>

            {/* Salários — destaque especial */}
            {(() => {
              const salarios = despesas.filter(d => /sal[aá]rio|salario/i.test(d.descricao || '') || /sal[aá]rio|salario/i.test(d.categoria || ''))
              if (salarios.length === 0) return null
              const total = salarios.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0)
              return (
                <div key="sal">
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(129,140,248,0.06)' }}>
                    <div>
                      <p className="text-xs font-semibold text-indigo-300"> Salários</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{salarios.length} funcionário{salarios.length !== 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-sm font-bold text-indigo-300">{formatCurrency(total)}</p>
                  </div>
                  {salarios.map((d, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.025)' }}>
                      <p className="text-[11px] text-gray-400">{d.descricao}</p>
                      <p className="text-[11px] text-gray-300 ml-4">{formatCurrency(d.valor)}</p>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Despesas confirmadas/pagas não-salário */}
            {(() => {
              const itens = despesas.filter(d =>
                (d.status === 'confirmado' || d.status === 'pago') &&
                !/sal[aá]rio|salario/i.test(d.descricao || '') &&
                !/sal[aá]rio|salario/i.test(d.categoria || '')
              )
              if (itens.length === 0) return null
              const total = itens.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0)
              return (
                <div key="conf">
                  <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(239,68,68,0.04)' }}>
                    <div>
                      <p className="text-xs font-semibold text-red-300">âœ… Confirmadas / pagas</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">{itens.length} itens</p>
                    </div>
                    <p className="text-sm font-bold text-red-300">{formatCurrency(total)}</p>
                  </div>
                  {itens.map((d, i) => (
                    <div key={i} className="flex items-center justify-between px-6 py-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.025)' }}>
                      <p className="text-[11px] text-gray-400">{d.descricao}{d.categoria ? ` · ${d.categoria}` : ''}</p>
                      <p className="text-[11px] text-gray-300 ml-4">{formatCurrency(d.valor)}</p>
                    </div>
                  ))}
                </div>
              )
            })()}

            {/* Despesas previstas agrupadas por categoria */}
            {(() => {
              const previstas = despesas.filter(d =>
                d.status === 'previsto' &&
                !/sal[aá]rio|salario/i.test(d.descricao || '') &&
                !/sal[aá]rio|salario/i.test(d.categoria || '')
              )
              if (previstas.length === 0) return null
              const grupos = {}
              for (const d of previstas) {
                const cat = d.categoria || 'Outros'
                if (!grupos[cat]) grupos[cat] = []
                grupos[cat].push(d)
              }
              return Object.entries(grupos).map(([cat, itens]) => {
                const total = itens.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0)
                return (
                  <div key={`p-${cat}`}>
                    <div className="flex items-center justify-between px-4 py-2.5" style={{ background: 'rgba(245,158,11,0.04)' }}>
                      <div>
                        <p className="text-xs font-semibold text-yellow-400"> {cat}</p>
                        <p className="text-[10px] text-gray-600 mt-0.5">{itens.length} item{itens.length !== 1 ? 'ns' : ''} previsto{itens.length !== 1 ? 's' : ''}</p>
                      </div>
                      <p className="text-sm font-bold text-yellow-400">{formatCurrency(total)}</p>
                    </div>
                    {itens.map((d, i) => (
                      <div key={i} className="flex items-center justify-between px-6 py-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.025)' }}>
                        <p className="text-[11px] text-gray-400">{d.descricao}</p>
                        <p className="text-[11px] text-gray-300 ml-4">{formatCurrency(d.valor)}</p>
                      </div>
                    ))}
                  </div>
                )
              })
            })()}

            {novos.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-xs text-gray-300">Novos gastos / decisões</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{novos.length} itens</p>
                </div>
                <p className="text-sm font-semibold text-red-400">{formatCurrency(totalNovos)}</p>
              </div>
            )}
            {comissoesMes.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-xs text-gray-300">Comissões do mês</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{comissoesMes.length} comissões</p>
                </div>
                <p className="text-sm font-semibold" style={{ color: '#818CF8' }}>{formatCurrency(totalComissoes)}</p>
              </div>
            )}
            {reducoes.length > 0 && (
              <div className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <p className="text-xs text-gray-300">Reduções / economias (desconta)</p>
                  <p className="text-[10px] text-gray-600 mt-0.5">{reducoes.length} reduções</p>
                </div>
                <p className="text-sm font-semibold" style={{ color: GREEN }}>- {formatCurrency(totalReducoes)}</p>
              </div>
            )}
            <div className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-xs text-gray-300">Despesas fixas ({despLocaisDoMes.length > 0 ? competencia : 'total geral âš ï¸'})</p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {despLocaisDoMes.length > 0
                    ? `${despLocaisDoMes.length} itens desta competência`
                    : `Nenhum item em ${competencia} — usando ${(dataDespLocais?.despesas ?? []).length} itens do total geral`}
                </p>
              </div>
              <p className="text-sm font-semibold text-yellow-400">{formatCurrency(despFixasMesTotal)}</p>
            </div>
            <div className="flex items-center justify-between px-4 py-2.5">
              <div>
                <p className="text-xs text-gray-300">Fatura do cartão</p>
                <p className="text-[10px] text-gray-600 mt-0.5">valor configurável</p>
              </div>
              <p className="text-sm font-semibold text-red-400">{formatCurrency(faturaCartao)}</p>
            </div>
            <div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(239,68,68,0.06)' }}>
              <p className="text-sm font-bold text-white">Total Despesas</p>
              <p className="text-base font-black text-red-400">{formatCurrency(despesaComFixas)}</p>
            </div>
          </div>
        </div>

        {despProxMesFonteParcial && (
          <div className="mt-3 px-4 py-2.5 rounded-lg text-[11px] text-yellow-400"
               style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
            âš ï¸ Despesas Fixas sem registros para {competencia} — usando total de todos os meses como estimativa.
          </div>
        )}
      </Section>

      {/* ── ANÁLISE DE RISCO DE CAIXA ────────────────────────── */}
      {saldoConta > 0 && insightsData.piorDia && (
        <Section title="Análise de Risco de Caixa" icon={AlertTriangle} defaultOpen={true}>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl p-6"
                 style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl"></span>
                <p className="text-xs font-semibold text-red-400 uppercase tracking-wider">Pior dia do mês</p>
              </div>
              <p className="text-3xl font-black text-red-400">{insightsData.piorDia}</p>
              <p className="text-lg font-bold text-white mt-1">{formatCurrency(insightsData.piorValor)}</p>
              <p className="text-[11px] text-gray-500 mt-2">
                {insightsData.piorValor < 0 ? 'âš ï¸ Saldo negativo projetado' : insightsData.piorValor < 1000 ? 'âš ï¸ Saldo crítico' : 'Menor saldo previsto'}
              </p>
            </div>
            <div className="rounded-xl p-6"
                 style={{ background: 'rgba(18,240,198,0.06)', border: '1px solid rgba(18,240,198,0.2)' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl"></span>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: GREEN }}>Melhor dia do mês</p>
              </div>
              <p className="text-3xl font-black" style={{ color: GREEN }}>{insightsData.melhorDia}</p>
              <p className="text-lg font-bold text-white mt-1">{formatCurrency(insightsData.melhorValor)}</p>
              <p className="text-[11px] text-gray-500 mt-2">Maior saldo projetado</p>
            </div>
          </div>
        </Section>
      )}

      {/* ── 8) FECHAMENTO FINAL ───────────────────────────────── */}
      <Section title="Fechamento Final — Projeção do mês" icon={PiggyBank} defaultOpen={true}
               badge={
                 <Badge variant={lucroProjetado >= 0 ? 'success' : 'error'} dot>
                   {lucroProjetado >= 0 ? 'Positivo' : 'Negativo'}
                 </Badge>
               }>
        <div className="mt-4 space-y-6">

          {/* Linha 1: Composição operacional + Cenários operacionais */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Composição Operacional */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Composição Operacional</h4>
              {[
                { label: 'Receita Confirmada',  value: recConfirmada,          icon: ArrowUpCircle,   color: GREEN,     sign: '' },
                { label: 'Receita Pendente',     value: recPendente,            icon: ArrowUpCircle,   color: '#F59E0B', sign: '(+) ' },
                { label: 'Desp. Confirmadas',   value: totalDespConfirmadas,   icon: ArrowDownCircle, color: '#EF4444', sign: '(-) ' },
                { label: 'Desp. Previstas',     value: totalDespPrevistas,     icon: ArrowDownCircle, color: '#F59E0B', sign: '(-) ' },
                { label: 'Novos Gastos',         value: totalNovos,             icon: ArrowDownCircle, color: '#EF4444', sign: '(-) ' },
                { label: 'Reduções / Economias', value: totalReducoes,          icon: ArrowUpCircle,   color: GREEN,     sign: '(+) ' },
                { label: 'Comissões',            value: totalComissoes,         icon: MinusCircle,     color: '#818CF8', sign: '(-) ' },
              ].map((row, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg"
                     style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="flex items-center gap-2 text-xs text-gray-300">
                    <row.icon size={13} style={{ color: row.color }} />
                    {row.sign}{row.label}
                  </span>
                  <span className="text-sm font-semibold" style={{ color: row.color }}>{formatCurrency(row.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-3 py-3 rounded-lg mt-1"
                   style={{ background: lucroProjetado >= 0 ? 'rgba(18,240,198,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${lucroProjetado >= 0 ? 'rgba(18,240,198,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
                <span className="text-sm font-bold text-white">(=) Lucro Projetado</span>
                <span className="text-lg font-bold" style={{ color: lucroProjetado >= 0 ? GREEN : '#EF4444' }}>
                  {formatCurrency(lucroProjetado)}
                </span>
              </div>
            </div>

            {/* Cenários (operacionais ou de caixa dependendo se saldo foi informado) */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {saldoConta > 0 ? 'Cenários — Saldo Final em Conta' : 'Cenários de Resultado Operacional'}
              </h4>
              {(saldoConta > 0 ? caixaCenarios : [
                { label: 'Conservador', desc: 'Apenas receita confirmada',      value: cenarioConservador, color: '#818CF8', icon: Scissors },
                { label: 'Realista',    desc: 'Confirma + 60% da pendente',    value: cenarioRealista,    color: '#F59E0B', icon: Target },
                { label: 'Otimista',    desc: 'Confirma + toda a pendente',     value: cenarioOtimista,    color: GREEN,     icon: TrendingUp },
              ]).map((c, i) => (
                <div key={i} className="rounded-xl p-4 relative overflow-hidden"
                     style={{ background: '#1A1E21', border: `1px solid ${c.color}22` }}>
                  <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"
                       style={{ background: c.color, opacity: 0.1 }} />
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <c.icon size={15} style={{ color: c.color }} />
                      <span className="text-sm font-semibold text-white">{c.label}</span>
                    </div>
                    <span className="text-lg font-bold" style={{ color: c.value >= 0 ? c.color : '#EF4444' }}>
                      {formatCurrency(c.value)}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500">{c.desc}</p>
                  {reservaMinima > 0 && saldoConta > 0 && (
                    <p className="text-[11px] mt-1" style={{ color: (c.value - reservaMinima) >= 0 ? GREEN : '#EF4444' }}>
                      {(c.value - reservaMinima) >= 0 ? `âœ“ +${formatCurrency(c.value - reservaMinima)} acima da reserva` : `âš  ${formatCurrency(c.value - reservaMinima)} abaixo da reserva`}
                    </p>
                  )}
                  <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                         style={{
                           background: c.value >= 0 ? c.color : '#EF4444',
                           width: `${Math.min(100, Math.max(4, Math.abs(c.value) / Math.max(1, saldoConta > 0 ? (saldoConta + recPendente) : (recConfirmada + recPendente)) * 100))}%`,
                         }} />
                  </div>
                </div>
              ))}
              {saldoConta > 0 && (
                <p className="text-[11px] text-gray-600 text-center pt-1">
                  Base: saldo atual ({formatCurrency(saldoConta)}) Â± entradas/saídas previstas
                </p>
              )}
            </div>
          </div>

          {/* Linha 2: Projeção de Caixa Real (só quando saldo informado) */}
          {saldoConta > 0 && (
            <div className="rounded-xl p-5"
                 style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(18,240,198,0.1)' }}>
              <h4 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: GREEN }}>
                Projeção de Caixa Real — Partindo do Saldo Atual
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                  { label: 'Saldo de Partida',  value: saldoConta,          color: 'white',     icon: Landmark,       sign: '' },
                  { label: 'Entradas Previstas', value: entradasRestantes,  color: GREEN,       icon: ArrowUpCircle,  sign: '+ ' },
                  { label: 'Saídas Previstas',   value: saidasRestantes,    color: '#EF4444',   icon: ArrowDownCircle,sign: '- ' },
                  { label: 'Economias',          value: totalReducoes,       color: GREEN,       icon: Scissors,       sign: '+ ' },
                  { label: 'Saldo Final',        value: saldoFinalPrevisto, color: saldoFinalPrevisto >= 0 ? GREEN : '#EF4444', icon: Target, sign: '= ' },
                  { label: 'Folga de Caixa',     value: folga,              color: folga >= 0 ? GREEN : '#EF4444', icon: Shield, sign: reservaMinima > 0 ? (folga >= 0 ? 'âœ“ ' : 'âš  ') : '—' },
                ].map((item, i) => (
                  <div key={i} className={`rounded-lg p-3 text-center ${i === 4 ? 'ring-1 ring-offset-0' : ''}`}
                       style={{
                         background: i === 4 ? (saldoFinalPrevisto >= 0 ? 'rgba(18,240,198,0.06)' : 'rgba(239,68,68,0.06)') : 'rgba(255,255,255,0.03)',
                         ringColor: item.color,
                       }}>
                    <item.icon size={14} style={{ color: item.color }} className="mx-auto mb-1" />
                    <p className="text-[10px] text-gray-500 mb-1">{item.label}</p>
                    <p className="text-sm font-bold" style={{ color: item.color }}>
                      {i === 5 && reservaMinima === 0
                        ? <span className="text-gray-600 text-xs">Sem reserva</span>
                        : <>{item.sign}{formatCurrency(item.value)}</>
                      }
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </Section>

      {/* ── 9) ANOTAÇÃ•ES DA REUNIÃO ───────────────────────────── */}
      <Section title="Anotações da Reunião" icon={FileText}>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Decisões tomadas</label>
            <textarea className={TEXTAREA_CLS} value={anotacoes.decisoes}
                      onChange={e => setAnotacoes(a => ({ ...a, decisoes: e.target.value }))}
                      placeholder="Decisões definidas na reunião…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Próximos passos</label>
            <textarea className={TEXTAREA_CLS} value={anotacoes.proximos_passos}
                      onChange={e => setAnotacoes(a => ({ ...a, proximos_passos: e.target.value }))}
                      placeholder="O que deve ser feito em seguida…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Itens pendentes</label>
            <textarea className={TEXTAREA_CLS} value={anotacoes.pendencias}
                      onChange={e => setAnotacoes(a => ({ ...a, pendencias: e.target.value }))}
                      placeholder="O que ficou pendente…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Observações importantes</label>
            <textarea className={TEXTAREA_CLS} value={anotacoes.observacoes}
                      onChange={e => setAnotacoes(a => ({ ...a, observacoes: e.target.value }))}
                      placeholder="Observações gerais do mês…" />
          </div>
        </div>
      </Section>


      {/* -- 10) COMISSOES DO MES ---------------------------------------- */}
      <Section title="Comissões do Mês" icon={Award}
               badge={<Badge variant="info" dot>{formatCurrency(totalComissoes)}</Badge>}>
        <div className="mt-3 grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Total',    v: totalComissoes, color: '#818CF8' },
            { label: 'Pago',     v: comissoesMes.filter(c => c.status === 'pago').reduce((s,c) => s + (parseFloat(c.valor)||0), 0), color: '#12F0C6' },
            { label: 'Pendente', v: comissoesMes.filter(c => c.status !== 'pago').reduce((s,c) => s + (parseFloat(c.valor)||0), 0), color: '#F59E0B' },
          ].map(k => (
            <div key={k.label} className="rounded-xl p-3 text-center"
                 style={{ background: `${k.color}10`, border: `1px solid ${k.color}20` }}>
              <p className="text-[10px] text-gray-500 mb-1">{k.label}</p>
              <p className="text-sm font-bold" style={{ color: k.color }}>{formatCurrency(k.v)}</p>
            </div>
          ))}
        </div>
        {comissoesMes.length === 0 ? (
          <p className="text-xs text-gray-600 text-center py-4">Nenhuma comissão neste mês</p>
        ) : (
          <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
            <table className="w-full text-left">
              <thead><tr style={{ background: 'rgba(0,0,0,0.3)' }}>
                {['Nome','Responsavel','Valor','Status','Obs.'].map(h => (
                  <th key={h} className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.03)' }}>
                {comissoesMes.map((c, i) => (
                  <tr key={c.id ?? i} className="hover:bg-white/[0.02]">
                    <td className="px-3 py-2.5 text-xs text-white font-medium">{c.nome}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-300">{c.responsavel || '-'}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-white">{formatCurrency(c.valor)}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md"
                            style={c.status === 'pago' ? { background: 'rgba(18,240,198,0.1)', color: '#12F0C6' } : { background: 'rgba(245,158,11,0.1)', color: '#F59E0B' }}>
                        {c.status === 'pago' ? 'Pago' : 'Pendente'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-400">{c.observacoes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* -- 11) REDUCOES / ECONOMIAS ------------------------------------ */}
      <Section title="Reduções / Economias feitas no mês" icon={Scissors}
               badge={<Badge variant="success" dot>{formatCurrency(totalReducoes)}</Badge>}>
        <MiniTable
          columns={colsReducoes}
          data={reducoes.map((r, i) => ({ ...r, _idx: i }))}
          onAdd={() => openModal('reducao')}
          onEdit={row => openModal('reducao', row._idx)}
          onRemove={row => setReducoes(a => a.filter((_, i) => i !== row._idx))}
          addLabel="Nova Redução"
        />
      </Section>

      {/* -- 12) NOVOS GASTOS / DECISOES --------------------------------- */}
      <Section title="Novos Gastos / Decisões do Mês" icon={ShoppingBag}
               badge={<Badge variant="warning" dot>{formatCurrency(totalNovos)}</Badge>}>
        <MiniTable
          columns={colsNovos}
          data={novos.map((g, i) => ({ ...g, _idx: i }))}
          onAdd={() => openModal('novo')}
          onEdit={row => openModal('novo', row._idx)}
          onRemove={row => setNovos(a => a.filter((_, i) => i !== row._idx))}
          addLabel="Novo Gasto"
        />
      </Section>


      {/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
         MODAL DE EDIÇÃO (despesa / redução / novo gasto)
         â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */}
      <Modal open={!!modal} onClose={() => setModal(null)}
             title={modal?.type === 'despesa' ? (modal.index !== null ? 'Editar Despesa' : 'Nova Despesa') :
                    modal?.type === 'reducao' ? (modal.index !== null ? 'Editar Redução' : 'Nova Redução') :
                    modal?.type === 'novo'    ? (modal.index !== null ? 'Editar Gasto' : 'Novo Gasto / Decisão') : ''}
             maxWidth="max-w-lg">
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Descrição</label>
            <input className={INPUT_CLS} value={form.descricao || ''} onChange={e => set('descricao', e.target.value)} placeholder="Descrição do item" />
          </div>

          {modal?.type === 'despesa' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Categoria</label>
                  <input className={INPUT_CLS} value={form.categoria || ''} onChange={e => set('categoria', e.target.value)} placeholder="Ex: ferramenta, imposto" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Valor (R$)</label>
                  <input className={INPUT_CLS} type="number" step="0.01" value={form.valor || ''} onChange={e => set('valor', parseFloat(e.target.value) || 0)} placeholder="0,00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Vencimento</label>
                  <input className={INPUT_CLS} type="date" value={form.vencimento || ''} onChange={e => set('vencimento', e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                  <select className={SELECT_CLS} value={form.status || 'previsto'} onChange={e => set('status', e.target.value)}>
                    <option value="previsto">Previsto</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="pago">Pago</option>
                    <option value="adiado">Adiado</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {modal?.type === 'reducao' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Categoria</label>
                  <input className={INPUT_CLS} value={form.categoria || ''} onChange={e => set('categoria', e.target.value)} placeholder="Ex: ferramenta, servidor" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Valor Reduzido (R$)</label>
                  <input className={INPUT_CLS} type="number" step="0.01" value={form.valor || ''} onChange={e => set('valor', parseFloat(e.target.value) || 0)} placeholder="0,00" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Impacto Mensal (R$)</label>
                <input className={INPUT_CLS} type="number" step="0.01" value={form.impacto_mensal || ''} onChange={e => set('impacto_mensal', parseFloat(e.target.value) || 0)} placeholder="0,00" />
              </div>
            </>
          )}

          {modal?.type === 'novo' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Tipo</label>
                  <select className={SELECT_CLS} value={form.tipo || 'novo_gasto'} onChange={e => set('tipo', e.target.value)}>
                    <option value="novo_gasto">Novo gasto</option>
                    <option value="investimento">Investimento</option>
                    <option value="comissao">Comissão</option>
                    <option value="ajuste">Ajuste</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Valor (R$)</label>
                  <input className={INPUT_CLS} type="number" step="0.01" value={form.valor || ''} onChange={e => set('valor', parseFloat(e.target.value) || 0)} placeholder="0,00" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Prioridade</label>
                <select className={SELECT_CLS} value={form.prioridade || 'media'} onChange={e => set('prioridade', e.target.value)}>
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Observação</label>
            <input className={INPUT_CLS} value={form.observacao || ''} onChange={e => set('observacao', e.target.value)} placeholder="Observação opcional" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setModal(null)}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={saveModal}>
              {modal?.index !== null ? 'Atualizar' : 'Adicionar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Adicionar / Editar Cliente ────────────────── */}
      <Modal open={!!cliModal} onClose={() => setCliModal(null)}
             title={cliModal?.mode === 'new' ? 'Adicionar Cliente' : 'Editar Cliente'}>
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nome do cliente</label>
            <input className={INPUT_CLS} value={cliForm.nome || ''} autoFocus
                   onChange={e => setCliForm(f => ({ ...f, nome: e.target.value }))}
                   placeholder="Nome do cliente" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Valor (R$)</label>
              <input className={INPUT_CLS} type="number" step="0.01"
                     value={cliForm.valor || ''}
                     onChange={e => setCliForm(f => ({ ...f, valor: e.target.value }))}
                     placeholder="0,00" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
              <select className={SELECT_CLS} value={cliForm.status_pagamento || 'pendente'}
                      onChange={e => setCliForm(f => ({ ...f, status_pagamento: e.target.value }))}>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
                <option value="vencido">Atrasado</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Dia de vencimento</label>
              <input className={INPUT_CLS} value={cliForm.dia_pagamento || ''}
                     onChange={e => setCliForm(f => ({ ...f, dia_pagamento: e.target.value }))}
                     placeholder="Ex: 25" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Origem</label>
              <select className={SELECT_CLS} value={cliForm.origem || 'atual'}
                      onChange={e => setCliForm(f => ({ ...f, origem: e.target.value }))}>
                <option value="atual">Mês atual</option>
                <option value="atraso">Atrasado (mês anterior)</option>
                <option value="recorrente">Recorrente</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Status de cobrança</label>
              <select className={SELECT_CLS} value={cliForm.cobranca_status || 'sem_cobrar'}
                      onChange={e => setCliForm(f => ({ ...f, cobranca_status: e.target.value }))}>
                <option value="sem_cobrar">Não cobrado</option>
                <option value="cobrado">Cobrado</option>
                <option value="prometeu_pagar">Prometeu pagar</option>
                <option value="negociar">Negociar</option>
              </select>
            </div>
            {cliForm.status_pagamento === 'pago' && (
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Data do pagamento</label>
                <input className={INPUT_CLS} type="date" value={cliForm.data_pagamento || ''}
                       onChange={e => setCliForm(f => ({ ...f, data_pagamento: e.target.value }))} />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Observação</label>
            <input className={INPUT_CLS} value={cliForm.observacao_pagamento || ''}
                   onChange={e => setCliForm(f => ({ ...f, observacao_pagamento: e.target.value }))}
                   placeholder="Observação opcional" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setCliModal(null)}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={saveCliModal}>
              {cliModal?.mode === 'new' ? 'Adicionar' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal: Hub (Despesas Fixas / Comissões CRUD) ─────── */}
      <Modal open={!!hubModal} onClose={() => setHubModal(null)}
             title={!hubModal ? '' : `${hubModal.mode === 'new' ? 'Nova' : 'Editar'} ${hubModal.type === 'desplocal' ? 'Despesa Fixa' : 'Comissão'}`}
             maxWidth="max-w-md">
        <div className="space-y-4 mt-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nome</label>
            <input className={INPUT_CLS} value={hubForm.nome || ''} autoFocus
                   onChange={e => setHubForm(f => ({ ...f, nome: e.target.value }))}
                   placeholder="Nome" />
          </div>
          {hubModal?.type === 'desplocal' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Categoria</label>
                  <select className={SELECT_CLS} value={hubForm.categoria || ''}
                          onChange={e => setHubForm(f => ({ ...f, categoria: e.target.value }))}>
                    {['Salários e Benefícios','Licenças / Ferramentas','Marketing / Publicidade','Custos Fixos','Materiais / Estrutura','Administrativo','Outro'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Valor (R$)</label>
                  <input className={INPUT_CLS} type="number" step="0.01" value={hubForm.valor ?? ''}
                         onChange={e => setHubForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Competência</label>
                  <input className={INPUT_CLS} value={hubForm.competencia || ''} placeholder="2026-04"
                         onChange={e => setHubForm(f => ({ ...f, competencia: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                  <select className={SELECT_CLS} value={hubForm.status || 'pendente'}
                          onChange={e => setHubForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="pendente">Pendente</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
              </div>
            </>
          )}
          {hubModal?.type === 'comissao' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Responsável</label>
                  <input className={INPUT_CLS} value={hubForm.responsavel || ''}
                         onChange={e => setHubForm(f => ({ ...f, responsavel: e.target.value }))} placeholder="Nome do responsável" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Valor (R$)</label>
                  <input className={INPUT_CLS} type="number" step="0.01" value={hubForm.valor ?? ''}
                         onChange={e => setHubForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Regra / Descrição</label>
                  <input className={INPUT_CLS} value={hubForm.regra || ''}
                         onChange={e => setHubForm(f => ({ ...f, regra: e.target.value }))} placeholder="Ex: 5% sobre vendas" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Status</label>
                  <select className={SELECT_CLS} value={hubForm.status || 'pendente'}
                          onChange={e => setHubForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="pendente">Pendente</option>
                    <option value="aprovado">Aprovado</option>
                    <option value="pago">Pago</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1">Competência</label>
                <input className={INPUT_CLS} value={hubForm.competencia || ''} placeholder="2026-04"
                       onChange={e => setHubForm(f => ({ ...f, competencia: e.target.value }))} />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Observações</label>
            <input className={INPUT_CLS} value={hubForm.observacoes || ''}
                   onChange={e => setHubForm(f => ({ ...f, observacoes: e.target.value }))} placeholder="Observação opcional" />
          </div>
          {hubFormErr && <p className="text-xs text-red-400">{hubFormErr}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setHubModal(null)}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={saveHubModal} disabled={hubSaving}>
              {hubSaving ? 'Salvando…' : hubModal?.mode === 'new' ? 'Adicionar' : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
