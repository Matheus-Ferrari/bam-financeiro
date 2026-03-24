import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { formatCompact } from '../../utils/formatters'
import LoadingSpinner from '../ui/LoadingSpinner'
import EmptyState from '../ui/EmptyState'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border px-4 py-3 text-xs shadow-xl"
         style={{ background: '#1A1E21', borderColor: 'rgba(255,255,255,0.1)' }}>
      <p className="font-semibold text-gray-300 mb-2">{label}</p>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-gray-400">{p.name}:</span>
          <span className="font-medium text-white">{formatCompact(p.value)}</span>
        </div>
      ))}
    </div>
  )
}

export default function ReceitasDespesasChart({ data, loading, error }) {
  if (loading) return <LoadingSpinner label="Carregando gráfico..." />
  if (error)   return <p className="text-xs text-red-400">{error}</p>

  const meses = data?.meses ?? []
  if (!meses.length) return <EmptyState title="Sem dados para o gráfico" />

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={meses} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
        <XAxis dataKey="mes" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Legend
          wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
          formatter={(value) => <span style={{ color: '#9CA3AF' }}>{value}</span>}
        />
        <Bar dataKey="receita"  name="Receita"   fill="#12F0C6" fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={28} />
        <Bar dataKey="despesa"  name="Despesa"   fill="#6366F1" fillOpacity={0.75} radius={[3,3,0,0]} maxBarSize={28} />
        <Line dataKey="resultado" name="Resultado" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', r: 3 }} type="monotone" />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
