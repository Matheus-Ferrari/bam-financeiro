import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  RefreshCw, DollarSign, TrendingUp, TrendingDown, Users, Calculator,
  Percent, Wallet, PieChart as PieIcon, Save, Check,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import { financeiroAPI } from '../services/api'
import { formatCurrency, formatCompact, formatPercent } from '../utils/formatters'

// ── Constantes ──────────────────────────────────────────────────────────
const AREAS = ['TI', 'Marketing', 'Outros']
const TIPOS = ['Salario', 'Ferramenta', 'Licenca', 'Trafego', 'Operacional', 'Outro']
const COR_AREA = { TI: '#12F0C6', Marketing: '#6366F1', Outros: '#F59E0B' }
const COR_TIPO = {
  Salario: '#12F0C6', Ferramenta: '#6366F1', Licenca: '#8B5CF6',
  Trafego: '#EC4899', Operacional: '#F59E0B', Outro: '#9CA3AF',
}

const INPUT_CLS =
  'px-3 py-1.5 rounded-lg text-xs text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50 placeholder:text-gray-600'

const SELECT_INLINE_CLS =
  'px-2 py-1 rounded text-[11px] text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50'

// ── Cards de resumo ─────────────────────────────────────────────────────
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

// ── Tooltip custom ──────────────────────────────────────────────────────
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
  const porArea = data?.por_area || []
  const porTipo = data?.por_tipo || []

  // ── Filtros ────────────────────────────────────────────────────────────
  const despesasFiltradas = useMemo(() => {
    return despesas.filter((d) => {
      if (areaFiltro && d.area !== areaFiltro) return false
      if (tipoFiltro && d.tipo_custo !== tipoFiltro) return false
      if (statusFiltro && String(d.status || '').toLowerCase() !== statusFiltro) return false
      return true
    })
  }, [despesas, areaFiltro, tipoFiltro, statusFiltro])

  const clientesFiltrados = useMemo(() => {
    return clientes.filter((c) => {
      if (clienteFiltro && !String(c.cliente || '').toLowerCase().includes(clienteFiltro.toLowerCase())) return false
      return true
    })
  }, [clientes, clienteFiltro])

  // ── Salvar classificação ───────────────────────────────────────────────
  const salvar = useCallback(async (id, patch) => {
    setSavingId(id)
    // Otimista: atualizar local imediatamente
    setData((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        despesas: prev.despesas.map((d) => (d.id === id ? { ...d, ...patch } : d)),
      }
    })
    try {
      await financeiroAPI.classificarPrecificacao({ lancamento_id: id, ...patch })
      setSavedFlash(id)
      setTimeout(() => setSavedFlash(null), 1500)
      // Recarregar para atualizar resumo/totais com novo valor
      carregar()
    } catch (e) {
      console.error('Erro ao salvar classificação', e)
      alert('Erro ao salvar: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setSavingId(null)
    }
  }, [carregar])

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
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
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

      {/* ── Cards de resumo ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <SummaryCard icon={TrendingUp} label="Receita" value={formatCurrency(resumo.receita_total)} color="#12F0C6" loading={loading} />
        <SummaryCard icon={TrendingDown} label="Custo Op." value={formatCurrency(resumo.custo_total)} color="#EF4444" loading={loading} />
        <SummaryCard
          icon={Wallet}
          label="Lucro Op."
          value={formatCurrency(resumo.lucro)}
          color={resumo.lucro >= 0 ? '#12F0C6' : '#EF4444'}
          loading={loading}
        />
        <SummaryCard icon={Percent} label="Margem" value={formatPercent(resumo.margem_percentual / 100)} color="#F59E0B" loading={loading} />
        <SummaryCard icon={Users} label="Clientes" value={resumo.qtd_clientes ?? '—'} color="#6366F1" loading={loading} />
        <SummaryCard icon={DollarSign} label="Ticket Médio" value={formatCurrency(resumo.ticket_medio)} color="#12F0C6" loading={loading} />
        <SummaryCard icon={Calculator} label="Custo / Cliente" value={formatCurrency(resumo.custo_medio_cliente)} color="#EC4899" loading={loading} />
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

      {/* ── Tabela de custos operacionais ───────────────────────────────── */}
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
                      value={d.area}
                      onChange={(e) => salvar(d.id, { area: e.target.value })}
                      disabled={savingId === d.id}
                      className={SELECT_INLINE_CLS}
                      style={{ color: COR_AREA[d.area] || '#fff' }}
                    >
                      {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={d.tipo_custo}
                      onChange={(e) => salvar(d.id, { tipo_custo: e.target.value })}
                      disabled={savingId === d.id}
                      className={SELECT_INLINE_CLS}
                    >
                      {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      defaultValue={d.observacao || ''}
                      onBlur={(e) => {
                        if (e.target.value !== (d.observacao || '')) salvar(d.id, { observacao: e.target.value })
                      }}
                      placeholder="—"
                      className={SELECT_INLINE_CLS + ' w-full min-w-[120px]'}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <label className="inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={d.incluir_na_precificacao !== false}
                        onChange={(e) => salvar(d.id, { incluir_na_precificacao: e.target.checked })}
                        disabled={savingId === d.id}
                        className="accent-[#12F0C6]"
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

      {/* ── Tabela de clientes / ticket ──────────────────────────────────── */}
      <div className="rounded-xl border" style={{ background: '#1A1E21', borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="flex items-center justify-between p-4 pb-2">
          <h3 className="text-sm font-semibold text-white">Clientes & Ticket Médio</h3>
          <span className="text-[11px] text-gray-500">{clientesFiltrados.length} clientes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Cliente</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Recebido</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Ticket</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">% Receita</th>
                <th className="text-right px-3 py-2 text-gray-500 font-medium">Margem est.</th>
                <th className="text-left px-3 py-2 text-gray-500 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {clientesFiltrados.map((c) => (
                <tr key={c.cliente} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }} className="hover:bg-white/[0.02]">
                  <td className="px-3 py-2 text-white font-medium">{c.cliente}</td>
                  <td className="px-3 py-2 text-right text-[#12F0C6] font-semibold">{formatCurrency(c.valor_recebido)}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{formatCurrency(c.ticket)}</td>
                  <td className="px-3 py-2 text-right text-gray-400">{c.participacao}%</td>
                  <td
                    className="px-3 py-2 text-right font-medium"
                    style={{ color: c.margem_estimada >= 0 ? '#12F0C6' : '#EF4444' }}
                  >
                    {c.margem_estimada}%
                  </td>
                  <td className="px-3 py-2 text-gray-400 text-[10px]">{c.status}</td>
                </tr>
              ))}
              {!loading && clientesFiltrados.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-gray-500">Nenhum cliente com receita neste período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
