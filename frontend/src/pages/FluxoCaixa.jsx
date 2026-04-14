import { useState, useMemo, useCallback } from 'react'
import {
  RefreshCw, TrendingUp, TrendingDown, DollarSign, CheckCircle,
  AlertCircle, Clock, Filter, X, ChevronDown, Users,
  ArrowUpCircle, ArrowDownCircle, Banknote, Search, Edit2, Save,
  Plus, Trash2,
} from 'lucide-react'
import {
  useFluxoCaixa,
  useConciliacao,
  useRecebimentosClientes,
  useClientes,
} from '../hooks/useFinanceiro'
import { financeiroAPI, clientesAPI } from '../services/api'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import { formatCurrency, formatCompact } from '../utils/formatters'
import {
  statusPagamentoBadge,
  statusConciliacaoBadge,
  origemLabel,
  tipoLabel,
  mesAtualNum,
  anoAtual,
  filtrarPorPeriodo,
  periodoToRange,
  pct,
  STATUS_CONCILIACAO,
  STATUS_PAGAMENTO,
} from '../utils/financeiroUtils'

// â”€â”€ helpers visuais â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const COR_TIPO = { entrada: '#12F0C6', saida: '#EF4444' }

function SummaryCard({ icon: Icon, label, value, color, sub, loading }) {
  return (
    <div className="rounded-xl border p-4 flex flex-col gap-1"
         style={{ background: '#1A1E21', borderColor: 'rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color }} />
        <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      </div>
      {loading
        ? <div className="h-6 w-24 rounded bg-white/5 animate-pulse mt-1" />
        : <p className="text-lg font-bold" style={{ color }}>{value}</p>
      }
      {sub && <p className="text-[10px] text-gray-600">{sub}</p>}
    </div>
  )
}

function StatusBadge({ status }) {
  const s = statusPagamentoBadge(status)
  return <Badge variant={s.badgeVariant} dot>{s.label}</Badge>
}

function ConcBadge({ status }) {
  const s = statusConciliacaoBadge(status)
  return <Badge variant={s.badgeVariant} dot>{s.label}</Badge>
}

const TAB_CLS = (active) =>
  `px-4 py-2 text-sm font-medium rounded-lg transition-all ${
    active
      ? 'text-black font-semibold'
      : 'text-gray-400 hover:text-white hover:bg-white/5'
  }`

const INPUT_CLS =
  'px-3 py-2 rounded-lg text-xs text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50 placeholder:text-gray-600'

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Tab 1 â€” Fluxo de Caixa
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const ORIGENS_OPCOES = [
  { v: 'cliente_mensal',    l: 'Cliente Mensal' },
  { v: 'projeto_adicional', l: 'Proj. Adicional' },
  { v: 'comissao',          l: 'Comissão' },
  { v: 'despesa_fixa',      l: 'Despesa Fixa' },
  { v: 'despesa_variavel',  l: 'Despesa Variável' },
  { v: 'ajuste_manual',     l: 'Ajuste Manual' },
  { v: 'boleto',            l: 'Boleto' },
  { v: 'cartao',            l: 'Cartão' },
  { v: 'transferencia',     l: 'Transferência' },
]

const STATUS_OPCOES = [
  { v: 'previsto',     l: 'Previsto' },
  { v: 'recebido',     l: 'Recebido' },
  { v: 'pago',         l: 'Pago' },
  { v: 'pendente',     l: 'Pendente' },
  { v: 'vencido',      l: 'Vencido' },
  { v: 'inadimplente', l: 'Inadimplente' },
  { v: 'cancelado',    l: 'Cancelado' },
]

const CELL_INPUT =
  'w-full px-1.5 py-1 rounded text-xs text-white bg-black/60 border border-[#12F0C6]/30 focus:outline-none focus:border-[#12F0C6]/70'
const CELL_SELECT =
  'w-full px-1 py-1 rounded text-xs text-white bg-[#1A1E21] border border-[#12F0C6]/30 focus:outline-none focus:border-[#12F0C6]/70'

function TabFluxo() {
  const mesDefault = mesAtualNum()
  const anoDefault = anoAtual()

  const [periodo, setPeriodo]       = useState('mes')
  const [mesNum, setMesNum]         = useState(mesDefault)
  const [ano, setAno]               = useState(anoDefault)
  const [tipo, setTipo]             = useState('')
  const [statusFiltro, setStatus]   = useState('')
  const [clienteFiltro, setCliente] = useState('')
  const [categoriaFiltro, setCategoria] = useState('')
  const [origemFiltro, setOrigem]   = useState('')
  const [busca, setBusca]           = useState('')
  const [atualizando, setAtualizando] = useState(null)

  // Inline editing state
  const [editingId, setEditingId]   = useState(null)
  const [editRow, setEditRow]       = useState({})
  const [saving, setSaving]         = useState(false)

  // Create new lancamento
  const FORM_EMPTY = {
    data_competencia: new Date().toISOString().slice(0, 10),
    descricao: '', cliente: '', categoria: 'Ajuste Manual',
    tipo: 'entrada', valor_previsto: '', valor_realizado: '0',
    status: 'previsto', origem: 'ajuste_manual', observacao: '',
  }
  const [createOpen, setCreateOpen]     = useState(false)
  const [createForm, setCreateForm]     = useState(FORM_EMPTY)
  const [createSaving, setCreateSaving] = useState(false)
  const [createErr, setCreateErr]       = useState('')

  // Delete manual
  const [confirmDel, setConfirmDel] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // Monta params para o backend
  const params = useMemo(() => {
    const p = {}
    if (periodo !== 'todo') {
      p.mes = mesNum
      p.ano = ano
    }
    if (tipo)         p.tipo    = tipo
    if (statusFiltro) p.status  = statusFiltro
    if (clienteFiltro) p.cliente = clienteFiltro
    return p
  }, [periodo, mesNum, ano, tipo, statusFiltro, clienteFiltro])

  const { data, loading, error, refetch } = useFluxoCaixa(params)
  const { data: clientesData } = useClientes()

  const lancamentos = data?.lancamentos ?? []
  const clientesNomes = useMemo(
    () => (clientesData?.clientes ?? []).map(c => c.nome).filter(Boolean).sort(),
    [clientesData]
  )

  // Categorias e origens únicas para os selects
  const categorias = useMemo(
    () => [...new Set(lancamentos.map(l => l.categoria).filter(Boolean))].sort(),
    [lancamentos]
  )
  const origens = useMemo(
    () => [...new Set(lancamentos.map(l => l.origem).filter(Boolean))].sort(),
    [lancamentos]
  )

  // Filtro local por texto, categoria e origem
  const filtrados = useMemo(() => {
    let result = lancamentos
    if (busca.trim()) {
      const q = busca.toLowerCase()
      result = result.filter(l =>
        l.descricao?.toLowerCase().includes(q) ||
        l.cliente?.toLowerCase().includes(q) ||
        l.categoria?.toLowerCase().includes(q)
      )
    }
    if (categoriaFiltro) result = result.filter(l => l.categoria === categoriaFiltro)
    if (origemFiltro)    result = result.filter(l => l.origem === origemFiltro)
    return result
  }, [lancamentos, busca, categoriaFiltro, origemFiltro])

  // â”€â”€ Edição inline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const startEdit = useCallback((l) => {
    setEditingId(l.id)
    setEditRow({
      data_competencia: l.data_competencia ?? '',
      descricao:        l.descricao ?? '',
      cliente:          l.cliente ?? '',
      categoria:        l.categoria ?? '',
      tipo:             l.tipo ?? 'entrada',
      valor_previsto:   l.valor_previsto ?? 0,
      valor_realizado:  l.valor_realizado ?? 0,
      status:           l.status ?? 'previsto',
      origem:           l.origem ?? 'cliente_mensal',
    })
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setEditRow({})
  }, [])

  const handleEditChange = useCallback((field, value) => {
    setEditRow(prev => {
      const next = { ...prev, [field]: value }
      // Regra de consistência: realizado > 0 â†’ status não pode ser previsto
      if (field === 'valor_realizado') {
        const v = parseFloat(value) || 0
        if (v > 0 && next.status === 'previsto') {
          next.status = next.tipo === 'entrada' ? 'recebido' : 'pago'
        } else if (v === 0 && (next.status === 'recebido' || next.status === 'pago')) {
          next.status = 'previsto'
        }
      }
      // Regra: ao mudar status manualmente, refletir realizado
      if (field === 'status') {
        if ((value === 'recebido' || value === 'pago') && (parseFloat(next.valor_realizado) || 0) === 0) {
          next.valor_realizado = parseFloat(next.valor_previsto) || 0
        }
        if (value === 'previsto') {
          next.valor_realizado = 0
        }
      }
      return next
    })
  }, [])

  const saveEdit = async () => {
    setSaving(true)
    try {
      await financeiroAPI.updateLancamento(editingId, {
        data_competencia: editRow.data_competencia || undefined,
        descricao:        editRow.descricao        || undefined,
        cliente:          editRow.cliente          || undefined,
        categoria:        editRow.categoria        || undefined,
        tipo:             editRow.tipo             || undefined,
        valor_previsto:   parseFloat(editRow.valor_previsto)  || undefined,
        valor_realizado:  parseFloat(editRow.valor_realizado),
        status:           editRow.status           || undefined,
        origem:           editRow.origem           || undefined,
      })
      setEditingId(null)
      setEditRow({})
      refetch()
    } catch (e) {
      alert('Erro ao salvar: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setSaving(false)
    }
  }

  // â”€â”€ Troca de status rápida (botões de ação) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleStatusChange = async (lancamento, novoStatus) => {
    setAtualizando(lancamento.id)
    try {
      const valorRealizado =
        novoStatus === 'recebido' || novoStatus === 'pago'
          ? lancamento.valor_previsto
          : 0
      await financeiroAPI.updateLancamentoStatus({
        lancamento_id:   lancamento.id,
        status:          novoStatus,
        valor_realizado: valorRealizado,
      })
      refetch()
    } catch (e) {
      alert('Erro ao atualizar: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setAtualizando(null)
    }
  }

  // â”€â”€ Toggle conciliação â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const handleToggleConciliacao = async (lancamento) => {
    const novoStatus = lancamento.status_conciliacao === 'conciliado' ? 'pendente' : 'conciliado'
    setAtualizando(lancamento.id + '_conc')
    try {
      await financeiroAPI.marcarConciliacao({ lancamento_id: lancamento.id, status_conciliacao: novoStatus })
      refetch()
    } catch (e) {
      alert('Erro: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setAtualizando(null)
    }
  }

  // ── Criar lançamento manual ──────────────────────────────────────────
  const handleCreate = async () => {
    if (!createForm.descricao.trim()) { setCreateErr('Descrição é obrigatória.'); return }
    if (!createForm.valor_previsto)   { setCreateErr('Valor é obrigatório.'); return }
    setCreateSaving(true); setCreateErr('')
    try {
      await financeiroAPI.createLancamento({
        ...createForm,
        valor_previsto:  parseFloat(createForm.valor_previsto)  || 0,
        valor_realizado: parseFloat(createForm.valor_realizado) || 0,
      })
      setCreateOpen(false)
      setCreateForm(FORM_EMPTY)
      refetch()
    } catch (e) {
      setCreateErr(e?.response?.data?.detail || 'Erro ao criar lançamento.')
    } finally { setCreateSaving(false) }
  }

  // ── Deletar lançamento manual ────────────────────────────────────────
  const handleDeleteManual = async (id) => {
    setDeletingId(id)
    try {
      await financeiroAPI.deleteLancamento(id)
      setConfirmDel(null)
      refetch()
    } catch (e) {
      alert('Erro ao excluir: ' + (e?.response?.data?.detail || e.message))
    } finally { setDeletingId(null) }
  }

  const meses = [
    { v: 1, l: 'Janeiro' }, { v: 2, l: 'Fevereiro' }, { v: 3, l: 'Março' },
    { v: 4, l: 'Abril' },   { v: 5, l: 'Maio' },      { v: 6, l: 'Junho' },
    { v: 7, l: 'Julho' },   { v: 8, l: 'Agosto' },    { v: 9, l: 'Setembro' },
    { v: 10, l: 'Outubro' },{ v: 11, l: 'Novembro' },{ v: 12, l: 'Dezembro' },
  ]

  const cards = [
    { icon: DollarSign,   label: 'Saldo Inicial',       value: formatCompact(data?.saldo_inicial ?? 0),            color: '#818CF8', sub: 'caixa atual' },
    { icon: ArrowUpCircle,label: 'Entradas Previstas',   value: formatCompact(data?.total_entradas_previsto ?? 0),  color: '#12F0C6', sub: 'no período' },
    { icon: ArrowUpCircle,label: 'Entradas Realizadas',  value: formatCompact(data?.total_entradas_realizado ?? 0), color: '#10B981', sub: 'recebido' },
    { icon: ArrowDownCircle,label:'Saídas Previstas',    value: formatCompact(data?.total_saidas_previsto ?? 0),    color: '#F59E0B', sub: 'no período' },
    { icon: ArrowDownCircle,label:'Saídas Realizadas',   value: formatCompact(data?.total_saidas_realizado ?? 0),   color: '#EF4444', sub: 'pago' },
    { icon: Banknote,     label: 'Saldo Final Previsto', value: formatCompact(data?.saldo_final_previsto ?? 0),     color: '#818CF8', sub: 'projetado' },
    { icon: Banknote,     label: 'Saldo Realizado',      value: formatCompact(data?.saldo_final_realizado ?? 0),    color: '#12F0C6', sub: 'efetivo' },
  ]

  const divergencia = data?.divergencia ?? 0

  return (
    <div className="space-y-5">

      {/* â”€â”€ Cards superiores â”€â”€ */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {cards.map(c => (
          <SummaryCard key={c.label} {...c} loading={loading} />
        ))}
      </div>

      {/* Divergência destaque */}
      {!loading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
             style={{
               background: divergencia < 0 ? 'rgba(239,68,68,0.08)' : 'rgba(18,240,198,0.06)',
               borderColor: divergencia < 0 ? 'rgba(239,68,68,0.2)' : 'rgba(18,240,198,0.15)',
             }}>
          <AlertCircle size={15} style={{ color: divergencia < 0 ? '#EF4444' : '#12F0C6', flexShrink: 0 }} />
          <span className="text-xs text-gray-300">
            Divergência previsto Á— realizado:&nbsp;
            <strong style={{ color: divergencia < 0 ? '#EF4444' : '#12F0C6' }}>
              {divergencia >= 0 ? '+' : ''}{formatCurrency(divergencia)}
            </strong>
            &nbsp;·&nbsp;{data?.total_conciliados ?? 0} conciliados, {data?.total_pendentes_conciliacao ?? 0} pendentes
          </span>
        </div>
      )}

      {/* â”€â”€ Filtros â”€â”€ */}
      <Card title="Filtros">
        <div className="flex flex-wrap gap-3 items-end">

          {/* Período rápido */}
          <div className="flex gap-1.5">
            {[
              { k: 'hoje',  l: 'Hoje' },
              { k: 'semana',l: 'Semana' },
              { k: 'mes',   l: 'Mês' },
              { k: 'todo',  l: 'Tudo' },
            ].map(({ k, l }) => (
              <button key={k} onClick={() => setPeriodo(k)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={periodo === k
                  ? { background: '#12F0C6', color: '#000' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }}>
                {l}
              </button>
            ))}
          </div>

          {/* Mês + Ano */}
          {periodo === 'mes' && (
            <div className="flex gap-2">
              <select value={mesNum} onChange={e => setMesNum(Number(e.target.value))}
                className={INPUT_CLS}>
                {meses.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
              <input type="number" value={ano} onChange={e => setAno(Number(e.target.value))}
                className={INPUT_CLS + ' w-24'} />
            </div>
          )}

          {/* Tipo */}
          <select value={tipo} onChange={e => setTipo(e.target.value)} className={INPUT_CLS}>
            <option value="">Entradas + Saídas</option>
            <option value="entrada">Entradas</option>
            <option value="saida">Saídas</option>
          </select>

          {/* Status */}
          <select value={statusFiltro} onChange={e => setStatus(e.target.value)} className={INPUT_CLS}>
            <option value="">Todos os status</option>
            <option value="previsto">Previsto</option>
            <option value="recebido">Recebido</option>
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="vencido">Vencido</option>
          </select>

          {/* Categoria */}
          {categorias.length > 0 && (
            <select value={categoriaFiltro} onChange={e => setCategoria(e.target.value)} className={INPUT_CLS}>
              <option value="">Todas as categorias</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}

          {/* Origem */}
          {origens.length > 0 && (
            <select value={origemFiltro} onChange={e => setOrigem(e.target.value)} className={INPUT_CLS}>
              <option value="">Todas as origens</option>
              {origens.map(o => <option key={o} value={o}>{origemLabel(o)}</option>)}
            </select>
          )}

          {/* Busca livre */}
          <div className="relative flex-1 min-w-48">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className={INPUT_CLS + ' w-full pl-8'}
              placeholder="Buscar descrição, cliente, categoria..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>

          <Button variant="ghost" size="sm" onClick={refetch}><RefreshCw size={13} /></Button>
        </div>
      </Card>

      {/* ── Tabela principal ── */}
      <Card
        title="Lançamentos"
        subtitle={`${filtrados.length} lançamentos · ✎ editar inline · 🗑 excluir manuais`}
        action={
          <button
            onClick={() => { setCreateForm(FORM_EMPTY); setCreateErr(""); setCreateOpen(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-black"
            style={{ background: "#12F0C6" }}>
            <Plus size={12} /> Novo Lançamento
          </button>
        }
      >
        {loading ? <LoadingSpinner label="Carregando fluxo..." /> :
         error   ? <p className="text-red-400 text-sm">{error}</p> :
         filtrados.length === 0 ? <EmptyState title="Nenhum lançamento encontrado" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {['Data','Descrição','Cliente','Categoria','Tipo','Previsto','Realizado','Status','Origem','Conc.','Ações'].map(h => (
                    <th key={h} className="text-left py-2 px-2 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtrados.map(l => {
                  const isEditing = editingId === l.id
                  const isBusy    = atualizando === l.id
                  const rowBg     = isEditing ? 'rgba(18,240,198,0.04)' : undefined
                  const isCli     = l.id?.startsWith('cli_')

                  return (
                    <tr key={l.id}
                        className="border-b transition-colors"
                        style={{
                          borderColor: 'rgba(255,255,255,0.04)',
                          background: rowBg,
                        }}>

                      {/* DATA */}
                      <td className="py-1.5 px-2 whitespace-nowrap" style={{ minWidth: 110 }}>
                        {isEditing
                          ? <input type="date" className={CELL_INPUT} style={{ minWidth: 110 }}
                              value={editRow.data_competencia}
                              onChange={e => handleEditChange('data_competencia', e.target.value)} />
                          : <span className="text-gray-400">{l.data_competencia ?? 'â€”'}</span>
                        }
                      </td>

                      {/* DESCRIÇÁƒO */}
                      <td className="py-1.5 px-2" style={{ minWidth: 130, maxWidth: 170 }}>
                        {isEditing
                          ? <input type="text" className={CELL_INPUT}
                              value={editRow.descricao}
                              onChange={e => handleEditChange('descricao', e.target.value)} />
                          : <span className="text-white truncate block max-w-[160px]">{l.descricao || 'â€”'}</span>
                        }
                      </td>

                      {/* CLIENTE */}
                      <td className="py-1.5 px-2" style={{ minWidth: 110, maxWidth: 140 }}>
                        {isEditing
                          ? <select className={CELL_SELECT}
                              value={editRow.cliente}
                              onChange={e => handleEditChange('cliente', e.target.value)}>
                              <option value="">â€” Nenhum â€”</option>
                              {clientesNomes.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                          : <span className="text-gray-300 truncate block max-w-[130px]">{l.cliente || 'â€”'}</span>
                        }
                      </td>

                      {/* CATEGORIA */}
                      <td className="py-1.5 px-2" style={{ minWidth: 100 }}>
                        {isEditing
                          ? <input type="text" className={CELL_INPUT}
                              value={editRow.categoria}
                              onChange={e => handleEditChange('categoria', e.target.value)} />
                          : <span className="text-gray-400 truncate block max-w-[110px]">{l.categoria || 'â€”'}</span>
                        }
                      </td>

                      {/* TIPO */}
                      <td className="py-1.5 px-2 whitespace-nowrap" style={{ minWidth: 80 }}>
                        {isEditing
                          ? <select className={CELL_SELECT}
                              value={editRow.tipo}
                              onChange={e => handleEditChange('tipo', e.target.value)}>
                              <option value="entrada">Entrada</option>
                              <option value="saida">Saída</option>
                            </select>
                          : <span className="font-semibold" style={{ color: COR_TIPO[l.tipo] ?? '#9CA3AF' }}>
                              {tipoLabel(l.tipo)}
                            </span>
                        }
                      </td>

                      {/* PREVISTO */}
                      <td className="py-1.5 px-2 text-right whitespace-nowrap" style={{ minWidth: 85 }}>
                        {isEditing
                          ? <input type="number" step="0.01" className={CELL_INPUT + ' text-right'}
                              value={editRow.valor_previsto}
                              onChange={e => handleEditChange('valor_previsto', e.target.value)} />
                          : <span className="text-gray-300">{formatCurrency(l.valor_previsto)}</span>
                        }
                      </td>

                      {/* REALIZADO */}
                      <td className="py-1.5 px-2 text-right whitespace-nowrap" style={{ minWidth: 85 }}>
                        {isEditing
                          ? <input type="number" step="0.01" className={CELL_INPUT + ' text-right'}
                              value={editRow.valor_realizado}
                              onChange={e => handleEditChange('valor_realizado', e.target.value)} />
                          : <span className="font-semibold"
                              style={{ color: l.valor_realizado > 0 ? COR_TIPO[l.tipo] : '#6B7280' }}>
                              {formatCurrency(l.valor_realizado)}
                            </span>
                        }
                      </td>

                      {/* STATUS */}
                      <td className="py-1.5 px-2 whitespace-nowrap" style={{ minWidth: 105 }}>
                        {isEditing
                          ? <select className={CELL_SELECT}
                              value={editRow.status}
                              onChange={e => handleEditChange('status', e.target.value)}>
                              {STATUS_OPCOES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          : <StatusBadge status={l.status} />
                        }
                      </td>

                      {/* ORIGEM */}
                      <td className="py-1.5 px-2 whitespace-nowrap" style={{ minWidth: 115 }}>
                        {isEditing
                          ? <select className={CELL_SELECT}
                              value={editRow.origem}
                              onChange={e => handleEditChange('origem', e.target.value)}>
                              {ORIGENS_OPCOES.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                            </select>
                          : <span className="text-gray-500">{origemLabel(l.origem)}</span>
                        }
                      </td>

                      {/* CONCILIADO â€” toggle sempre visível */}
                      <td className="py-1.5 px-2 whitespace-nowrap" style={{ minWidth: 80 }}>
                        <button
                          disabled={atualizando === l.id + '_conc'}
                          onClick={() => handleToggleConciliacao(l)}
                          title={l.status_conciliacao === 'conciliado' ? 'Marcar como pendente' : 'Marcar como conciliado'}
                          className="px-2 py-1 rounded text-[10px] font-medium transition-colors disabled:opacity-40"
                          style={
                            l.status_conciliacao === 'conciliado'
                              ? { background: 'rgba(18,240,198,0.15)', color: '#12F0C6' }
                              : { background: 'rgba(245,158,11,0.10)', color: '#F59E0B' }
                          }>
                          {l.status_conciliacao === 'conciliado' ? 'âœ“ Conc.' : '~ Pend.'}
                        </button>
                      </td>

                      {/* AÇÁ•ES */}
                      <td className="py-1.5 px-2 whitespace-nowrap" style={{ minWidth: 110 }}>
                        {isEditing ? (
                          <div className="flex gap-1">
                            <button
                              disabled={saving}
                              onClick={saveEdit}
                              className="px-2 py-1 rounded text-[10px] font-semibold transition-opacity disabled:opacity-40 flex items-center gap-1"
                              style={{ background: 'rgba(18,240,198,0.18)', color: '#12F0C6' }}>
                              <Save size={10} /> Salvar
                            </button>
                            <button
                              disabled={saving}
                              onClick={cancelEdit}
                              className="px-2 py-1 rounded text-[10px] font-medium transition-opacity disabled:opacity-40"
                              style={{ background: 'rgba(255,255,255,0.06)', color: '#9CA3AF' }}>
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <button
                              onClick={() => startEdit(l)}
                              className="px-2 py-1 rounded text-[10px] font-medium transition-colors"
                              style={{ background: 'rgba(129,140,248,0.10)', color: '#818CF8' }}
                              title="Editar lançamento">
                              <Edit2 size={10} />
                            </button>
                            {l.tipo === 'entrada' && l.status !== 'recebido' && (
                              <button
                                disabled={isBusy}
                                onClick={() => handleStatusChange(l, 'recebido')}
                                className="px-2 py-1 rounded text-[10px] font-medium transition-opacity disabled:opacity-40"
                                style={{ background: 'rgba(18,240,198,0.12)', color: '#12F0C6' }}
                                title="Marcar como Recebido">
                                âœ“ Rec.
                              </button>
                            )}
                            {l.tipo === 'saida' && l.status !== 'pago' && (
                              <button
                                disabled={isBusy}
                                onClick={() => handleStatusChange(l, 'pago')}
                                className="px-2 py-1 rounded text-[10px] font-medium transition-opacity disabled:opacity-40"
                                style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}
                                title="Marcar como Pago">
                                âœ“ Pago
                              </button>
                            )}
                            {(l.status === 'recebido' || l.status === 'pago') && (
                              <button
                                disabled={isBusy}
                                onClick={() => handleStatusChange(l, 'previsto')}
                                className="px-2 py-1 rounded text-[10px] font-medium transition-opacity disabled:opacity-40"
                                style={{ background: 'rgba(255,255,255,0.06)', color: '#9CA3AF' }}
                                title="Reverter para Previsto">
                                â†º
                              </button>
                            )}
                            {l.fonte === "manual" && (
                              <button
                                disabled={deletingId === l.id}
                                onClick={() => setConfirmDel(l)}
                                className="px-2 py-1 rounded text-[10px] font-medium transition-opacity disabled:opacity-40"
                                style={{ background: "rgba(239,68,68,0.12)", color: "#EF4444" }}
                                title="Excluir lançamento manual">
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* â”€â”€ Resumo lateral â”€â”€ */}
      {!loading && data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Resumo label="A Receber no Período" value={data.total_entradas_previsto - data.total_entradas_realizado} color="#F59E0B" />
          <Resumo label="Total Recebido"        value={data.total_entradas_realizado} color="#12F0C6" />
          <Resumo label="A Pagar no Período"    value={data.total_saidas_previsto - data.total_saidas_realizado}    color="#F59E0B" />
          <Resumo label="Total Pago"            value={data.total_saidas_realizado}    color="#EF4444" />
        </div>
      )}

    {/* ── Modal: Novo Lançamento ───────────────────────────────── */}
    {createOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-[#1A1E21] border border-[#2A2E31] rounded-xl p-6 w-full max-w-lg space-y-4">
          <h2 className="text-white font-semibold text-lg">Novo Lançamento Manual</h2>
          {createErr && <p className="text-red-400 text-sm">{createErr}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Descrição *</label>
              <input className="w-full bg-[#0D1012] border border-[#2A2E31] rounded px-3 py-2 text-white text-sm" value={createForm.descricao} onChange={e => setCreateForm(f => ({...f, descricao: e.target.value}))} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tipo *</label>
              <select className="w-full bg-[#0D1012] border border-[#2A2E31] rounded px-3 py-2 text-white text-sm" value={createForm.tipo} onChange={e => setCreateForm(f => ({...f, tipo: e.target.value}))}>
                <option value="entrada">Entrada</option>
                <option value="saida">Saída</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Data</label>
              <input type="date" className="w-full bg-[#0D1012] border border-[#2A2E31] rounded px-3 py-2 text-white text-sm" value={createForm.data_competencia} onChange={e => setCreateForm(f => ({...f, data_competencia: e.target.value}))} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Valor Previsto *</label>
              <input type="number" step="0.01" className="w-full bg-[#0D1012] border border-[#2A2E31] rounded px-3 py-2 text-white text-sm" value={createForm.valor_previsto} onChange={e => setCreateForm(f => ({...f, valor_previsto: e.target.value}))} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Valor Realizado</label>
              <input type="number" step="0.01" className="w-full bg-[#0D1012] border border-[#2A2E31] rounded px-3 py-2 text-white text-sm" value={createForm.valor_realizado} onChange={e => setCreateForm(f => ({...f, valor_realizado: e.target.value}))} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Categoria</label>
              <input className="w-full bg-[#0D1012] border border-[#2A2E31] rounded px-3 py-2 text-white text-sm" value={createForm.categoria} onChange={e => setCreateForm(f => ({...f, categoria: e.target.value}))} />
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Status</label>
              <select className="w-full bg-[#0D1012] border border-[#2A2E31] rounded px-3 py-2 text-white text-sm" value={createForm.status} onChange={e => setCreateForm(f => ({...f, status: e.target.value}))}>
                <option value="previsto">Previsto</option>
                <option value="realizado">Realizado</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Cliente</label>
              <select className="w-full bg-[#0D1012] border border-[#2A2E31] rounded px-3 py-2 text-white text-sm" value={createForm.cliente} onChange={e => setCreateForm(f => ({...f, cliente: e.target.value}))}>
                <option value="">— nenhum —</option>
                {clientesNomes.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Origem</label>
              <select className="w-full bg-[#0D1012] border border-[#2A2E31] rounded px-3 py-2 text-white text-sm" value={createForm.origem} onChange={e => setCreateForm(f => ({...f, origem: e.target.value}))}>
                <option value="manual">Manual</option>
                <option value="recorrente">Recorrente</option>
                <option value="eventual">Eventual</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">Observação</label>
              <input className="w-full bg-[#0D1012] border border-[#2A2E31] rounded px-3 py-2 text-white text-sm" value={createForm.observacao} onChange={e => setCreateForm(f => ({...f, observacao: e.target.value}))} />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => { setCreateOpen(false); setCreateErr(''); }} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
            <button onClick={handleCreate} disabled={createSaving} className="px-4 py-2 text-sm bg-[#12F0C6] text-black rounded font-semibold hover:opacity-90 disabled:opacity-50">{createSaving ? 'Salvando…' : 'Salvar Lançamento'}</button>
          </div>
        </div>
      </div>
    )}

    {/* ── Confirm: Excluir Lançamento ──────────────────────────── */}
    {confirmDel && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
        <div className="bg-[#1A1E21] border border-[#2A2E31] rounded-xl p-6 w-full max-w-sm space-y-4">
          <h2 className="text-white font-semibold text-lg">Excluir lançamento?</h2>
          <p className="text-gray-400 text-sm">Esta ação não pode ser desfeita. O lançamento <span className="text-white font-medium">{confirmDel.descricao}</span> será removido permanentemente.</p>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setConfirmDel(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
            <button onClick={() => handleDeleteManual(confirmDel.id)} disabled={!!deletingId} className="px-4 py-2 text-sm bg-red-500 text-white rounded font-semibold hover:opacity-90 disabled:opacity-50">{deletingId ? 'Excluindo…' : 'Excluir'}</button>
          </div>
        </div>
      </div>
    )}
    </div>
  )
}

function Resumo({ label, value, color }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: '#1A1E21', borderColor: 'rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-base font-bold" style={{ color }}>{formatCompact(Math.max(value, 0))}</p>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Tab 2 â€” Conciliação
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function TabConciliacao() {
  const mesDefault = mesAtualNum()
  const anoDefault = anoAtual()
  const [mes, setMes] = useState(mesDefault)
  const [ano, setAno] = useState(anoDefault)
  const [filtroConc, setFiltroConc] = useState('pendente')
  const [busca, setBusca] = useState('')
  const [marcando, setMarcando] = useState(null)

  const { data, loading, error, refetch } = useConciliacao({ mes, ano })

  const lancamentos = useMemo(() => {
    let list = data?.lancamentos ?? []
    if (filtroConc !== 'todos') {
      list = list.filter(l => l.status_conciliacao === filtroConc)
    }
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(l =>
        l.descricao?.toLowerCase().includes(q) ||
        l.cliente?.toLowerCase().includes(q)
      )
    }
    return list
  }, [data, filtroConc, busca])

  const handleMarcar = async (lancamento_id, status_conciliacao) => {
    setMarcando(lancamento_id)
    try {
      await financeiroAPI.marcarConciliacao({ lancamento_id, status_conciliacao })
      refetch()
    } catch (e) {
      alert('Erro ao registrar: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setMarcando(null)
    }
  }

  const meses = [
    [1,'Jan'],[2,'Fev'],[3,'Mar'],[4,'Abr'],[5,'Mai'],[6,'Jun'],
    [7,'Jul'],[8,'Ago'],[9,'Set'],[10,'Out'],[11,'Nov'],[12,'Dez'],
  ]

  return (
    <div className="space-y-5">

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard icon={CheckCircle} label="Conciliados"  loading={loading}
          value={`${data?.total_conciliado ?? 0} lançamentos`}
          color="#12F0C6" sub={`${formatCompact(data?.valor_conciliado ?? 0)}`} />
        <SummaryCard icon={Clock}       label="Pendentes"    loading={loading}
          value={`${data?.total_pendente ?? 0} lançamentos`}
          color="#F59E0B" sub={`${formatCompact(data?.valor_pendente ?? 0)}`} />
        <SummaryCard icon={AlertCircle} label="Divergentes"  loading={loading}
          value={`${data?.total_divergente ?? 0} lançamentos`}
          color="#EF4444" sub={`${formatCompact(data?.valor_divergente ?? 0)}`} />
        <SummaryCard icon={TrendingUp}  label="% Conciliado" loading={loading}
          value={`${data?.percentual_conciliado ?? 0}%`}
          color={data?.percentual_conciliado >= 80 ? '#12F0C6' : '#F59E0B'} sub="no mês" />
      </div>

      {/* Filtros */}
      <Card title="Filtros de Conciliação">
        <div className="flex flex-wrap gap-3 items-center">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className={INPUT_CLS}>
            {meses.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="number" value={ano} onChange={e => setAno(Number(e.target.value))}
            className={INPUT_CLS + ' w-24'} />

          <div className="flex gap-1.5">
            {[
              { k: 'todos',      l: 'Todos'      },
              { k: 'pendente',   l: 'Pendentes'  },
              { k: 'conciliado', l: 'Conciliados'},
              { k: 'divergente', l: 'Divergentes'},
            ].map(({ k, l }) => (
              <button key={k} onClick={() => setFiltroConc(k)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={filtroConc === k
                  ? { background: '#12F0C6', color: '#000' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }}>
                {l}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-40">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className={INPUT_CLS + ' w-full pl-8'} placeholder="Buscar..."
              value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <Button variant="ghost" size="sm" onClick={refetch}><RefreshCw size={13} /></Button>
        </div>
      </Card>

      {/* Tabela de conciliação */}
      <Card title="Lançamentos para Conciliação" subtitle={`${lancamentos.length} registros`}>
        {loading ? <LoadingSpinner label="Carregando..." /> :
         error   ? <p className="text-red-400 text-sm">{error}</p> :
         lancamentos.length === 0 ? <EmptyState title="Nenhum lançamento encontrado" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {['Data','Tipo','Descrição','Cliente','Valor','Status Pgto','Conciliação','Ações'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lancamentos.map(l => (
                  <tr key={l.id}
                      className="border-b hover:bg-white/[0.02] transition-colors"
                      style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <td className="py-2 px-3 text-gray-400 whitespace-nowrap">{l.data_competencia}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span style={{ color: COR_TIPO[l.tipo] ?? '#9CA3AF' }} className="font-semibold">
                        {tipoLabel(l.tipo)}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-white max-w-[160px] truncate">{l.descricao || 'â€”'}</td>
                    <td className="py-2 px-3 text-gray-300 max-w-[110px] truncate">{l.cliente || 'â€”'}</td>
                    <td className="py-2 px-3 text-right whitespace-nowrap font-semibold text-white">
                      {formatCurrency(l.valor_previsto)}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap"><StatusBadge status={l.status} /></td>
                    <td className="py-2 px-3 whitespace-nowrap"><ConcBadge status={l.status_conciliacao} /></td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <div className="flex gap-1.5">
                        <button
                          disabled={marcando === l.id}
                          onClick={() => handleMarcar(l.id, 'conciliado')}
                          className="px-2 py-1 rounded text-[10px] font-medium transition-colors"
                          style={{ background: 'rgba(18,240,198,0.12)', color: '#12F0C6' }}
                          title="Marcar como conciliado">
                          âœ“ Ok
                        </button>
                        <button
                          disabled={marcando === l.id}
                          onClick={() => handleMarcar(l.id, 'divergente')}
                          className="px-2 py-1 rounded text-[10px] font-medium transition-colors"
                          style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}
                          title="Marcar como divergente">
                          ! Div
                        </button>
                        <button
                          disabled={marcando === l.id}
                          onClick={() => handleMarcar(l.id, 'pendente')}
                          className="px-2 py-1 rounded text-[10px] font-medium transition-colors"
                          style={{ background: 'rgba(255,255,255,0.06)', color: '#9CA3AF' }}
                          title="Marcar como pendente">
                          ~ Pend
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Orientação futura */}
      <div className="rounded-xl border border-dashed p-4 flex gap-3 items-start"
           style={{ borderColor: 'rgba(129,140,248,0.25)', background: 'rgba(99,102,241,0.04)' }}>
        <AlertCircle size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#818CF8' }} />
        <div>
          <p className="text-xs font-semibold text-gray-300 mb-0.5">Integração bancária em breve</p>
          <p className="text-[11px] text-gray-600">
            Quando a integração com o banco for ativada, o extrato será importado automaticamente
            e a conciliação será assistida por IA. Por ora, use os botões acima para marcar manualmente.
          </p>
        </div>
      </div>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Tab 3 â€” Recebimentos por Cliente
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function TabRecebimentos() {
  const mesDefault = mesAtualNum()
  const anoDefault = anoAtual()
  const [mes, setMes] = useState(mesDefault)
  const [ano, setAno] = useState(anoDefault)
  const [filtroPgto, setFiltroPgto] = useState('todos')
  const [busca, setBusca] = useState('')
  const [atualizando, setAtualizando] = useState(null)

  const { data, loading, error, refetch } = useRecebimentosClientes({ mes, ano })

  const clientes = useMemo(() => {
    let list = data?.clientes ?? []
    if (filtroPgto !== 'todos') {
      list = list.filter(c => c.status_pagamento === filtroPgto)
    }
    if (busca.trim()) {
      const q = busca.toLowerCase()
      list = list.filter(c => c.cliente?.toLowerCase().includes(q))
    }
    return list
  }, [data, filtroPgto, busca])

  const handlePagamento = async (c, status) => {
    setAtualizando(c.id)
    try {
      await clientesAPI.update(c.id, {
        status_pagamento:           status,
        data_pagamento:             status === 'pago' ? new Date().toISOString() : null,
        valor_recebido:             status === 'pago' ? (c.total_previsto || 0) : c.total_recebido,
        mes_referencia_pagamento:   new Date().toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
        cobranca_status:            status === 'pago' ? 'pago' : c.cobranca_status,
      })
      refetch()
    } catch (e) {
      alert('Erro ao atualizar: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setAtualizando(null) }
  }

  const handleCobranca = async (c, cobrancaStatus) => {
    setAtualizando(c.id)
    try {
      await clientesAPI.update(c.id, {
        cobranca_status: cobrancaStatus,
        ultimo_contato:  new Date().toISOString().slice(0, 10),
      })
      refetch()
    } finally { setAtualizando(null) }
  }

  const STATUS_PGTO_COR = {
    pago:     '#12F0C6',
    recebido: '#12F0C6',
    parcial:  '#F59E0B',
    pendente: '#F59E0B',
    vencido:  '#EF4444',
  }

  const meses = [
    [1,'Jan'],[2,'Fev'],[3,'Mar'],[4,'Abr'],[5,'Mai'],[6,'Jun'],
    [7,'Jul'],[8,'Ago'],[9,'Set'],[10,'Out'],[11,'Nov'],[12,'Dez'],
  ]

  return (
    <div className="space-y-5">

      {/* Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <SummaryCard icon={DollarSign}   label="Total Previsto" loading={loading}
          value={formatCompact(data?.total_previsto ?? 0)} color="#818CF8" />
        <SummaryCard icon={TrendingUp}   label="Total Recebido" loading={loading}
          value={formatCompact(data?.total_recebido ?? 0)} color="#12F0C6" />
        <SummaryCard icon={Clock}        label="Total Pendente" loading={loading}
          value={formatCompact(data?.total_pendente ?? 0)} color="#F59E0B" />
        <SummaryCard icon={CheckCircle}  label="Clientes Pagos"     loading={loading}
          value={data?.n_pagos ?? 0} color="#12F0C6" sub="no mês" />
        <SummaryCard icon={AlertCircle}  label="Vencidos/Atrasados"  loading={loading}
          value={data?.n_vencidos ?? 0} color="#EF4444" />
        <SummaryCard icon={Users}        label="Pendentes"      loading={loading}
          value={data?.n_pendentes ?? 0} color="#F59E0B" />
      </div>

      {/* Filtros */}
      <Card title="Filtros">
        <div className="flex flex-wrap gap-3 items-center">
          <select value={mes} onChange={e => setMes(Number(e.target.value))} className={INPUT_CLS}>
            {meses.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <input type="number" value={ano} onChange={e => setAno(Number(e.target.value))}
            className={INPUT_CLS + ' w-24'} />

          <div className="flex gap-1.5">
            {[
              { k: 'todos',    l: 'Todos'   },
              { k: 'vencido',  l: 'Vencidos'},
              { k: 'pendente', l: 'Pendentes'},
              { k: 'parcial',  l: 'Parcial' },
              { k: 'pago',     l: 'Pagos'   },
            ].map(({ k, l }) => (
              <button key={k} onClick={() => setFiltroPgto(k)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={filtroPgto === k
                  ? { background: k === 'vencido' ? '#EF4444' : '#12F0C6', color: '#000' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }}>
                {l}
              </button>
            ))}
          </div>

          <div className="relative flex-1 min-w-40">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input className={INPUT_CLS + ' w-full pl-8'} placeholder="Buscar cliente..."
              value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
          <Button variant="ghost" size="sm" onClick={refetch}><RefreshCw size={13} /></Button>
        </div>
      </Card>

      {/* Tabela */}
      <Card title="Recebimentos por Cliente"
            subtitle={`${clientes.length} clientes · ${data?.mes_referencia ?? ''}`}>
        {loading ? <LoadingSpinner label="Carregando..." /> :
         error   ? <p className="text-red-400 text-sm">{error}</p> :
         clientes.length === 0 ? <EmptyState title="Nenhum cliente encontrado" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {['Cliente','Previsto','Recebido','Pendência','Vencimento','Status','Ações Rápidas'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientes.map(c => {
                  const cor = STATUS_PGTO_COR[c.status_pagamento] ?? '#9CA3AF'
                  const sBadge = statusPagamentoBadge(c.status_pagamento)
                  const loading_ = atualizando === c.id
                  return (
                    <tr key={c.id}
                        className="border-b hover:bg-white/[0.02] transition-colors"
                        style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      <td className="py-2 px-3">
                        <p className="text-white font-medium">{c.cliente}</p>
                        {c.responsavel && <p className="text-gray-600 text-[10px]">{c.responsavel}</p>}
                      </td>
                      <td className="py-2 px-3 text-right text-gray-300 whitespace-nowrap">
                        {formatCurrency(c.total_previsto)}
                      </td>
                      <td className="py-2 px-3 text-right font-semibold whitespace-nowrap"
                          style={{ color: c.total_recebido > 0 ? '#12F0C6' : '#6B7280' }}>
                        {formatCurrency(c.total_recebido)}
                      </td>
                      <td className="py-2 px-3 text-right whitespace-nowrap"
                          style={{ color: c.pendencia > 0 ? '#F59E0B' : '#6B7280' }}>
                        {c.pendencia > 0 ? formatCurrency(c.pendencia) : 'â€”'}
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <p className="text-gray-300">dia {c.dia_pagamento}</p>
                        <p className="text-[10px] text-gray-600">{c.vencimento}</p>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <Badge variant={sBadge.badgeVariant} dot>{sBadge.label}</Badge>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1.5 flex-wrap">
                          {c.status_pagamento !== 'pago' && (
                            <button disabled={loading_} onClick={() => handlePagamento(c, 'pago')}
                              className="px-2 py-1 rounded text-[10px] font-medium"
                              style={{ background: 'rgba(18,240,198,0.12)', color: '#12F0C6' }}>
                              âœ“ Recebido
                            </button>
                          )}
                          {c.status_pagamento !== 'pago' && (
                            <button disabled={loading_} onClick={() => handleCobranca(c, 'cobrado')}
                              className="px-2 py-1 rounded text-[10px] font-medium"
                              style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                              â˜Ž Cobrado
                            </button>
                          )}
                          {c.status_pagamento === 'pago' && (
                            <button disabled={loading_} onClick={() => handlePagamento(c, 'pendente')}
                              className="px-2 py-1 rounded text-[10px] font-medium"
                              style={{ background: 'rgba(255,255,255,0.06)', color: '#9CA3AF' }}>
                              â†º Estornar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Componente principal com abas
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const TABS = [
  { id: 'fluxo',         label: 'Fluxo de Caixa',      icon: DollarSign  },
  { id: 'conciliacao',   label: 'Conciliação',          icon: CheckCircle },
  { id: 'recebimentos',  label: 'Recebimentos por Cliente', icon: Users  },
]

export default function FluxoCaixa() {
  const [tab, setTab] = useState('fluxo')
  const ActiveTab = tab === 'fluxo'
    ? TabFluxo
    : tab === 'conciliacao'
      ? TabConciliacao
      : TabRecebimentos

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          Visão operacional · <span style={{ color: '#12F0C6' }}>dados do Excel</span>
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl"
           style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={TAB_CLS(tab === id) + ' flex items-center gap-2 flex-1 justify-center'}
            style={tab === id ? { background: '#12F0C6' } : {}}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Conteúdo da tab ativa */}
      <ActiveTab />
    </div>
  )
}
