
import { useState, useEffect } from 'react'
import Modal from './Modal'
import Button from '../ui/Button'

const STATUS_OPTS = [
  { value: 'ativo',    label: 'Ativo'    },
  { value: 'inativo',  label: 'Inativo'  },
  { value: 'prospecto',label: 'Prospecto'},
]

const TIPO_OPTS = [
  { value: 'recorrente', label: 'Recorrente' },
  { value: 'pontual',    label: 'Pontual'    },
  { value: 'projeto',    label: 'Projeto'    },
]

const COBRANCA_STATUS_OPTS = [
  { value: 'sem_cobrar',         label: 'Sem cobrar' },
  { value: 'cobrar_hoje',        label: 'Cobrar hoje' },
  { value: 'cobrado',            label: 'Cobrado' },
  { value: 'aguardando_retorno', label: 'Aguardando retorno' },
  { value: 'prometeu_pagamento', label: 'Prometeu pagamento' },
  { value: 'pago',               label: 'Pago' },
  { value: 'atrasado',           label: 'Atrasado' },
]

const FORMA_CONTATO_OPTS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email',    label: 'E-mail' },
  { value: 'ligacao',  label: 'Ligação' },
  { value: 'outro',    label: 'Outro' },
]

const EMPTY = {
  nome:                   '',
  status:                 'ativo',
  tipo:                   'recorrente',
  valor_mensal:           '',
  valor_previsto:         '',
  valor_recebido:         '',
  status_pagamento:       'pendente',
  data_pagamento:         '',
  observacao_pagamento:   '',
  data_inicio:            '',
  responsavel:            '',
  observacoes:            '',
  dia_pagamento:          '',
  cobranca_status:        'sem_cobrar',
  cobranca_obs:           '',
  ultimo_contato:         '',
  proximo_followup:       '',
  forma_contato:          'whatsapp',
  // Automação de cobrança
  email_financeiro:        '',
  whatsapp_financeiro:     '',
  cobrar_automaticamente:  false,
}

export default function ModalCliente({ open, onClose, onSave, cliente }) {
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    setForm(cliente
      ? {
          ...EMPTY,
          ...cliente,
          valor_mensal:           cliente.valor_mensal           ?? '',
          valor_previsto:         cliente.valor_previsto         ?? '',
          valor_recebido:         cliente.valor_recebido         ?? '',
          dia_pagamento:          cliente.dia_pagamento          ?? '',
          data_pagamento:         cliente.data_pagamento         ? String(cliente.data_pagamento).slice(0, 10) : '',
          ultimo_contato:         cliente.ultimo_contato         ?? '',
          proximo_followup:       cliente.proximo_followup       ?? '',
          cobranca_status:        cliente.cobranca_status        ?? 'sem_cobrar',
          cobranca_obs:           cliente.cobranca_obs           ?? '',
          forma_contato:          cliente.forma_contato          ?? 'whatsapp',
          email_financeiro:        cliente.email_financeiro       ?? '',
          whatsapp_financeiro:     cliente.whatsapp_financeiro    ?? '',
          cobrar_automaticamente:  cliente.cobrar_automaticamente ?? false,
        }
      : EMPTY
    )
    setErr('')
  }, [cliente, open])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.nome.trim()) { setErr('Nome é obrigatório.'); return }
    setSaving(true)
    try {
      await onSave({
        ...form,
        valor_mensal:   form.valor_mensal   === '' ? null : Number(form.valor_mensal),
        valor_previsto: form.valor_previsto === '' ? null : Number(form.valor_previsto),
        valor_recebido: form.valor_recebido === '' ? 0    : Number(form.valor_recebido),
        dia_pagamento:  form.dia_pagamento  === '' ? null : Number(form.dia_pagamento),
      })
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
      title={cliente ? 'Editar Cliente' : 'Novo Cliente'}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-4">
        {err && (
          <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>
        )}

        <Field label="Nome *">
          <input
            className={INPUT_CLS}
            value={form.nome}
            onChange={e => set('nome', e.target.value)}
            placeholder="Ex: Empresa ABC"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Status">
            <select className={INPUT_CLS} value={form.status} onChange={e => set('status', e.target.value)}>
              {STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <select className={INPUT_CLS} value={form.tipo} onChange={e => set('tipo', e.target.value)}>
              {TIPO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Valor Mensal (R$)">
            <input
              className={INPUT_CLS}
              type="number"
              min="0"
              step="0.01"
              value={form.valor_mensal}
              onChange={e => set('valor_mensal', e.target.value)}
              placeholder="0,00"
            />
          </Field>
          <Field label="Valor Previsto (R$)">
            <input
              className={INPUT_CLS}
              type="number"
              min="0"
              step="0.01"
              value={form.valor_previsto}
              onChange={e => set('valor_previsto', e.target.value)}
              placeholder="0,00"
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Status Pagamento">
            <select className={INPUT_CLS} value={form.status_pagamento} onChange={e => set('status_pagamento', e.target.value)}>
              <option value="pendente">Pendente</option>
              <option value="pago">Pago</option>
              <option value="atrasado">Atrasado</option>
            </select>
          </Field>
          <Field label="Valor Recebido (R$)">
            <input className={INPUT_CLS} type="number" min="0" step="0.01"
              value={form.valor_recebido} onChange={e => set('valor_recebido', e.target.value)} placeholder="0,00" />
          </Field>
          <Field label="Dia de Pagamento">
            <input className={INPUT_CLS} type="number" min="1" max="31"
              value={form.dia_pagamento} onChange={e => set('dia_pagamento', e.target.value)} placeholder="Ex: 25" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Data Pagamento">
            <input className={INPUT_CLS} type="date" value={form.data_pagamento} onChange={e => set('data_pagamento', e.target.value)} />
          </Field>
          <Field label="Início do Contrato">
            <input className={INPUT_CLS} type="date" value={form.data_inicio} onChange={e => set('data_inicio', e.target.value)} />
          </Field>
        </div>

        <Field label="Responsável / Contato">
          <input className={INPUT_CLS} value={form.responsavel}
            onChange={e => set('responsavel', e.target.value)} placeholder="Ex: João Silva" />
        </Field>

        <Field label="Observação de Pagamento">
          <textarea className={INPUT_CLS + ' resize-none'} rows={2}
            value={form.observacao_pagamento} onChange={e => set('observacao_pagamento', e.target.value)}
            placeholder="Ex: pagamento parcial, renegociação..." />
        </Field>

        {/* ── Seção Cobrança ─────────────────────────────────── */}
        <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">Cobrança</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status de Cobrança">
              <select className={INPUT_CLS} value={form.cobranca_status} onChange={e => set('cobranca_status', e.target.value)}>
                {COBRANCA_STATUS_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Forma de Contato">
              <select className={INPUT_CLS} value={form.forma_contato} onChange={e => set('forma_contato', e.target.value)}>
                {FORMA_CONTATO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            <Field label="Último Contato">
              <input className={INPUT_CLS} type="date" value={form.ultimo_contato} onChange={e => set('ultimo_contato', e.target.value)} />
            </Field>
            <Field label="Próximo Follow-up">
              <input className={INPUT_CLS} type="date" value={form.proximo_followup} onChange={e => set('proximo_followup', e.target.value)} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Obs. de Cobrança">
              <textarea className={INPUT_CLS + ' resize-none'} rows={2}
                value={form.cobranca_obs} onChange={e => set('cobranca_obs', e.target.value)}
                placeholder="Ex: aguardando aprovação interna, prometeu pagar na sexta..." />
            </Field>
          </div>
        </div>

        {/* ── Automação futura ─────────────────────────────── */}
        <div className="pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
          <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wide">
            Automação de Cobrança <span className="normal-case text-gray-600 font-normal">(em breve)</span>
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="E-mail Financeiro">
              <input className={INPUT_CLS} type="email" value={form.email_financeiro}
                onChange={e => set('email_financeiro', e.target.value)}
                placeholder="financeiro@empresa.com" />
            </Field>
            <Field label="WhatsApp Financeiro">
              <input className={INPUT_CLS} type="tel" value={form.whatsapp_financeiro}
                onChange={e => set('whatsapp_financeiro', e.target.value)}
                placeholder="11999999999" />
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <input
              id="cobrar_auto"
              type="checkbox"
              checked={!!form.cobrar_automaticamente}
              onChange={e => set('cobrar_automaticamente', e.target.checked)}
              className="w-4 h-4 accent-[#12F0C6] cursor-pointer"
            />
            <label htmlFor="cobrar_auto" className="text-sm text-gray-300 cursor-pointer">
              Cobrar automaticamente no dia&nbsp;
              <strong style={{ color: '#12F0C6' }}>{form.dia_pagamento || 25}</strong>
              &nbsp;todo mês
            </label>
          </div>
        </div>

        <Field label="Observações Gerais">
          <textarea className={INPUT_CLS + ' resize-none'} rows={2}
            value={form.observacoes} onChange={e => set('observacoes', e.target.value)}
            placeholder="Informações adicionais..." />
        </Field>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : (cliente ? 'Salvar Alterações' : 'Criar Cliente')}
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
