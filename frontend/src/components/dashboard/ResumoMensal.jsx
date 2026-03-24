import { formatCompact } from '../../utils/formatters'
import LoadingSpinner from '../ui/LoadingSpinner'
import EmptyState from '../ui/EmptyState'

export default function ResumoMensal({ data, loading, error }) {
  if (loading) return <LoadingSpinner label="Carregando resumo..." />
  if (error)   return <p className="text-xs text-red-400">{error}</p>

  const meses = data?.meses ?? []
  if (!meses.length) return <EmptyState title="Sem dados mensais" />

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            {['Mês', 'Receita', 'Despesa', 'Resultado', 'Margem'].map((h) => (
              <th key={h} className="text-left py-2 pr-4 text-gray-500 font-medium uppercase tracking-wider last:text-right">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {meses.map((m, i) => {
            const margem = m.receita > 0 ? (m.resultado / m.receita) * 100 : 0
            const positivo = m.resultado >= 0
            return (
              <tr
                key={i}
                className="border-b transition-colors hover:bg-white/[0.03]"
                style={{ borderColor: 'rgba(255,255,255,0.04)' }}
              >
                <td className="py-2.5 pr-4 font-medium text-gray-300">{m.mes}</td>
                <td className="py-2.5 pr-4 text-white">{formatCompact(m.receita)}</td>
                <td className="py-2.5 pr-4 text-gray-300">{formatCompact(m.despesa)}</td>
                <td className="py-2.5 pr-4 font-semibold" style={{ color: positivo ? '#12F0C6' : '#EF4444' }}>
                  {positivo ? '+' : ''}{formatCompact(m.resultado)}
                </td>
                <td className="py-2.5 text-right font-medium" style={{ color: margem >= 25 ? '#12F0C6' : margem >= 15 ? '#F59E0B' : '#EF4444' }}>
                  {margem.toFixed(1).replace('.', ',')}%
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
