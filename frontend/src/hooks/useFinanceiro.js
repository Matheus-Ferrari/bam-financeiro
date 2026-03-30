import { useState, useEffect, useCallback } from 'react'
import { financeiroAPI, healthAPI, clientesAPI, cortesAPI, quickUpdateAPI, projetosAdicionaisAPI, comissoesAPI, despesasLocaisAPI } from '../services/api'

/**
 * Hook genérico para buscar dados de um endpoint.
 * Retorna { data, loading, error, refetch }
 */
export function useApiData(fetcher, deps = []) {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  const fetch_ = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetcher()
      setData(res.data)
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Erro ao buscar dados')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { fetch_() }, [fetch_])

  return { data, loading, error, refetch: fetch_ }
}

export const useKpis      = () => useApiData(() => financeiroAPI.getKpis())
export const useResumo    = () => useApiData(() => financeiroAPI.getResumo())
export const useReceitas  = () => useApiData(() => financeiroAPI.getReceitas())
export const useDespesas  = () => useApiData(() => financeiroAPI.getDespesas())
export const useAlertas   = () => useApiData(() => financeiroAPI.getAlertas())
export const useCenarios  = () => useApiData(() => financeiroAPI.getCenarios())
export const useHealth    = () => useApiData(() => healthAPI.check())
export const useSaude     = () => useApiData(() => financeiroAPI.getSaude())
export const useInsights  = () => useApiData(() => financeiroAPI.getInsights())
export const useClientes  = () => useApiData(() => clientesAPI.getAll())
export const useCortes    = () => useApiData(() => cortesAPI.getAll())
export const useOperacaoMes = () => useApiData(() => financeiroAPI.getOperacaoMes())
export const useCaixa = () => useApiData(() => financeiroAPI.getCaixa())
export const useQuickUpdateHistory = () => useApiData(() => quickUpdateAPI.history())

export function useProjecoes(params) {
  return useApiData(
    () => financeiroAPI.getProjecoes(params),
    [params.crescimento_pct, params.novos_clientes_crm, params.meses]
  )
}

export const useProjetosAdicionais = () => useApiData(() => projetosAdicionaisAPI.getAll())
export const useComissoes           = () => useApiData(() => comissoesAPI.getAll())
export const useDespesasLocais      = () => useApiData(() => despesasLocaisAPI.getAll())

// ── Fluxo de Caixa ───────────────────────────────────────────────────────

export function useFluxoCaixa(params = {}) {
  return useApiData(
    () => financeiroAPI.getFluxoCaixa(params),
    [params.mes, params.ano, params.tipo, params.status, params.cliente, params.categoria]
  )
}

export function useConciliacao(params = {}) {
  return useApiData(
    () => financeiroAPI.getConciliacao(params),
    [params.mes, params.ano]
  )
}

export function useRecebimentosClientes(params = {}) {
  return useApiData(
    () => financeiroAPI.getRecebimentosClientes(params),
    [params.mes, params.ano]
  )
}
