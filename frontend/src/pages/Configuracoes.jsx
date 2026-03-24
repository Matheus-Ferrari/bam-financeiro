import { useHealth } from '../hooks/useFinanceiro'
import { excelAPI } from '../services/api'
import { useState } from 'react'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import { FileSpreadsheet, Server, RefreshCw, CheckCircle, XCircle } from 'lucide-react'

export default function Configuracoes() {
  const { data: health, loading: healthLoading, refetch: refetchHealth } = useHealth()
  const [sheets,    setSheets]    = useState(null)
  const [loadingXL, setLoadingXL] = useState(false)
  const [errorXL,   setErrorXL]   = useState(null)

  const testExcel = async () => {
    setLoadingXL(true); setErrorXL(null)
    try {
      const res = await excelAPI.getSheets()
      setSheets(res.data)
    } catch (e) {
      setErrorXL(e?.response?.data?.detail || 'Erro ao conectar')
    } finally {
      setLoadingXL(false)
    }
  }

  const apiOk = health?.status === 'ok'

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">

      {/* Status da API */}
      <Card title="Status da API" subtitle="Conectividade com o backend">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Server size={20} className="text-gray-500" />
            <div>
              <p className="text-sm text-white font-medium">Backend FastAPI</p>
              <p className="text-xs text-gray-500">http://localhost:8000</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {healthLoading ? (
              <Badge variant="neutral">Verificando...</Badge>
            ) : apiOk ? (
              <Badge variant="success" dot>Online</Badge>
            ) : (
              <Badge variant="error" dot>Offline</Badge>
            )}
            <Button variant="ghost" size="sm" onClick={refetchHealth}>
              <RefreshCw size={12} /> Testar
            </Button>
          </div>
        </div>
        {health && (
          <div className="mt-4 text-xs text-gray-500 space-y-1 pt-4 border-t"
               style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p>Versão: <span className="text-gray-300">{health.versao}</span></p>
            <p>Timestamp: <span className="text-gray-300">{health.timestamp}</span></p>
          </div>
        )}
      </Card>

      {/* Status do Excel */}
      <Card title="Arquivo Excel" subtitle="Fonte de dados principal">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet size={20} className="text-gray-500" />
            <div>
              <p className="text-sm text-white font-medium">Financeiro_BAM_Fase1_BI.xlsx</p>
              <p className="text-xs text-gray-500">/data/Financeiro_BAM_Fase1_BI.xlsx</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={testExcel} disabled={loadingXL}>
            <RefreshCw size={12} className={loadingXL ? 'animate-spin' : ''} />
            {loadingXL ? 'Lendo...' : 'Verificar Excel'}
          </Button>
        </div>

        {errorXL && <p className="mt-3 text-xs text-red-400">{errorXL}</p>}

        {sheets && (
          <div className="mt-4 pt-4 border-t space-y-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-2">
              {sheets.carregado
                ? <CheckCircle size={14} style={{ color: '#12F0C6' }} />
                : <XCircle    size={14} className="text-red-400" />}
              <span className="text-xs" style={{ color: sheets.carregado ? '#12F0C6' : '#EF4444' }}>
                {sheets.carregado ? 'Excel carregado com sucesso' : 'Arquivo não encontrado — usando dados mock'}
              </span>
            </div>

            {sheets.abas?.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Abas detectadas:</p>
                <div className="flex flex-wrap gap-2">
                  {sheets.abas.map((aba) => (
                    <Badge key={aba} variant="neutral">{aba}</Badge>
                  ))}
                </div>
              </div>
            )}

            {Object.keys(sheets.mapeamento ?? {}).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-2">Mapeamento automático:</p>
                <div className="space-y-1">
                  {Object.entries(sheets.mapeamento).map(([tipo, aba]) => (
                    <div key={tipo} className="flex items-center gap-2 text-xs">
                      <Badge variant="info">{tipo}</Badge>
                      <span className="text-gray-400">→</span>
                      <span className="text-gray-300">{aba}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Informações do Sistema */}
      <Card title="Sobre o Sistema" subtitle="BAM Financeiro v1.0.0">
        <div className="space-y-3 text-xs">
          {[
            ['Sistema',    'BAM Financeiro'],
            ['Versão',     '1.0.0'],
            ['Frontend',   'React 18 + Vite + Tailwind CSS'],
            ['Backend',    'Python + FastAPI + Pandas'],
            ['Gráficos',   'Recharts'],
            ['Ícones',     'Lucide React'],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between py-2 border-b" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <span className="text-gray-500">{k}</span>
              <span className="text-gray-300 font-medium">{v}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Futuras configurações */}
      <Card title="Configurações Futuras" subtitle="Expansão planejada">
        <div className="space-y-2">
          {[
            'Conexão com banco de dados (PostgreSQL)',
            'Autenticação e controle de acesso',
            'CRM — gestão de clientes',
            'Planos comerciais e precificação',
            'Marketing e campanhas',
            'Notificações e alertas por e-mail',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 text-xs text-gray-500 py-1">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: 'rgba(255,255,255,0.15)' }} />
              {item}
            </div>
          ))}
        </div>
      </Card>

    </div>
  )
}
