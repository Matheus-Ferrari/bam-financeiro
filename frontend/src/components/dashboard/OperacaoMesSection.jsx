import { useMemo, useState } from 'react'
import { Wallet, ArrowDownCircle, ArrowUpCircle, CalendarClock, RefreshCw, Save } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { financeiroAPI } from '../../services/api'
import { formatCompact, formatCurrency } from '../../utils/formatters'

export default function OperacaoMesSection({ data, loading, onRefresh }) {
  const [caixaInput, setCaixaInput] = useState('')
  const [obs, setObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const stats = useMemo(() => {
    if (!data) return []
    return [
      { label: 'Caixa Atual', value: formatCompact(data.caixa_atual), icon: Wallet, color: '#12F0C6' },
      { label: 'A Receber (Mês)', value: formatCompact(data.total_pendente_recebimento), icon: ArrowDownCircle, color: '#F59E0B' },
      { label: 'A Pagar (Mês)', value: formatCompact(data.total_pendente_pagamento), icon: ArrowUpCircle, color: '#EF4444' },
      { label: 'Saldo Projetado', value: formatCompact(data.saldo_projetado_mes), icon: CalendarClock, color: '#6366F1' },
    ]
  }, [data])

  const handleSaveCaixa = async () => {
    const sanitized = (caixaInput || '').replace(/\./g, '').replace(',', '.')
    const valor = Number(sanitized)
    if (!Number.isFinite(valor)) {
      setErr('Informe um valor de caixa válido.')
      return
    }

    setErr('')
    setSaving(true)
    try {
      await financeiroAPI.updateCaixa({ valor_atual: valor, observacao: obs })
      setCaixaInput('')
      setObs('')
      if (typeof onRefresh === 'function') onRefresh()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Não foi possível atualizar o caixa.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card title="Operação do Mês" subtitle="Carregando visão operacional">
        <p className="text-sm text-gray-500">Buscando dados operacionais...</p>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Operação do Mês</h2>
          <p className="text-xs text-gray-500 mt-0.5">Conferência diária de receber, pagar e caixa</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          <RefreshCw size={13} /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((item) => {
          const Icon = item.icon
          return (
            <div key={item.label} className="rounded-xl border p-4" style={{ background: '#272C30', borderColor: 'rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <Icon size={14} style={{ color: item.color }} />
                <span>{item.label}</span>
              </div>
              <p className="text-xl font-bold mt-2" style={{ color: item.color }}>{item.value}</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Caixa Atual" subtitle="Atualize manualmente com histórico">
          <div className="space-y-3">
            <div className="text-xs text-gray-400">
              <p>Caixa atual: <span className="text-white font-semibold">{formatCurrency(data?.caixa_atual ?? 0)}</span></p>
            </div>
            <input
              value={caixaInput}
              onChange={(e) => setCaixaInput(e.target.value)}
              placeholder="Novo valor de caixa"
              className="w-full px-3 py-2 rounded-lg text-sm text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50"
            />
            <input
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              placeholder="Motivo/observação (opcional)"
              className="w-full px-3 py-2 rounded-lg text-sm text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50"
            />
            {err && <p className="text-xs text-red-400">{err}</p>}
            <Button variant="primary" size="sm" onClick={handleSaveCaixa} disabled={saving}>
              <Save size={13} /> {saving ? 'Salvando...' : 'Salvar caixa'}
            </Button>
          </div>
        </Card>

        <Card title="Clientes" subtitle="Pagos e pendentes no mês" className="lg:col-span-1">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Pagos</span>
              <Badge variant="success">{data?.clientes_pagos?.length ?? 0}</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Pendentes</span>
              <Badge variant="warning">{data?.clientes_pendentes?.length ?? 0}</Badge>
            </div>
            <div className="max-h-36 overflow-auto pr-1 space-y-1.5">
              {(data?.quem_falta_pagar ?? []).slice(0, 8).map((c) => (
                <div key={c.id} className="text-xs rounded-md px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <p className="text-white truncate">{c.nome}</p>
                  <p className="text-gray-500">{formatCurrency(c.valor_previsto ?? c.valor_mensal ?? 0)}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card title="Receber x Pagar" subtitle="Conferência operacional" className="lg:col-span-1">
          <div className="space-y-2.5 text-xs">
            <Row label="Previsto de receitas" value={formatCurrency(data?.total_previsto_receitas_mes ?? 0)} />
            <Row label="Recebido" value={formatCurrency(data?.total_recebido_mes ?? 0)} />
            <Row label="Pendente de recebimento" value={formatCurrency(data?.total_pendente_recebimento ?? 0)} />
            <Row label="Previsto de despesas" value={formatCurrency(data?.total_previsto_despesas_mes ?? 0)} />
            <Row label="Pago" value={formatCurrency(data?.total_pago_mes ?? 0)} />
            <Row label="Pendente de pagamento" value={formatCurrency(data?.total_pendente_pagamento ?? 0)} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title="Movimentações Recentes" subtitle="Entradas, saídas e ajustes manuais">
          <div className="max-h-56 overflow-auto space-y-2 pr-1">
            {(data?.movimentacoes_recentes ?? []).slice(0, 12).map((m) => (
              <MovItem key={m.id} item={m} />
            ))}
            {(data?.movimentacoes_recentes ?? []).length === 0 && (
              <p className="text-xs text-gray-500">Sem movimentações recentes.</p>
            )}
          </div>
        </Card>

        <Card title="Últimos Registros Manuais" subtitle="Histórico de Atualização Rápida">
          <div className="max-h-56 overflow-auto space-y-2 pr-1">
            {(data?.ultimos_registros_manuais ?? []).slice(0, 12).map((m) => (
              <div key={m.id} className="rounded-md px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <p className="text-xs text-white truncate">{m.input || m.parsed?.descricao || 'Atualização manual'}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{(m.created_at || '').replace('T', ' ').slice(0, 16)}</p>
              </div>
            ))}
            {(data?.ultimos_registros_manuais ?? []).length === 0 && (
              <p className="text-xs text-gray-500">Sem registros manuais.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-md px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <span className="text-gray-400">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  )
}

function MovItem({ item }) {
  const tipo = String(item?.tipo || '').toLowerCase()
  const isEntrada = tipo === 'entrada' || tipo === 'recebimento'
  const tone = isEntrada ? '#12F0C6' : (tipo === 'ajuste_caixa' ? '#6366F1' : '#EF4444')

  return (
    <div className="rounded-md px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-white truncate">{item.descricao || 'Movimentação'}</p>
        <span className="text-xs font-semibold" style={{ color: tone }}>{formatCurrency(item.valor || 0)}</span>
      </div>
      <p className="text-[11px] text-gray-500 mt-0.5">
        {(item.data || '').replace('T', ' ').slice(0, 16)} · {item.tipo || 'manual'}
      </p>
    </div>
  )
}
