import { useState } from 'react'
import { useReceitas } from '../hooks/useFinanceiro'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import DataTable from '../components/tables/DataTable'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { formatCompact, formatCurrency } from '../utils/formatters'
import { DollarSign, Filter } from 'lucide-react'

const STATUS_VARIANT = { Recebido: 'success', Pendente: 'warning', Cancelado: 'error' }

const COLUMNS = [
  { key: 'mes',       label: 'Mês' },
  { key: 'descricao', label: 'Descrição' },
  { key: 'categoria', label: 'Categoria', render: (v) => <Badge variant="info">{v}</Badge> },
  { key: 'cliente',   label: 'Cliente' },
  {
    key: 'status',
    label: 'Status',
    render: (v) => <Badge variant={STATUS_VARIANT[v] ?? 'neutral'} dot>{v}</Badge>,
  },
  {
    key: 'valor', label: 'Valor', align: 'right',
    render: (v) => <span className="font-semibold text-white">{formatCurrency(v)}</span>,
  },
]

export default function Receitas() {
  const { data, loading, error } = useReceitas()
  const [filtroMes, setFiltroMes] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  const lancamentos = data?.lancamentos ?? []
  const total       = data?.total ?? 0

  const meses       = [...new Set(lancamentos.map((r) => r.mes).filter(Boolean))]
  const categorias  = [...new Set(lancamentos.map((r) => r.categoria).filter(Boolean))]

  const filtrados = lancamentos.filter((r) => {
    if (filtroMes       && r.mes       !== filtroMes)       return false
    if (filtroCategoria && r.categoria !== filtroCategoria) return false
    return true
  })

  const totalFiltrado = filtrados.reduce((s, r) => s + (r.valor ?? 0), 0)

  if (loading) return <LoadingSpinner />
  if (error)   return <p className="text-red-400 text-sm">{error}</p>

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Totalizador */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border p-5" style={{ background: '#272C30', borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Receitas</p>
          <p className="text-2xl font-bold" style={{ color: '#12F0C6' }}>{formatCompact(total)}</p>
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
          <p className="text-xs text-gray-600 mt-1">tipos de receita</p>
        </div>
      </div>

      {/* Filtros */}
      <Card title="Filtros" subtitle="Refine os dados exibidos">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter size={12} className="text-gray-500" />
            <select
              value={filtroMes}
              onChange={(e) => setFiltroMes(e.target.value)}
              className="text-xs rounded-lg px-3 py-1.5 outline-none focus:ring-1"
              style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.10)', color: '#fff', '--tw-ring-color': '#12F0C6' }}
            >
              <option value="">Todos os meses</option>
              {meses.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
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
            <button
              onClick={() => { setFiltroMes(''); setFiltroCategoria('') }}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ color: '#12F0C6', background: 'rgba(18,240,198,0.08)' }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      </Card>

      {/* Tabela */}
      <Card title="Lançamentos de Receita" subtitle={`${filtrados.length} registros encontrados`}>
        <DataTable columns={COLUMNS} data={filtrados} />
      </Card>

      {/* Composição por categoria */}
      <Card title="Por Categoria" subtitle="Receita agrupada">
        <div className="space-y-2">
          {(data?.por_categoria ?? []).map((cat) => {
            const pct = total > 0 ? (cat.valor / total) * 100 : 0
            return (
              <div key={cat.categoria} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-40 truncate">{cat.categoria}</span>
                <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#12F0C6' }} />
                </div>
                <span className="text-xs text-white w-20 text-right">{formatCompact(cat.valor)}</span>
                <span className="text-xs text-gray-500 w-12 text-right">{pct.toFixed(1)}%</span>
              </div>
            )
          })}
        </div>
      </Card>

      {data?.fonte === 'mock' && (
        <p className="text-center text-xs text-gray-700">Dados demonstrativos (mock)</p>
      )}
    </div>
  )
}
