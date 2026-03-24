import { useState } from 'react'
import { Users, Plus, Search, RefreshCw, Edit2, Trash2, DollarSign, CheckCircle, TrendingUp } from 'lucide-react'
import { useClientes } from '../hooks/useFinanceiro'
import { clientesAPI } from '../services/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import ModalCliente from '../components/modals/ModalCliente'
import { formatCompact } from '../utils/formatters'

const STATUS_BADGE = {
  ativo:     'success',
  inativo:   'error',
  prospecto: 'warning',
}

const STATUS_PGTO_BADGE = {
  pago: 'success',
  pendente: 'warning',
}

const TIPO_LABEL = {
  recorrente: 'Recorrente',
  pontual:    'Pontual',
  projeto:    'Projeto',
}

export default function Clientes() {
  const { data, loading, error, refetch } = useClientes()
  const [search, setSearch]         = useState('')
  const [statusFiltro, setStatus]   = useState('todos')
  const [modalOpen, setModalOpen]   = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleting, setDeleting]     = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [updatingPgto, setUpdatingPgto] = useState(null)

  const clientes = data?.clientes ?? []
  const resumo   = data?.resumo   ?? {}

  const filtered = clientes.filter(c => {
    const matchStatus = statusFiltro === 'todos' || c.status === statusFiltro
    const q = search.toLowerCase()
    const matchSearch = !q ||
      c.nome?.toLowerCase().includes(q) ||
      c.responsavel?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  // ── CRUD handlers ──────────────────────────────────────────

  const handleSave = async (formData) => {
    if (editTarget) {
      await clientesAPI.update(editTarget.id, formData)
    } else {
      await clientesAPI.create(formData)
    }
    refetch()
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try {
      await clientesAPI.remove(id)
      setConfirmDel(null)
      refetch()
    } finally {
      setDeleting(null)
    }
  }

  const handlePagamento = async (cliente, status) => {
    setUpdatingPgto(cliente.id)
    try {
      const agora = new Date().toISOString()
      await clientesAPI.update(cliente.id, {
        status_pagamento: status,
        data_pagamento: status === 'pago' ? agora : null,
        valor_recebido: status === 'pago'
          ? (cliente.valor_recebido || cliente.valor_previsto || cliente.valor_mensal || 0)
          : (cliente.valor_recebido || 0),
        mes_referencia_pagamento: new Date().toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      })
      refetch()
    } finally {
      setUpdatingPgto(null)
    }
  }

  const openCreate = () => { setEditTarget(null); setModalOpen(true) }
  const openEdit = (c) => { setEditTarget(c); setModalOpen(true) }

  // ── Render ──────────────────────────────────────────────────

  if (loading) return <LoadingSpinner label="Carregando clientes..." />
  if (error)   return <p className="text-red-400 text-sm">{error}</p>

  return (
    <div className="space-y-6 animate-fade-in">

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <KpiMini
          icon={<Users size={15} style={{ color: '#12F0C6' }} />}
          label="Total de Clientes"
          value={resumo.total ?? 0}
          color="#12F0C6"
        />
        <KpiMini
          icon={<CheckCircle size={15} style={{ color: '#10B981' }} />}
          label="Clientes Ativos"
          value={resumo.ativos ?? 0}
          color="#10B981"
        />
        <KpiMini
          icon={<DollarSign size={15} style={{ color: '#6366F1' }} />}
          label="Previsto Receber"
          value={formatCompact(resumo.total_previsto_receber ?? resumo.receita_mensal_estimada ?? 0)}
          color="#6366F1"
        />
        <KpiMini
          icon={<TrendingUp size={15} style={{ color: '#F59E0B' }} />}
          label="Recebido"
          value={formatCompact(resumo.total_recebido ?? 0)}
          color="#F59E0B"
        />
        <KpiMini
          icon={<CheckCircle size={15} style={{ color: '#12F0C6' }} />}
          label="Pagos"
          value={resumo.pagos_mes ?? 0}
          color="#12F0C6"
        />
        <KpiMini
          icon={<Users size={15} style={{ color: '#EF4444' }} />}
          label="Pendentes"
          value={resumo.pendentes_mes ?? 0}
          color="#EF4444"
        />
      </div>

      {/* Tabela */}
      <Card
        title="Base de Clientes"
        subtitle={`${filtered.length} de ${clientes.length} clientes`}
        action={
          <Button variant="primary" size="sm" onClick={openCreate}>
            <Plus size={13} /> Novo Cliente
          </Button>
        }
      >
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50 placeholder:text-gray-600"
              placeholder="Buscar por nome ou responsável..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex gap-2">
            {['todos','ativo','inativo','prospecto'].map(s => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                  statusFiltro === s
                    ? 'text-black'
                    : 'text-gray-400 hover:text-white bg-white/5 hover:bg-white/10'
                }`}
                style={statusFiltro === s ? { background: '#12F0C6' } : {}}
              >
                {s === 'todos' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <Button variant="ghost" size="sm" onClick={refetch}>
            <RefreshCw size={13} />
          </Button>
        </div>

        {/* Lista */}
        {filtered.length === 0 ? (
          <EmptyState title="Nenhum cliente encontrado" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {['Nome', 'Status', 'Pagamento', 'Previsto', 'Recebido', 'Data Pagto', 'Responsável', 'Ações'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr
                    key={c.id}
                    className="border-b hover:bg-white/3 transition-colors"
                    style={{ borderColor: 'rgba(255,255,255,0.04)' }}
                  >
                    <td className="py-3 px-3">
                      <p className="font-medium text-white">{c.nome}</p>
                      {c.data_inicio && (
                        <p className="text-gray-600 text-[10px]">desde {c.data_inicio}</p>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={STATUS_BADGE[c.status] ?? 'neutral'} dot>
                        {c.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={STATUS_PGTO_BADGE[(c.status_pagamento || 'pendente').toLowerCase()] ?? 'warning'} dot>
                        {c.status_pagamento || 'pendente'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold" style={{ color: '#12F0C6' }}>
                        {formatCompact(c.valor_previsto ?? c.valor_mensal ?? 0)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-white">
                        {formatCompact(c.valor_recebido ?? 0)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-400">
                      {c.data_pagamento ? String(c.data_pagamento).slice(0, 10) : '—'}
                    </td>
                    <td className="py-3 px-3 text-gray-400">
                      {c.responsavel || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handlePagamento(c, 'pago')}
                          disabled={updatingPgto === c.id}
                          className="px-2 py-1 rounded-md text-[10px] font-semibold text-black"
                          style={{ background: '#12F0C6' }}
                        >
                          Pago
                        </button>
                        <button
                          onClick={() => handlePagamento(c, 'pendente')}
                          disabled={updatingPgto === c.id}
                          className="px-2 py-1 rounded-md text-[10px] font-semibold text-gray-300 border border-white/15"
                        >
                          Pendente
                        </button>
                        <button
                          onClick={() => openEdit(c)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-[#12F0C6] hover:bg-[#12F0C6]/10 transition-colors"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => setConfirmDel(c)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                        >
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

      {/* Modal criar/editar */}
      <ModalCliente
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        cliente={editTarget}
      />

      {/* Confirm delete */}
      {confirmDel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
        >
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
               style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-sm font-semibold text-white">Remover cliente?</p>
            <p className="text-xs text-gray-400">
              Tem certeza que deseja remover <span className="text-white font-medium">{confirmDel.nome}</span>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDel(null)} disabled={!!deleting}>
                Cancelar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                style={{ background: '#EF4444', color: '#fff' }}
                onClick={() => handleDelete(confirmDel.id)}
                disabled={!!deleting}
              >
                {deleting === confirmDel.id ? 'Removendo...' : 'Remover'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiMini({ icon, label, value, color }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: '#272C30', border: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}
