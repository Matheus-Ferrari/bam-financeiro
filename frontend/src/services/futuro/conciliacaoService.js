/**
 * conciliacaoService.js — wrapper para a API de conciliação já implementada.
 *
 * Este serviço encapsula as chamadas de conciliação e está preparado para
 * suportar conciliação assistida por IA no futuro.
 */

import { financeiroAPI } from '../api'

/**
 * Busca dados de conciliação do backend (dados reais do Excel).
 */
export async function getConciliacao(params = {}) {
  const res = await financeiroAPI.getConciliacao(params)
  return res.data
}

/**
 * Marca um lançamento com status de conciliação.
 * @param {string} lancamentoId  - ID do lançamento (ex: "rec_1", "dep_3")
 * @param {'conciliado'|'pendente'|'divergente'} status
 * @param {string} [observacao]
 * @param {number} [valorExtrato] - Valor do extrato (para identificar divergência)
 */
export async function marcarConciliacao(lancamentoId, status, observacao = '', valorExtrato = null) {
  const res = await financeiroAPI.marcarConciliacao({
    lancamento_id:      lancamentoId,
    status_conciliacao: status,
    observacao,
    valor_extrato:      valorExtrato,
  })
  return res.data
}

/**
 * [STUB] Vincula um lançamento interno a uma movimentação do extrato bancário.
 * Futuro: cruzar automaticamente por data + valor.
 */
export async function vincularExtrato(_lancamentoId, _movimentacaoExtratoId) {
  return { ok: false, mensagem: 'Vínculo automático com extrato ainda não implementado.' }
}

/**
 * [STUB] Sugere correspondências entre lançamentos e extrato via IA.
 * Futuro: usar modelo de similaridade (data + valor + descrição).
 */
export async function sugerirConciliacao(_lancamentos, _extrato) {
  return { ok: false, sugestoes: [], mensagem: 'Sugestão por IA ainda não implementada.' }
}

const conciliacaoService = {
  getConciliacao,
  marcarConciliacao,
  vincularExtrato,
  sugerirConciliacao,
}
export default conciliacaoService
