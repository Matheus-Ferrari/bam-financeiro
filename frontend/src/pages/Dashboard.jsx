import { useState, useMemo } from 'react'
import { RefreshCw, CalendarCheck, TrendingUp, CheckCircle, AlertTriangle, Clock, ArrowRight, DollarSign, Activity, Zap, Users, MessageSquare, TrendingDown } from 'lucide-react'
import { useKpis, useOperacaoMes, useCaixa, useFechamento, useFluxoCaixa } from '../hooks/useFinanceiro'
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
  const kpis       = useKpis()
  const operacao   = useOperacaoMes()
  const caixa      = useCaixa()
  const fech       = useFechamento(competencia)
  // Fluxo de caixa do mês atual + mês anterior (para cobrir semana passada que pode ser do mês passado)
  const fluxoMesAtual  = useFluxoCaixa({ mes: now.getMonth() + 1, ano: now.getFullYear() })
  const fluxoMesAnt    = useFluxoCaixa({ mes: now.getMonth() === 0 ? 12 : now.getMonth(), ano: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear() })
  const navigate   = useNavigate()

  const [markingId, setMarkingId]             = useState(null)
  const [expandAtrasados, setExpandAtrasados] = useState(true)
  const [expandAlertCard, setExpandAlertCard] = useState(null)
  const [expandFinanceiro, setExpandFinanceiro]   = useState(true)
  const [tabFinanceiro, setTabFinanceiro]         = useState('mensal')
  const [expandMetricaMensal, setExpandMetricaMensal] = useState(null) // 'recebida'|'areceber'|'despesas'

  const op = operacao.data
  const cx = caixa.data
  const fd = fech.data

  const refetchAll = () => { kpis.refetch(); operacao.refetch(); caixa.refetch(); fech.refetch(); fluxoMesAtual.refetch(); fluxoMesAnt.refetch() }

  const marcarPago = async (cliente) => {
    const valor = parseFloat(cliente.valor_mensal || cliente.valor_previsto || cliente.valor || 0)
    setMarkingId(cliente.id)
    try {
      const updateData = {
        status_pagamento: 'pago',
        valor_recebido:   valor,
        data_pagamento:   now.toISOString().split('T')[0],
        cobranca_status:  'pago',
      }
      await clientesAPI.update(cliente.id, updateData)
      // Sincronizar com localStorage para que FechamentoMes reflita imediatamente
      try {
        const key = `bam-cov-${competencia}`
        const ov = JSON.parse(localStorage.getItem(key) || '{}')
        ov[cliente.id] = { ...(ov[cliente.id] || {}), ...updateData }
        localStorage.setItem(key, JSON.stringify(ov))
      } catch {}
      refetchAll()
    } catch { }
    finally { setMarkingId(null) }
  }

  // ── Listas de clientes: fechamento > operacao (fallback) ─────────
  const extrasArr    = fd?.clientes_extras ?? []
  const pagosArr     = [
    ...(fd?.clientes_pagos ?? op?.clientes_pagos ?? []),
    ...extrasArr.filter(c => c.status_pagamento === 'pago'),
  ]
  const pendentesRaw = [
    ...(fd?.clientes_pendentes ?? op?.clientes_pendentes ?? []),
    ...extrasArr.filter(c => c.status_pagamento !== 'pago'),
  ]
  const atrasados    = pendentesRaw.filter(c => c.origem === 'atraso' || c.status_pagamento === 'atrasado' || c.status_pagamento === 'vencido')
  const pendentesMes = pendentesRaw.filter(c => c.origem !== 'atraso' && c.status_pagamento !== 'atrasado' && c.status_pagamento !== 'vencido')

  // ── Métricas financeiras — fonte única: arrays de clientes ─────────
  const fRes              = fd?.resumo ?? {}
  // Receita confirmada: calculada da lista de pagos (mesma fórmula do Fechamento do Mês)
  const receitaConfirmada = pagosArr.reduce(
    (s, c) => s + parseFloat(c.valor_recebido || c.valor_mensal || c.valor_previsto || c.valor || 0), 0
  )
  // A Receber: pendentes do mês + em atraso (todos os não recebidos)
  const aReceber          = [...pendentesMes, ...atrasados].reduce(
    (s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0
  )
  // Receita prevista = recebida + a receber (total esperado no mês)
  const receitaPrevista   = receitaConfirmada + aReceber
  const caixaAtual        = cx?.caixa_atual ?? op?.caixa_atual ?? 0

  const totalAtrasado  = atrasados.reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
  const totalPendente  = pendentesMes.reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
  const totalClientes  = pagosArr.length + pendentesMes.length + atrasados.length
  const pctPagos       = totalClientes > 0 ? Math.round(pagosArr.length / totalClientes * 100) : 0

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

  // ── Resumo semanal — calculado sobre pagosArr já disponível ─────
  const { inicioSemana, inicioSemanaPasada } = useMemo(() => {
    const d = new Date()
    const diasParaSegunda = d.getDay() === 0 ? 6 : d.getDay() - 1
    const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diasParaSegunda)
    const inicioPasada = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() - 7)
    return { inicioSemana: inicio, inicioSemanaPasada: inicioPasada }
  }, [])

  // parseDate: evita bug de UTC — '2026-04-20' vira local noon, timestamps ISO ficam como estão
  const parseDate = (v) => {
    if (!v) return new Date(0)
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(v + 'T12:00:00')
    return new Date(v)
  }

  const pagosEssaSemana = useMemo(() =>
    pagosArr.filter(c => { const d = parseDate(c.data_pagamento); return !isNaN(d.getTime()) && d >= inicioSemana })
  , [pagosArr, inicioSemana])

  const pagosSemanaPasada = useMemo(() =>
    pagosArr.filter(c => { const d = parseDate(c.data_pagamento); return !isNaN(d.getTime()) && d >= inicioSemanaPasada && d < inicioSemana })
  , [pagosArr, inicioSemana, inicioSemanaPasada])

  const cobradosPendentes = useMemo(() =>
    [...pendentesMes, ...atrasados].filter(c => c.cobranca_status === 'cobrado')
  , [pendentesMes, atrasados])

  const prometeram = useMemo(() =>
    [...pendentesMes, ...atrasados].filter(c => c.cobranca_status === 'prometeu_pagamento')
  , [pendentesMes, atrasados])

  const semCobrarArr = useMemo(() =>
    [...pendentesMes, ...atrasados].filter(c => !c.cobranca_status || c.cobranca_status === 'sem_cobrar' || c.cobranca_status === 'cobrar_hoje')
  , [pendentesMes, atrasados])

  const totalEssaSemana    = pagosEssaSemana.reduce((s, c) => s + parseFloat(c.valor_recebido || c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
  const totalSemanaPasada  = pagosSemanaPasada.reduce((s, c) => s + parseFloat(c.valor_recebido || c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
  const totalCobrados      = cobradosPendentes.reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
  const totalPrometeram    = prometeram.reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
  const totalSemCobrar     = semCobrarArr.reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)

  // Fim da semana atual (domingo)
  const fimSemana = useMemo(() => new Date(inicioSemana.getTime() + 7 * 86400000 - 1), [inicioSemana])

  // Pendentes com vencimento nessa semana (dia_pagamento cai entre seg e dom desta semana)
  const aReceberEssaSemana = useMemo(() => {
    const diaIni = inicioSemana.getDate()
    const diaFim = fimSemana.getDate()
    const mesIni = inicioSemana.getMonth()
    const mesFim = fimSemana.getMonth()
    return pendentesMes.filter(c => {
      const dia = c.dia_pagamento
      if (!dia) return false
      if (mesIni === mesFim) return dia >= diaIni && dia <= diaFim
      // Semana cruza virada de mês
      return dia >= diaIni || dia <= diaFim
    })
  }, [pendentesMes, inicioSemana, fimSemana])

  // Atrasados que foram cobrados / prometeram pagar (podem entrar essa semana)
  const atrasadosAtivosEssaSemana = useMemo(() =>
    atrasados.filter(c => c.cobranca_status === 'cobrado' || c.cobranca_status === 'prometeu_pagamento')
  , [atrasados])

  const totalAReceberEssaSemana = useMemo(() =>
    [...aReceberEssaSemana, ...atrasadosAtivosEssaSemana]
      .reduce((s, c) => s + parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0), 0)
  , [aReceberEssaSemana, atrasadosAtivosEssaSemana])

  // ── Despesas pagas: usa os mesmos lançamentos do Fluxo de Caixa ───────────────
  const mapDespesa = (d) => ({
    id:            d.id,
    nome:          d.descricao || d.cliente || 'Despesa',
    categoria:     d.categoria || '',
    valor:         parseFloat(String(parseFloat(d.valor_realizado) > 0 ? d.valor_realizado : d.valor_previsto || 0)),
    // Usa data_pagamento; se for o dia 01 (placeholder do fechamento) ou nula, tenta data_vencimento
    data_pagamento: (() => {
      const dp = d.data_pagamento
      if (dp && dp !== '' && !dp.endsWith('-01')) return dp
      return d.data_vencimento || d.data_competencia || null
    })(),
  })

  const todasDespesas = useMemo(() => {
    const lancAtual = fluxoMesAtual.data?.lancamentos ?? []
    const lancAnt   = fluxoMesAnt.data?.lancamentos ?? []
    return [...lancAtual, ...lancAnt]
      .filter(d => d.tipo === 'saida' && d.status === 'pago' && d.origem !== 'cartao')
      .map(mapDespesa)
  }, [fluxoMesAtual.data, fluxoMesAnt.data])

  // Despesas pagas no mês atual (para a aba Mensal)
  // Exclui itens de cartão: eles impactam caixa apenas via pagamento de fatura (lancamento separado)
  const despesasMes = useMemo(() =>
    (fluxoMesAtual.data?.lancamentos ?? [])
      .filter(d => d.tipo === 'saida' && d.status === 'pago' && d.origem !== 'cartao')
      .map(mapDespesa)
  , [fluxoMesAtual.data])

  // Despesas a pagar (previsto, não pagas ainda) do mês atual
  // Exclui itens de cartão: não são saídas imediatas (serão pagas via fatura)
  const despesasAPagarMes = useMemo(() =>
    (fluxoMesAtual.data?.lancamentos ?? [])
      .filter(d => d.tipo === 'saida' && d.status !== 'pago' && d.origem !== 'cartao')
      .map(d => ({
        id:              d.id,
        nome:            d.descricao || d.cliente || 'Despesa',
        categoria:       d.categoria || '',
        valor:           parseFloat(d.valor_previsto || 0),
        data_vencimento: d.data_vencimento || (d.data_competencia && !d.data_competencia.endsWith('-01') ? d.data_competencia : null),
      }))
  , [fluxoMesAtual.data])

  const despesasAPagarEssaSemana = useMemo(() =>
    despesasAPagarMes.filter(d => {
      if (!d.data_vencimento) return false
      const dt = parseDate(d.data_vencimento)
      return !isNaN(dt.getTime()) && dt >= inicioSemana && dt <= fimSemana
    })
  , [despesasAPagarMes, inicioSemana, fimSemana])

  const totalDespesasAPagarMes        = despesasAPagarMes.reduce((s, d) => s + d.valor, 0)
  const totalDespesasAPagarEssaSemana = despesasAPagarEssaSemana.reduce((s, d) => s + d.valor, 0)

  // Despesas totais do mês (pagas + a pagar), excluindo cartão
  const totalDespesasMes = despesasMes.reduce((s, d) => s + d.valor, 0) + totalDespesasAPagarMes
  // Lucro projetado: receita total prevista − total despesas diretas do mês
  const lucroProjetado   = receitaPrevista - totalDespesasMes

  // ── Saúde financeira ─────────────────────────────────────────────
  const margem     = receitaPrevista > 0 ? lucroProjetado / receitaPrevista : 0
  const saudeNivel = margem > 0.1 ? 'Saudável' : margem >= 0 ? 'Atenção' : 'Crítica'
  const saudeColor = margem > 0.1 ? GREEN : margem >= 0 ? '#F59E0B' : '#EF4444'
  const saudeBg    = margem > 0.1 ? 'rgba(18,240,198,0.06)' : margem >= 0 ? 'rgba(245,158,11,0.06)' : 'rgba(239,68,68,0.06)'
  const saudeBorder= margem > 0.1 ? 'rgba(18,240,198,0.2)' : margem >= 0 ? 'rgba(245,158,11,0.2)' : 'rgba(239,68,68,0.2)'

  const saidasEssaSemana = useMemo(() =>
    todasDespesas.filter(d => {
      const dt = parseDate(d.data_pagamento)
      return !isNaN(dt.getTime()) && dt >= inicioSemana
    })
  , [todasDespesas, inicioSemana])

  const saidasSemanaPasada = useMemo(() =>
    todasDespesas.filter(d => {
      const dt = parseDate(d.data_pagamento)
      return !isNaN(dt.getTime()) && dt >= inicioSemanaPasada && dt < inicioSemana
    })
  , [todasDespesas, inicioSemana, inicioSemanaPasada])

  const totalSaidasEssaSemana   = saidasEssaSemana.reduce((s, d) => s + parseFloat(d.valor || 0), 0)
  const totalSaidasSemanaPasada = saidasSemanaPasada.reduce((s, d) => s + parseFloat(d.valor || 0), 0)

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

      {/* ── Receitas & Despesas ──────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.06)' }}>
        {/* Header com abas + fechar */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Activity size={13} style={{ color: GREEN }} />
            <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Receitas & Despesas</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <button
                onClick={() => { setTabFinanceiro('mensal'); setExpandFinanceiro(true) }}
                className="text-[10px] px-3 py-1.5 font-semibold transition"
                style={tabFinanceiro === 'mensal' && expandFinanceiro ? { background: GREEN, color: '#000' } : { color: '#6B7280' }}>
                Mensal
              </button>
              <button
                onClick={() => { setTabFinanceiro('semanal'); setExpandFinanceiro(true) }}
                className="text-[10px] px-3 py-1.5 font-semibold transition"
                style={tabFinanceiro === 'semanal' && expandFinanceiro ? { background: GREEN, color: '#000' } : { color: '#6B7280' }}>
                Semanal
              </button>
            </div>
            <button
              onClick={() => setExpandFinanceiro(v => !v)}
              className="text-[10px] text-gray-600 hover:text-gray-400 transition px-2 py-1 rounded">
              {expandFinanceiro ? 'Fechar ↑' : 'Abrir ↓'}
            </button>
          </div>
        </div>
        {expandFinanceiro && tabFinanceiro === 'semanal' && (
          <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {/* Layout 2 colunas: Esta Semana | Semana Passada */}
            <div className="grid grid-cols-1 lg:grid-cols-2" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>

              {/* ── Esta Semana ── */}
              <div className="p-4 space-y-4 lg:border-r" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: GREEN }} />
                    <p className="text-xs font-bold text-white uppercase tracking-wider">Esta Semana</p>
                  </div>
                  <p className="text-[10px] text-gray-600">
                    {inicioSemana.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} –{' '}
                    {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </p>
                </div>

                {/* Receitas desta semana */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <CheckCircle size={10} style={{ color: GREEN }} /> Receitas recebidas
                    </p>
                    <p className="text-[11px] font-bold" style={{ color: pagosEssaSemana.length > 0 ? GREEN : '#4B5563' }}>
                      {formatCurrency(totalEssaSemana)}
                    </p>
                  </div>
                  {pagosEssaSemana.length === 0 ? (
                    <p className="text-xs text-gray-600 italic py-1">Nenhum recebimento de cliente ainda.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {pagosEssaSemana.map(c => {
                        const v = parseFloat(c.valor_recebido || c.valor_mensal || c.valor_previsto || c.valor || 0)
                        return (
                          <div key={c.id} className="flex items-center justify-between py-1 px-2 rounded-lg" style={{ background: 'rgba(18,240,198,0.04)' }}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: GREEN }} />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-white truncate">{c.nome}</p>
                                {c.data_pagamento && <p className="text-[10px] text-gray-600">{new Date(c.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</p>}
                              </div>
                            </div>
                            <p className="text-xs font-bold ml-3 whitespace-nowrap" style={{ color: GREEN }}>{formatCurrency(v)}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* A Receber esta semana */}
                {(aReceberEssaSemana.length > 0 || atrasadosAtivosEssaSemana.length > 0) && (
                  <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                        <Clock size={10} className="text-amber-400" /> A Receber
                      </p>
                      <p className="text-[11px] font-bold text-amber-400">{formatCurrency(totalAReceberEssaSemana)}</p>
                    </div>
                    <div className="space-y-1.5">
                      {aReceberEssaSemana.map(c => {
                        const v = parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0)
                        const label = c.cobranca_status === 'cobrado' ? 'cobrado' : c.cobranca_status === 'prometeu_pagamento' ? 'prometeu' : c.dia_pagamento ? `dia ${c.dia_pagamento}` : ''
                        return (
                          <div key={c.id} className="flex items-center justify-between py-1 px-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.04)' }}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-white truncate">{c.nome}</p>
                                {label && <p className="text-[10px] text-amber-600">{label}</p>}
                              </div>
                            </div>
                            <p className="text-xs font-bold ml-3 whitespace-nowrap text-amber-400">{formatCurrency(v)}</p>
                          </div>
                        )
                      })}
                      {atrasadosAtivosEssaSemana.map(c => {
                        const v = parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0)
                        const label = c.cobranca_status === 'prometeu_pagamento' ? 'prometeu pagar' : 'cobrado · em atraso'
                        return (
                          <div key={c.id} className="flex items-center justify-between py-1 px-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-amber-200 truncate">{c.nome}</p>
                                <p className="text-[10px] text-amber-600">{label}</p>
                              </div>
                            </div>
                            <p className="text-xs font-bold ml-3 whitespace-nowrap text-amber-400">{formatCurrency(v)}</p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Despesas a pagar esta semana */}
                {despesasAPagarEssaSemana.length > 0 && (
                  <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                        <TrendingDown size={10} className="text-orange-400" /> Despesas a Pagar
                      </p>
                      <p className="text-[11px] font-bold text-orange-400">{formatCurrency(totalDespesasAPagarEssaSemana)}</p>
                    </div>
                    <div className="space-y-1.5">
                      {despesasAPagarEssaSemana.map((d, i) => (
                        <div key={d.id || i} className="flex items-center justify-between py-1 px-2 rounded-lg" style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.15)' }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white truncate">{d.nome}</p>
                              <p className="text-[10px] text-orange-600">
                                {d.categoria && <span>{d.categoria}</span>}
                                {d.data_vencimento && <span>{d.categoria ? ' · ' : ''}venc. {new Date(d.data_vencimento.length === 10 ? d.data_vencimento + 'T12:00:00' : d.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>}
                              </p>
                            </div>
                          </div>
                          <p className="text-xs font-bold ml-3 whitespace-nowrap text-orange-400">{formatCurrency(d.valor)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Despesas pagas esta semana */}
                <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <TrendingDown size={10} className="text-red-400" /> Despesas pagas
                    </p>
                    <p className="text-[11px] font-bold text-red-400">{formatCurrency(totalSaidasEssaSemana)}</p>
                  </div>
                  {saidasEssaSemana.length === 0 ? (
                    <p className="text-xs text-gray-600 italic py-1">Nenhuma despesa paga registrada.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {saidasEssaSemana.map((d, i) => (
                        <div key={d.id || i} className="flex items-center justify-between py-1 px-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.04)' }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-white truncate">{d.nome || d.descricao || 'Despesa'}</p>
                              {d.categoria && <p className="text-[10px] text-gray-600">{d.categoria}</p>}
                            </div>
                          </div>
                          <p className="text-xs font-bold ml-3 whitespace-nowrap text-red-400">{formatCurrency(parseFloat(d.valor || 0))}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Semana Passada ── */}
              <div className="p-4 space-y-4 border-t lg:border-t-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-500" />
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Semana Passada</p>
                  </div>
                  <p className="text-[10px] text-gray-600">
                    {inicioSemanaPasada.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} –{' '}
                    {new Date(inicioSemana.getTime() - 86400000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                  </p>
                </div>

                {/* Receitas semana passada */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <CheckCircle size={10} className="text-gray-500" /> Receitas recebidas
                    </p>
                    <p className="text-[11px] font-bold text-gray-400">{formatCurrency(totalSemanaPasada)}</p>
                  </div>
                  {pagosSemanaPasada.length === 0 ? (
                    <p className="text-xs text-gray-600 italic py-1">Nenhum recebimento registrado.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {pagosSemanaPasada.map(c => {
                        const v = parseFloat(c.valor_recebido || c.valor_mensal || c.valor_previsto || c.valor || 0)
                        return (
                          <div key={c.id} className="flex items-center justify-between py-1 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-gray-500 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-300 truncate">{c.nome}</p>
                                {c.data_pagamento && <p className="text-[10px] text-gray-600">{new Date(c.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</p>}
                              </div>
                            </div>
                            <p className="text-xs font-bold ml-3 whitespace-nowrap text-gray-400">{formatCurrency(v)}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Despesas pagas semana passada */}
                <div className="pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold flex items-center gap-1">
                      <TrendingDown size={10} className="text-gray-600" /> Despesas pagas
                    </p>
                    <p className="text-[11px] font-bold text-gray-500">{formatCurrency(totalSaidasSemanaPasada)}</p>
                  </div>
                  {saidasSemanaPasada.length === 0 ? (
                    <p className="text-xs text-gray-600 italic py-1">Nenhuma despesa paga registrada.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {saidasSemanaPasada.map((d, i) => (
                        <div key={d.id || i} className="flex items-center justify-between py-1 px-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)' }}>
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-400 truncate">{d.nome || d.descricao || 'Despesa'}</p>
                              {d.categoria && <p className="text-[10px] text-gray-600">{d.categoria}</p>}
                            </div>
                          </div>
                          <p className="text-xs font-bold ml-3 whitespace-nowrap text-gray-500">{formatCurrency(parseFloat(d.valor || 0))}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Pipeline de cobrança (rodapé) */}
            {(cobradosPendentes.length > 0 || prometeram.length > 0 || semCobrarArr.length > 0) && (
              <div className="px-4 pb-4 pt-2 border-t space-y-1.5" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">Pipeline de cobrança</p>
                {cobradosPendentes.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                      <p className="text-xs text-gray-300"><span className="font-semibold text-blue-400">{cobradosPendentes.length}</span>{' '}{cobradosPendentes.length === 1 ? 'cobrado, aguardando pagamento' : 'cobrados, aguardando pagamento'}</p>
                    </div>
                    <p className="text-xs font-semibold text-blue-400">{formatCurrency(totalCobrados)}</p>
                  </div>
                )}
                {prometeram.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: GREEN }} />
                      <p className="text-xs text-gray-300"><span className="font-semibold" style={{ color: GREEN }}>{prometeram.length}</span>{' '}{prometeram.length === 1 ? 'prometeu pagar' : 'prometeram pagar'}</p>
                    </div>
                    <p className="text-xs font-semibold" style={{ color: GREEN }}>{formatCurrency(totalPrometeram)}</p>
                  </div>
                )}
                {semCobrarArr.length > 0 && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
                      <p className="text-xs text-gray-400"><span className="font-semibold">{semCobrarArr.length}</span>{' '}sem cobrança realizada</p>
                    </div>
                    <p className="text-xs font-semibold text-gray-500">{formatCurrency(totalSemCobrar)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Aba Mensal */}
        {expandFinanceiro && tabFinanceiro === 'mensal' && (
          <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
            {/* Grid de métricas clicáveis */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {[
                { key: 'recebida', label: 'Receita Recebida', value: receitaConfirmada, color: GREEN,       icon: CheckCircle,  sub: `${pagosArr.length} clientes pagaram` },
                { key: 'prevista', label: 'Receita Prevista', value: receitaPrevista,   color: '#6366F1',    icon: TrendingUp,   sub: `total esperado em ${mesRef}` },
                { key: 'areceber', label: 'A Receber',        value: aReceber,          color: '#F59E0B',    icon: Clock,        sub: `${pendentesMes.length + atrasados.length} em aberto` },
                { key: 'despesas', label: 'Despesas Pagas',   value: despesasMes.reduce((s, d) => s + d.valor, 0), color: '#EF4444', icon: DollarSign, sub: `${despesasMes.length} lançamentos pagos` },
                { key: 'apagar',   label: 'Despesas a Pagar', value: totalDespesasAPagarMes, color: '#F97316', icon: TrendingDown, sub: `${despesasAPagarMes.length} pendentes` },
                { key: 'lucro',    label: 'Lucro Projetado',  value: lucroProjetado,    color: lucroProjetado >= 0 ? GREEN : '#EF4444', icon: Activity, sub: `receita prevista − despesas totais` },
              ].map(({ key, label, value, color, icon: Icon, sub }) => {
                const isActive = expandMetricaMensal === key
                return (
                  <button
                    key={key}
                    onClick={() => setExpandMetricaMensal(v => v === key ? null : key)}
                    className="px-4 py-4 text-left transition hover:bg-white/[0.02]"
                    style={{ background: isActive ? `${color}0d` : '#1A1E21', borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent' }}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider leading-tight">{label}</p>
                      <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}18` }}>
                        <Icon size={11} style={{ color }} />
                      </div>
                    </div>
                    <p className="text-lg font-black" style={{ color: value < 0 ? '#EF4444' : color }}>{formatCurrency(value)}</p>
                    <p className="text-[10px] text-gray-500 mt-1">{sub}</p>
                    {['recebida','areceber','despesas','apagar','lucro'].includes(key) && (
                      <p className="text-[10px] mt-1" style={{ color: isActive ? color : '#4B5563' }}>
                        {isActive ? '▲ fechar' : '▼ ver detalhes'}
                      </p>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Painel expandido */}
            {expandMetricaMensal === 'recebida' && (
              <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-3">
                  Clientes que pagaram em {mesRef}
                </p>
                <div className="space-y-1.5">
                  {pagosArr.length === 0 ? (
                    <p className="text-xs text-gray-600 italic">Nenhum pagamento registrado ainda.</p>
                  ) : pagosArr.map(c => {
                    const v = parseFloat(c.valor_recebido || c.valor_mensal || c.valor_previsto || c.valor || 0)
                    return (
                      <div key={c.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: `${GREEN}08`, border: `1px solid ${GREEN}15` }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckCircle size={11} style={{ color: GREEN, flexShrink: 0 }} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">{c.nome}</p>
                            {c.data_pagamento && <p className="text-[10px] text-gray-500">{new Date(c.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}</p>}
                          </div>
                        </div>
                        <p className="text-xs font-bold ml-3 whitespace-nowrap" style={{ color: GREEN }}>{formatCurrency(v)}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-3 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-[10px] text-gray-600">Total recebido</span>
                  <span className="text-xs font-bold" style={{ color: GREEN }}>{formatCurrency(receitaConfirmada)}</span>
                </div>
              </div>
            )}

            {expandMetricaMensal === 'areceber' && (
              <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-3">
                  Pendentes de pagamento em {mesRef}
                </p>
                <div className="space-y-1.5">
                  {[...pendentesMes, ...atrasados].length === 0 ? (
                    <p className="text-xs text-gray-600 italic">Nenhum pendente! 🎉</p>
                  ) : [...pendentesMes, ...atrasados].map(c => {
                    const v = parseFloat(c.valor_mensal || c.valor_previsto || c.valor || 0)
                    const isAtrasado = c.origem === 'atraso' || c.status_pagamento === 'atrasado' || c.status_pagamento === 'vencido'
                    return (
                      <div key={c.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: isAtrasado ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)', border: isAtrasado ? '1px solid rgba(239,68,68,0.15)' : '1px solid rgba(245,158,11,0.15)' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: isAtrasado ? '#EF4444' : '#F59E0B' }} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">{c.nome}</p>
                            <p className="text-[10px] text-gray-500">
                              {isAtrasado ? 'Em atraso' : c.dia_pagamento ? `Venc. dia ${c.dia_pagamento}` : 'Pendente'}
                              {c.cobranca_status === 'cobrado' && ' · Cobrado'}
                              {c.cobranca_status === 'prometeu_pagamento' && ' · Prometeu pagar'}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs font-bold ml-3 whitespace-nowrap" style={{ color: isAtrasado ? '#EF4444' : '#F59E0B' }}>{formatCurrency(v)}</p>
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between mt-3 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-[10px] text-gray-600">Total a receber</span>
                  <span className="text-xs font-bold text-yellow-400">{formatCurrency(aReceber)}</span>
                </div>
              </div>
            )}

            {expandMetricaMensal === 'apagar' && (
              <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-3">
                  Despesas a pagar em {mesRef}
                </p>
                {despesasAPagarMes.length === 0 ? (
                  <p className="text-xs text-gray-600 italic">Nenhuma despesa pendente! ✓</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {despesasAPagarMes.map((d, i) => (
                      <div key={d.id || i} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.12)' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <TrendingDown size={10} className="text-orange-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">{d.nome}</p>
                            <p className="text-[10px] text-gray-600">
                              {d.categoria && <span>{d.categoria}</span>}
                              {d.data_vencimento && (
                                <span>{d.categoria ? ' · ' : ''}venc. {new Date(d.data_vencimento.length === 10 ? d.data_vencimento + 'T12:00:00' : d.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs font-bold ml-2 whitespace-nowrap text-orange-400">{formatCurrency(d.valor)}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between mt-3 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-[10px] text-gray-600">Total a pagar</span>
                  <span className="text-xs font-bold text-orange-400">{formatCurrency(totalDespesasAPagarMes)}</span>
                </div>
              </div>
            )}

            {expandMetricaMensal === 'despesas' && (
              <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-3">
                  Despesas pagas em {mesRef}
                </p>
                {despesasMes.length === 0 ? (
                  <p className="text-xs text-gray-600 italic">Nenhuma despesa paga registrada.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {despesasMes.map((d, i) => (
                      <div key={d.id || i} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}>
                        <div className="flex items-center gap-2 min-w-0">
                          <TrendingDown size={10} className="text-red-500 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-white truncate">{d.nome}</p>
                            <p className="text-[10px] text-gray-600">
                              {d.categoria && <span>{d.categoria}</span>}
                              {d.data_pagamento && (
                                <span> · {new Date(d.data_pagamento.length === 10 ? d.data_pagamento + 'T12:00:00' : d.data_pagamento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs font-bold ml-2 whitespace-nowrap text-red-400">{formatCurrency(d.valor)}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between mt-3 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  <span className="text-[10px] text-gray-600">Total pago</span>
                  <span className="text-xs font-bold text-red-400">{formatCurrency(despesasMes.reduce((s, d) => s + d.valor, 0))}</span>
                </div>
              </div>
            )}

            {expandMetricaMensal === 'lucro' && (
              <div className="px-4 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-3">
                  Detalhamento do Lucro Projetado em {mesRef}
                </p>
                {/* Receitas */}
                <div className="space-y-1.5 mb-3">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider">Receitas</p>
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: `${GREEN}08`, border: `1px solid ${GREEN}15` }}>
                    <span className="text-xs text-gray-300">Receita confirmada ({pagosArr.length} clientes)</span>
                    <span className="text-xs font-bold" style={{ color: GREEN }}>{formatCurrency(receitaConfirmada)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
                    <span className="text-xs text-gray-300">A receber ({pendentesMes.length + atrasados.length} clientes)</span>
                    <span className="text-xs font-bold text-amber-400">{formatCurrency(aReceber)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02]">
                    <span className="text-xs font-semibold text-white">Receita prevista total</span>
                    <span className="text-xs font-bold text-white">{formatCurrency(receitaPrevista)}</span>
                  </div>
                </div>
                {/* Despesas */}
                <div className="space-y-1.5 mb-3">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider">Despesas</p>
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}>
                    <span className="text-xs text-gray-300">Despesas pagas ({despesasMes.length})</span>
                    <span className="text-xs font-bold text-red-400">{formatCurrency(despesasMes.reduce((s, d) => s + d.valor, 0))}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.12)' }}>
                    <span className="text-xs text-gray-300">Despesas a pagar ({despesasAPagarMes.length})</span>
                    <span className="text-xs font-bold text-orange-400">{formatCurrency(totalDespesasAPagarMes)}</span>
                  </div>
                  <div className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-white/[0.02]">
                    <span className="text-xs font-semibold text-white">Total despesas</span>
                    <span className="text-xs font-bold text-white">{formatCurrency(totalDespesasMes)}</span>
                  </div>
                </div>
                {/* Resultado */}
                <div className="flex items-center justify-between py-2 px-3 rounded-lg border mt-2"
                     style={{ background: lucroProjetado >= 0 ? `${GREEN}0a` : 'rgba(239,68,68,0.08)', borderColor: lucroProjetado >= 0 ? `${GREEN}25` : 'rgba(239,68,68,0.25)' }}>
                  <div>
                    <p className="text-xs font-semibold text-white">Lucro Projetado</p>
                    <p className="text-[10px] text-gray-500">Receita prevista − Total despesas</p>
                  </div>
                  <p className="text-base font-black" style={{ color: lucroProjetado >= 0 ? GREEN : '#EF4444' }}>{formatCurrency(lucroProjetado)}</p>
                </div>
              </div>
            )}

            {/* Indicadores rápidos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-px border-t" style={{ background: 'rgba(255,255,255,0.04)', borderColor: 'rgba(255,255,255,0.05)' }}>
              {[
                { label: 'Caixa Atual',      value: formatCurrency(caixaAtual),  color: GREEN,      sub: null },
                { label: 'Clientes Pagos',   value: `${pctPagos}%`,              color: GREEN,      sub: `${pagosArr.length} de ${totalClientes}` },
                { label: 'Total Pendente',   value: formatCurrency(aReceber),    color: '#F59E0B',  sub: `${pendentesMes.length + atrasados.length} clientes` },
                { label: 'Saúde Financeira', value: saudeNivel,                   color: saudeColor, sub: lucroProjetado >= 0 ? 'lucro positivo' : 'despesas > receita' },
              ].map(({ label, value, color, sub }) => (
                <div key={label} className="px-4 py-3" style={{ background: '#1A1E21' }}>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
                  <p className="text-sm font-bold mt-1" style={{ color }}>{value}</p>
                  {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
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
                <span className="text-sm font-bold text-red-400">{formatCurrency(totalDespesasMes)}</span>
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
