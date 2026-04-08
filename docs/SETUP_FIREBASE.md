# BAM Financeiro — Setup Firebase

Guia completo para configurar Firebase (Firestore + Authentication) como
backend de persistência, substituindo os arquivos Excel e JSON locais.

---

## Índice

1. [Visão geral da arquitetura](#1-visão-geral)
2. [Criar projeto Firebase](#2-criar-projeto-firebase)
3. [Ativar Authentication](#3-ativar-authentication)
4. [Ativar Firestore](#4-ativar-firestore)
5. [Criar Service Account e baixar JSON](#5-service-account)
6. [Configurar variáveis de ambiente](#6-variáveis-de-ambiente)
7. [Instalar dependências e rodar localmente](#7-rodar-localmente)
8. [Migrar dados existentes (JSON → Firestore)](#8-migrar-dados)
9. [Criar o primeiro usuário/empresa](#9-primeiro-usuário)
10. [Testar com curl / Postman](#10-testes)
11. [Checklist de próximos passos](#11-checklist)
12. [Modelo de dados Firestore](#12-modelo-de-dados)
13. [Decisões de design e mudanças de contrato](#13-mudanças-de-contrato)

---

## 1. Visão geral

```
Frontend (React/Vite)
      │  HTTP (cookie bam_session ou Authorization: Bearer)
      ▼
Backend (FastAPI / Python)
      │  Firebase Admin SDK
      ├──▶  Cloud Firestore  ← persistência principal
      └──▶  Firebase Auth    ← verificação de JWT (Bearer tokens)
```

### Dois modos de autenticação (compatibilidade)

| Modo                      | Como funciona                                       | Quem usa         |
|---------------------------|-----------------------------------------------------|------------------|
| **Cookie HMAC (legado)**  | Frontend envia `bam_session` cookie; backend valida | Frontend atual   |
| **Bearer Firebase (novo)**| Cliente envia `Authorization: Bearer <id_token>`    | Futuros clients  |

Em ambos os modos o backend lê/escreve no mesmo Firestore da empresa definida
em `FIREBASE_COMPANY_ID`.

---

## 2. Criar projeto Firebase

1. Acesse [console.firebase.google.com](https://console.firebase.google.com)
2. Clique em **"Adicionar projeto"**
3. Escolha o nome (ex: `bam-financeiro-prod`)
4. Desative Google Analytics se não precisar
5. Clique em **"Criar projeto"**

---

## 3. Ativar Authentication

1. No console do projeto → **Build → Authentication**
2. Clique em **"Primeiros passos"**
3. Na aba **"Sign-in method"**, ative **"E-mail/senha"**
4. Clique em **"Salvar"**

> Para autenticar usuários via Bearer token no futuro, o frontend precisará
> usar o Firebase SDK (ex: `signInWithEmailAndPassword`).

---

## 4. Ativar Firestore

1. No console do projeto → **Build → Firestore Database**
2. Clique em **"Criar banco de dados"**
3. Escolha **"Iniciar no modo de produção"** (recomendado)
4. Escolha a região mais próxima (ex: `southamerica-east1`)
5. Clique em **"Criar"**

### Regras de segurança recomendadas (ponto de partida)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Usuários — somente o próprio uid ou admin lê/escreve
    match /users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }

    // Dados da empresa — apenas usuários autenticados da empresa
    match /companies/{companyId}/{document=**} {
      allow read, write: if request.auth != null
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.companyId == companyId;
    }
  }
}
```

> **Nota**: o backend acessa o Firestore via **Admin SDK** (service account),
> que ignora as regras de segurança. As regras protegem acessos diretos
> do cliente (ex: SDK JS no browser).

---

## 5. Service Account

1. No console do projeto → ⚙️ **Configurações do projeto → Contas de serviço**
2. Clique em **"Gerar nova chave privada"**
3. Salve o arquivo JSON como `backend/serviceAccountKey.json`
4. **NUNCA** commite este arquivo no git  
   (adicione `serviceAccountKey.json` ao `.gitignore`)

---

## 6. Variáveis de ambiente

```bash
# Na pasta backend/
cp .env.example .env
```

Edite `backend/.env`:

```dotenv
FIREBASE_CREDENTIALS_PATH=./serviceAccountKey.json
FIREBASE_PROJECT_ID=bam-financeiro-prod     # substitua pelo ID real
FIREBASE_COMPANY_ID=bam                     # ID da empresa padrão no Firestore

SECRET_KEY=<string-aleatória-32-chars>      # python -c "import secrets; print(secrets.token_hex(32))"
ACCESS_CODE=sua-senha-de-acesso
AUTH_BYPASS=false
ENVIRONMENT=development
```

---

## 7. Rodar localmente

```bash
# 1. Criar e ativar ambiente virtual
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows
# source .venv/bin/activate     # Linux/Mac

# 2. Instalar dependências
pip install -r requirements.txt

# 3. Iniciar servidor
uvicorn app.main:app --reload
# API disponível em http://localhost:8000
# Docs Swagger em http://localhost:8000/docs
```

Ao iniciar, o backend conecta no Firestore. Se as credenciais estiverem erradas
você verá um erro de startup e o servidor não subirá.

---

## 8. Migrar dados existentes

Se você já tem dados nos arquivos JSON em `/data/`, rode o script de migração
**uma única vez** para importar tudo para o Firestore:

```bash
cd backend
python scripts/migrate_json_to_firestore.py
```

O script:
- Lê os arquivos JSON de `/data/`
- Importa para `companies/{FIREBASE_COMPANY_ID}/{coleção}`
- Preserva os IDs existentes (campo `id` de cada registro)

> **Receitas e Despesas (antes no Excel)**: o script não migra esses dados.
> Você precisará inserir manualmente via API:
> ```
> POST /financeiro/receitas  (endpoint a ser criado, ou diretamente pelo console Firebase)
> ```
> Veja o Apêndice A no final deste documento para script de importação do Excel.

---

## 9. Criar o primeiro usuário/empresa

### 9a. Criar empresa no Firestore

No console Firebase → Firestore → coleção `companies` → "Adicionar documento":

```
Documento ID: bam       ← deve bater com FIREBASE_COMPANY_ID
Campos:
  companyId: "bam"
  nome: "BAM Comunicação"
  criadoEm: <timestamp>
```

### 9b. Criar usuário no Firebase Auth

```bash
# Com Firebase CLI (npm install -g firebase-tools):
firebase auth:import --hash-algo=SCRYPT ...   # ou crie pelo console

# Pelo console: Authentication → Users → Adicionar usuário
# Email: admin@bam.com.br
# Senha: <senha-forte>
```

### 9c. Registrar usuário no Firestore

Na coleção `users`, crie o documento com ID = UID do Firebase Auth:

```
Documento ID: <uid-do-firebase-auth>
Campos:
  uid:       "<uid>"
  email:     "admin@bam.com.br"
  nome:      "Administrador BAM"
  companyId: "bam"
  role:      "admin"
  criadoEm:  <timestamp>
```

---

## 10. Testes

### Smoke test com cookie (frontend atual)

```bash
# Login (retorna cookie bam_session)
curl -c cookies.txt -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"code":"sua-senha-de-acesso"}'

# Verificar autenticação
curl -b cookies.txt http://localhost:8000/auth/me

# Listar clientes
curl -b cookies.txt http://localhost:8000/clientes

# KPIs financeiros
curl -b cookies.txt http://localhost:8000/financeiro/kpis
```

### Smoke test com Bearer token Firebase

```bash
# 1. Obtenha um ID token via Firebase REST API:
TOKEN=$(curl -s -X POST \
  "https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=<FIREBASE_WEB_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bam.com.br","password":"<senha>","returnSecureToken":true}' \
  | python -c "import sys,json; print(json.load(sys.stdin)['idToken'])")

# 2. Usar o token:
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/clientes
curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/financeiro/kpis
```

> A Web API Key está em: Console Firebase → Configurações do Projeto → Geral → Web API Key

### Criar uma receita via API

```bash
curl -b cookies.txt -X POST http://localhost:8000/financeiro/receitas \
  -H "Content-Type: application/json" \
  -d '{
    "mes": "abril",
    "servico": "Marketing Digital",
    "cliente": "Cliente X",
    "descricao": "Gestão de tráfego",
    "valor_previsto": 3500.00,
    "status": "pendente",
    "pagamento": "PIX"
  }'
```

---

## 11. Checklist de próximos passos

### Console Firebase

- [ ] Criar projeto Firebase
- [ ] Ativar Authentication (E-mail/senha)
- [ ] Ativar Firestore Database (modo produção)
- [ ] Configurar regras de segurança do Firestore
- [ ] Gerar chave de Service Account → salvar como `backend/serviceAccountKey.json`
- [ ] Criar documento `companies/bam` no Firestore
- [ ] Criar primeiro usuário no Firebase Auth
- [ ] Criar documento `users/{uid}` com `companyId: "bam"` e `role: "admin"`

### Ambiente local

- [ ] Copiar `.env.example` → `.env` e preencher valores
- [ ] Instalar dependências: `pip install -r requirements.txt`
- [ ] Rodar migração de dados JSON: `python scripts/migrate_json_to_firestore.py`
- [ ] Iniciar servidor: `uvicorn app.main:app --reload`
- [ ] Validar: `curl http://localhost:8000/health`
- [ ] Testar autenticação com cookie
- [ ] Testar KPIs: `curl -b cookies.txt http://localhost:8000/financeiro/kpis`

### Endpoint de criação de receitas/despesas (melhoria futura)

Os endpoints `POST /financeiro/receitas` e `POST /financeiro/despesas` não
existiam antes (dados vinham do Excel). Serão necessários para alimentar o
Firestore. Adicione-os a `backend/app/routes/financeiro.py` quando precisar.

---

## 12. Modelo de dados Firestore

```
companies/{companyId}/
  ├── clientes/{id}
  │     nome, status, tipo, valor_mensal, valor_previsto, valor_recebido,
  │     status_pagamento, data_pagamento, mes_referencia_pagamento,
  │     responsavel, observacoes, dia_pagamento, criado_em, atualizado_em
  │
  ├── cortes/{id}
  │     descricao, categoria, economia_mensal, status, ativo, observacao,
  │     criado_em, atualizado_em
  │
  ├── receitas/{id}                    ← NOVO (antes no Excel)
  │     mes, servico, cliente, descricao, valor_previsto, status, pagamento,
  │     criado_em, atualizado_em
  │
  ├── despesas/{id}                    ← NOVO (antes no Excel)
  │     mes, categoria, descricao, valor, status, pagamento,
  │     criado_em, atualizado_em
  │
  ├── projetos_adicionais/{id}
  │     cliente, tipo, nome, valor, competencia, data_vencimento,
  │     status_pagamento, data_recebimento, observacoes, criado_em, atualizado_em
  │
  ├── comissoes/{id}
  │     nome, responsavel, regra, valor, competencia, status, observacoes,
  │     criado_em, atualizado_em
  │
  ├── despesas_locais/{id}
  │     nome, categoria, subcategoria, valor, competencia, parcelado,
  │     total_parcelas, parcela_atual, status, observacoes, criado_em, atualizado_em
  │
  ├── movimentacoes/{id}
  │     tipo, descricao, valor, data, cliente_relacionado, categoria,
  │     observacao, origem, criado_em, atualizado_em
  │
  ├── caixa/{id}
  │     valor_anterior, valor_atual, delta, observacao, origem, data,
  │     criado_em, atualizado_em
  │
  ├── quick_updates/{id}
  │     input, parsed (sub-objeto), applied, created_at
  │
  ├── conciliacao/{id}
  │     lancamento_id, status_conciliacao, observacao, valor_extrato,
  │     data_conciliacao
  │
  └── status_overrides/{id}
        lancamento_id, status, valor_realizado, data_competencia,
        descricao, cliente, categoria, tipo, valor_previsto, origem,
        atualizado_em

users/{uid}                             ← coleção global (lookup de empresa)
  companyId, role, email, nome, criadoEm
```

### Índices compostos recomendados

| Coleção       | Campo 1        | Campo 2    | Uso                            |
|---------------|----------------|------------|--------------------------------|
| `receitas`    | `mes`          | `status`   | Filtrar por mês + status       |
| `despesas`    | `mes`          | `categoria`| Filtrar por mês + categoria    |
| `clientes`    | `status`       | `tipo`     | Filtrar ativos recorrentes     |
| `movimentacoes`| `data`        | `tipo`     | Fluxo por período e tipo       |

---

## 13. Mudanças de contrato HTTP

| Endpoint                        | Antes              | Depois              | Impacto           |
|---------------------------------|--------------------|---------------------|-------------------|
| `PUT /financeiro/despesas/{id}` | `id` = int (1-based)| `id` = string UUID | ⚠️ breaking       |
| `PUT /financeiro/receitas/{id}` | `id` = int (1-based)| `id` = string UUID | ⚠️ breaking       |
| `GET /financeiro/receitas`      | `fonte: "excel"`   | `fonte: "firestore"`| cosmético apenas  |
| `GET /financeiro/despesas`      | `fonte: "excel"`   | `fonte: "firestore"`| cosmético apenas  |
| `GET /financeiro/resumo`        | `fonte: "excel"`   | `fonte: "firestore"`| cosmético apenas  |
| `GET /excel/sheets`             | retorna info Excel | retorna placeholder | não usado no prod |

**Sobre o breaking change dos IDs em PUT**:  
O frontend busca os IDs via `GET /financeiro/receitas.lancamentos[*].id` e usa
em `PUT /financeiro/receitas/{id}`. Como os IDs agora são UUIDs retornados pelo
próprio GET, o frontend continuará funcionando **sem alteração de código** —
ele apenas usará IDs string em vez de int. A única incompatibilidade seria se
existissem chamadas PUT com IDs numéricos hard-coded, o que não ocorre no
frontend atual.

---

## Apêndice A — Importar Excel para Firestore

Se você tiver dados históricos no arquivo `Financeiro_BAM_Fase1_BI.xlsx`,
use o script abaixo para importar as abas "Base Receitas" e "Base Despesas":

```bash
# Instale openpyxl temporariamente
pip install openpyxl

# Execute o script (crie este arquivo manualmente ou adapte)
python scripts/import_excel_receitas_despesas.py
```

```python
# scripts/import_excel_receitas_despesas.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parents[1]))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parents[1] / ".env")

import pandas as pd
from app.repositories import receitas_repo, despesas_repo

EXCEL = Path(__file__).parents[2] / "data" / "Financeiro_BAM_Fase1_BI.xlsx"

def importar():
    # Receitas
    df_r = pd.read_excel(EXCEL, sheet_name="Base Receitas").dropna(how="all")
    for _, row in df_r.iterrows():
        receitas_repo.create({
            "mes":            str(row.get("Mês", "") or ""),
            "servico":        str(row.get("Serviço", "") or ""),
            "cliente":        str(row.get("Cliente", "") or ""),
            "descricao":      str(row.get("Descrição", "") or ""),
            "valor_previsto": float(row.get("Valor Previsto") or 0),
            "status":         str(row.get("Status") or ""),
            "pagamento":      str(row.get("Pagamento") or ""),
        })
    print(f"Receitas importadas: {len(df_r)}")

    # Despesas
    df_d = pd.read_excel(EXCEL, sheet_name="Base Despesas").dropna(how="all")
    for _, row in df_d.iterrows():
        despesas_repo.create({
            "mes":       str(row.get("Mês", "") or ""),
            "categoria": str(row.get("Categoria", "") or ""),
            "descricao": str(row.get("Despesa", "") or ""),
            "valor":     float(row.get("Valor") or 0),
            "status":    str(row.get("Status") or ""),
            "pagamento": str(row.get("Pagamento") or ""),
        })
    print(f"Despesas importadas: {len(df_d)}")

importar()
```
