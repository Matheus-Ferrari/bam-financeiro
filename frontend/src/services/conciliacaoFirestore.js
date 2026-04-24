/**
 * conciliacaoFirestore.js — Gravação de conciliações via API do backend.
 *
 * Usa o endpoint POST /financeiro/conciliacao/marcar (Cloud Function),
 * que escreve no Firestore com admin SDK — sem depender de regras de
 * segurança do cliente.
 *
 * Nunca altera lançamentos originais. Nunca usa deleteDoc.
 */

import { financeiroAPI } from './api'

/**
 * Marca um lançamento como conciliado via backend API.
 * Idempotente: o backend ignora se já estiver conciliado.
 *
 * @param {{ lancamentoId: string, csvItem: object }} params
 * @returns {Promise<void>}
 */
export async function salvarConciliacao({ lancamentoId, csvItem }) {
  if (!lancamentoId) {
    throw new Error(
      'Sem lançamento interno vinculado. Apenas itens com match podem ser conciliados.'
    )
  }

  await financeiroAPI.marcarConciliacao({
    lancamento_id:      String(lancamentoId),
    status_conciliacao: 'conciliado',
    observacao:         `Conciliado via extrato Nubank em ${new Date().toISOString().slice(0, 10)}`,
    valor_extrato:      csvItem?.amount ?? undefined,
  })
}
