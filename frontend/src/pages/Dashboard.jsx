import { DollarSign, TrendingUp, TrendingDown, Percent, Hash, RefreshCw, Clock, Wallet, CheckCircle, AlertTriangle, Users } from 'lucide-react'
import { useKpis, useResumo, useAlertas, useDespesas, useOperacaoMes, useCaixa } from '../hooks/useFinanceiro'
import KPICard from '../components/dashboard/KPICard'
import AlertsList from '../components/dashboard/AlertsList'
import ResumoMensal from '../components/dashboard/ResumoMensal'
import ReceitasDespesasChart from '../components/charts/ReceitasDespesasChart'
import ComposicaoDespesasChart from '../components/charts/ComposicaoDespesasChart'
import QuickUpdatePanel from '../components/dashboard/QuickUpdatePanel'
import OperacaoMesSection from '../components/dashboard/OperacaoMesSection'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import { formatCompact, formatPercent, formatCurrency } from '../utils/formatters'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const kpis    = useKpis()
  const resumo  = useResumo()
  const alertas = useAlertas()
  const despesas = useDespesas()
  const operacao = useOperacaoMes()
  const caixa   = useCaixa()
  const navigate = useNavigate()

  const k  = kpis.data
  const op = operacao.data
  const cx = caixa.data

  const refetchAll = () => {
    kpis.refetch(); resumo.refetch(); alertas.refetch()
    despesas.refetch(); operacao.refetch(); caixa.refetch()
  }

  const kpiCards = [
    {
      title:     'Saldo de Caixa',
      formatted: cx ? formatCompact(cx.caixa_atual ?? 0) : null,
      icon:      Wallet,
      color:     (cx?.caixa_atual ?? 0) >= 0 ? '#12F0C6' : '#EF4444',
      subtitle:  'posição atual',
    },
    {
      title:     'Receita Total',
      formatted: k ? formatCompact(k.total_receita)   : null,
      icon:      DollarSign,
      color:     '#12F0C6',
      subtitle:  k?.periodo,
    },
    {
      title:     'Despesa Total',
      formatted: k ? formatCompact(k.total_despesa)   : null,
      icon:      TrendingDown,
      color:     '#6366F1',
      subtitle:  k?.periodo,
    },
    {
      title:     'Resultado',
      formatted: k ? formatCompact(k.total_resultado) : null,
      icon:      TrendingUp,
      color:     (k?.total_resultado ?? 0) >= 0 ? '#12F0C6' : '#EF4444',
      subtitle:  'Receita − Despesa',
    },
    {
      title:     'Margem Líquida',
      formatted: k ? formatPercent(k.margem_pct)      : null,
      icon:      Percent,
      color:     (k?.margem_pct ?? 0) >= 25 ? '#12F0C6' : '#F59E0B',
      subtitle:  'sobre a receita',
    },
    {
      title:     'A Receber',
      formatted: k ? formatCompact(k.a_receber ?? 0)  : null,
      icon:      Clock,
      color:     '#F59E0B',
      subtitle:  'pendente recebimento',
    },
  ]

  // Contadores de clientes do operação-mes
  const pagos     = op?.clientes_pagos?.length   ?? 0
  const pendentes = op?.clientes_pendentes?.length ?? 0
  const vencidos  = op?.quem_falta_pagar?.filter(c => c.status_pagamento === 'atrasado')?.length ?? 0
  const saldoProj = op?.saldo_projetado_mes ?? 0

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">
            Visão consolidada · <span style={{ color: '#12F0C6' }}>{k?.mes_referencia ?? '...'}</span>
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={refetchAll}>
          <RefreshCw size={13} /> Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {kpiCards.map((card) => (
          <KPICard key={card.title} {...card} loading={kpis.loading || caixa.loading} />
        ))}
      </div>

      {/* Painel operacional de caixa */}
      {!operacao.loading && op && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Clientes pagos */}
          <button
            onClick={() => navigate('/fluxo-caixa')}
            className="rounded-xl border p-4 text-left hover:bg-white/[0.02] transition-colors"
            style={{ background: '#1A1E21', borderColor: 'rgba(18,240,198,0.15)' }}>
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle size={13} style={{ color: '#12F0C6' }} />
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Clientes Pagos</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#12F0C6' }}>{pagos}</p>
            <p className="text-[10px] text-gray-600 mt-1">no mês</p>
          </button>

          {/* Pendentes */}
          <button
            onClick={() => navigate('/fluxo-caixa')}
            className="rounded-xl border p-4 text-left hover:bg-white/[0.02] transition-colors"
            style={{ background: '#1A1E21', borderColor: 'rgba(245,158,11,0.15)' }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={13} style={{ color: '#F59E0B' }} />
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Clientes Pendentes</p>
            </div>
            <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{pendentes}</p>
            <p className="text-[10px] text-gray-600 mt-1">aguardando pagamento</p>
          </button>

          {/* A receber */}
          <button
            onClick={() => navigate('/fluxo-caixa')}
            className="rounded-xl border p-4 text-left hover:bg-white/[0.02] transition-colors"
            style={{ background: '#1A1E21', borderColor: 'rgba(99,102,241,0.15)' }}>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={13} style={{ color: '#818CF8' }} />
              <p className="text-[10px] uppercase tracking-wider text-gray-500">A Receber este Mês</p>
            </div>
            <p className="text-xl font-bold" style={{ color: '#818CF8' }}>
              {formatCompact(op.total_pendente_recebimento ?? 0)}
            </p>
            <p className="text-[10px] text-gray-600 mt-1">em aberto</p>
          </button>

          {/* Saldo projetado */}
          <button
            onClick={() => navigate('/fluxo-caixa')}
            className="rounded-xl border p-4 text-left hover:bg-white/[0.02] transition-colors"
            style={{ background: '#1A1E21', borderColor: saldoProj >= 0 ? 'rgba(18,240,198,0.15)' : 'rgba(239,68,68,0.15)' }}>
            <div className="flex items-center gap-2 mb-2">
              <Wallet size={13} style={{ color: saldoProj >= 0 ? '#12F0C6' : '#EF4444' }} />
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Saldo Projetado</p>
            </div>
            <p className="text-xl font-bold" style={{ color: saldoProj >= 0 ? '#12F0C6' : '#EF4444' }}>
              {formatCompact(saldoProj)}
            </p>
            <p className="text-[10px] text-gray-600 mt-1">fim do mês</p>
          </button>
        </div>
      )}

      {/* Atualização rápida + operação diária */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-1">
          <QuickUpdatePanel onApplied={refetchAll} />
        </div>
        <div className="xl:col-span-2">
          <OperacaoMesSection
            data={operacao.data}
            loading={operacao.loading}
            onRefresh={refetchAll}
          />
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card
          title="Receitas × Despesas"
          subtitle="Evolução mensal"
          className="lg:col-span-2"
        >
          <ReceitasDespesasChart
            data={resumo.data}
            loading={resumo.loading}
            error={resumo.error}
          />
        </Card>

        <Card title="Composição das Despesas" subtitle="Por categoria — último mês">
          <ComposicaoDespesasChart
            data={despesas.data}
            loading={despesas.loading}
            error={despesas.error}
          />
        </Card>
      </div>

      {/* Resumo + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Resumo Mensal" subtitle="Todos os meses" className="lg:col-span-2">
          <ResumoMensal
            data={resumo.data}
            loading={resumo.loading}
            error={resumo.error}
          />
        </Card>

        <Card title="Alertas Financeiros" subtitle={`${alertas.data?.total ?? 0} avisos ativos`}>
          <AlertsList
            data={alertas.data}
            loading={alertas.loading}
            error={alertas.error}
          />
        </Card>
      </div>

      {/* Rodapé de fonte */}
      {k?.fonte === 'mock' && (
        <p className="text-center text-xs text-gray-700">
          Dados demonstrativos (mock) — conecte o Excel real para substituir.
        </p>
      )}
    </div>
  )
}
