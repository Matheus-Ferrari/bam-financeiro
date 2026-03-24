import { useState } from 'react'
import { Plus, Search, RefreshCw, Edit2, Trash2 } from 'lucide-react'
import { useDespesasLocais } from '../hooks/useFinanceiro'
import { despesasLocaisAPI } from '../services/api'
import Card from '../components/ui/Card'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/modals/Modal'
import { formatCurrency, formatCompact } from '../utils/formatters'

const CATEGORIAS = [
  'Salários e Benefícios',
  'Licenças / Ferramentas',
  'Marketing / Publicidade',
  'Custos Fixos',
  'Materiais / Estrutura',
  'Administrativo',
  'Outro',
]

const STATUS_BADGE = { pago: 'success', pendente: 'warning' }

const EMPTY = {
  nome: '', categoria: 'Licenças / Ferramentas', subcategoria: '', valor: '',
  competencia: '', parcelado: false, total_parcelas: '', parcela_atual: '',
  status: 'pendente', observacoes: '',
}

export default function DespesasLocais() {
  const { data, loading, error, refetch } = useDespesasLocais()
  const [search, setSearch]           = useState('')
  const [filtroMes, setFiltroMes]     = useState('')
  const [filtroCat, setFiltroCat]     = useState('')
  const [filtroStatus, setStatus]     = useState('todos')
  const [modalOpen, setModal]         = useState(false)
  const [editTarget, setEdit]         = useState(null)
  const [confirmDel, setConfirmDel]   = useState(null)
  const [deleting, setDeleting]       = useState(null)
  const [form, setForm]               = useState(EMPTY)
  const [saving, setSaving]           = useState(false)
  const [formErr, setFormErr]         = useState('')

  const despesas    = data?.despesas ?? []
  const competencias = [...new Set(despesas.map(d => d.competencia).filter(Boolean))].sort()

  const filtered = despesas.filter(d => {
    const q = search.toLowerCase()
    return (
      (!q || d.nome?.toLowerCase().includes(q) || d.categoria?.toLowerCase().includes(q)) &&
      (!filtroMes    || d.competencia === filtroMes) &&
      (!filtroCat    || d.categoria === filtroCat) &&
      (filtroStatus === 'todos' || d.status === filtroStatus)
    )
  })

  const totalFiltrado = filtered.reduce((s, d) => s + (d.valor ?? 0), 0)

  const openCreate = () => { setEdit(null); setForm(EMPTY); setFormErr(''); setModal(true) }
  const openEdit   = (d) => {
    setEdit(d)
    setForm({
      ...EMPTY, ...d,
      valor:          d.valor ?? '',
      total_parcelas: d.total_parcelas ?? '',
      parcela_atual:  d.parcela_atual  ?? '',
    })
    setFormErr(''); setModal(true)
  }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nome.trim()) { setFormErr('Nome é obrigatório.'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        valor:          form.valor === ''          ? 0    : Number(form.valor),
        total_parcelas: form.total_parcelas === '' ? null : Number(form.total_parcelas),
        parcela_atual:  form.parcela_atual  === '' ? null : Number(form.parcela_atual),
        parcelado:      !!form.parcelado,
      }
      editTarget ? await despesasLocaisAPI.update(editTarget.id, payload)
                 : await despesasLocaisAPI.create(payload)
      setModal(false); refetch()
    } catch (e) {
      setFormErr(e?.response?.data?.detail || 'Erro ao salvar.')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id) => {
    setDeleting(id)
    try { await despesasLocaisAPI.remove(id); setConfirmDel(null); refetch() }
    finally { setDeleting(null) }
  }

  const togglePago = async (d) => {
    await despesasLocaisAPI.update(d.id, { status: d.status === 'pago' ? 'pendente' : 'pago' })
    refetch()
  }

  if (loading) return <LoadingSpinner label="Carregando despesas..." />
  if (error)   return <p className="text-red-400 text-sm">{error}</p>

  return (
    <div className="space-y-6 animate-fade-in">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiMini label="Total Geral"    value={formatCompact(data?.total ?? 0)}          color="#EF4444" />
        <KpiMini label="Filtro Ativo"   value={formatCompact(totalFiltrado)}             color="#F59E0B" />
        <KpiMini label="Total Pago"     value={formatCompact(data?.total_pago ?? 0)}     color="#10B981" />
        <KpiMini label="Total Pendente" value={formatCompact(data?.total_pendente ?? 0)} color="#F59E0B" />
      </div>

      {/* Tabela */}
      <Card
        title="Despesas Fixas / Manuais"
        subtitle={`${filtered.length} de ${despesas.length} despesas`}
        action={<Button variant="primary" size="sm" onClick={openCreate}><Plus size={13} /> Nova Despesa</Button>}
      >
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50 placeholder:text-gray-600"
              placeholder="Buscar por nome ou categoria..."
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>
          <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
            className="text-xs rounded-lg px-3 py-2 outline-none"
            style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.10)', color: '#fff' }}>
            <option value="">Todas as competências</option>
            {competencias.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={filtroCat} onChange={e => setFiltroCat(e.target.value)}
            className="text-xs rounded-lg px-3 py-2 outline-none"
            style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.10)', color: '#fff' }}>
            <option value="">Todas as categorias</option>
            {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
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

        {filtered.length === 0 ? <EmptyState title="Nenhuma despesa encontrada" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {['Nome','Categoria','Competência','Parcelas','Valor','Status','Ações'].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(d => (
                  <tr key={d.id} className="border-b hover:bg-white/3 transition-colors"
                      style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                    <td className="py-3 px-3">
                      <p className="font-medium text-white whitespace-nowrap">{d.nome}</p>
                      {d.subcategoria && <p className="text-gray-600 text-[10px]">{d.subcategoria}</p>}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant="neutral">{d.categoria}</Badge>
                    </td>
                    <td className="py-3 px-3 text-gray-400">{d.competencia || '—'}</td>
                    <td className="py-3 px-3">
                      {d.parcelado && d.total_parcelas ? (
                        <span className="font-mono text-xs px-2 py-0.5 rounded"
                              style={{ background: 'rgba(99,102,241,0.15)', color: '#818CF8' }}>
                          {d.parcela_atual}/{d.total_parcelas}
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3 font-semibold text-white">
                      {formatCurrency(d.valor)}
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={STATUS_BADGE[d.status] ?? 'neutral'} dot>
                        {d.status === 'pago' ? 'Pago' : 'Pendente'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => togglePago(d)}
                          className="px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap"
                          style={d.status === 'pago'
                            ? { background: 'rgba(255,255,255,0.1)', color: '#9CA3AF' }
                            : { background: '#12F0C6', color: '#000' }}>
                          {d.status === 'pago' ? 'Pendente' : 'Pago'}
                        </button>
                        <button onClick={() => openEdit(d)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-[#12F0C6] hover:bg-[#12F0C6]/10 transition-colors">
                          <Edit2 size={12} />
                        </button>
                        <button onClick={() => setConfirmDel(d)}
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
             title={editTarget ? 'Editar Despesa' : 'Nova Despesa Fixa'} maxWidth="max-w-lg">
        <div className="space-y-4">
          {formErr && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formErr}</p>}
          <Field label="Nome *">
            <input className={IC} value={form.nome} onChange={e => set('nome', e.target.value)} placeholder="Ex: GitHub, Figma, VT Edu..." />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Categoria">
              <select className={IC} value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Subcategoria">
              <input className={IC} value={form.subcategoria} onChange={e => set('subcategoria', e.target.value)} placeholder="Ex: Design, Vale-Transporte..." />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor (R$)">
              <input className={IC} type="number" min="0" step="0.01" value={form.valor} onChange={e => set('valor', e.target.value)} placeholder="0,00" />
            </Field>
            <Field label="Competência (AAAA-MM)">
              <input className={IC} value={form.competencia} onChange={e => set('competencia', e.target.value)} placeholder="2026-03" />
            </Field>
          </div>

          {/* Parcelamento */}
          <div className="flex items-center gap-3 py-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={!!form.parcelado} onChange={e => set('parcelado', e.target.checked)}
                className="w-4 h-4 rounded accent-[#12F0C6]" />
              <span className="text-xs text-gray-300">Parcelado</span>
            </label>
          </div>

          {form.parcelado && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Parcela Atual">
                <input className={IC} type="number" min="1" value={form.parcela_atual} onChange={e => set('parcela_atual', e.target.value)} placeholder="Ex: 7" />
              </Field>
              <Field label="Total de Parcelas">
                <input className={IC} type="number" min="1" value={form.total_parcelas} onChange={e => set('total_parcelas', e.target.value)} placeholder="Ex: 12" />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
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
            <p className="text-sm font-semibold text-white">Remover despesa?</p>
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
