"""
Utilitários de autenticação — token HMAC, sem dependências externas.
Toda a lógica de sessão está centralizada aqui.
"""

import base64
import hashlib
import hmac
import json
import os
import time
from typing import Optional

from fastapi import Cookie, HTTPException, status

# ── Configuração via variáveis de ambiente ────────────────────────────────

_SECRET_KEY    = os.getenv("SECRET_KEY",  "dev-secret-mude-em-producao-123456")
_ACCESS_CODE   = os.getenv("ACCESS_CODE", "")
_TOKEN_EXPIRE  = int(os.getenv("TOKEN_EXPIRE_HOURS", "24")) * 3600
_AUTH_BYPASS   = os.getenv("AUTH_BYPASS", "false").strip().lower() in {"1", "true", "yes", "on"}

COOKIE_NAME = "bam_session"


def auth_bypass_enabled() -> bool:
    """Indica se a autenticação foi temporariamente desabilitada por configuração."""
    return _AUTH_BYPASS


def bypass_payload() -> dict:
    """Payload sintético usado quando a autenticação está em bypass."""
    return {"sub": "bam_user", "authenticated": True, "bypass": True}


# ── Helpers de token ─────────────────────────────────────────────────────

def create_token(subject: str = "bam_user") -> str:
    """Cria um token HMAC-SHA256 assinado com expiração."""
    now     = int(time.time())
    payload = {"sub": subject, "iat": now, "exp": now + _TOKEN_EXPIRE}
    p_b64   = (
        base64.urlsafe_b64encode(json.dumps(payload, separators=(",", ":")).encode())
        .rstrip(b"=")
        .decode()
    )
    sig = hmac.new(
        _SECRET_KEY.encode("utf-8"),
        p_b64.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return f"{p_b64}.{sig}"


def verify_token(token: str) -> Optional[dict]:
    """Verifica assinatura e expiração. Retorna payload ou None."""
    if not token or "." not in token:
        return None
    try:
        idx   = token.rfind(".")
        p_b64 = token[:idx]
        sig   = token[idx + 1:]

        expected = hmac.new(
            _SECRET_KEY.encode("utf-8"),
            p_b64.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(sig, expected):
            return None

        padding = "=" * (-len(p_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(p_b64 + padding))

        if payload.get("exp", 0) < time.time():
            return None

        return payload
    except Exception:
        return None


def check_access_code(code: str) -> bool:
    """Compara o código recebido com ACCESS_CODE (timing-safe)."""
    if auth_bypass_enabled():
        return True
    if not _ACCESS_CODE:
        return False
    return hmac.compare_digest(code.strip(), _ACCESS_CODE.strip())


def cookie_kwargs() -> dict:
    """Argumentos do Set-Cookie adaptados ao ambiente (dev vs produção)."""
    prod = os.getenv("ENVIRONMENT", "development").lower() == "production"
    return dict(
        key      = COOKIE_NAME,
        httponly = True,
        secure   = prod,
        samesite = "none" if prod else "lax",
        max_age  = _TOKEN_EXPIRE,
        path     = "/",
    )


# ── Dependência FastAPI ───────────────────────────────────────────────────

def require_auth(bam_session: Optional[str] = Cookie(default=None)) -> dict:
    """
    Dependência FastAPI — verifica o cookie de sessão.
    Levanta HTTP 401 se inválido ou ausente.
    """
    if auth_bypass_enabled():
        return bypass_payload()

    payload = verify_token(bam_session or "")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado. Faça login para continuar.",
        )
    return payload
