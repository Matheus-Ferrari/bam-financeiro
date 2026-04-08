"""
Utilitários de autenticação.

Suporta dois mecanismos (em ordem de preferência):
  1. Firebase Bearer token  — Authorization: Bearer <firebase_id_token>
     Verifica o token com Firebase Admin SDK.  O uid e companyId vêm do
     Firestore (coleção `users/{uid}`).
  2. Cookie HMAC (legado)   — bam_session=<token>
     Mantém compatibilidade com o frontend existente que usa cookies.
     Todos os requests autenticados via cookie usam FIREBASE_COMPANY_ID
     como tenant (variável de ambiente).

Toda a lógica de sessão está centralizada aqui.
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import time
from typing import Optional

from fastapi import Cookie, Header, HTTPException, status

logger = logging.getLogger(__name__)

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


# ── Helpers de token HMAC (cookie) ───────────────────────────────────────

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


# ── Verificação de Bearer token Firebase ─────────────────────────────────

def _verify_firebase_bearer(authorization: Optional[str]) -> Optional[dict]:
    """
    Extrai e verifica o Firebase ID token do header Authorization.
    Retorna um payload com uid, email, company_id ou None se inválido.
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None
    id_token = authorization[len("Bearer "):]
    try:
        from app.firebase_app import verify_firebase_token, COMPANY_ID
        decoded = verify_firebase_token(id_token)
        if not decoded:
            return None
        uid        = decoded.get("uid", "")
        email      = decoded.get("email", "")
        company_id = _lookup_company(uid) or COMPANY_ID
        return {
            "sub":        uid,
            "email":      email,
            "company_id": company_id,
            "firebase":   True,
            "authenticated": True,
        }
    except Exception as exc:
        logger.debug("Falha ao verificar Bearer Firebase: %s", exc)
        return None


def _lookup_company(uid: str) -> Optional[str]:
    """
    Busca o companyId do usuário no Firestore (coleção `users/{uid}`).
    Retorna None se não encontrado.
    """
    try:
        from app.firebase_app import get_db
        doc = get_db().collection("users").document(uid).get()
        if doc.exists:
            return doc.to_dict().get("companyId")
    except Exception as exc:
        logger.debug("Falha ao buscar companyId para uid=%s: %s", uid, exc)
    return None


# ── Dependência FastAPI ───────────────────────────────────────────────────

def require_auth(
    bam_session:   Optional[str] = Cookie(default=None),
    authorization: Optional[str] = Header(default=None),
) -> dict:
    """
    Dependência FastAPI — aceita Bearer Firebase OU cookie HMAC.

    Prioridade:
      1. Se AUTH_BYPASS=true → retorna payload sintético.
      2. Se header Authorization: Bearer <token> → verifica Firebase token.
      3. Se cookie bam_session → verifica token HMAC.
      4. Caso contrário → HTTP 401.
    """
    if auth_bypass_enabled():
        return bypass_payload()

    # ── Firebase Bearer token ─────────────────────────────────────────
    if authorization:
        payload = _verify_firebase_bearer(authorization)
        if payload:
            return payload
        # Se o header estava presente mas é inválido → falha explícita
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token Firebase inválido ou expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # ── Cookie HMAC (legado) ──────────────────────────────────────────
    payload = verify_token(bam_session or "")
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Não autenticado. Faça login para continuar.",
        )

    from app.firebase_app import COMPANY_ID
    payload.setdefault("company_id", COMPANY_ID)
    return payload
