import { useState } from 'react'
import { Plus, Search, RefreshCw, Edit2, Trash2 } from 'lucide-react'
import { useComissoes } from '../hooks/useFinanceiro'
import { comissoesAPI } from '../services/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/modals/Modal'
import { formatCurrency, formatCompact } from '../utils/formatters'

const STATUS_BADGE = { pago: 'success', pendente: 'warning' }

const EMPTY = {
  nome: '', responsavel: '', regra: '', valor: '',
  competencia: '', status: 'pendente', observacoes: '',
}

export default function Comissoes() {
  const { data, loading, error, refetch } = useComissoes()
  const [search, setSearch]           = useState('')
  const [filtroResp, setFiltroResp]   = useState('')
  const [filtroMes, setFiltroMes]     = useState('')
  const [filtroStatus, setStatus]     = useState('todos')
  const [modalOpen, setModal]         = useState(false)
  const [editTarget, setEdit]         = useState(null)
  const [confirmDel, setConfirmDel]   = useState(null)
  const [deleting, setDeleting]       = useState(null)
  const [form, setForm]               = useState(EMPTY)
  const [saving, setSaving]           = useState(false)
  const [formErr, setFormErr]         = useState('')

  const comissoes    = data?.comissoes ?? []
  const competencias = [...new Set(comissoes.map(c => c.competencia).filter(Boolean))].sort()
  const responsaveis = [...new Set(comissoes.map(c => c.responsavel).filter(Boolean))].sort()

  const filtered = comissoes.filter(c => {
    const q = search.toLowerCase()
    return (
      (!q || c.nome?.toLowerCase().includes(q) || c.responsavel?.toLowerCase().includes(q)) &&
      (!filtroResp || c.responsavel === filtroResp) &&
      (!filtroMes  || c.competencia === filtroMes) &&
      (filtroStatus === 'todos' || c.status === filtroStatus)
    )
  })

  const totalFiltrado = filtered.reduce((s, c) => s + (c.valor ?? 0), 0)

  const openCreate = () => { setEdit(null); setForm(EMPTY); setFormErr(''); setModal(true) }
  const openEdit   = (c) => {
    setEdit(c)
    setForm({ ...EMPTY, ...c, valor: c.valor ?? '' })
    setFormErr(''); setModal(true)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nome.trim()) { setFormErr('Nome é obrigatório.'); return }
    setSaving(true)
    try {
      const payload = { ...form, valor: form.valor === '' ? 0 : Number(form.valor) }
      editTarget ? await comissoesAPI.update(editTarget.id, payload)
                 : await comissoesAPI.create(payload)
      setModal(false); refetch()
    } catch (e) {
      setFormErr(e?.response?.data?.detail || 'Erro ao salvar.')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try { await comissoesAPI.remove(id); setConfirmDel(null); refetch() }
    finally { setDeleting(null) }
  }

  const marcarPago = async (c) => {
    await comissoesAPI.update(c.id, { status: c.status === 'pago' ? 'pendente' : 'pago' })
    refetch()
  }

  if (loading) return <LoadingSpinner label="Carregando comissões..." />
  if (error)   return <p className="text-red-400 text-sm">{error}</p>

  return (
    <div className="space-y-6 animate-fade-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiMini label="Total Geral"    value={formatCompact(data?.total ?? 0)}          color="#8B5CF6" />
        <KpiMini label="Filtro Ativo"   value={formatCompact(totalFiltrado)}             color="#12F0C6" />
        <KpiMini label="Total Pago"     value={formatCompact(data?.total_pago ?? 0)}     color="#10B981" />
        <KpiMini label="Total Pendente" value={formatCompact(data?.total_pendente ?? 0)} color="#F59E0B" />
      </div>

      {/* Tabela */}
      <Card
        title="Comissões da Equipe"
        subtitle={`${filtered.length} de ${comissoes.length} registros`}
        action={<Button variant="primary" size="sm" onClick={openCreate}><Plus size={13} /> Nova Comissão</Button>}
      >
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50 placeholder:text-gray-600"
              placeholder="Buscar por nome ou responsável..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select value={filtroResp} onChange={e => setFiltroResp(e.target.value)}
            className="text-xs rounded-lg px-3 py-2 outline-none"
            style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.10)', color: '#fff' }}>
            <option value="">Todos os responsáveis</option>
            {responsaveis.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
            className="text-xs rounded-lg px-3 py-2 outline-none"
            style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.10)', color: '#fff' }}>
            <option value="">Todas as competências</option>
            {competencias.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="flex gap-2">
            {['todos','pago','pendente'].map(s => (
              <button key={s} onClick={() => setStatus(s)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors"
                style={filtroStatus === s ? { background: '#12F0C6', color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: '#9CA3AF' }}>
                {s === 'todos' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={refetch}><RefreshCw size={13} /></Button>
        </div>

        {filtered.length === 0 ? <EmptyState title="Nenhuma comissão encontrada" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {['Nome','Responsável','Regra / Descrição','Competência','Valor','Status','Observações','Ações'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id} className="border-b hover:bg-white/3 transition-colors"
                      style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <td className="py-3 px-3 font-medium text-white whitespace-nowrap">{c.nome}</td>
                    <td className="py-3 px-3 text-gray-300">{c.responsavel || '—'}</td>
                    <td className="py-3 px-3 text-gray-400 max-w-xs truncate">{c.regra || '—'}</td>
                    <td className="py-3 px-3 text-gray-400">{c.competencia || '—'}</td>
                    <td className="py-3 px-3 font-semibold" style={{ color: '#8B5CF6' }}>{formatCurrency(c.valor)}</td>
                    <td className="py-3 px-3">
                      <Badge variant={STATUS_BADGE[c.status] ?? 'neutral'} dot>
                        {c.status === 'pago' ? 'Pago' : 'Pendente'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-gray-500 max-w-xs truncate">{c.observacoes || '—'}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => marcarPago(c)}
                          className="px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap"
                          style={c.status === 'pago'
                            ? { background: 'rgba(255,255,255,0.1)', color: '#9CA3AF' }
                            : { background: '#12F0C6', color: '#000' }}>
                          {c.status === 'pago' ? 'Pendente' : 'Pago'}
                        </button>
                        <button onClick={() => openEdit(c)}
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

      {/* Modal */}
      <Modal open={modalOpen} onClose={() => setModal(false)}
             title={editTarget ? 'Editar Comissão' : 'Nova Comissão'} maxWidth="max-w-lg">
        <div className="space-y-4">
          {formErr && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formErr}</p>}
          <Field label="Nome *">
            <input className={IC} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: Bônus Edu — Vendas Cemitério" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Responsável">
              <input className={IC} value={form.responsavel} onChange={e => set('responsavel', e.target.value)} placeholder="Ex: Edu" />
            </Field>
            <Field label="Competência (AAAA-MM)">
              <input className={IC} value={form.competencia} onChange={e => set('competencia', e.target.value)} placeholder="2026-03" />
            </Field>
          </div>
          <Field label="Regra / Descrição">
            <textarea className={IC + ' resize-none'} rows={2} value={form.regra} onChange={e => set('regra', e.target.value)} placeholder="Descreva a regra de comissão..." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor (R$)">
              <input className={IC} type="number" min="0" step="0.01" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="0,00" />
            </Field>
            <Field label="Status">
              <select className={IC} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="pendente">Pendente</option>
                <option value="pago">Pago</option>
              </select>
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
            <p className="text-sm font-semibold text-white">Remover comissão?</p>
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
