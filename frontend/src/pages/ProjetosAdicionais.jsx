import { useState } from 'react'
import { Plus, Search, RefreshCw, Edit2, Trash2 } from 'lucide-react'
import { useProjetosAdicionais } from '../hooks/useFinanceiro'
import { projetosAdicionaisAPI } from '../services/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/modals/Modal'
import { formatCurrency, formatCompact } from '../utils/formatters'

const TIPO_OPTS = [
  { value: 'lp',           label: 'Landing Page'    },
  { value: 'apresentacao', label: 'Apresentação'    },
  { value: 'site',         label: 'Site'            },
  { value: 'comercial',    label: 'Comercial'       },
  { value: 'outro',        label: 'Outro'           },
]
const TIPO_LABEL = { lp: 'Landing Page', apresentacao: 'Apresentação', site: 'Site', comercial: 'Comercial', outro: 'Outro' }

const STATUS_OPTS = [
  { value: 'pendente',  label: 'Pendente'   },
  { value: 'pago',      label: 'Pago'       },
  { value: 'em_aberto', label: 'Em Aberto'  },
  { value: 'parcial',   label: 'Parcial'    },
]
const STATUS_BADGE = { pago: 'success', pendente: 'warning', em_aberto: 'neutral', parcial: 'info' }

const EMPTY = {
  cliente: '', tipo: 'lp', nome: '', valor: '', competencia: '',
  data_vencimento: '', status_pagamento: 'pendente', data_recebimento: '', observacoes: '',
}

export default function ProjetosAdicionais() {
  const { data, loading, error, refetch } = useProjetosAdicionais()
  const [search, setSearch]         = useState('')
  const [filtroMes, setFiltroMes]   = useState('')
  const [filtroStatus, setStatus]   = useState('todos')
  const [modalOpen, setModal]       = useState(false)
  const [editTarget, setEdit]       = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const [deleting, setDeleting]     = useState(null)
  const [form, setForm]             = useState(EMPTY)
  const [saving, setSaving]         = useState(false)
  const [formErr, setFormErr]       = useState('')

  const projetos      = data?.projetos ?? []
  const competencias  = [...new Set(projetos.map(p => p.competencia).filter(Boolean))].sort()

  const filtered = projetos.filter(p => {
    const q = search.toLowerCase()
    return (
      (!q || p.cliente?.toLowerCase().includes(q) || p.nome?.toLowerCase().includes(q)) &&
      (!filtroMes || p.competencia === filtroMes) &&
      (filtroStatus === 'todos' || p.status_pagamento === filtroStatus)
    )
  })

  const totalFiltrado = filtered.reduce((s, p) => s + (p.valor ?? 0), 0)
  const porCliente    = filtered.reduce((acc, p) => ({ ...acc, [p.cliente]: (acc[p.cliente] || 0) + (p.valor ?? 0) }), {})

  const openCreate = () => { setEdit(null); setForm(EMPTY); setFormErr(''); setModal(true) }
  const openEdit   = (p) => {
    setEdit(p)
    setForm({ ...EMPTY, ...p, valor: p.valor ?? '', data_vencimento: p.data_vencimento ?? '', data_recebimento: p.data_recebimento ?? '' })
    setFormErr(''); setModal(true)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.cliente.trim()) { setFormErr('Cliente é obrigatório.'); return }
    if (!form.nome.trim())    { setFormErr('Nome é obrigatório.'); return }
    setSaving(true)
    try {
      const payload = { ...form, valor: form.valor === '' ? 0 : Number(form.valor) }
      editTarget ? await projetosAdicionaisAPI.update(editTarget.id, payload)
                 : await projetosAdicionaisAPI.create(payload)
      setModal(false); refetch()
    } catch (e) {
      setFormErr(e?.response?.data?.detail || 'Erro ao salvar.')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try { await projetosAdicionaisAPI.remove(id); setConfirmDel(null); refetch() }
    finally { setDeleting(null) }
  }

  const marcarPago = async (p) => {
    await projetosAdicionaisAPI.update(p.id, {
      status_pagamento: 'pago',
      data_recebimento: new Date().toISOString().slice(0, 10),
    })
    refetch()
  }

  if (loading) return <LoadingSpinner label="Carregando projetos..." />
  if (error)   return <p className="text-red-400 text-sm">{error}</p>

  return (
    <div className="space-y-6 animate-fade-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiMini label="Total Geral"    value={formatCompact(data?.total ?? 0)}          color="#12F0C6" />
        <KpiMini label="Filtro Ativo"   value={formatCompact(totalFiltrado)}             color="#8B5CF6" />
        <KpiMini label="Total Pago"     value={formatCompact(data?.total_pago ?? 0)}     color="#10B981" />
        <KpiMini label="Total Pendente" value={formatCompact(data?.total_pendente ?? 0)} color="#F59E0B" />
      </div>

      {/* Tabela principal */}
      <Card
        title="Projetos Adicionais"
        subtitle={`${filtered.length} de ${projetos.length} projetos`}
        action={<Button variant="primary" size="sm" onClick={openCreate}><Plus size={13} /> Novo Projeto</Button>}
      >
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50 placeholder:text-gray-600"
              placeholder="Buscar por cliente ou nome..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
            className="text-xs rounded-lg px-3 py-2 outline-none"
            style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.10)', color: '#fff' }}>
            <option value="">Todas as competências</option>
            {competencias.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="flex gap-2 flex-wrap">
            {['todos','pago','pendente','em_aberto','parcial'].map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
                style={filtroStatus === s ? { background: '#12F0C6', color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }}>
                {s === 'todos' ? 'Todos' : s === 'em_aberto' ? 'Em Aberto' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={refetch}><RefreshCw size={13} /></Button>
        </div>

        {filtered.length === 0 ? <EmptyState title="Nenhum projeto encontrado" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {['Cliente','Tipo','Nome / Descrição','Competência','Valor','Vencimento','Status','Recebimento','Ações'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-b hover:bg-white/3 transition-colors"
                      style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <td className="py-3 px-3 font-medium text-white whitespace-nowrap">{p.cliente}</td>
                    <td className="py-3 px-3"><Badge variant="info">{TIPO_LABEL[p.tipo] ?? p.tipo}</Badge></td>
                    <td className="py-3 px-3 text-gray-300 max-w-xs truncate">{p.nome}</td>
                    <td className="py-3 px-3 text-gray-400">{p.competencia || '—'}</td>
                    <td className="py-3 px-3 font-semibold" style={{ color: '#12F0C6' }}>{formatCurrency(p.valor)}</td>
                    <td className="py-3 px-3 text-gray-400">{p.data_vencimento || '—'}</td>
                    <td className="py-3 px-3">
                      <Badge variant={STATUS_BADGE[p.status_pagamento] ?? 'neutral'} dot>
                        {STATUS_OPTS.find(o => o.value === p.status_pagamento)?.label ?? p.status_pagamento}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-gray-400">{p.data_recebimento || '—'}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        {p.status_pagamento !== 'pago' && (
                          <button onClick={() => marcarPago(p)}
                            className="px-2 py-1 rounded-md text-[10px] font-semibold text-black whitespace-nowrap"
                            style={{ background: '#12F0C6' }}>Pago</button>
                        )}
                        <button onClick={() => openEdit(p)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-[#12F0C6] hover:bg-[#12F0C6]/10 transition-colors">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => setConfirmDel(p)}
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

      {/* Resumo por cliente */}
      {Object.keys(porCliente).length > 0 && (
        <Card title="Total por Cliente" subtitle="Soma dos projetos no filtro ativo">
          <div className="space-y-2">
            {Object.entries(porCliente).sort((a, b) => b[1] - a[1]).map(([cli, val]) => (
              <div key={cli} className="flex items-center justify-between py-1.5 border-b last:border-0"
                   style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <span className="text-sm text-white">{cli}</span>
                <span className="text-sm font-semibold" style={{ color: '#12F0C6' }}>{formatCurrency(val)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-gray-400">Total</span>
              <span className="text-sm font-bold text-white">{formatCurrency(totalFiltrado)}</span>
            </div>
          </div>
        </Card>
      )}

      {/* Modal criar/editar */}
      <Modal open={modalOpen} onClose={() => setModal(false)}
             title={editTarget ? 'Editar Projeto' : 'Novo Projeto Adicional'} maxWidth="max-w-lg">
        <div className="space-y-4">
          {formErr && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formErr}</p>}
          <Field label="Cliente *">
            <input className={IC} value={form.cliente} onChange={e => set('cliente', e.target.value)} placeholder="Nome do cliente" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Tipo">
              <select className={IC} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                {TIPO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Competência (AAAA-MM)">
              <input className={IC} value={form.competencia} onChange={e => set('competencia', e.target.value)} placeholder="2026-03" />
            </Field>
          </div>
          <Field label="Nome / Descrição *">
            <input className={IC} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Landing Page Campanha Verão" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor (R$)">
              <input className={IC} type="number" min="0" step="0.01" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="0,00" />
            </Field>
            <Field label="Status Pagamento">
              <select className={IC} value={form.status_pagamento} onChange={e => set('status_pagamento', e.target.value)}>
                {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data de Vencimento">
              <input className={IC} type="date" value={form.data_vencimento} onChange={e => set('data_vencimento', e.target.value)} />
            </Field>
            <Field label="Data de Recebimento">
              <input className={IC} type="date" value={form.data_recebimento} onChange={e => set('data_recebimento', e.target.value)} />
            </Field>
          </div>
          <Field label="Observações">
            <textarea className={IC + ' resize-none'} rows={2} value={form.observacoes} onChange={e => set('observacoes', e.target.value)} placeholder="..." />
          </Field>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="ghost" onClick={() => setModal(false)} disabled={saving}>Cancelar</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : editTarget ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm delete */}
      {confirmDel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
               style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p className="text-sm font-semibold text-white">Remover projeto?</p>
            <p className="text-xs text-gray-400">Tem certeza que deseja remover <span className="text-white font-medium">{confirmDel.nome}</span>?</p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" size="sm" onClick={() => setConfirmDel(null)}>Cancelar</Button>
              <button onClick={() => handleDelete(confirmDel.id)} disabled={!!deleting}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: '#EF4444', color: '#fff' }}>
                {deleting === confirmDel.id ? 'Removendo...' : 'Remover'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiMini({ label, value, color }) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ background: '#272C30', border: '1px solid rgba(255,255,255,0.07)' }}>
      <span className="text-xs text-gray-400">{label}</span>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-gray-400">{label}</label>
      {children}
    </div>
  )
}

const IC = 'w-full px-3 py-2 rounded-lg text-sm text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50 focus:ring-1 focus:ring-[#12F0C6]/20 placeholder:text-gray-600 transition-colors'
