/**
 * cobrancaService.js — stub para emissão futura de cobranças automáticas.
 *
 * COMO INTEGRAR NO FUTURO:
 *  1. Configure VITE_COBRANCA_PROVIDER=asaas no .env
 *  2. Implemente emitirCobranca() chamando /cobranca/emitir no backend
 *  3. Configure webhook para receber confirmação de pagamento
 *
 * Fluxo planejado:
 *  → Todo dia 23: cobrar clientes com vencimento no dia 25
 *  → Status: agendada → enviada → visualizada → paga
 */

/**
 * [STUB] Emite cobrança (boleto / link Pix) para um cliente.
 */
export async function emitirCobranca({ clienteId, valor, vencimento, descricao }) {
  return {
    ok: false,
    mensagem: 'Emissão de cobrança ainda não implementada.',
    boleto_url: null,
    pix_copia_cola: null,
    link_pagamento: null,
  }
}

/**
 * [STUB] Verifica e processa cobranças automáticas do dia.
 * Futuro: chamar na inicialização do app ou via worker.
 */
export async function processarCobrancasAutomaticas() {
  return {
    ok: false,
    emitidas: 0,
    mensagem: 'Automação de cobrança ainda não implementada.',
  }
}

/**
 * [STUB] Registra manualmente o status de cobrança de um cliente.
 * Já funciona via clientesAPI.update() — esse wrapper é para uso futuro com webhook.
 */
export async function registrarStatusCobranca({ clienteId, status, observacao }) {
  return { ok: false, mensagem: 'Use clientesAPI.update() diretamente por enquanto.' }
}

const cobrancaService = { emitirCobranca, processarCobrancasAutomaticas, registrarStatusCobranca }
export default cobrancaService
