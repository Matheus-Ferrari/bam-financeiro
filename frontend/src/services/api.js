import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5001/bam-financeiro/us-central1/api'

export const TOKEN_KEY = 'bam_token'
export const USER_KEY  = 'bam_user'

const api = axios.create({
  baseURL:         BASE,
  timeout:         15_000,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true,
})

// Attach Bearer token from sessionStorage on every request
api.interceptors.request.use(config => {
  const token = sessionStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers = config.headers || {}
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

// Interceptor global: reinicia no root em caso de sessão expirada
api.interceptors.response.use(
  response => response,
  error => {
    const is401       = error.response?.status === 401
    const isAuthRoute = error.config?.url?.includes('/auth/')
    if (is401 && !isAuthRoute) {
      sessionStorage.removeItem(TOKEN_KEY)
      sessionStorage.removeItem(USER_KEY)
      window.location.href = import.meta.env.BASE_URL || '/'
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login:  (email, password) => api.post('/auth/login', { email, password }),
  logout: ()                => api.post('/auth/logout'),
  me:     ()                => api.get('/auth/me'),
}

export const healthAPI = {
  check: () => api.get('/health'),
}

export const excelAPI = {
  getSheets: () => api.get('/excel/sheets'),
}

export const financeiroAPI = {
  getKpis:        ()          => api.get('/financeiro/kpis'),
  getResumo:      ()          => api.get('/financeiro/resumo'),
  getReceitas:    ()          => api.get('/financeiro/receitas'),
  getDespesas:    ()          => api.get('/financeiro/despesas'),
  getAlertas:     ()          => api.get('/financeiro/alertas'),
  getProjecoes:   (params)    => api.get('/financeiro/projecoes', { params }),
  getCenarios:    ()          => api.get('/financeiro/cenarios'),
  getSaude:       ()          => api.get('/financeiro/saude'),
  getInsights:    ()          => api.get('/financeiro/insights'),
  getOperacaoMes: ()          => api.get('/financeiro/operacao-mes'),
  getCaixa:       ()          => api.get('/financeiro/caixa'),
  updateCaixa:    (data)      => api.post('/financeiro/caixa', data),
  updateDespesa:  (id, data)  => api.put(`/financeiro/despesas/${id}`, data),
  updateReceita:  (id, data)  => api.put(`/financeiro/receitas/${id}`, data),

  // ── Fluxo de Caixa ────────────────────────────────────────────────
  getFluxoCaixa:           (params)  => api.get('/financeiro/fluxo-caixa', { params }),
  getConciliacao:          (params)  => api.get('/financeiro/conciliacao', { params }),
  marcarConciliacao:       (data)    => api.post('/financeiro/conciliacao/marcar', data),
  getRecebimentosClientes: (params)  => api.get('/financeiro/recebimentos-clientes', { params }),
  updateLancamentoStatus:  (data)    => api.post('/financeiro/lancamento/status', data),
  updateLancamento:        (id, data) => api.post('/financeiro/lancamento/update', { lancamento_id: id, ...data }),
  createLancamento:        (data)    => api.post('/financeiro/lancamento/create', data),
  deleteLancamento:        (id)      => api.delete(`/financeiro/lancamento/${id}`),

  // Precificação
  getPrecificacao:         (params)  => api.get('/financeiro/precificacao', { params }),
  classificarPrecificacao: (data)    => api.post('/financeiro/precificacao/classificar', data),
  classificarCliente:      (data)    => api.post('/financeiro/precificacao/cliente', data),
}

export const quickUpdateAPI = {
  parse:   (text)    => api.post('/quick-update/parse', { text }),
  apply:   (payload) => api.post('/quick-update/apply', payload),
  history: ()        => api.get('/quick-update/history'),
}

export const clientesAPI = {
  getAll:  ()         => api.get('/clientes'),
  create:  (data)     => api.post('/clientes', data),
  update:  (id, data) => api.put(`/clientes/${id}`, data),
  remove:  (id)       => api.delete(`/clientes/${id}`),
}

export const cortesAPI = {
  getAll:  ()         => api.get('/cortes'),
  create:  (data)     => api.post('/cortes', data),
  update:  (id, data) => api.put(`/cortes/${id}`, data),
  remove:  (id)       => api.delete(`/cortes/${id}`),
}

export const projetosAdicionaisAPI = {
  getAll: ()         => api.get('/projetos-adicionais'),
  create: (data)     => api.post('/projetos-adicionais', data),
  update: (id, data) => api.put(`/projetos-adicionais/${id}`, data),
  remove: (id)       => api.delete(`/projetos-adicionais/${id}`),
}

export const comissoesAPI = {
  getAll: ()         => api.get('/comissoes'),
  create: (data)     => api.post('/comissoes', data),
  update: (id, data) => api.put(`/comissoes/${id}`, data),
  remove: (id)       => api.delete(`/comissoes/${id}`),
}

export const despesasLocaisAPI = {
  getAll: ()         => api.get('/despesas-locais'),
  create: (data)     => api.post('/despesas-locais', data),
  update: (id, data) => api.put(`/despesas-locais/${id}`, data),
  remove: (id)       => api.delete(`/despesas-locais/${id}`),
}

export const fechamentoAPI = {
  getAll:             ()              => api.get('/fechamento'),
  get:                (competencia)   => api.get(`/fechamento/${competencia}`),
  save:               (data)          => api.post('/fechamento', data),
  update:             (id, data)      => api.put(`/fechamento/${id}`, data),
  remove:             (id)            => api.delete(`/fechamento/${id}`),
  saveClientesExtras: (id, lista)     => api.put(`/fechamento/${id}`, { clientes_extras: lista }),
}

export default api
