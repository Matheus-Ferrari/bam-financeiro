import { useState, useEffect } from 'react'
import Modal from './Modal'
import Button from '../ui/Button'

const STATUS_OPTS = [
  { value: 'planejado',   label: 'Planejado'   },
  { value: 'em_execucao', label: 'Em Execução' },
  { value: 'concluido',   label: 'Concluído'   },
  { value: 'cancelado',   label: 'Cancelado'   },
]

const CATEGORIA_OPTS = [
  'Ferramentas SaaS',
  'Infraestrutura',
  'Marketing',
  'Pessoal',
  'Operacional',
  'Outros',
]

const EMPTY = {
  descricao:      '',
  categoria:      'Ferramentas SaaS',
  economia_mensal:'',
  status:         'planejado',
  ativo:          true,
  observacao:     '',
}

export default function ModalCorte({ open, onClose, onSave, corte }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    setForm(corte
      ? { ...EMPTY, ...corte, economia_mensal: corte.economia_mensal ?? '' }
      : EMPTY
    )
    setErr('')
  }, [corte, open])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.descricao.trim()) { setErr('Descrição é obrigatória.'); return }
    if (form.economia_mensal === '' || isNaN(Number(form.economia_mensal))) {
      setErr('Economia mensal inválida.'); return
    }
    setSaving(true)
    try {
      await onSave({ ...form, economia_mensal: Number(form.economia_mensal) })
      onClose()
    } catch (e) {
      setErr(e?.response?.data?.detail || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={corte ? 'Editar Corte' : 'Novo Corte Planejado'}
    >
      <div className="space-y-4">
        {err && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>
        )}

        <Field label="Descrição *">
          <input
            className={INPUT_CLS}
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="Ex: Cancelar assinatura FilterFork"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Categoria">
            <select className={INPUT_CLS} value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              {CATEGORIA_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </Field>
          <Field label="Economia Mensal (R$) *">
            <input
              className={INPUT_CLS}
              type="number"
              min="0"
              step="0.01"
              value={form.economia_mensal}
              onChange={e => set('economia_mensal', e.target.value)}
              placeholder="200"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <select className={INPUT_CLS} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Ativo">
            <button
              type="button"
              onClick={() => set('ativo', !form.ativo)}
              className={`mt-0.5 flex items-center gap-2 text-sm font-medium transition-colors ${form.ativo ? 'text-[#12F0C6]' : 'text-gray-500'}`}
            >
              <span
                className="w-8 h-4 rounded-full relative transition-colors flex-shrink-0"
                style={{ background: form.ativo ? '#12F0C6' : 'rgba(255,255,255,0.1)' }}
              >
                <span
                  className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                  style={{ left: form.ativo ? '17px' : '2px' }}
                />
              </span>
              {form.ativo ? 'Sim' : 'Não'}
            </button>
          </Field>
        </div>

        <Field label="Observação">
          <textarea
            className={INPUT_CLS + ' resize-none'}
            rows={3}
            value={form.observacao}
            onChange={e => set('observacao', e.target.value)}
            placeholder="Detalhes sobre o corte..."
          />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : (corte ? 'Salvar Alterações' : 'Adicionar Corte')}
          </Button>
        </div>
      </div>
    </Modal>
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

const INPUT_CLS = [
  'w-full px-3 py-2 rounded-lg text-sm text-white',
  'bg-black/40 border border-white/10',
  'focus:outline-none focus:border-[#12F0C6]/50 focus:ring-1 focus:ring-[#12F0C6]/20',
  'placeholder:text-gray-600 transition-colors',
].join(' ')
