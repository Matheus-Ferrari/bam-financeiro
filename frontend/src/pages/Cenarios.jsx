import { useState } from 'react'
import { useCenarios, useCortes } from '../hooks/useFinanceiro'
import { cortesAPI } from '../services/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import ModalCorte from '../components/modals/ModalCorte'
import { formatCompact, formatPercent } from '../utils/formatters'
import { Scissors, AlertTriangle, Zap, Plus, Edit2, Trash2, RefreshCw } from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts'

const CENARIO_CONFIG = {
  conservador: { label: 'Conservador',  icon: Scissors,       color: '#12F0C6', desc: '-5%' },
  moderado:    { label: 'Moderado',     icon: AlertTriangle,  color: '#F59E0B', desc: '-12%' },
  agressivo:   { label: 'Agressivo',    icon: Zap,            color: '#EF4444', desc: '-22%' },
}

export default function Cenarios() {
  const { data, loading, error } = useCenarios()
  const cortesHook = useCortes()

  // ── Estado modal cortes ───────────────────────────────────────────
  const [modalCorteOpen, setModalCorteOpen] = useState(false)
  const [editCorte, setEditCorte]           = useState(null)
  const [confirmDel, setConfirmDel]         = useState(null)
  const [deleting, setDeleting]             = useState(null)

  const cortes  = cortesHook.data?.cortes  ?? []
  const resumoC = cortesHook.data?.resumo  ?? {}

  const handleSaveCorte = async (formData) => {
    if (editCorte) await cortesAPI.update(editCorte.id, formData)
    else           await cortesAPI.create(formData)
    cortesHook.refetch()
  }

  const handleDeleteCorte = async (id) => {
    setDeleting(id)
    try { await cortesAPI.remove(id); setConfirmDel(null); cortesHook.refetch() }
    finally { setDeleting(null) }
  }

  // ── Render principal ──────────────────────────────────────────────
  if (loading) return <LoadingSpinner label="Carregando cenários..." />
  if (error)   return <p className="text-red-400 text-sm">{error}</p>

  const base     = data?.base ?? {}
  const cenarios = data?.cenarios ?? {}

  // Radar data
  const radarData = Object.entries(cenarios).map(([key, c]) => ({
    cenario:    CENARIO_CONFIG[key]?.label ?? key,
    reducao:    c.reducao_pct,
    novaMargem: c.nova_margem_pct,
    impactoAnual: (c.impacto_anual / 1000),
  }))

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Baseline */}
      <Card title="Situação Atual (Base)" subtitle="Referência para os cenários">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Receita Atual',   value: formatCompact(base.receita_atual),   color: '#12F0C6' },
            { label: 'Despesa Atual',   value: formatCompact(base.despesa_atual),   color: '#6366F1' },
            { label: 'Resultado Atual', value: formatCompact(base.resultado_atual), color: base.resultado_atual >= 0 ? '#12F0C6' : '#EF4444' },
            { label: 'Margem Atual',    value: formatPercent(base.margem_atual_pct), color: '#F59E0B' },
          ].map((item) => (
            <div key={item.label} className="text-center p-4 rounded-lg" style={{ background: '#1A1E21' }}>
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className="text-xl font-bold" style={{ color: item.color }}>{item.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Cards de cenários */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {Object.entries(cenarios).map(([key, c]) => {
          const cfg  = CENARIO_CONFIG[key] ?? {}
          const Icon = cfg.icon ?? Scissors
          return (
            <div
              key={key}
              className="rounded-xl border p-5 space-y-4 relative overflow-hidden"
              style={{ background: '#272C30', borderColor: `${cfg.color}25` }}
            >
              {/* Glow */}
              <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-2xl opacity-10 pointer-events-none"
                   style={{ background: cfg.color, transform: 'translate(40%,-40%)' }} />

              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                     style={{ background: `${cfg.color}15` }}>
                  <Icon size={16} style={{ color: cfg.color }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{c.nome}</h3>
                  <p className="text-xs text-gray-500">{c.descricao}</p>
                </div>
              </div>

              {/* Métricas */}
              <div className="space-y-2 text-xs">
                <Row label="Redução de despesa"   value={`${cfg.desc} · ${formatCompact(c.reducao_valor)}`}  color={cfg.color} />
                <Row label="Nova despesa"          value={formatCompact(c.nova_despesa)}                        />
                <Row label="Novo resultado"        value={formatCompact(c.novo_resultado)}                      color={c.novo_resultado >= 0 ? '#12F0C6' : '#EF4444'} />
                <Row label="Nova margem"           value={formatPercent(c.nova_margem_pct)}                     color={cfg.color} />
                <Row label="Melhoria no resultado" value={`+${formatCompact(c.melhoria_resultado)}`}            color='#12F0C6' />
                <Row label="Impacto anual"         value={formatCompact(c.impacto_anual)}                       color={cfg.color} />
              </div>

              {/* Àreas sugeridas */}
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1.5">Áreas sugeridas</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.areas_sugeridas.map((area) => (
                    <span key={area} className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: `${cfg.color}12`, color: cfg.color }}>
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Comparação visual */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Comparativo — Novo Resultado" subtitle="Por cenário">
          <div className="space-y-3 mt-2">
            {[
              { label: 'Atual',       value: base.resultado_atual,        pct: 100, color: '#6B7280' },
              ...Object.entries(cenarios).map(([k, c]) => ({
                label: c.nome,
                value: c.novo_resultado,
                pct:   base.resultado_atual > 0 ? (c.novo_resultado / base.resultado_atual) * 100 : 0,
                color: CENARIO_CONFIG[k]?.color ?? '#9CA3AF',
              })),
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3 text-xs">
                <span className="w-28 text-gray-400">{item.label}</span>
                <div className="flex-1 h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <div className="h-full rounded-full transition-all"
                       style={{ width: `${Math.min(item.pct, 200)}%`, background: item.color, maxWidth: '100%' }} />
                </div>
                <span className="w-24 text-right font-semibold" style={{ color: item.color }}>
                  {formatCompact(item.value)}
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Impacto Anual" subtitle="Economia acumulada em 12 meses">
          <div className="space-y-3 mt-2">
            {Object.entries(cenarios).map(([key, c]) => {
              const cfg = CENARIO_CONFIG[key] ?? {}
              const Icon = cfg.icon ?? Scissors
              return (
                <div key={key} className="flex items-center gap-3 p-3 rounded-lg"
                     style={{ background: '#1A1E21' }}>
                  <Icon size={14} style={{ color: cfg.color }} />
                  <span className="flex-1 text-xs text-gray-300">{c.nome}</span>
                  <span className="text-sm font-bold" style={{ color: cfg.color }}>
                    {formatCompact(c.impacto_anual)}
                  </span>
                  <span className="text-xs text-gray-500">/ ano</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* ── Plano de Redução ─────────────────────────────────────────── */}
      <Card
        title="Plano de Redução de Gastos"
        subtitle="Cadastre e acompanhe cortes planejados"
        action={
          <Button variant="primary" size="sm" onClick={() => { setEditCorte(null); setModalCorteOpen(true) }}>
            <Plus size={13} /> Novo Corte
          </Button>
        }
      >
        {/* Resumo */}
        {cortes.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total de Cortes',     value: resumoC.total ?? 0,                         color: '#12F0C6' },
              { label: 'Ativos',              value: resumoC.ativos ?? 0,                        color: '#10B981' },
              { label: 'Econ. Mensal Ativa',  value: formatCompact(resumoC.economia_ativa ?? 0), color: '#F59E0B' },
              { label: 'Impacto em 12 meses', value: formatCompact(resumoC.impacto_12m ?? 0),    color: '#6366F1' },
            ].map(item => (
              <div key={item.label} className="text-center p-3 rounded-lg" style={{ background: '#1A1E21' }}>
                <p className="text-[10px] text-gray-500 mb-1">{item.label}</p>
                <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabela */}
        {cortesHook.loading ? <LoadingSpinner label="..." /> : cortes.length === 0 ? (
          <EmptyState title="Nenhum corte cadastrado ainda" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {['Descrição', 'Categoria', 'Economia/Mês', 'Status', 'Ativo', 'Ações'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cortes.map(c => (
                  <tr key={c.id} className="border-b hover:bg-white/3 transition-colors"
                      style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <td className="py-3 px-3 font-medium text-white">{c.descricao}</td>
                    <td className="py-3 px-3 text-gray-400">{c.categoria}</td>
                    <td className="py-3 px-3 font-bold" style={{ color: '#12F0C6' }}>
                      {formatCompact(c.economia_mensal)}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={
                        c.status === 'concluido'   ? 'success' :
                        c.status === 'em_execucao' ? 'info'    :
                        c.status === 'cancelado'   ? 'error'   : 'neutral'
                      }>
                        {c.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <span className="w-2 h-2 rounded-full inline-block mr-1.5"
                            style={{ background: c.ativo ? '#12F0C6' : '#6B7280' }} />
                      {c.ativo ? 'Sim' : 'Não'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { setEditCorte(c); setModalCorteOpen(true) }}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-[#12F0C6] hover:bg-[#12F0C6]/10 transition-colors">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => setConfirmDel(c)}
                                className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal corte */}
      <ModalCorte
        open={modalCorteOpen}
        onClose={() => setModalCorteOpen(false)}
        onSave={handleSaveCorte}
        corte={editCorte}
      />

      {/* Confirm delete corte */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
               style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-sm font-semibold text-white">Remover corte?</p>
            <p className="text-xs text-gray-400">
              Remover <span className="text-white font-medium">{confirmDel.descricao}</span>?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDel(null)} disabled={!!deleting}>Cancelar</Button>
              <Button variant="secondary" size="sm"
                      style={{ background: '#EF4444', color: '#fff' }}
                      onClick={() => handleDeleteCorte(confirmDel.id)} disabled={!!deleting}>
                {deleting === confirmDel.id ? 'Removendo...' : 'Remover'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Row({ label, value, color = '#9CA3AF' }) {
  return (
    <div className="flex justify-between items-center py-1 border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold" style={{ color }}>{value}</span>
    </div>
  )
}
