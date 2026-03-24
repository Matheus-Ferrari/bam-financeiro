import axios from 'axios'

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL:         BASE,
  timeout:         15_000,
  headers:         { 'Content-Type': 'application/json' },
  withCredentials: true,  // envia/recebe cookies em requisições cross-origin
})

// Interceptor global: reinicia no root em caso de sessão expirada
api.interceptors.response.use(
  response => response,
  error => {
    const is401       = error.response?.status === 401
    const isAuthRoute = error.config?.url?.includes('/auth/')
    if (is401 && !isAuthRoute) {
      window.location.href = '/'
    }
    return Promise.reject(error)
  }
)

export const authAPI = {
  login:  (code) => api.post('/auth/login', { code }),
  logout: ()     => api.post('/auth/logout'),
  me:     ()     => api.get('/auth/me'),
}

export const healthAPI = {
  check: () => api.get('/health'),
}

export const excelAPI = {
  getSheets: () => api.get('/excel/sheets'),
}

export const financeiroAPI = {
  getKpis:     ()       => api.get('/financeiro/kpis'),
  getResumo:   ()       => api.get('/financeiro/resumo'),
  getReceitas: ()       => api.get('/financeiro/receitas'),
  getDespesas: ()       => api.get('/financeiro/despesas'),
  getAlertas:  ()       => api.get('/financeiro/alertas'),
  getProjecoes:(params) => api.get('/financeiro/projecoes', { params }),
  getCenarios: ()       => api.get('/financeiro/cenarios'),
  getSaude:    ()       => api.get('/financeiro/saude'),
  getInsights: ()       => api.get('/financeiro/insights'),
  getOperacaoMes: ()    => api.get('/financeiro/operacao-mes'),
  getCaixa:      ()     => api.get('/financeiro/caixa'),
  updateCaixa:   (data) => api.post('/financeiro/caixa', data),
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

export default api
