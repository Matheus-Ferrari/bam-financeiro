"""
BAM Financeiro - API Principal
Ponto de entrada da aplicação FastAPI.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Carrega sempre o arquivo backend/.env, mesmo que o processo seja iniciado fora da pasta backend.
_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(dotenv_path=_ENV_PATH)

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import auth, clientes, cortes, excel, financeiro, health, quick_update, projetos_adicionais, comissoes, despesas_locais
from app.utils.auth import require_auth

app = FastAPI(
    title="BAM Financeiro API",
    description="Sistema financeiro BAM — API v1.0",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────
_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
]
_frontend_url = os.getenv("FRONTEND_URL", "")
if _frontend_url:
    _origins.append(_frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rotas públicas ───────────────────────────────────────────────────────
app.include_router(health.router, tags=["health"])
app.include_router(auth.router)     # /auth/login, /auth/logout, /auth/me

# ── Rotas protegidas (exigem sessão válida) ───────────────────────────────
_auth = [Depends(require_auth)]
app.include_router(excel.router,      prefix="/excel",      tags=["excel"],      dependencies=_auth)
app.include_router(financeiro.router, prefix="/financeiro", tags=["financeiro"], dependencies=_auth)
app.include_router(clientes.router,   prefix="/clientes",   tags=["clientes"],   dependencies=_auth)
app.include_router(cortes.router,     prefix="/cortes",     tags=["cortes"],     dependencies=_auth)
app.include_router(quick_update.router, dependencies=_auth)
app.include_router(projetos_adicionais.router, prefix="/projetos-adicionais", tags=["projetos-adicionais"], dependencies=_auth)
app.include_router(comissoes.router,           prefix="/comissoes",           tags=["comissoes"],           dependencies=_auth)
app.include_router(despesas_locais.router,     prefix="/despesas-locais",     tags=["despesas-locais"],     dependencies=_auth)


@app.get("/", tags=["root"])
def root():
    return {
        "sistema": "BAM Financeiro",
        "versao": "1.0.0",
        "status": "online",
        "docs": "/docs",
    }
