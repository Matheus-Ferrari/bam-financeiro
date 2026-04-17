import { useState, useMemo } from 'react'
import { RefreshCw, CalendarCheck, TrendingUp, CheckCircle, AlertTriangle, Clock, ArrowRight, DollarSign, Activity, Zap, Users, MessageSquare } from 'lucide-react'
import { useKpis, useOperacaoMes, useCaixa, useFechamento } from '../hooks/useFinanceiro'
import QuickUpdatePanel from '../components/dashboard/QuickUpdatePanel'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { formatCurrency } from '../utils/formatters'
import { useNavigate } from 'react-router-dom'
import { clientesAPI } from '../services/api'

const GREEN = '#12F0C6'
const MESES_ABR = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

export default function Dashboard() {
  // ── Referência de mês sempre baseada no relógio do browser ──────
  const now         = new Date()
  const diaHoje     = now.getDate()
  const competencia = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const mesRef      = `${MESES_ABR[now.getMonth()]}/${String(now.getFullYear()).slice(-2)}`
  const dateLabel   = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // ── Hooks de dados ───────────────────────────────────────────────
  const kpis     = useKpis()
  const operacao = useOperacaoMes()
  const caixa    = useCaixa()
  const fech     = useFechamento(competencia)
  const navigate = useNavigate()

  const [markingId, setMarkingId]             = useState(null)
  const [expandAtrasados, setExpandAtrasados] = useState(true)
  const [expandAlertCard, setExpandAlertCard] = useState(null) // 'hoje'|'proximos'|'atrasados'|'maiores'

  const op = operacao.data
  const cx = caixa.data
  const fd = fech.data

  const refetchAll = () => { kpis.refetch(); operacao.refetch(); caixa.refetch(); fech.refetch() }

  const marcarPago = async (cliente) => {
    const valor = parseFloat(cliente.valor_mensal || cliente.valor_previsto || cliente.valor || 0)
    setMarkingId(cliente.id)
    try {
      await clientesAPI.update(cliente.id, {
        status_pagamento: 'pago',
        valor_recebido:   valor,
        data_pagamento:   now.toISOString().split('T')[0],
      })
      refetchAll()
    } catch { }
    finally { setMarkingId(null) }
  }

  // ── Listas de clientes: fechamento > operacao (fallback) ─────────
  const pagosArr     = fd?.clientes_pagos ?? op?.clientes_pagos ?? []
  const pendentesRaw = [
    ...(fd?.clientes_pendentes ?? op?.clientes_pendentes ?? []),
    ...(fd?.clientes_extras ?? []),
  ]
  const atrasados    = pendentesRaw.filter(c => c.origem === 'atraso' || c.status_pagamento === 'atrasado' || c.status_pagamento === 'vencido')
  const pendentesMes = pendentesRaw.filter(c => c.origem !== 'atraso' && c.status_pagamento !== 'atrasado' && c.status_pagamento !== 'vencido')

  // ── Métricas financeiras: fechamento > operacao > kpis ───────────
  const fRes              = fd?.resumo ?? {}
  const receitaConfirmada = typeof fRes.receita_confirmada === 'number'
    ? fRes.receita_confirmada
    : pagosArr.reduce((s, c) => s + parseFloat(c.valor_recebido || c.valor_mensal || c.valor || 0), 0)
  const receitaPrevista   = typeof fRes.total_receita === 'number'
    ? fRes.total_receita
    : (op?.total_previsto_receitas_mes ?? receitaConfirmada)
  const aReceber          = typeof fRes.receita_pendente === 'number'
    ? fRes.receita_pendente
    : pendentesMes.reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
  const totalDespesas     = typeof fRes.total_despesa === 'number'
    ? fRes.total_despesa
    : (op?.total_previsto_despesas_mes ?? 0)
  const lucroProjetado    = receitaPrevista - totalDespesas
  const caixaAtual        = cx?.caixa_atual ?? op?.caixa_atual ?? 0

  const totalAtrasado  = atrasados.reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
  const totalPendente  = pendentesMes.reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
  const totalClientes  = pagosArr.length + pendentesMes.length + atrasados.length
  const pctPagos       = totalClientes > 0 ? Math.round(pagosArr.length / totalClientes * 100) : 0

  // ── Saúde financeira ─────────────────────────────────────────────
  const margem         = receitaPrevista > 0 ? lucroProjetado / receitaPrevista : 0
  const saudeNivel     = margem > 0.1 ? 'Saudável' : margem >= 0 ? 'Atenção' : 'Crítica'
  const saudeColor     = margem > 0.1 ? GREEN : margem >= 0 ? '#F59E0B' : '#EF4444'
  const saudeBg        = margem > 0.1 ? 'rgba(18,240,198,0.06)' : margem >= 0 ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)'
  const saudeBorder    = margem > 0.1 ? 'rgba(18,240,198,0.2)' : margem >= 0 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'

  // ── Segmentos para alertas operacionais ──────────────────────────
  const vencendoHoje    = useMemo(() =>
    pendentesMes.filter(c => c.dia_pagamento === diaHoje)
  , [pendentesMes, diaHoje])

  const vencendoBreve   = useMemo(() =>
    pendentesMes.filter(c => c.dia_pagamento > diaHoje && c.dia_pagamento <= diaHoje + 5)
  , [pendentesMes, diaHoje])

  const maioresPendentes = useMemo(() =>
    [...pendentesMes]
      .sort((a, b) => parseFloat(b.valor_mensal || b.valor_previsto || b.valor || 0) - parseFloat(a.valor_mensal || a.valor_previsto || a.valor || 0))
      .slice(0, 5)
  , [pendentesMes])

  // ── Frases dinâmicas "Visão de Hoje" ────────────────────────────
  const frases = useMemo(() => {
    const msgs = []
    if (vencendoHoje.length === 0) {
      msgs.push({ icon: CheckCircle, color: GREEN, text: `Nenhum cliente com vencimento hoje.` })
    } else {
      const totalHoje = vencendoHoje.reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
      msgs.push({ icon: AlertTriangle, color: '#F59E0B', text: `${vencendoHoje.length} ${vencendoHoje.length === 1 ? 'cliente vence hoje' : 'clientes vencem hoje'} — ${formatCurrency(totalHoje)} a receber.` })
    }
    if (vencendoBreve.length > 0) {
      const totalBreve = vencendoBreve.reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
      msgs.push({ icon: Clock, color: '#818CF8', text: `${vencendoBreve.length} ${vencendoBreve.length === 1 ? 'cliente vence' : 'clientes vencem'} nos próximos 5 dias — ${formatCurrency(totalBreve)}.` })
    }
    if (atrasados.length > 0) {
      msgs.push({ icon: AlertTriangle, color: '#EF4444', text: `${atrasados.length} ${atrasados.length === 1 ? 'cliente está em atraso' : 'clientes estão em atraso'} — ${formatCurrency(totalAtrasado)} pendentes.` })
    }
    if (aReceber > 0) {
      msgs.push({ icon: DollarSign, color: '#F59E0B', text: `Você ainda tem ${formatCurrency(aReceber)} a receber neste mês.` })
    }
    if (receitaConfirmada > 0 && receitaPrevista > 0) {
      msgs.push({ icon: Activity, color: GREEN, text: `Até agora você recebeu ${formatCurrency(receitaConfirmada)} de ${formatCurrency(receitaPrevista)} previstos (${Math.round(receitaConfirmada / receitaPrevista * 100)}%).` })
    }
    return msgs
  }, [vencendoHoje, vencendoBreve, atrasados, totalAtrasado, aReceber, receitaConfirmada, receitaPrevista])

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

      {/* ── Visão de Hoje ─────────────────────────────────────────── */}
      <div className="rounded-xl p-4" style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Zap size={13} style={{ color: GREEN }} />
          <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Visão de Hoje</p>
        </div>
        <div className="space-y-2">
          {frases.map((f, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <f.icon size={13} style={{ color: f.color, flexShrink: 0, marginTop: 1 }} />
              <p className="text-xs text-gray-300">{f.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Saúde Financeira ─────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-5 py-3 rounded-xl"
           style={{ background: saudeBg, border: `1px solid ${saudeBorder}` }}>
        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: saudeColor }} />
        <div className="flex-1">
          <p className="text-xs font-semibold" style={{ color: saudeColor }}>
            Saúde financeira: <span className="font-bold">{saudeNivel}</span>
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {saudeNivel === 'Saudável'
              ? `Margem de ${(margem * 100).toFixed(1)}% — receita supera despesas com folga.`
              : saudeNivel === 'Atenção'
                ? `Margem de ${(margem * 100).toFixed(1)}% — receita cobre despesas mas com pouca folga.`
                : `Despesas superam a receita prevista em ${formatCurrency(Math.abs(lucroProjetado))}.`}
          </p>
        </div>
        <p className="text-sm font-bold flex-shrink-0" style={{ color: saudeColor }}>{formatCurrency(lucroProjetado)}</p>
      </div>

      {/* ── Cards de alerta operacional ──────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {
            key: 'hoje', label: 'Vencendo Hoje', count: vencendoHoje.length,
            value: vencendoHoje.reduce((s,c) => s + parseFloat(c.valor_mensal||c.valor_previsto||c.valor||0), 0),
            color: '#F59E0B', icon: AlertTriangle, list: vencendoHoje,
          },
          {
            key: 'proximos', label: 'Próximos 5 dias', count: vencendoBreve.length,
            value: vencendoBreve.reduce((s,c) => s + parseFloat(c.valor_mensal||c.valor_previsto||c.valor||0), 0),
            color: '#818CF8', icon: Clock, list: vencendoBreve,
          },
          {
            key: 'atrasados', label: 'Em Atraso', count: atrasados.length,
            value: totalAtrasado,
            color: '#EF4444', icon: AlertTriangle, list: atrasados,
          },
          {
            key: 'maiores', label: 'Maiores Pendentes', count: maioresPendentes.length,
            value: maioresPendentes.reduce((s,c) => s + parseFloat(c.valor_mensal||c.valor_previsto||c.valor||0), 0),
            color: '#6366F1', icon: Users, list: maioresPendentes,
          },
        ].map(({ key, label, count, value, color, icon: Icon, list }) => (
          <div key={key} className="rounded-xl overflow-hidden"
               style={{ background: '#272C30', border: `1px solid ${count > 0 ? color + '30' : 'rgba(255,255,255,0.07)'}` }}>
            <button
              onClick={() => setExpandAlertCard(v => v === key ? null : key)}
              className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.02] transition">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${color}18` }}>
                  <Icon size={11} style={{ color }} />
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: count > 0 ? color : '#4B5563' }}>{count}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold" style={{ color: count > 0 ? color : '#374151' }}>{formatCurrency(value)}</p>
                {count > 0 && <p className="text-[10px] text-gray-600 mt-0.5">Ver detalhes</p>}
              </div>
            </button>
            {expandAlertCard === key && count > 0 && (
              <div className="border-t px-4 pb-3 space-y-2" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {list.map(c => {
                  const v = parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0)
                  return (
                    <div key={c.id} className="flex items-center justify-between pt-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{c.nome}</p>
                        {c.dia_pagamento && <p className="text-[10px] text-gray-600">Dia {c.dia_pagamento}</p>}
                      </div>
                      <p className="text-xs font-semibold mx-3 whitespace-nowrap" style={{ color }}>{formatCurrency(v)}</p>
                      <button
                        disabled={markingId === c.id}
                        onClick={() => marcarPago(c)}
                        className="text-[10px] px-2 py-1 rounded-md font-medium transition whitespace-nowrap disabled:opacity-40"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.25)' }}>
                        {markingId === c.id ? '...' : 'Marcar pago'}
                      </button>
                    </div>
                  )
                })}
                <button
                  onClick={() => navigate('/clientes')}
                  className="flex items-center gap-1 text-[10px] text-gray-600 hover:text-white transition mt-1">
                  Abrir em Clientes <ArrowRight size={10} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 5 headline metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Receita Recebida', value: receitaConfirmada, color: GREEN,                                          icon: CheckCircle,  sub: `${pagosArr.length} clientes pagaram` },
          { label: 'Receita Prevista', value: receitaPrevista,   color: '#6366F1',                                      icon: TrendingUp,   sub: `total esperado em ${mesRef}` },
          { label: 'A Receber',        value: aReceber,          color: '#F59E0B',                                      icon: Clock,        sub: `${pendentesMes.length} pendentes este mês` },
          { label: 'Despesas',         value: totalDespesas,     color: '#EF4444',                                      icon: DollarSign,   sub: 'previsto + confirmado' },
          { label: 'Lucro Projetado',  value: lucroProjetado,    color: lucroProjetado >= 0 ? GREEN : '#EF4444',        icon: Activity,     sub: 'receita prevista − despesas' },
        ].map(({ label, value, color, icon: Icon, sub }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: '#272C30', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider leading-tight">{label}</p>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                <Icon size={13} style={{ color }} />
              </div>
            </div>
            <p className="text-xl font-black" style={{ color: value < 0 ? '#EF4444' : color }}>{formatCurrency(value)}</p>
            <p className="text-[11px] text-gray-500 mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Indicadores rápidos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Caixa Atual',      value: formatCurrency(caixaAtual),                                  color: GREEN,      sub: null },
          { label: 'Clientes Pagos',   value: `${pctPagos}%`,                                              color: GREEN,      sub: `${pagosArr.length} de ${totalClientes}` },
          { label: 'Total Pendente',   value: formatCurrency(totalPendente + totalAtrasado),               color: '#F59E0B',  sub: `${pendentesMes.length + atrasados.length} clientes` },
          { label: 'Saúde Financeira', value: saudeNivel,                                                   color: saudeColor, sub: lucroProjetado >= 0 ? 'lucro positivo' : 'despesas > receita' },
        ].map(({ label, value, color, sub }) => (
          <div key={label} className="rounded-xl px-4 py-3"
               style={{ background: '#272C30', border: `1px solid ${color}22` }}>
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
            <p className="text-sm font-bold mt-1" style={{ color }}>{value}</p>
            {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
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
                  const valorTotal    = parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0)
                  const valorPago     = parseFloat(c.valor_recebido || 0)
                  const valorPendente = valorPago > 0 ? Math.max(valorTotal - valorPago, 0) : valorTotal
                  return (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{c.nome}</p>
                        <p className="text-[11px] text-gray-500 mt-0.5">{c.servico || c.categoria || 'Assessoria'}</p>
                      </div>
                      <div className="text-right mx-4">
                        <p className="text-sm font-bold text-red-400 whitespace-nowrap">{formatCurrency(valorPendente)}</p>
                        {valorPago > 0 && <p className="text-[10px] text-gray-600">Total: {formatCurrency(valorTotal)}</p>}
                      </div>
                      <button
                        disabled={markingId === c.id}
                        onClick={() => marcarPago(c)}
                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-40 whitespace-nowrap"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                        {markingId === c.id ? '...' : 'Marcar como pago'}
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
                  const valorTotal    = parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0)
                  const valorPago     = parseFloat(c.valor_recebido || 0)
                  const valorPendente = valorPago > 0 ? Math.max(valorTotal - valorPago, 0) : valorTotal
                  const isCobrado     = c.cobranca_status === 'cobrado'
                  const isPrometeu    = c.cobranca_status === 'prometeu_pagar'
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
                      <div className="text-right mx-4">
                        <p className="text-sm font-bold text-yellow-400 whitespace-nowrap">{formatCurrency(valorPendente)}</p>
                        {valorPago > 0 && <p className="text-[10px] text-gray-500">Pago: {formatCurrency(valorPago)}</p>}
                      </div>
                      <button
                        disabled={markingId === c.id}
                        onClick={() => marcarPago(c)}
                        className="flex items-center gap-1.5 text-[11px] px-3 py-1.5 rounded-lg font-medium transition disabled:opacity-40 whitespace-nowrap"
                        style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)' }}>
                        {markingId === c.id ? '...' : 'Marcar como pago'}
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
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Resumo do mês — {mesRef}</p>
            {[
              { label: 'Clientes pagos',    value: pagosArr.length,      color: GREEN,     suffix: 'clientes' },
              { label: 'Pendentes',         value: pendentesMes.length,  color: '#F59E0B', suffix: 'clientes' },
              { label: 'Em atraso',         value: atrasados.length,     color: '#EF4444', suffix: 'clientes' },
            ].map(({ label, value, color, suffix }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-gray-400">{label}</span>
                <span className="text-sm font-bold" style={{ color }}>{value} <span className="text-xs text-gray-600 font-normal">{suffix}</span></span>
              </div>
            ))}
            <div className="pt-2 border-t space-y-1.5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Recebido</span>
                <span className="text-sm font-bold" style={{ color: GREEN }}>{formatCurrency(receitaConfirmada)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Previsto</span>
                <span className="text-sm font-bold text-gray-300">{formatCurrency(receitaPrevista)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Despesas</span>
                <span className="text-sm font-bold text-red-400">{formatCurrency(totalDespesas)}</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <span className="text-xs text-gray-400 font-medium">Lucro proj.</span>
                <span className="text-sm font-bold" style={{ color: lucroProjetado >= 0 ? GREEN : '#EF4444' }}>{formatCurrency(lucroProjetado)}</span>
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
