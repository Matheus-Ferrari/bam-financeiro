/**
 * bancoService.js — stub para futura integração bancária / Open Finance.
 *
 * COMO INTEGRAR NO FUTURO:
 *  1. Adicione VITE_BANCO_PROVIDER=nubank no .env
 *  2. Implemente getExtrato() com a API real
 *  3. Chame syncExtrato() em um worker ou cron no frontend
 *
 * Por enquanto: todas as funções retornam status "não implementado".
 */

import api from '../api'

// Stub: status da conexão com o banco
export const bancoService = {
  /**
   * [STUB] Verifica se a integração bancária está configurada.
   */
  getStatus: () =>
    Promise.resolve({
      conectado: false,
      provedor: null,
      mensagem: 'Integração bancária ainda não configurada.',
    }),

  /**
   * [STUB] Importa movimentações do extrato bancário.
   * Futuro: GET /banco/extrato?inicio=YYYY-MM-DD&fim=YYYY-MM-DD
   */
  getExtrato: (_dataInicio, _dataFim) =>
    Promise.resolve({ ok: false, movimentacoes: [], mensagem: 'Não implementado.' }),

  /**
   * [STUB] Sincroniza extrato com o backend.
   * Futuro: POST /banco/sync
   */
  syncExtrato: () =>
    Promise.resolve({ ok: false, sincronizado: 0, mensagem: 'Sincronização automática não implementada.' }),
}

export default bancoService
