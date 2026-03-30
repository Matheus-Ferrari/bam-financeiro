/**
 * notificacaoService.js — stub para notificações futuras por e-mail e WhatsApp.
 *
 * COMO INTEGRAR NO FUTURO:
 *  - E-mail: adicione VITE_SENDGRID_KEY no .env e implemente enviarEmail()
 *  - WhatsApp: adicione VITE_WHATSAPP_API_URL no .env e implemente enviarWhatsApp()
 *  - O backend (notificacao_service.py) já tem os stubs equivalentes
 *
 * Fluxo planejado:
 *  → Lembrete de vencimento (D-2): enviado automaticamente
 *  → Confirmação de recebimento: enviado ao marcar cliente como pago
 *  → Alerta de inadimplência: enviado após D+3 sem pagamento
 */

/**
 * [STUB] Envia lembrete de vencimento para o cliente.
 */
export async function enviarLembreteVencimento({ clienteNome, valor, vencimento, canal, contato }) {
  return {
    ok: false,
    canal,
    mensagem: 'Notificação automática ainda não implementada.',
  }
}

/**
 * [STUB] Envia confirmação de recebimento.
 */
export async function enviarConfirmacaoRecebimento({ clienteNome, valor, data, canal, contato }) {
  return { ok: false, mensagem: 'Confirmação automática ainda não implementada.' }
}

/**
 * [STUB] Envia alerta de inadimplência (cobrado mas não pago após D+3).
 */
export async function enviarAlertaInadimplencia({ clienteNome, diasAtraso, valor, canal, contato }) {
  return { ok: false, mensagem: 'Alerta de inadimplência ainda não implementado.' }
}

const notificacaoService = {
  enviarLembreteVencimento,
  enviarConfirmacaoRecebimento,
  enviarAlertaInadimplencia,
}
export default notificacaoService
