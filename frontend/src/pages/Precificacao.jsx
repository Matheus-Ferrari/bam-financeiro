import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  RefreshCw, DollarSign, TrendingUp, TrendingDown, Users, Calculator,
  Percent, Wallet, PieChart as PieIcon, Edit3, X, Check, Trash2, EyeOff, Eye, Plus,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { financeiroAPI } from '../services/api'
import { formatCurrency, formatCompact, formatPercent } from '../utils/formatters'

// ── Constantes ──────────────────────────────────────────────────────────
const AREAS_CUSTO = ['TI', 'Marketing', 'Outros']
const AREAS_CLIENTE = ['TI', 'Marketing', 'Outros', 'Misto']
const TIPOS = ['Salario', 'Ferramenta', 'Licenca', 'Trafego', 'Operacional', 'Outro']
const TIPOS_SERVICO = ['Site', 'CRM', 'Trafego', 'SocialMedia', 'Design', 'Automacao', 'Suporte', 'Outro']
const RESPONSAVEIS = ['Ferrari', 'Luan', 'Marketing', 'Outro']
const COR_AREA = { TI: '#12F0C6', Marketing: '#6366F1', Outros: '#F59E0B', Misto: '#EC4899' }
const COR_TIPO = {
  Salario: '#12F0C6', Ferramenta: '#6366F1', Licenca: '#8B5CF6',
  Trafego: '#EC4899', Operacional: '#F59E0B', Outro: '#9CA3AF',
  'Op. TI': '#12F0C6', 'Op. Marketing': '#6366F1', 'Op. Outros': '#F59E0B', 'Op. Misto': '#EC4899',
}

const INPUT_CLS =
  'px-3 py-1.5 rounded-lg text-xs text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50 placeholder:text-gray-600'

const SELECT_INLINE_CLS =
  'px-2 py-1 rounded text-[11px] text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50'

// ── Cards ───────────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, color, sub, loading }) {
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-1"
      style={{ background: '#1A1E21', borderColor: 'rgba(255,255,255,0.07)' }}
    >
      <div className="flex items-center gap-2">
        <Icon size={14} style={{ color }} />
        <p className="text-[11px] text-gray-500 uppercase tracking-wider">{label}</p>
      </div>
      {loading ? (
        <div className="h-6 w-24 rounded bg-white/5 animate-pulse mt-1" />
      ) : (
        <p className="text-lg font-bold" style={{ color }}>{value}</p>
      )}
      {sub && <p className="text-[10px] text-gray-600">{sub}</p>}
    </div>
  )
}

function AreaCard({ area, receita, custo, margem, margem_percentual, ticket_medio, qtd_clientes }) {
  const cor = COR_AREA[area] || '#9CA3AF'
  const margemPositiva = margem >= 0
  return (
    <div
      className="rounded-xl border p-4 flex flex-col gap-2"
      style={{ background: '#1A1E21', borderColor: cor + '40' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: cor }}>{area}</span>
        <span className="text-[10px] text-gray-500">{qtd_clientes} cli.</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <p className="text-gray-500">Receita</p>
          <p className="text-white font-semibold">{formatCurrency(receita)}</p>
        </div>
        <div>
          <p className="text-gray-500">Custo</p>
          <p className="text-gray-300">{formatCurrency(custo)}</p>
        </div>
        <div>
          <p className="text-gray-500">Margem</p>
          <p className="font-semibold" style={{ color: margemPositiva ? '#12F0C6' : '#EF4444' }}>
            {formatCurrency(margem)} <span className="text-[10px]">({margem_percentual}%)</span>
          </p>
        </div>
        <div>
          <p className="text-gray-500">Ticket</p>
          <p className="text-gray-300">{formatCurrency(ticket_medio)}</p>
        </div>
      </div>
    </div>
  )
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-xl"
      style={{ background: '#1A1E21', borderColor: 'rgba(255,255,255,0.1)' }}
    >
      {label && <p className="font-semibold text-gray-300 mb-1">{label}</p>}
      {payload.map((p) => (
        <div key={p.dataKey || p.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color || p.payload?.fill }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="font-medium text-white">{formatCompact(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Modal Editar Cliente ────────────────────────────────────────────────
function ModalEditarCliente({ cliente, clientesBrutos, onClose, onSave }) {
  const [form, setForm] = useState({
    nome_exibido: cliente.nome_exibido || '',
    grupo: '',
    area: cliente.area || 'Outros',
    tipo_servico: cliente.tipo_servico || '',
    responsavel: cliente.responsavel || '',
    incluir_no_ticket: cliente.incluir_no_ticket !== false,
    observacao: cliente.observacao || '',
    oculto: cliente.oculto === true,
    splits: Array.isArray(cliente.splits) ? cliente.splits.map((s) => ({ area: s.area, valor: s.valor })) : [],
  })
  const [salvando, setSalvando] = useState(false)

  const submit = async () => {
    setSalvando(true)
    try {
      await onSave({
        cliente_key: cliente.cliente_key,
        ...form,
        grupo: form.grupo || '',
        splits: form.splits.filter((s) => s.area && Number(s.valor) > 0),
      })
      onClose()
    } finally {
      setSalvando(false)
    }
  }

  const candidatos = clientesBrutos.filter((b) => b.cliente_key !== cliente.cliente_key)
  const somaSplits = form.splits.reduce((s, sp) => s + (Number(sp.valor) || 0), 0)
  const valorRecebido = Number(cliente.valor_recebido) || 0
  const splitsValid = form.splits.length === 0 || Math.abs(somaSplits - valorRecebido) < 0.01

  const addSplit = () => setForm({ ...form, splits: [...form.splits, { area: 'TI', valor: 0 }] })
  const updSplit = (i, patch) => setForm({ ...form, splits: form.splits.map((s, idx) => idx === i ? { ...s, ...patch } : s) })
  const delSplit = (i) => setForm({ ...form, splits: form.splits.filter((_, idx) => idx !== i) })
  const distribuirIgual = () => {
    if (form.splits.length === 0) return
    const v = Math.round((valorRecebido / form.splits.length) * 100) / 100
    setForm({ ...form, splits: form.splits.map((s) => ({ ...s, valor: v })) })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-[#1A1E21] border border-[#2A2E31] rounded-xl p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">Editar Cliente</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={18} /></button>
        </div>
        <p className="text-[11px] text-gray-500">
          Original: <span className="text-gray-300">{cliente.cliente_original}</span>
          {valorRecebido > 0 && <span className="ml-2 text-[#12F0C6]">• R$ {valorRecebido.toFixed(2)}</span>}
        </p>

        <div className="space-y-3">
          <Field label="Nome exibido">
            <input
              type="text"
              value={form.nome_exibido}
              onChange={(e) => setForm({ ...form, nome_exibido: e.target.value })}
              placeholder={cliente.cliente_original}
              className={INPUT_CLS + ' w-full'}
            />
          </Field>

          <Field label="Agrupar com cliente existente (opcional)">
            <select
              value={form.grupo}
              onChange={(e) => setForm({ ...form, grupo: e.target.value })}
              className={INPUT_CLS + ' w-full'}
            >
              <option value="">— Independente —</option>
              {candidatos.map((c) => (
                <option key={c.cliente_key} value={c.cliente_key}>{c.cliente_original}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Área principal">
              <select
                value={form.area}
                onChange={(e) => setForm({ ...form, area: e.target.value })}
                className={INPUT_CLS + ' w-full'}
                style={{ color: COR_AREA[form.area] }}
              >
                {AREAS_CLIENTE.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Tipo de serviço">
              <select
                value={form.tipo_servico}
                onChange={(e) => setForm({ ...form, tipo_servico: e.target.value })}
                className={INPUT_CLS + ' w-full'}
              >
                <option value="">—</option>
                {TIPOS_SERVICO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Responsável">
            <select
              value={form.responsavel}
              onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
              className={INPUT_CLS + ' w-full'}
            >
              <option value="">—</option>
              {RESPONSAVEIS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>

          <div className="border border-white/10 rounded-lg p-3 bg-black/20 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">
                Dividir receita por área
              </label>
              <div className="flex gap-1">
                {form.splits.length > 0 && (
                  <button
                    type="button"
                    onClick={distribuirIgual}
                    className="px-2 py-0.5 text-[10px] rounded text-gray-400 hover:text-white border border-white/10"
                    title="Distribuir valor igualmente"
                  >
                    ÷ igual
                  </button>
                )}
                <button
                  type="button"
                  onClick={addSplit}
                  className="px-2 py-0.5 text-[10px] rounded text-[#12F0C6] hover:bg-[#12F0C6]/10 border border-[#12F0C6]/30 flex items-center gap-1"
                >
                  <Plus size={10} /> linha
                </button>
              </div>
            </div>
            {form.splits.length === 0 && (
              <p className="text-[10px] text-gray-600 italic">
                Sem split: a receita total vai 100% para "Área principal" acima.
              </p>
            )}
            {form.splits.map((sp, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select
                  value={sp.area}
                  onChange={(e) => updSplit(i, { area: e.target.value })}
                  className={INPUT_CLS + ' flex-1'}
                  style={{ color: COR_AREA[sp.area] }}
                >
                  {AREAS_CLIENTE.filter((a) => a !== 'Misto').map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <input
                  type="number"
                  step="0.01"
                  value={sp.valor}
                  onChange={(e) => updSplit(i, { valor: parseFloat(e.target.value) || 0 })}
                  placeholder="0,00"
                  className={INPUT_CLS + ' w-28 text-right'}
                />
                <button
                  type="button"
                  onClick={() => delSplit(i)}
                  className="text-gray-500 hover:text-red-400"
                  title="Remover"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {form.splits.length > 0 && (
              <div className="flex justify-between text-[10px] pt-1 border-t border-white/5">
                <span className="text-gray-500">Soma splits:</span>
                <span className={splitsValid ? 'text-[#12F0C6]' : 'text-yellow-400'}>
                  R$ {somaSplits.toFixed(2)}
                  {!splitsValid && <span className="ml-1">(⚠ ajustado proporcionalmente)</span>}
                </span>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={form.incluir_no_ticket}
              onChange={(e) => setForm({ ...form, incluir_no_ticket: e.target.checked })}
              className="accent-[#12F0C6]"
            />
            Incluir no cálculo de ticket médio
          </label>

          <label className="flex items-center gap-2 text-xs text-red-400 cursor-pointer">
            <input
              type="checkbox"
              checked={form.oculto}
              onChange={(e) => setForm({ ...form, oculto: e.target.checked })}
              className="accent-red-500"
            />
            <EyeOff size={12} /> Ocultar desta página (não afeta o resto do sistema)
          </label>

          <Field label="Observação">
            <textarea
              value={form.observacao}
              onChange={(e) => setForm({ ...form, observacao: e.target.value })}
              rows={2}
              className={INPUT_CLS + ' w-full resize-none'}
            />
          </Field>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancelar</button>
          <button
            onClick={submit}
            disabled={salvando}
            className="px-4 py-2 text-sm rounded font-semibold text-black"
            style={{ background: '#12F0C6' }}
          >
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

// ── Página principal ────────────────────────────────────────────────────
export default function Precificacao() {
  const today = new Date()
  const [mes, setMes] = useState(today.getMonth() + 1)
  const [ano, setAno] = useState(today.getFullYear())
  const [areaFiltro, setAreaFiltro] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [clienteFiltro, setClienteFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [savingId, setSavingId] = useState(null)
  const [savedFlash, setSavedFlash] = useState(null)
  const [editCliente, setEditCliente] = useState(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await financeiroAPI.getPrecificacao({ mes, ano })
      setData(r.data)
    } catch (e) {
      setError(e?.response?.data?.detail || e.message)
    } finally {
      setLoading(false)
    }
  }, [mes, ano])

  useEffect(() => { carregar() }, [carregar])

  const resumo = data?.resumo || {}
  const despesas = data?.despesas || []
  const clientes = data?.clientes || []
  const clientesBrutos = data?.clientes_brutos || []
  const clientesOcultos = data?.clientes_ocultos || []
  const porArea = data?.por_area || []
  const porTipo = data?.por_tipo || []
  const resumoPorArea = data?.resumo_por_area || []

  const despesasFiltradas = useMemo(() => despesas.filter((d) => {
    if (areaFiltro && d.area !== areaFiltro) return false
    if (tipoFiltro && d.tipo_custo !== tipoFiltro) return false
    if (statusFiltro && String(d.status || '').toLowerCase() !== statusFiltro) return false
    return true
  }), [despesas, areaFiltro, tipoFiltro, statusFiltro])

  const clientesFiltrados = useMemo(() => clientes.filter((c) => {
    if (clienteFiltro && !String(c.nome_exibido + ' ' + c.cliente_original).toLowerCase().includes(clienteFiltro.toLowerCase())) return false
    if (areaFiltro && c.area !== areaFiltro) return false
    return true
  }), [clientes, clienteFiltro, areaFiltro])

  // Salvar despesa
  const salvarDespesa = useCallback(async (id, patch) => {
    setSavingId(id)
    setData((prev) => prev && ({ ...prev, despesas: prev.despesas.map((d) => d.id === id ? { ...d, ...patch } : d) }))
    try {
      await financeiroAPI.classificarPrecificacao({ lancamento_id: id, ...patch })
      setSavedFlash(id)
      setTimeout(() => setSavedFlash(null), 1500)
      carregar()
    } catch (e) {
      alert('Erro: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setSavingId(null)
    }
  }, [carregar])

  // Salvar cliente
  const salvarCliente = useCallback(async (payload) => {
    try {
      await financeiroAPI.classificarCliente(payload)
      await carregar()
    } catch (e) {
      alert('Erro ao salvar cliente: ' + (e?.response?.data?.detail || e.message))
    }
  }, [carregar])

  // Ações rápidas: ocultar / restaurar
  const ocultarCliente = useCallback(async (c) => {
    if (!confirm(`Ocultar "${c.nome_exibido || c.cliente_original}" desta página?\n\nIsso NÃO remove do sistema, apenas esconde da Precificação.`)) return
    await salvarCliente({ cliente_key: c.cliente_key, oculto: true })
  }, [salvarCliente])

  const restaurarCliente = useCallback(async (c) => {
    await salvarCliente({ cliente_key: c.cliente_key, oculto: false })
  }, [salvarCliente])

  return (
    <div className="space-y-6 p-1">
      {/* ── Filtros ─────────────────────────────────────────────────────── */}
      <div className="flex gap-2 items-center flex-wrap">
        <select value={mes} onChange={(e) => setMes(parseInt(e.target.value))} className={INPUT_CLS}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
          ))}
        </select>
        <select value={ano} onChange={(e) => setAno(parseInt(e.target.value))} className={INPUT_CLS}>
          {[ano - 1, ano, ano + 1].map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={areaFiltro} onChange={(e) => setAreaFiltro(e.target.value)} className={INPUT_CLS}>
          <option value="">Todas as áreas</option>
          {AREAS_CLIENTE.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} className={INPUT_CLS}>
          <option value="">Todos os tipos</option>
          {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} className={INPUT_CLS}>
          <option value="">Todos os status</option>
          <option value="pago">Pago</option>
          <option value="previsto">Previsto</option>
          <option value="vencido">Vencido</option>
        </select>
        <input
          type="text"
          placeholder="Cliente"
          value={clienteFiltro}
          onChange={(e) => setClienteFiltro(e.target.value)}
          className={INPUT_CLS + ' min-w-[140px]'}
        />
        <button
          onClick={carregar}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-[#12F0C6]/10 text-[#12F0C6] hover:bg-[#12F0C6]/20 disabled:opacity-40"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          Erro: {error}
        </div>
      )}

      {/* ── Resumo geral ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <SummaryCard icon={TrendingUp} label="Receita" value={formatCurrency(resumo.receita_total)} color="#12F0C6" loading={loading} />
        <SummaryCard icon={TrendingDown} label="Custo Op." value={formatCurrency(resumo.custo_total)} color="#EF4444" loading={loading} />
        <SummaryCard
          icon={Wallet} label="Lucro Op." value={formatCurrency(resumo.lucro)}
          color={resumo.lucro >= 0 ? '#12F0C6' : '#EF4444'} loading={loading}
        />
        <SummaryCard icon={Percent} label="Margem" value={formatPercent((resumo.margem_percentual || 0) / 100)} color="#F59E0B" loading={loading} />
        <SummaryCard icon={Users} label="Clientes" value={resumo.qtd_clientes ?? '—'} color="#6366F1" loading={loading} />
        <SummaryCard icon={DollarSign} label="Ticket Médio" value={formatCurrency(resumo.ticket_medio)} color="#12F0C6" loading={loading} />
        <SummaryCard icon={Calculator} label="Custo / Cliente" value={formatCurrency(resumo.custo_medio_cliente)} color="#EC4899" loading={loading} />
      </div>

      {/* ── Resumo por área ─────────────────────────────────────────────── */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-2">Receita × Custo por Área</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {resumoPorArea.map((a) => <AreaCard key={a.area} {...a} />)}
        </div>
      </div>

      {/* ── Gráficos ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4" style={{ background: '#1A1E21', borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-3">
            <PieIcon size={14} style={{ color: '#12F0C6' }} />
            <h3 className="text-sm font-semibold text-white">Custos por Área</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={porArea} dataKey="valor" nameKey="area" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={3}>
                {porArea.map((e, i) => <Cell key={i} fill={COR_AREA[e.area] || '#9CA3AF'} stroke="transparent" />)}
              </Pie>
              <ReTooltip content={<ChartTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="rounded-xl border p-4" style={{ background: '#1A1E21', borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center gap-2 mb-3">
            <PieIcon size={14} style={{ color: '#6366F1' }} />
            <h3 className="text-sm font-semibold text-white">Custos por Tipo</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={porTipo} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="tipo" tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tickFormatter={formatCompact} tick={{ fill: '#6B7280', fontSize: 10 }} axisLine={false} width={60} />
              <ReTooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Bar dataKey="valor" radius={[3, 3, 0, 0]} maxBarSize={36}>
                {porTipo.map((e, i) => <Cell key={i} fill={COR_TIPO[e.tipo] || '#9CA3AF'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Tabela de despesas ──────────────────────────────────────────── */}
      <div className="rounded-xl border" style={{ background: '#1A1E21', borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between p-4 pb-2">
          <h3 className="text-sm font-semibold text-white">Custos Operacionais — Editável</h3>
          <span className="text-[11px] text-gray-500">{despesasFiltradas.length} lançamentos</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Data</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Descrição</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Categoria</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Valor</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Origem</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Área</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Tipo</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Observação</th>
                <th className="text-center px-3 py-2 text-gray-500 font-medium">Incluir</th>
              </tr>
            </thead>
            <tbody>
              {despesasFiltradas.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-gray-400">{d.data_competencia}</td>
                  <td className="px-3 py-2 text-white">{d.descricao}</td>
                  <td className="px-3 py-2 text-gray-400">{d.categoria}</td>
                  <td className="px-3 py-2 text-right text-gray-300 font-medium">{formatCurrency(d.valor)}</td>
                  <td className="px-3 py-2 text-gray-500 text-[10px]">{d.fonte}</td>
                  <td className="px-3 py-2">
                    <select
                      value={d.area} onChange={(e) => salvarDespesa(d.id, { area: e.target.value })}
                      disabled={savingId === d.id} className={SELECT_INLINE_CLS}
                      style={{ color: COR_AREA[d.area] || '#fff' }}
                    >
                      {AREAS_CUSTO.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={d.tipo_custo} onChange={(e) => salvarDespesa(d.id, { tipo_custo: e.target.value })}
                      disabled={savingId === d.id} className={SELECT_INLINE_CLS}
                    >
                      {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text" defaultValue={d.observacao || ''}
                      onBlur={(e) => { if (e.target.value !== (d.observacao || '')) salvarDespesa(d.id, { observacao: e.target.value }) }}
                      placeholder="—" className={SELECT_INLINE_CLS + ' w-full min-w-[120px]'}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox" checked={d.incluir_na_precificacao !== false}
                        onChange={(e) => salvarDespesa(d.id, { incluir_na_precificacao: e.target.checked })}
                        disabled={savingId === d.id} className="accent-[#12F0C6]"
                      />
                      {savedFlash === d.id && <Check size={12} className="ml-1 text-[#12F0C6]" />}
                    </label>
                  </td>
                </tr>
              ))}
              {!loading && despesasFiltradas.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-500">Nenhum lançamento de despesa neste período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tabela de clientes ──────────────────────────────────────────── */}
      <div className="rounded-xl border" style={{ background: '#1A1E21', borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between p-4 pb-2">
          <h3 className="text-sm font-semibold text-white">Clientes & Receita por Área</h3>
          <span className="text-[11px] text-gray-500">{clientesFiltrados.length} clientes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Original</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Exibido</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Área</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Tipo</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Resp.</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Recebido</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">% Receita</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Margem est.</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Status</th>
                <th className="text-center px-3 py-2 text-gray-500 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map((c) => (
                <tr key={c.cliente_key} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-gray-400 text-[10px]">{c.cliente_original}</td>
                  <td className="px-3 py-2 text-white font-medium">
                    {c.nome_exibido}
                    {!c.incluir_no_ticket && <span className="ml-1 text-[9px] text-gray-600">(fora ticket)</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ background: (COR_AREA[c.area] || '#9CA3AF') + '20', color: COR_AREA[c.area] || '#9CA3AF' }}>
                      {c.area}
                    </span>
                    {c.splits && c.splits.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {c.splits.map((s, i) => (
                          <span key={i} className="px-1 py-0.5 rounded text-[9px]" style={{ background: (COR_AREA[s.area] || '#9CA3AF') + '15', color: COR_AREA[s.area] || '#9CA3AF' }}>
                            {s.area}: {formatCurrency(s.valor)}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-400">{c.tipo_servico || '—'}</td>
                  <td className="px-3 py-2 text-gray-400">{c.responsavel || '—'}</td>
                  <td className="px-3 py-2 text-right text-[#12F0C6] font-semibold">{formatCurrency(c.valor_recebido)}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{c.participacao}%</td>
                  <td className="px-3 py-2 text-right font-medium" style={{ color: c.margem_estimada >= 0 ? '#12F0C6' : '#EF4444' }}>
                    {c.margem_estimada}%
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-[10px]">{c.status}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setEditCliente(c)}
                        className="px-2 py-1 rounded text-[10px] font-medium"
                        style={{ background: 'rgba(18,240,198,0.12)', color: '#12F0C6' }}
                        title="Editar cliente"
                      >
                        <Edit3 size={11} />
                      </button>
                      <button
                        onClick={() => ocultarCliente(c)}
                        className="px-2 py-1 rounded text-[10px] font-medium"
                        style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}
                        title="Ocultar desta página"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && clientesFiltrados.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-6 text-center text-gray-500">Nenhum cliente com receita neste período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editCliente && (
        <ModalEditarCliente
          cliente={editCliente}
          clientesBrutos={clientesBrutos}
          onClose={() => setEditCliente(null)}
          onSave={salvarCliente}
        />
      )}

      {/* ── Clientes ocultos ── */}
      {clientesOcultos.length > 0 && (
        <div className="rounded-xl border" style={{ background: '#1A1E21', borderColor: 'rgba(255,255,255,0.07)' }}>
          <div className="flex items-center justify-between p-4 pb-2">
            <div className="flex items-center gap-2">
              <EyeOff size={14} className="text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-400">Clientes ocultos desta página</h3>
            </div>
            <span className="text-[11px] text-gray-500">{clientesOcultos.length} oculto(s)</span>
          </div>
          <div className="px-4 pb-4 flex flex-wrap gap-2">
            {clientesOcultos.map((c) => (
              <button
                key={c.cliente_key}
                onClick={() => restaurarCliente(c)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-[11px] text-gray-400 hover:text-white hover:border-[#12F0C6]/40"
                title="Restaurar para a página"
              >
                <Eye size={11} />
                <span>{c.cliente_original}</span>
                <span className="text-gray-600">{formatCurrency(c.valor)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
