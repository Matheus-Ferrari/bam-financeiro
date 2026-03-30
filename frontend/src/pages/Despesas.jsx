import { useState } from 'react'
import { Edit2, RefreshCw } from 'lucide-react'
import { useDespesas } from '../hooks/useFinanceiro'
import { financeiroAPI } from '../services/api'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import ComposicaoDespesasChart from '../components/charts/ComposicaoDespesasChart'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { formatCompact, formatCurrency } from '../utils/formatters'

const CAT_COLORS = {
  'Salários e Benefícios':  '#12F0C6',
  'Custos Fixos':            '#6366F1',
  'Licenças / Ferramentas':  '#F59E0B',
  'Marketing / Publicidade': '#EF4444',
  Administrativo:            '#8B5CF6',
  'Materiais / Estrutura':   '#EC4899',
  'Pessoal/RH':              '#12F0C6',
  Infraestrutura:            '#6366F1',
  Marketing:                 '#F59E0B',
  Ferramentas:               '#EF4444',
  Operacional:               '#8B5CF6',
}

const INPUT_CLS = 'w-full px-3 py-2 rounded-lg text-sm text-white bg-black/40 border border-white/10 focus:outline-none focus:border-[#12F0C6]/50 placeholder:text-gray-600'

export default function Despesas() {
  const { data, loading, error, refetch } = useDespesas()
  const [filtroMes, setFiltroMes]             = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [editItem, setEditItem]               = useState(null)
  const [editForm, setEditForm]               = useState({})
  const [saving, setSaving]                   = useState(false)

  const lancamentos = data?.lancamentos ?? []
  const total       = data?.total ?? 0

  const meses      = [...new Set(lancamentos.map(d => d.mes).filter(Boolean))]
  const categorias = [...new Set(lancamentos.map(d => d.categoria).filter(Boolean))]

  const filtrados = lancamentos.filter(d => {
    if (filtroMes       && d.mes       !== filtroMes)       return false
    if (filtroCategoria && d.categoria !== filtroCategoria) return false
    return true
  })

  const totalFiltrado = filtrados.reduce((s, d) => s + (d.valor ?? 0), 0)

  const clean = (v) => (!v || v === 'nan' || v === 'NaN') ? '' : v
  const openEdit = (item) => {
    setEditItem(item)
    setEditForm({ valor: item.valor, descricao: clean(item.descricao), status: clean(item.status), categoria: clean(item.categoria) })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await financeiroAPI.updateDespesa(editItem.id, {
        valor:     editForm.valor     !== '' ? Number(editForm.valor) : undefined,
        descricao: editForm.descricao || undefined,
        status:    editForm.status    || undefined,
        categoria: editForm.categoria || undefined,
      })
      setEditItem(null)
      refetch()
    } catch (e) {
      alert('Erro ao salvar: ' + (e?.response?.data?.detail || e.message))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <LoadingSpinner />
  if (error)   return <p className="text-red-400 text-sm">{error}</p>

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Totalizadores */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border p-5" style={{ background: '#272C30', borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Despesas</p>
          <p className="text-2xl font-bold text-white">{formatCompact(total)}</p>
          <p className="text-xs text-gray-600 mt-1">{lancamentos.length} lançamentos</p>
        </div>
        <div className="rounded-xl border p-5" style={{ background: '#272C30', borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Filtro Ativo</p>
          <p className="text-2xl font-bold text-white">{formatCompact(totalFiltrado)}</p>
          <p className="text-xs text-gray-600 mt-1">{filtrados.length} registros</p>
        </div>
        <div className="rounded-xl border p-5" style={{ background: '#272C30', borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Categorias</p>
          <p className="text-2xl font-bold text-white">{categorias.length}</p>
          <p className="text-xs text-gray-600 mt-1">centros de custo</p>
        </div>
      </div>

      {/* Gráfico + Filtros */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card title="Composição por Categoria" subtitle="Distribuição atual" className="lg:col-span-1">
          <ComposicaoDespesasChart data={data} loading={false} error={null} />
        </Card>

        <Card title="Filtros" className="lg:col-span-2">
          <div className="flex flex-wrap gap-3 mb-4">
            <select value={filtroMes} onChange={e => setFiltroMes(e.target.value)}
              className="text-xs rounded-lg px-3 py-1.5 outline-none"
              style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.10)', color: '#fff' }}>
              <option value="">Todos os meses</option>
              {meses.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}
              className="text-xs rounded-lg px-3 py-1.5 outline-none"
              style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.10)', color: '#fff' }}>
              <option value="">Todas as categorias</option>
              {categorias.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {(filtroMes || filtroCategoria) && (
              <button onClick={() => { setFiltroMes(''); setFiltroCategoria('') }}
                className="text-xs px-3 py-1.5 rounded-lg" style={{ color: '#12F0C6', background: 'rgba(18,240,198,0.08)' }}>
                Limpar
              </button>
            )}
            <button onClick={refetch} className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5"
              style={{ color: '#9CA3AF', background: 'rgba(255,255,255,0.05)' }}>
              <RefreshCw size={11} /> Atualizar
            </button>
          </div>

          {/* Barras por categoria */}
          <div className="space-y-2.5">
            {(data?.por_categoria ?? []).map(cat => {
              const pct = total > 0 ? (cat.valor / total) * 100 : 0
              const cor = CAT_COLORS[cat.categoria] ?? '#9CA3AF'
              return (
                <div key={cat.categoria} className="flex items-center gap-3">
                  <span className="text-xs text-gray-400 w-36 truncate">{cat.categoria}</span>
                  <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cor }} />
                  </div>
                  <span className="text-xs text-white w-20 text-right font-medium">{formatCompact(cat.valor)}</span>
                  <span className="text-xs w-10 text-right" style={{ color: cor }}>{pct.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Tabela com edição */}
      <Card title="Lançamentos de Despesa" subtitle={`${filtrados.length} registros`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                {['Mês','Descrição','Categoria','Centro','Valor','Status',''].map(h => (
                  <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(d => (
                <tr key={d.id} className="border-b hover:bg-white/3 transition-colors"
                  style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                  <td className="py-2.5 px-3 text-gray-400">{d.mes}</td>
                  <td className="py-2.5 px-3 text-white">{d.descricao}</td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: CAT_COLORS[d.categoria] ?? '#9CA3AF' }} />
                      {d.categoria}
                    </span>
                  </td>
                  <td className="py-2.5 px-3"><Badge variant="neutral">{d.centro_custo}</Badge></td>
                  <td className="py-2.5 px-3 text-right font-semibold text-white">{formatCurrency(d.valor)}</td>
                  <td className="py-2.5 px-3">
                    {d.status && d.status !== 'nan'
                      ? <Badge variant={d.status === 'PAGO' || d.status === 'Pago' ? 'success' : 'warning'} dot>{d.status}</Badge>
                      : <span className="text-gray-700">—</span>}
                  </td>
                  <td className="py-2.5 px-3">
                    <button onClick={() => openEdit(d)}
                      className="w-7 h-7 rounded-md flex items-center justify-center text-gray-500 hover:text-[#12F0C6] hover:bg-[#12F0C6]/10 transition-colors">
                      <Edit2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {data?.fonte === 'mock' && (
        <p className="text-center text-xs text-gray-700">Dados demonstrativos (mock)</p>
      )}

      {/* Modal de edição */}
      {editItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4"
            style={{ background: '#1A1E21', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div>
              <p className="text-sm font-semibold text-white">Editar Despesa</p>
              <p className="text-xs text-gray-500 mt-0.5">{editItem.mes} · {editItem.descricao}</p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">Valor (R$)</label>
                <input className={INPUT_CLS} type="number" step="0.01" min="0"
                  value={editForm.valor} onChange={e => setEditForm(f => ({ ...f, valor: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-400">Descrição</label>
                <input className={INPUT_CLS} value={editForm.descricao || ''}
                  onChange={e => setEditForm(f => ({ ...f, descricao: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Status</label>
                  <select className={INPUT_CLS} value={editForm.status || ''}
                    onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}>
                    <option value="">—</option>
                    <option value="PAGO">PAGO</option>
                    <option value="PENDENTE">PENDENTE</option>
                    <option value="AGENDADO">AGENDADO</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Categoria</label>
                  <input className={INPUT_CLS} value={editForm.categoria || ''}
                    onChange={e => setEditForm(f => ({ ...f, categoria: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setEditItem(null)} disabled={saving}>Cancelar</Button>
              <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}




