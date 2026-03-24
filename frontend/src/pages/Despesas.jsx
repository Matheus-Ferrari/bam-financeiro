import { useState } from 'react'
import { useDespesas } from '../hooks/useFinanceiro'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import DataTable from '../components/tables/DataTable'
import ComposicaoDespesasChart from '../components/charts/ComposicaoDespesasChart'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { formatCompact, formatCurrency } from '../utils/formatters'
import { Filter } from 'lucide-react'

const CAT_COLORS = {
  // Categorias reais do Excel
  'Salários e Benefícios':  '#12F0C6',
  'Custos Fixos':            '#6366F1',
  'Licenças / Ferramentas':  '#F59E0B',
  'Marketing / Publicidade': '#EF4444',
  Administrativo:            '#8B5CF6',
  'Materiais / Estrutura':   '#EC4899',
  // Fallback para categorias legadas/mock
  'Pessoal/RH':              '#12F0C6',
  Infraestrutura:            '#6366F1',
  Marketing:                 '#F59E0B',
  Ferramentas:               '#EF4444',
  Operacional:               '#8B5CF6',
}

const COLUMNS = [
  { key: 'mes',          label: 'Mês' },
  { key: 'descricao',    label: 'Descrição' },
  {
    key: 'categoria',
    label: 'Categoria',
    render: (v) => (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: CAT_COLORS[v] ?? '#9CA3AF' }} />
        {v}
      </span>
    ),
  },
  { key: 'centro_custo', label: 'Centro de Custo', render: (v) => <Badge variant="neutral">{v}</Badge> },
  {
    key: 'valor', label: 'Valor', align: 'right',
    render: (v) => <span className="font-semibold text-white">{formatCurrency(v)}</span>,
  },
]

export default function Despesas() {
  const { data, loading, error } = useDespesas()
  const [filtroMes, setFiltroMes]           = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  const lancamentos = data?.lancamentos ?? []
  const total       = data?.total ?? 0

  const meses      = [...new Set(lancamentos.map((d) => d.mes).filter(Boolean))]
  const categorias = [...new Set(lancamentos.map((d) => d.categoria).filter(Boolean))]

  const filtrados = lancamentos.filter((d) => {
    if (filtroMes       && d.mes       !== filtroMes)       return false
    if (filtroCategoria && d.categoria !== filtroCategoria) return false
    return true
  })

  const totalFiltrado = filtrados.reduce((s, d) => s + (d.valor ?? 0), 0)

  if (loading) return <LoadingSpinner />
  if (error)   return <p className="text-red-400 text-sm">{error}</p>

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Totalizadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border p-5" style={{ background: '#272C30', borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Despesas</p>
          <p className="text-2xl font-bold text-white">{formatCompact(total)}</p>
          <p className="text-xs text-gray-600 mt-1">{lancamentos.length} lançamentos</p>
        </div>
        <div className="rounded-xl border p-5" style={{ background: '#272C30', borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Filtro Ativo</p>
          <p className="text-2xl font-bold text-white">{formatCompact(totalFiltrado)}</p>
          <p className="text-xs text-gray-600 mt-1">{filtrados.length} registros</p>
        </div>
        <div className="rounded-xl border p-5" style={{ background: '#272C30', borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Categorias</p>
          <p className="text-2xl font-bold text-white">{categorias.length}</p>
          <p className="text-xs text-gray-600 mt-1">centros de custo</p>
        </div>
      </div>

      {/* Gráfico + Filtros */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Composição por Categoria" subtitle="Distribuição atual" className="lg:col-span-1">
          <ComposicaoDespesasChart data={data} loading={false} error={null} />
        </Card>

        <Card title="Filtros" className="lg:col-span-2">
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="text-xs rounded-lg px-3 py-1.5 outline-none"
              style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.10)', color: '#fff' }}
            >
              <option value="">Todos os meses</option>
              {meses.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="text-xs rounded-lg px-3 py-1.5 outline-none"
              style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.10)', color: '#fff' }}
            >
              <option value="">Todas as categorias</option>
              {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {(filtroMes || filtroCategoria) && (
              <button onClick={() => { setFiltroMes(''); setFiltroCategoria('') }}
                      className="text-xs px-3 py-1.5 rounded-lg"
                      style={{ color: '#12F0C6', background: 'rgba(18,240,198,0.08)' }}>
                Limpar
              </button>
            )}
          </div>

          {/* Barras de categoria */}
          <div className="space-y-2.5">
            {(data?.por_categoria ?? []).map((cat) => {
              const pct = total > 0 ? (cat.valor / total) * 100 : 0
              const cor = CAT_COLORS[cat.categoria] ?? '#9CA3AF'
              return (
                <div key={cat.categoria} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-36 truncate">{cat.categoria}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cor }} />
                  </div>
                  <span className="text-xs text-white w-20 text-right font-medium">{formatCompact(cat.valor)}</span>
                  <span className="text-xs w-10 text-right" style={{ color: cor }}>{pct.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Tabela */}
      <Card title="Lançamentos de Despesa" subtitle={`${filtrados.length} registros`}>
        <DataTable columns={COLUMNS} data={filtrados} />
      </Card>

      {data?.fonte === 'mock' && (
        <p className="text-center text-xs text-gray-700">Dados demonstrativos (mock)</p>
      )}
    </div>
  )
}
