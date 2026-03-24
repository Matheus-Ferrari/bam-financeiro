import { useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useProjecoes } from '../hooks/useFinanceiro'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { formatCompact, formatCurrency, formatPercent } from '../utils/formatters'
import { Play, Users, TrendingUp } from 'lucide-react'

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

export default function Projecoes() {
  const [crescimento, setCrescimento]   = useState(10)
  const [clientes,    setClientes]      = useState(10)
  const [meses,       setMeses]         = useState(6)
  const [params,      setParams]        = useState({ crescimento_pct: 10, novos_clientes_crm: 10, meses: 6 })

  const { data, loading, error } = useProjecoes(params)

  const aplicar = () => setParams({ crescimento_pct: crescimento, novos_clientes_crm: clientes, meses })

  const projecoes = data?.projecoes ?? []
  const totais    = data?.totais ?? {}
  const crm       = data?.crm_cenarios ?? []
  const prm       = data?.parametros ?? {}

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Painel de parâmetros */}
      <Card title="Parâmetros da Simulação" subtitle="Configure e clique em Simular">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">

          {/* Crescimento */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">
              Crescimento de Receita
              <span className="ml-2 font-semibold" style={{ color: '#12F0C6' }}>{crescimento}%/mês</span>
            </label>
            <input
              type="range" min={0} max={50} step={1} value={crescimento}
              onChange={(e) => setCrescimento(Number(e.target.value))}
              className="w-full accent-bam-green h-1.5 rounded-full cursor-pointer"
              style={{ accentColor: '#12F0C6' }}
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>0%</span><span>25%</span><span>50%</span>
            </div>
          </div>

          {/* CRM */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">
              Novos Clientes CRM (R$100/mês)
              <span className="ml-2 font-semibold" style={{ color: '#12F0C6' }}>{clientes} clientes</span>
            </label>
            <input
              type="range" min={0} max={100} step={5} value={clientes}
              onChange={(e) => setClientes(Number(e.target.value))}
              className="w-full h-1.5 rounded-full cursor-pointer"
              style={{ accentColor: '#12F0C6' }}
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>0</span><span>50</span><span>100</span>
            </div>
          </div>

          {/* Meses */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">
              Horizonte de Projeção
              <span className="ml-2 font-semibold" style={{ color: '#12F0C6' }}>{meses} meses</span>
            </label>
            <input
              type="range" min={1} max={24} step={1} value={meses}
              onChange={(e) => setMeses(Number(e.target.value))}
              className="w-full h-1.5 rounded-full cursor-pointer"
              style={{ accentColor: '#12F0C6' }}
            />
            <div className="flex justify-between text-[10px] text-gray-600 mt-1">
              <span>1</span><span>12</span><span>24</span>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <Button onClick={aplicar}>
            <Play size={13} /> Simular
          </Button>
        </div>
      </Card>

      {loading ? <LoadingSpinner label="Calculando projeção..." /> : error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <>
          {/* Totais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Receita Acumulada',    value: totais.receita_acumulada,    color: '#12F0C6' },
              { label: 'Despesa Acumulada',    value: totais.despesa_acumulada,    color: '#6366F1' },
              { label: 'Resultado Acumulado',  value: totais.resultado_acumulado,  color: totais.resultado_acumulado >= 0 ? '#12F0C6' : '#EF4444' },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border p-5" style={{ background: '#272C30', borderColor: 'rgba(255,255,255,0.07)' }}>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{item.label}</p>
                <p className="text-2xl font-bold" style={{ color: item.color }}>{formatCompact(item.value)}</p>
                <p className="text-xs text-gray-600 mt-1">em {prm.meses} meses</p>
              </div>
            ))}
          </div>

          {/* Gráfico */}
          <Card title="Projeção Mensal" subtitle={`Crescimento de ${prm.crescimento_pct}% + ${prm.novos_clientes_crm} clientes CRM`}>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={projecoes} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="mes" tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => formatCompact(v)} tick={{ fill: '#6B7280', fontSize: 11 }} axisLine={false} tickLine={false} width={72} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                        formatter={(v) => <span style={{ color: '#9CA3AF' }}>{v}</span>} />
                <Bar  dataKey="receita_projetada"   name="Receita"    fill="#12F0C6" fillOpacity={0.8} radius={[3,3,0,0]} maxBarSize={28} />
                <Bar  dataKey="despesa_projetada"   name="Despesa"    fill="#6366F1" fillOpacity={0.7} radius={[3,3,0,0]} maxBarSize={28} />
                <Line dataKey="resultado_acumulado" name="Acumulado"  stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} type="monotone" />
              </ComposedChart>
            </ResponsiveContainer>
          </Card>

          {/* Cenários CRM */}
          <Card title="Cenários CRM — R$ 100/cliente" subtitle="Impacto de novos clientes no módulo CRM">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {crm.map((c) => (
                <div key={c.clientes}
                     className="rounded-lg border p-4 text-center"
                     style={{ background: '#1A1E21', borderColor: 'rgba(18,240,198,0.15)' }}>
                  <div className="w-10 h-10 rounded-full mx-auto mb-3 flex items-center justify-center"
                       style={{ background: 'rgba(18,240,198,0.10)' }}>
                    <Users size={18} style={{ color: '#12F0C6' }} />
                  </div>
                  <p className="text-xs text-gray-400 mb-1">{c.clientes} clientes</p>
                  <p className="text-lg font-bold" style={{ color: '#12F0C6' }}>{formatCompact(c.receita_mensal_extra)}<span className="text-xs text-gray-500">/mês</span></p>
                  <p className="text-xs text-gray-500 mt-1">Total {prm.meses}m: <span className="text-white">{formatCompact(c.receita_total_periodo)}</span></p>
                </div>
              ))}
            </div>
          </Card>

          {/* Tabela detalhada */}
          <Card title="Detalhe Mês a Mês" subtitle="Valores projetados">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                    {['Mês', 'Receita', 'Despesa', 'Resultado', 'Margem', 'Acumulado'].map((h) => (
                      <th key={h} className="text-left py-2 pr-4 text-gray-500 font-medium uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {projecoes.map((p, i) => (
                    <tr key={i} className="border-b hover:bg-white/[0.02]" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                      <td className="py-2.5 pr-4 font-medium text-gray-300">{p.mes}</td>
                      <td className="py-2.5 pr-4 text-white">{formatCompact(p.receita_projetada)}</td>
                      <td className="py-2.5 pr-4 text-gray-300">{formatCompact(p.despesa_projetada)}</td>
                      <td className="py-2.5 pr-4 font-semibold" style={{ color: p.resultado_projetado >= 0 ? '#12F0C6' : '#EF4444' }}>
                        {formatCompact(p.resultado_projetado)}
                      </td>
                      <td className="py-2.5 pr-4" style={{ color: p.margem_pct >= 25 ? '#12F0C6' : '#F59E0B' }}>
                        {String(p.margem_pct.toFixed(1)).replace('.', ',')}%
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-white">{formatCompact(p.resultado_acumulado)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
