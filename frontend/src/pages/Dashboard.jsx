import { useState } from 'react'
import { RefreshCw, CalendarCheck, TrendingUp, CheckCircle, AlertTriangle, Clock, ArrowRight, DollarSign } from 'lucide-react'
import { useKpis, useOperacaoMes, useCaixa } from '../hooks/useFinanceiro'
import QuickUpdatePanel from '../components/dashboard/QuickUpdatePanel'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { formatCurrency, formatCompact } from '../utils/formatters'
import { useNavigate } from 'react-router-dom'
import { clientesAPI } from '../services/api'

const GREEN = '#12F0C6'

export default function Dashboard() {
  const kpis     = useKpis()
  const operacao = useOperacaoMes()
  const caixa    = useCaixa()
  const navigate = useNavigate()
  const [markingId, setMarkingId] = useState(null)
  const [expandAtrasados, setExpandAtrasados] = useState(true)
  const [expandPendentes, setExpandPendentes] = useState(true)

  const k  = kpis.data
  const op = operacao.data
  const cx = caixa.data

  const refetchAll = () => { kpis.refetch(); operacao.refetch(); caixa.refetch() }

  const marcarPago = async (cliente) => {
    const valor = parseFloat(cliente.valor_mensal || cliente.valor_previsto || cliente.valor || 0)
    setMarkingId(cliente.id)
    try {
      await clientesAPI.update(cliente.id, {
        status_pagamento: 'pago',
        valor_recebido:   valor,
        data_pagamento:   new Date().toISOString().split('T')[0],
      })
      refetchAll()
    } catch { }
    finally { setMarkingId(null) }
  }

  const pendentesRaw  = op?.clientes_pendentes ?? []
  const atrasados     = pendentesRaw.filter(c => c.origem === 'atraso' || c.status_pagamento === 'atrasado' || c.status_pagamento === 'vencido')
  const pendentesMes  = pendentesRaw.filter(c => c.origem !== 'atraso' && c.status_pagamento !== 'atrasado' && c.status_pagamento !== 'vencido')
  const pagos         = op?.clientes_pagos ?? []
  const totalAReceber = op?.total_pendente_recebimento ?? k?.a_receber ?? 0
  const saldoProj     = op?.saldo_projetado_mes ?? 0
  const totalAtrasado = atrasados.reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
  const totalPendente = pendentesMes.reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
  const mesRef        = k?.mes_referencia ?? new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  const now = new Date()
  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="space-y-5 animate-fade-in">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white capitalize">{dateLabel}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Painel executivo · <span style={{ color: GREEN }}>{mesRef}</span></p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="ghost" size="sm" onClick={refetchAll}><RefreshCw size={13} /> Atualizar</Button>
          <Button variant="secondary" size="sm" onClick={() => navigate('/fechamento')}><CalendarCheck size={13} /> Fechamento</Button>
        </div>
      </div>

      {/* 3 headline metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Receita Confirmada', value: pagos.reduce((s,c)=>s+parseFloat(c.valor_recebido||c.valor_mensal||c.valor||0),0), color: GREEN, icon: CheckCircle, sub: `${pagos.length} clientes pagaram` },
          { label: 'A Receber',          value: totalAReceber,  color: '#F59E0B', icon: Clock,         sub: `${pendentesMes.length} pendentes este mês` },
          { label: 'Saldo Projetado',    value: saldoProj,      color: saldoProj >= 0 ? GREEN : '#EF4444', icon: TrendingUp, sub: 'fim do mês estimado' },
        ].map(({ label, value, color, icon: Icon, sub }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: '#272C30', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">{label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                <Icon size={13} style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-black" style={{ color: value < 0 ? '#EF4444' : color }}>{formatCurrency(value)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Alert bar for atrasados */}
      {atrasados.length > 0 && (
        <button
          onClick={() => setExpandAtrasados(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-left transition"
          style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <div className="flex items-center gap-2.5">
            <AlertTriangle size={15} className="text-red-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-300">{atrasados.length} {atrasados.length === 1 ? 'cliente em atraso' : 'clientes em atraso'}</p>
              <p className="text-xs text-red-400/60">{formatCurrency(totalAtrasado)} ainda não recebido de meses anteriores</p>
            </div>
          </div>
          <ArrowRight size={14} className="text-red-400/50" />
        </button>
      )}

      {/* Main: 2 col layout */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* Left: pending list */}
        <div className="xl:col-span-2 space-y-3">

          {/* Atrasados (expanded) */}
          {atrasados.length > 0 && expandAtrasados && (
            <div className="rounded-xl overflow-hidden" style={{ background: '#272C30', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(239,68,68,0.06)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-xs font-semibold text-red-300 uppercase tracking-wider">Atrasados — meses anteriores</p>
                <span className="text-xs text-gray-600">{formatCurrency(totalAtrasado)}</span>
              </div>
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {atrasados.map(c => {
                  const valor = parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0)
                  return (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{c.nome}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{c.servico || c.categoria || 'Assessoria'}</p>
                      </div>
                      <p className="text-sm font-bold text-red-400 mx-4 whitespace-nowrap">{formatCurrency(valor)}</p>
                      <button
                        disabled={markingId === c.id}
                        onClick={() => marcarPago(c)}
                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-40"
                        style={{ background: 'rgba(18,240,198,0.1)', color: GREEN }}>
                        {markingId === c.id ? '...' : '✓ Pago'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pendentes deste mês */}
          <div className="rounded-xl overflow-hidden" style={{ background: '#272C30', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.2)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Pendente de pagamento — {mesRef}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{pendentesMes.length} clientes · {formatCurrency(totalPendente)} em aberto</p>
              </div>
              <button
                onClick={() => navigate('/fechamento')}
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-white transition">
                Ver tudo <ArrowRight size={12} />
              </button>
            </div>
            {pendentesMes.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <CheckCircle size={24} className="mx-auto mb-2" style={{ color: GREEN }} />
                <p className="text-sm text-gray-400">Todos os clientes estão em dia!</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                {pendentesMes.map(c => {
                  const valor = parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0)
                  const isCobrado  = c.cobranca_status === 'cobrado'
                  const isPrometeu = c.cobranca_status === 'prometeu_pagar'
                  return (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-white truncate">{c.nome}</p>
                          {isCobrado  && <Badge variant="info"  dot>Cobrado</Badge>}
                          {isPrometeu && <Badge variant="success" dot>Prometeu</Badge>}
                        </div>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {c.servico || c.categoria || 'Assessoria'}
                          {c.dia_pagamento ? ` · Venc. dia ${c.dia_pagamento}` : ''}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-yellow-400 mx-4 whitespace-nowrap">{formatCurrency(valor)}</p>
                      <button
                        disabled={markingId === c.id}
                        onClick={() => marcarPago(c)}
                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-40"
                        style={{ background: 'rgba(18,240,198,0.1)', color: GREEN }}>
                        {markingId === c.id ? '...' : '✓ Pago'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: summary + quick update */}
        <div className="space-y-4">
          {/* Mini snapshot */}
          <div className="rounded-xl p-4 space-y-3" style={{ background: '#272C30', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Resumo do mês</p>
            {[
              { label: 'Clientes pagos',    value: pagos.length,         color: GREEN,     suffix: 'clientes' },
              { label: 'Clientes pendentes',value: pendentesMes.length,  color: '#F59E0B', suffix: 'clientes' },
              { label: 'Em atraso',         value: atrasados.length,     color: '#EF4444', suffix: 'clientes' },
            ].map(({ label, value, color, suffix }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{label}</span>
                <span className="text-sm font-bold" style={{ color }}>{value} <span className="text-xs text-gray-600 font-normal">{suffix}</span></span>
              </div>
            ))}
            <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Total recebido</span>
                <span className="text-sm font-bold" style={{ color: GREEN }}>
                  {formatCurrency(pagos.reduce((s,c)=>s+parseFloat(c.valor_recebido||c.valor_mensal||c.valor||0),0))}
                </span>
              </div>
            </div>
          </div>

          {/* Quick update */}
          <QuickUpdatePanel onApplied={refetchAll} />
        </div>
      </div>
    </div>
  )
}
