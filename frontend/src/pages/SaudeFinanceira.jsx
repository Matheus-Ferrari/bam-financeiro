import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Info, TrendingUp, TrendingDown, Users, Clock, BarChart2, PieChart, Scissors } from 'lucide-react'
import { useSaude, useInsights, useResumo } from '../hooks/useFinanceiro'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { formatCompact, formatPercent } from '../utils/formatters'

// ── Ícones por nome (vindo do backend) ────────────────────────────────────
const ICON_MAP = {
  TrendingUp, TrendingDown, Users, Clock, BarChart2, CheckCircle,
  PieChart, Scissors, AlertTriangle, XCircle, Info,
}

const NIVEL_CONFIG = {
  critico: { label: 'Crítico',    color: '#EF4444', bg: 'rgba(239,68,68,0.08)'    },
  alto:    { label: 'Alto',       color: '#F97316', bg: 'rgba(249,115,22,0.08)'   },
  medio:   { label: 'Médio',      color: '#F59E0B', bg: 'rgba(245,158,11,0.08)'   },
  baixo:   { label: 'Baixo',      color: '#10B981', bg: 'rgba(16,185,129,0.08)'   },
}

const SEMAFORO_CFG = {
  verde:    { label: 'Saudável',  color: '#12F0C6', glow: '#12F0C6', emoji: '✅' },
  amarelo:  { label: 'Atenção',   color: '#F59E0B', glow: '#F59E0B', emoji: '⚠️' },
  vermelho: { label: 'Crítico',   color: '#EF4444', glow: '#EF4444', emoji: '🔴' },
}

const INSIGHT_CONFIG = {
  positive: { color: '#12F0C6', bg: 'rgba(18,240,198,0.06)',   border: 'rgba(18,240,198,0.15)' },
  warning:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.06)',   border: 'rgba(245,158,11,0.15)' },
  info:     { color: '#6366F1', bg: 'rgba(99,102,241,0.06)',   border: 'rgba(99,102,241,0.15)' },
  error:    { color: '#EF4444', bg: 'rgba(239,68,68,0.06)',    border: 'rgba(239,68,68,0.15)'  },
}

export default function SaudeFinanceira() {
  const saude    = useSaude()
  const insights = useInsights()
  const resumo   = useResumo()

  const s    = saude.data
  const ins  = insights.data?.insights ?? []
  const meses = resumo.data?.meses ?? []

  const refetchAll = () => { saude.refetch(); insights.refetch(); resumo.refetch() }

  if (saude.loading) return <LoadingSpinner label="Calculando saúde financeira..." />
  if (saude.error)   return <p className="text-red-400 text-sm">{saude.error}</p>

  const sem   = SEMAFORO_CFG[s.semaforo] ?? SEMAFORO_CFG.vermelho
  const score = s.score ?? 0

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <p className="text-gray-400 text-sm">
          Diagnóstico automático · <span style={{ color: sem.color }}>{sem.emoji} {sem.label}</span>
        </p>
        <Button variant="ghost" size="sm" onClick={refetchAll}>
          <RefreshCw size={13} /> Atualizar
        </Button>
      </div>

      {/* Score + Semáforo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Score card */}
        <div
          className="lg:col-span-1 rounded-2xl p-6 flex flex-col items-center justify-center gap-4 relative overflow-hidden"
          style={{ background: '#272C30', border: `1px solid ${sem.color}25` }}
        >
          {/* Glow */}
          <div className="absolute inset-0 opacity-5 pointer-events-none"
               style={{ background: `radial-gradient(circle at 50% 50%, ${sem.glow}, transparent 70%)` }} />

          {/* Score ring */}
          <ScoreRing score={score} color={sem.color} />
          <div className="text-center">
            <p className="text-white font-bold text-lg">{sem.label}</p>
            <p className="text-gray-500 text-xs mt-0.5">Score de Saúde Financeira</p>
          </div>
        </div>

        {/* KPIs rápidos */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Receita Total',    value: formatCompact(s.total_receita),    color: '#12F0C6' },
            { label: 'Despesa Total',    value: formatCompact(s.total_despesa),    color: '#6366F1' },
            { label: 'Resultado',        value: formatCompact(s.resultado),        color: s.resultado >= 0 ? '#12F0C6' : '#EF4444' },
            { label: 'Margem Líquida',   value: formatPercent(s.margem_pct),       color: s.margem_pct >= 10 ? '#F59E0B' : '#EF4444' },
            { label: 'Comprometimento',  value: `${s.equilibrio_pct}%`,            color: s.equilibrio_pct < 90 ? '#12F0C6' : '#EF4444' },
            { label: 'A Receber',        value: formatCompact(s.a_receber),        color: '#8B5CF6' },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-4 text-center"
                 style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.05)' }}>
              <p className="text-[10px] text-gray-500 mb-1">{item.label}</p>
              <p className="text-base font-bold" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Riscos */}
      {s.riscos?.length > 0 && (
        <Card title="Riscos Identificados" subtitle={`${s.riscos.length} risco(s) detectado(s)`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {s.riscos.map((r, i) => {
              const cfg  = NIVEL_CONFIG[r.nivel] ?? NIVEL_CONFIG.baixo
              const Icon = ICON_MAP[r.icone] ?? AlertTriangle
              return (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl"
                     style={{ background: cfg.bg, border: `1px solid ${cfg.color}20` }}>
                  <Icon size={15} style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white">{r.titulo}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                            style={{ background: `${cfg.color}20`, color: cfg.color }}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">{r.descricao}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Recomendações + Top Clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Recomendações" subtitle="Ações sugeridas para melhoria">
          <ul className="space-y-2 mt-2">
            {s.recomendacoes?.map((rec, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                      style={{ background: 'rgba(18,240,198,0.12)', color: '#12F0C6' }}>
                  {i + 1}
                </span>
                <span className="text-gray-300 leading-relaxed">{rec}</span>
              </li>
            ))}
          </ul>
        </Card>

        {s.concentracao_cliente?.top_clientes?.length > 0 && (
          <Card title="Concentração de Receita" subtitle="Top clientes por participação">
            <div className="space-y-3 mt-2">
              {s.concentracao_cliente.top_clientes.map((c, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <span className="w-5 text-gray-600 font-mono">{i + 1}.</span>
                  <span className="flex-1 text-gray-300 truncate">{c.cliente}</span>
                  <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full" style={{ width: `${c.pct}%`, background: '#12F0C6' }} />
                  </div>
                  <span className="w-10 text-right font-semibold" style={{ color: '#12F0C6' }}>{c.pct}%</span>
                </div>
              ))}
              <p className="text-[10px] text-gray-600 pt-1">
                Top 3 concentram {s.concentracao_cliente.concentracao_top3_pct}% da receita
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Insights */}
      {ins.length > 0 && (
        <Card title="Insights Automáticos" subtitle={`${ins.length} análise(s) gerada(s)`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2">
            {ins.map((item, i) => {
              const cfg  = INSIGHT_CONFIG[item.tipo] ?? INSIGHT_CONFIG.info
              const Icon = ICON_MAP[item.icone] ?? Info
              return (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl"
                     style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}>
                  <Icon size={14} style={{ color: cfg.color, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p className="text-xs font-semibold text-white mb-0.5">{item.titulo}</p>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{item.descricao}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Evolução Mensal */}
      {meses.length > 0 && (
        <Card title="Evolução Mensal" subtitle="Receita, despesa e resultado por competência">
          <div className="overflow-x-auto mt-2">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5">
                  {['Mês', 'Receita', 'Despesa', 'Resultado', 'Margem'].map(h => (
                    <th key={h} className="text-left text-gray-500 font-medium pb-2 pr-4 last:pr-0">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {meses.map((m, i) => {
                  const pos = (m.resultado ?? 0) >= 0
                  const margem = m.margem_pct ?? (m.receita ? ((m.resultado ?? 0) / m.receita) * 100 : 0)
                  return (
                    <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02]">
                      <td className="py-2.5 pr-4 text-gray-300 font-medium">{m.mes}</td>
                      <td className="py-2.5 pr-4" style={{ color: '#12F0C6' }}>{formatCompact(m.receita)}</td>
                      <td className="py-2.5 pr-4" style={{ color: '#6366F1' }}>{formatCompact(m.despesa)}</td>
                      <td className="py-2.5 pr-4 font-semibold" style={{ color: pos ? '#12F0C6' : '#EF4444' }}>
                        {pos ? '+' : ''}{formatCompact(m.resultado ?? 0)}
                      </td>
                      <td className="py-2.5 font-semibold" style={{ color: margem >= 10 ? '#12F0C6' : margem >= 0 ? '#F59E0B' : '#EF4444' }}>
                        {margem.toFixed(1)}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {meses.length > 1 && (() => {
                const totR = meses.reduce((s, m) => s + m.receita, 0)
                const totD = meses.reduce((s, m) => s + m.despesa, 0)
                const totRes = totR - totD
                const totMarg = totR ? (totRes / totR) * 100 : 0
                return (
                  <tfoot>
                    <tr className="border-t border-white/10">
                      <td className="pt-3 text-gray-500 font-semibold">Total</td>
                      <td className="pt-3 font-semibold" style={{ color: '#12F0C6' }}>{formatCompact(totR)}</td>
                      <td className="pt-3 font-semibold" style={{ color: '#6366F1' }}>{formatCompact(totD)}</td>
                      <td className="pt-3 font-bold" style={{ color: totRes >= 0 ? '#12F0C6' : '#EF4444' }}>
                        {totRes >= 0 ? '+' : ''}{formatCompact(totRes)}
                      </td>
                      <td className="pt-3 font-bold" style={{ color: totMarg >= 10 ? '#12F0C6' : totMarg >= 0 ? '#F59E0B' : '#EF4444' }}>
                        {totMarg.toFixed(1)}%
                      </td>
                    </tr>
                  </tfoot>
                )
              })()}
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Score ring em SVG ──────────────────────────────────────────────────────
function ScoreRing({ score, color }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ

  return (
    <div className="relative w-36 h-36 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" width={144} height={144}>
        <circle cx={72} cy={72} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={10} />
        <circle
          cx={72} cy={72} r={r} fill="none"
          stroke={color}
          strokeWidth={10}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 8px ${color}88)`, transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div className="relative text-center">
        <p className="text-3xl font-bold text-white">{score}</p>
        <p className="text-[10px] text-gray-500">/100</p>
      </div>
    </div>
  )
}
