import { DollarSign, TrendingUp, TrendingDown, Percent, Hash, RefreshCw, Clock } from 'lucide-react'
import { useKpis, useResumo, useAlertas, useDespesas, useOperacaoMes } from '../hooks/useFinanceiro'
import KPICard from '../components/dashboard/KPICard'
import AlertsList from '../components/dashboard/AlertsList'
import ResumoMensal from '../components/dashboard/ResumoMensal'
import ReceitasDespesasChart from '../components/charts/ReceitasDespesasChart'
import ComposicaoDespesasChart from '../components/charts/ComposicaoDespesasChart'
import QuickUpdatePanel from '../components/dashboard/QuickUpdatePanel'
import OperacaoMesSection from '../components/dashboard/OperacaoMesSection'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import { formatCompact, formatPercent } from '../utils/formatters'

export default function Dashboard() {
  const kpis    = useKpis()
  const resumo  = useResumo()
  const alertas = useAlertas()
  const despesas = useDespesas()
  const operacao = useOperacaoMes()

  const k = kpis.data

  const refetchAll = () => {
    kpis.refetch(); resumo.refetch(); alertas.refetch(); despesas.refetch(); operacao.refetch()
  }

  const kpiCards = [
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
      color:     k?.total_resultado >= 0 ? '#12F0C6' : '#EF4444',
      subtitle:  'Receita − Despesa',
    },
    {
      title:     'Margem Líquida',
      formatted: k ? formatPercent(k.margem_pct)      : null,
      icon:      Percent,
      color:     k?.margem_pct >= 25 ? '#12F0C6' : '#F59E0B',
      subtitle:  'sobre a receita',
    },
    {
      title:     'Lançamentos',
      formatted: k ? String(k.total_lancamentos)      : null,
      icon:      Hash,
      color:     '#8B5CF6',
      subtitle:  'no período',
    },
    {
      title:     'A Receber',
      formatted: k ? formatCompact(k.a_receber ?? 0)  : null,
      icon:      Clock,
      color:     '#F59E0B',
      subtitle:  'pendente recebimento',
    },
  ]

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
          <KPICard key={card.title} {...card} loading={kpis.loading} />
        ))}
      </div>

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
