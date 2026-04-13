import { X, Copy, ExternalLink, Mail, MessageCircle, Phone, Edit2, CheckCircle, Clock, AlertTriangle, FileText, Receipt } from 'lucide-react'
import Badge from '../ui/Badge'
import Button from '../ui/Button'
import { formatCurrency } from '../../utils/formatters'

const GREEN = '#12F0C6'

const STATUS_BADGE = { ativo: 'success', inativo: 'error', prospecto: 'warning' }
const STATUS_PGTO  = { pago: 'success', pendente: 'warning', atrasado: 'error' }
const COBRANCA_BADGE = {
  sem_cobrar: 'neutral', cobrar_hoje: 'error', cobrado: 'info',
  aguardando_retorno: 'warning', prometeu_pagamento: 'info', pago: 'success', atrasado: 'error',
}
const COBRANCA_LABEL = {
  sem_cobrar: 'Sem cobrar', cobrar_hoje: 'Cobrar hoje', cobrado: 'Cobrado',
  aguardando_retorno: 'Aguardando', prometeu_pagamento: 'Prometeu pagar', pago: 'Pago', atrasado: 'Atrasado',
}

function copyText(text) {
  navigator.clipboard.writeText(text)
}

function abrirWhatsApp(cliente) {
  const fone = (cliente.whatsapp || cliente.whatsapp_financeiro || cliente.telefone || '').replace(/\D/g, '')
  if (!fone) return
  const nome = cliente.nome_contato_principal || cliente.nome_contato_financeiro || cliente.responsavel || cliente.nome
  const msg = encodeURIComponent(
    `Olá, ${nome}! Tudo bem? Estou entrando em contato para lembrar sobre o pagamento referente ao serviço deste mês. Qualquer dúvida, fico à disposição.`
  )
  window.open(`https://wa.me/55${fone}?text=${msg}`, '_blank')
}

function abrirEmail(cliente) {
  const email = cliente.email_financeiro || cliente.email_principal || ''
  if (!email) return
  const nome = cliente.nome_contato_financeiro || cliente.nome_contato_principal || cliente.responsavel || cliente.nome
  const empresa = cliente.empresa || cliente.nome
  const assunto = encodeURIComponent(`Cobrança / lembrete de pagamento - ${empresa}`)
  const corpo = encodeURIComponent(
    `Olá, ${nome}, tudo bem?\n\nEstamos enviando este lembrete referente ao pagamento do período atual.\nQualquer dúvida, ficamos à disposição.\n\nAtenciosamente.`
  )
  window.open(`mailto:${email}?subject=${assunto}&body=${corpo}`, '_self')
}

export default function DrawerCliente({ cliente, open, onClose, onEdit, onPagamento }) {
  if (!open || !cliente) return null
  const c = cliente

  const temWhatsapp = !!(c.whatsapp || c.whatsapp_financeiro || c.telefone)
  const temEmail    = !!(c.email_financeiro || c.email_principal)
  const emailDisplay = c.email_financeiro || c.email_principal || ''
  const foneDisplay  = c.whatsapp || c.whatsapp_financeiro || c.telefone || ''

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-lg flex flex-col animate-slide-in-right"
           style={{ background: '#131719', borderLeft: '1px solid rgba(255,255,255,0.06)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-lg font-bold text-white">{c.nome}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={STATUS_BADGE[c.status] ?? 'neutral'} dot>{c.status}</Badge>
              {c.tipo && <Badge variant="neutral">{c.tipo}</Badge>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Seção: Financeiro */}
          <Section title="Financeiro" icon={<Receipt size={14} style={{ color: GREEN }} />}>
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="Valor Previsto" value={formatCurrency(c.valor_previsto || c.valor_mensal || 0)} color={GREEN} />
              <InfoItem label="Valor Recebido" value={formatCurrency(c.valor_recebido || 0)} color="#F59E0B" />
              <InfoItem label="Status Pagamento">
                <Badge variant={STATUS_PGTO[(c.status_pagamento || 'pendente').toLowerCase()] ?? 'warning'} dot>
                  {c.status_pagamento || 'pendente'}
                </Badge>
              </InfoItem>
              <InfoItem label="Dia Pagamento" value={c.dia_pagamento ? `Dia ${c.dia_pagamento}` : '—'} />
              <InfoItem label="Último Pagamento" value={c.data_pagamento ? String(c.data_pagamento).slice(0, 10) : '—'} />
              <InfoItem label="Cobrança">
                <Badge variant={COBRANCA_BADGE[c.cobranca_status] ?? 'neutral'} dot>
                  {COBRANCA_LABEL[c.cobranca_status] ?? c.cobranca_status ?? 'Sem cobrar'}
                </Badge>
              </InfoItem>
            </div>
            {c.observacao_pagamento && (
              <p className="text-xs text-gray-500 mt-2 italic">{c.observacao_pagamento}</p>
            )}
          </Section>

          {/* Seção: Contato */}
          <Section title="Contato" icon={<Phone size={14} style={{ color: GREEN }} />}>
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="Responsável" value={c.responsavel || '—'} />
              <InfoItem label="Empresa" value={c.empresa || '—'} />
              <InfoItem label="E-mail" value={emailDisplay || '—'}>
                {emailDisplay && (
                  <button onClick={() => copyText(emailDisplay)} className="ml-1 text-gray-600 hover:text-white" title="Copiar"><Copy size={10} /></button>
                )}
              </InfoItem>
              <InfoItem label="Telefone" value={foneDisplay || '—'}>
                {foneDisplay && (
                  <button onClick={() => copyText(foneDisplay)} className="ml-1 text-gray-600 hover:text-white" title="Copiar"><Copy size={10} /></button>
                )}
              </InfoItem>
              <InfoItem label="WhatsApp" value={c.whatsapp || c.whatsapp_financeiro || '—'} />
              <InfoItem label="Forma de Contato" value={c.forma_contato || '—'} />
            </div>
          </Section>

          {/* Seção: Fiscal / Faturamento */}
          <Section title="Fiscal / Faturamento" icon={<FileText size={14} style={{ color: GREEN }} />}>
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="CNPJ/CPF" value={c.cnpj_cpf || c.cnpj_faturamento || '—'} />
              <InfoItem label="Razão Social" value={c.razao_social || '—'} />
              <InfoItem label="Código Serviço NF" value={c.codigo_servico_nf || '—'} />
              <InfoItem label="Forma Cobrança" value={c.forma_cobranca || '—'} />
              <InfoItem label="NF Status" value={c.nf_status || 'Não emitida'} />
              <InfoItem label="Boleto Status" value={c.boleto_status || 'Não gerado'} />
            </div>
            {c.descricao_padrao_nf && <p className="text-xs text-gray-500 mt-2">Descrição NF: {c.descricao_padrao_nf}</p>}
            {c.observacoes_fiscais && <p className="text-xs text-gray-500 mt-1 italic">{c.observacoes_fiscais}</p>}
          </Section>

          {/* Observações */}
          {c.observacoes && (
            <Section title="Observações">
              <p className="text-xs text-gray-400 leading-relaxed">{c.observacoes}</p>
            </Section>
          )}
        </div>

        {/* Footer: Ações Rápidas */}
        <div className="px-6 py-4 border-t space-y-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Ações Rápidas</p>
          <div className="flex flex-wrap gap-2">
            {c.status_pagamento !== 'pago' ? (
              <Button size="sm" variant="primary" onClick={() => onPagamento(c, 'pago')}>
                <CheckCircle size={12} /> Marcar como Pago
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => onPagamento(c, 'pendente')}>
                <Clock size={12} /> Marcar Pendente
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => onEdit(c)}>
              <Edit2 size={12} /> Editar
            </Button>
            <button
              disabled={!temWhatsapp}
              onClick={() => abrirWhatsApp(c)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: 'rgba(37,211,102,0.12)', color: '#25D366' }}
              title={!temWhatsapp ? 'Sem WhatsApp cadastrado' : 'Cobrar por WhatsApp'}
            >
              <MessageCircle size={12} /> WhatsApp
            </button>
            <button
              disabled={!temEmail}
              onClick={() => abrirEmail(c)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: 'rgba(99,102,241,0.12)', color: '#818CF8' }}
              title={!temEmail ? 'Sem e-mail cadastrado' : 'Cobrar por E-mail'}
            >
              <Mail size={12} /> E-mail
            </button>
            {emailDisplay && (
              <button onClick={() => copyText(emailDisplay)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white bg-white/5 transition">
                <Copy size={12} /> Copiar e-mail
              </button>
            )}
            {foneDisplay && (
              <button onClick={() => copyText(foneDisplay)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:text-white bg-white/5 transition">
                <Copy size={12} /> Copiar telefone
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function Section({ title, icon, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
        {children}
      </div>
    </div>
  )
}

function InfoItem({ label, value, color, children }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-gray-600">{label}</p>
      <div className="flex items-center">
        {value && <p className="text-xs font-medium" style={{ color: color || '#E5E7EB' }}>{value}</p>}
        {children}
      </div>
    </div>
  )
}
