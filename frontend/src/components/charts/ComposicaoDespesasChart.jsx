import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { formatCompact } from '../../utils/formatters'
import LoadingSpinner from '../ui/LoadingSpinner'
import EmptyState from '../ui/EmptyState'

const COLORS = ['#12F0C6', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899']

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const d = payload[0]
  return (
    <div className="rounded-lg border px-4 py-2.5 text-xs shadow-xl"
         style={{ background: '#1A1E21', borderColor: 'rgba(255,255,255,0.1)' }}>
      <p className="font-semibold text-white">{d.name}</p>
      <p className="text-gray-400 mt-0.5">{formatCompact(d.value)}</p>
      <p style={{ color: d.payload.cor || d.payload.fill }}>
        {d.payload.percentual?.toFixed(1).replace('.', ',')}%
      </p>
    </div>
  )
}

const renderLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.06) return null
  const RADIAN = Math.PI / 180
  const r  = innerRadius + (outerRadius - innerRadius) * 0.55
  const x  = cx + r * Math.cos(-midAngle * RADIAN)
  const y  = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

export default function ComposicaoDespesasChart({ data, loading, error }) {
  if (loading) return <LoadingSpinner label="Carregando composição..." />
  if (error)   return <p className="text-xs text-red-400">{error}</p>

  const categorias = data?.por_categoria ?? []
  if (!categorias.length) return <EmptyState title="Sem dados de categorias" />

  const chartData = categorias.map((c, i) => ({
    ...c,
    name: c.categoria,
    fill: c.cor || COLORS[i % COLORS.length],
  }))

  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={3}
          dataKey="valor"
          labelLine={false}
          label={renderLabel}
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
          formatter={(value) => <span style={{ color: '#9CA3AF' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
