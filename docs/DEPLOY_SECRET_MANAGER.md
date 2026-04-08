# BAM Financeiro — Deploy com Google Cloud Secret Manager

Guia de referência rápida para configurar credenciais Firebase via
Google Cloud Secret Manager e fazer o deploy do backend.

---

## Índice

1. [Por que Secret Manager?](#1-por-que-secret-manager)
2. [Criar o secret (passo que você ainda não fez)](#2-criar-o-secret)
3. [Variáveis de ambiente para o deploy](#3-variáveis-de-ambiente)
4. [Rodar localmente (fallback de arquivo)](#4-rodar-localmente)
5. [Testar após o deploy](#5-testar)
6. [Migração inicial: Excel → Firestore](#6-migração-inicial)
7. [Bootstrap do Firestore](#7-bootstrap)
8. [Avisos de segurança](#8-segurança)

---

## 1. Por que Secret Manager?

| Opção                  | Vantagem                          | Desvantagem          |
|------------------------|-----------------------------------|----------------------|
| Arquivo JSON local     | Simples para dev                  | Não pode ir ao git   |
| Variável de ambiente   | Funciona em qualquer PaaS         | JSON inteiro na env  |
| **Secret Manager** ✅  | Rotação, auditoria, RBAC no GCP   | Requer permissão IAM |

O backend usa Secret Manager como **fonte primária** e aceita arquivo local
como fallback somente para desenvolvimento.

---

## 2. Criar o secret

> **Você ainda não criou o secret.** Execute estes comandos:

```bash
# 1. Aponta o CLI para o projeto correto
gcloud config set project bam-financeiro

# 2. Habilita a API (necessário uma única vez)
gcloud services enable secretmanager.googleapis.com

# 3. Cria o secret (a replicação automática distribui globalmente)
gcloud secrets create firebase-service-account \
  --replication-policy="automatic"

# 4. Adiciona o conteúdo do JSON baixado do Firebase Console
#    (NUNCA commite o arquivo JSON no git)
gcloud secrets versions add firebase-service-account \
  --data-file="bam-financeiro-firebase-adminsdk-fbsvc-fbc5002504.json"

# 5. Confirma que a versão foi criada
gcloud secrets versions list firebase-service-account
```

### Permissão para a Service Account acessar o secret

Quando o backend roda no Cloud Run, a Service Account padrão precisa da
permissão `Secret Manager Secret Accessor`:

```bash
# Descubra o e-mail da SA usada pelo Cloud Run
SA_EMAIL=$(gcloud run services describe bam-financeiro-backend \
  --region=southamerica-east1 \
  --format='value(spec.template.spec.serviceAccountName)')

# Adiciona a permissão ao secret
gcloud secrets add-iam-policy-binding firebase-service-account \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor"
```

> Se você estiver usando a SA padrão do Compute:  
> `{PROJECT_NUMBER}-compute@developer.gserviceaccount.com`

---

## 3. Variáveis de ambiente para o deploy

Configure **exatamente** estas variáveis no seu serviço (Cloud Run, Render,
Railway, Fly.io, etc.):

| Variável                | Valor obrigatório              | Observação                                   |
|-------------------------|-------------------------------|----------------------------------------------|
| `FIREBASE_PROJECT_ID`   | `bam-financeiro`              | ID do projeto GCP                            |
| `FIREBASE_SECRET_NAME`  | `firebase-service-account`    | Nome exato do secret criado acima            |
| `FIREBASE_SECRET_VERSION`| `latest`                     | Ou o número da versão (ex: `1`)              |
| `FIREBASE_COMPANY_ID`   | `bam`                         | ID do tenant no Firestore                    |
| `SECRET_KEY`            | *(string longa aleatória)*    | Assinar cookies de sessão                    |
| `ACCESS_CODE`           | *(senha de acesso ao app)*    | Código que o usuário digita no login         |
| `AUTH_BYPASS`           | `false`                       | **Nunca `true` em produção**                 |
| `ENVIRONMENT`           | `production`                  | Ativa cookies Secure + SameSite=None         |
| `FRONTEND_URL`          | `https://seu-dominio.com`     | Adicionado ao CORS                           |
| `TOKEN_EXPIRE_HOURS`    | `24`                          | Validade do cookie de sessão                 |

### Exemplo para Cloud Run (gcloud)

```bash
gcloud run services update bam-financeiro-backend \
  --region=southamerica-east1 \
  --set-env-vars="
FIREBASE_PROJECT_ID=bam-financeiro,
FIREBASE_SECRET_NAME=firebase-service-account,
FIREBASE_SECRET_VERSION=latest,
FIREBASE_COMPANY_ID=bam,
AUTH_BYPASS=false,
ENVIRONMENT=production,
FRONTEND_URL=https://bam-financeiro.vercel.app,
TOKEN_EXPIRE_HOURS=24" \
  --set-secrets="SECRET_KEY=bam-secret-key:latest,ACCESS_CODE=bam-access-code:latest"
```

---

## 4. Rodar localmente (fallback de arquivo)

Para desenvolvimento local sem acesso ao Secret Manager:

```bash
# backend/.env  — adicione APENAS UMA das duas opções abaixo:

# Opção A — Secret Manager (precisa de ADC configurado)
FIREBASE_SECRET_NAME=firebase-service-account
FIREBASE_SECRET_VERSION=latest
FIREBASE_PROJECT_ID=bam-financeiro

# Opção B — arquivo local (mais simples para dev)
# FIREBASE_CREDENTIALS_PATH=./bam-financeiro-firebase-adminsdk-fbsvc-fbc5002504.json
# FIREBASE_PROJECT_ID=bam-financeiro

FIREBASE_COMPANY_ID=bam
AUTH_BYPASS=true   # só em dev — NUNCA em produção
```

Para Opção A local, configure ADC:

```bash
gcloud auth application-default login
```

Para Opção B, certifique-se de que o arquivo JSON está listado no `.gitignore`
(já foi adicionado no padrão `*firebase-adminsdk*.json`).

---

## 5. Testar após o deploy

### 5.1 Health check

```bash
curl https://SEU_BACKEND_URL/health
# Esperado: {"status": "ok", ...}
```

### 5.2 Bootstrap do Firestore (primeira vez)

```bash
# Em dev (AUTH_BYPASS=true):
curl -X POST http://localhost:8000/admin/bootstrap
# Esperado: {"ok": true, "company_id": "bam", "resultado": {...}}

# Em produção (requer Bearer token com role=admin):
curl -X POST https://SEU_BACKEND_URL/admin/bootstrap \
  -H "Authorization: Bearer SEU_FIREBASE_ID_TOKEN"
```

### 5.3 KPIs (após importar dados do Excel)

```bash
# Com cookie de sessão (frontend legado):
curl http://localhost:8000/financeiro/kpis \
  -H "Cookie: bam_session=SEU_TOKEN"

# Esperado: {"fonte": "firestore", "kpis": {...}}
# Se Firestore estiver vazio: {"fonte": "mock", ...}
```

### 5.4 Endpoints completos disponíveis

```
GET  /health
POST /auth/login
POST /auth/logout
GET  /auth/me
POST /admin/bootstrap         ← novo
GET  /financeiro/resumo
GET  /financeiro/kpis
GET  /financeiro/receitas
GET  /financeiro/despesas
GET  /financeiro/fluxo-caixa
GET  /financeiro/projecoes
GET  /financeiro/saude
GET  /clientes
POST /clientes
PUT  /clientes/{id}
DELETE /clientes/{id}
GET  /cortes
...
```

---

## 6. Migração inicial: Excel → Firestore

Execute **uma única vez** para popular o Firestore com os dados históricos:

```bash
# A partir do diretório backend/
cd backend

# Instala dependências (incluindo openpyxl para ler o Excel)
pip install -r requirements.txt

# Simulação: mostra o que seria importado sem gravar nada
python scripts/import_excel_to_firestore.py --dry-run

# Importação real (confira o .env antes)
python scripts/import_excel_to_firestore.py

# Forçar caminho diferente do Excel:
python scripts/import_excel_to_firestore.py \
  --excel /caminho/para/Financeiro_BAM_Fase1_BI.xlsx \
  --company bam
```

O script:
- Lê a aba **"Base Receitas"** → `companies/bam/receitas`
- Lê a aba **"Base Despesas"** → `companies/bam/despesas`
- Usa `legacy_key` (hash SHA-256 dos campos) para idempotência: rodar duas
  vezes não duplica registros.
- Exibe contagem de criados / atualizados / ignorados por coleção.

---

## 7. Bootstrap do Firestore

O bootstrap é necessário para criar a estrutura mínima antes da primeira
utilização (garante o documento `companies/bam` e materializa as coleções).

```bash
# Forma mais simples (com AUTH_BYPASS=true no .env):
curl -X POST http://localhost:8000/admin/bootstrap

# Alternativa via Python (antes de subir o servidor):
cd backend
python - <<'EOF'
import os; from dotenv import load_dotenv; load_dotenv(".env")
from app.services.bootstrap_service import bootstrap_firestore
print(bootstrap_firestore(os.getenv("FIREBASE_COMPANY_ID", "bam")))
EOF
```

---

## 8. Avisos de segurança

> ⚠️ **NUNCA commite o arquivo JSON da Service Account no git.**

O `.gitignore` já bloqueia os padrões:
```
*firebase-adminsdk*.json
*serviceAccountKey*.json
*.service-account.json
```

Checklist de segurança:
- [ ] `AUTH_BYPASS=false` em produção.
- [ ] `SECRET_KEY` é uma string longa e aleatória (não reutilizar entre ambientes).
- [ ] O service account JSON **não** está versionado.
- [ ] O secret no Secret Manager tem auditoria de acesso ativada.
- [ ] As regras do Firestore exigem autenticação (não `allow read, write: if true`).
- [ ] `ENVIRONMENT=production` para cookies seguros.
- [ ] `FRONTEND_URL` configurado para o domínio correto (restringe CORS).
