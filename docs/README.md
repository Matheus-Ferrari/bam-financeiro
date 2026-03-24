# BAM Financeiro — Sistema de Gestão Financeira

Sistema WebApp profissional para gestão financeira da BAM.  
Evolução da planilha Excel para um dashboard executivo completo.

---

## Stack

| Camada    | Tecnologia                              |
|-----------|-----------------------------------------|
| Frontend  | React 18 · Vite · Tailwind CSS · Recharts · Lucide |
| Backend   | Python · FastAPI · Pandas · Openpyxl   |
| Dados     | Excel (Fase 1) → Banco de dados (Fase 2) |

---

## Estrutura do Projeto

```
Bam-FINANCEIRO/
├── backend/
│   ├── app/
│   │   ├── main.py                     # FastAPI app principal
│   │   ├── routes/
│   │   │   ├── health.py               # GET /health
│   │   │   ├── excel.py                # GET /excel/sheets
│   │   │   └── financeiro.py           # GET /financeiro/*
│   │   ├── services/
│   │   │   ├── excel_service.py        # Leitura robusta do Excel
│   │   │   ├── financeiro_service.py   # KPIs, receitas, despesas, alertas
│   │   │   └── projection_service.py   # Projeções e cenários de corte
│   │   └── utils/
│   │       ├── formatters.py           # Formatos monetários BR
│   │       └── helpers.py              # Utilitários gerais
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx           # Visão executiva principal
│   │   │   ├── Receitas.jsx            # Tabela + filtros de receitas
│   │   │   ├── Despesas.jsx            # Tabela + composição de despesas
│   │   │   ├── Projecoes.jsx           # Simulador de crescimento
│   │   │   ├── Cenarios.jsx            # Cenários de corte de custos
│   │   │   └── Configuracoes.jsx       # Status + configurações
│   │   ├── components/
│   │   │   ├── ui/                     # Card, Badge, Button, etc.
│   │   │   ├── dashboard/              # KPICard, AlertsList, ResumoMensal
│   │   │   ├── charts/                 # ReceitasDespesasChart, ComposicaoChart
│   │   │   └── tables/                 # DataTable genérica
│   │   ├── hooks/useFinanceiro.js      # Hooks de fetch de dados
│   │   ├── services/api.js             # Cliente Axios
│   │   ├── utils/formatters.js         # Formatação BR
│   │   └── layouts/MainLayout.jsx      # Sidebar + header
│   └── package.json
└── data/
    └── Financeiro_BAM_Fase1_BI.xlsx    # Fonte de dados Excel
```

---

## Como Rodar

### 1. Backend

```bash
cd backend

# Criar ambiente virtual
python -m venv .venv

# Ativar (Windows PowerShell)
.venv\Scripts\Activate.ps1

# Instalar dependências
pip install -r requirements.txt

# Rodar o servidor
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API disponível em: http://localhost:8000  
Documentação interativa: http://localhost:8000/docs

### 2. Frontend

```bash
cd frontend

# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev
```

App disponível em: http://localhost:5173

---

## Endpoints da API

| Método | Endpoint                   | Descrição                            |
|--------|----------------------------|--------------------------------------|
| GET    | `/health`                  | Status da API                        |
| GET    | `/excel/sheets`            | Abas detectadas no Excel             |
| GET    | `/financeiro/kpis`         | KPIs principais (receita, margem...) |
| GET    | `/financeiro/resumo`       | Visão consolidada mensal             |
| GET    | `/financeiro/receitas`     | Lista e agregações de receitas       |
| GET    | `/financeiro/despesas`     | Lista e agregações de despesas       |
| GET    | `/financeiro/alertas`      | Alertas financeiros automáticos      |
| GET    | `/financeiro/projecoes`    | Simulação de crescimento (params)    |
| GET    | `/financeiro/cenarios`     | Cenários de corte de despesas        |

### Parâmetros de Projeção

```
GET /financeiro/projecoes?crescimento_pct=10&novos_clientes_crm=10&meses=6
```

---

## Identidade Visual

| Token          | Valor     | Uso                          |
|----------------|-----------|------------------------------|
| Verde BAM      | `#12F0C6` | Destaque · ações · KPIs      |
| Grafite        | `#272C30` | Cards · superfícies          |
| Preto          | `#000000` | Background principal          |

---

## Fallback Inteligente

O sistema opera em modo **mock** quando o Excel não está disponível ou não possui
as abas esperadas. Os dados mock são realistas (empresa digital em crescimento)
e permitem desenvolvimento e demonstração sem o arquivo real.

Para ver o status: `GET /excel/sheets` → campo `usando_mock`.

---

## Roadmap

- [ ] Fase 2: Banco de dados PostgreSQL
- [ ] CRM — gestão de clientes por plano
- [ ] Autenticação multi-usuário
- [ ] Planos comerciais e simulador de pricing
- [ ] Integração com marketing e campanhas
- [ ] App mobile (React Native)
