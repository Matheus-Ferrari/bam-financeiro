"""
Rotas de autenticação: /auth/login · /auth/logout · /auth/me
"""

from typing import Optional

from fastapi import APIRouter, Cookie, HTTPException, Response
from pydantic import BaseModel

from app.utils.auth import (
    COOKIE_NAME,
    auth_bypass_enabled,
    bypass_payload,
    check_access_code,
    cookie_kwargs,
    create_token,
    verify_token,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    code: str


@router.post("/login")
def login(body: LoginRequest, response: Response):
    """Valida o código de acesso e define o cookie de sessão."""
    if not check_access_code(body.code):
        raise HTTPException(status_code=401, detail="Código de acesso inválido.")

    token = create_token()
    kw    = cookie_kwargs()
    response.set_cookie(value=token, **kw)
    return {"ok": True, "message": "Autenticado com sucesso."}


@router.post("/logout")
def logout(response: Response):
    """Remove o cookie de sessão."""
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"ok": True, "message": "Sessão encerrada."}


@router.get("/me")
def me(bam_session: Optional[str] = Cookie(default=None)):
    """Retorna status de autenticação da sessão atual."""
    if auth_bypass_enabled():
        payload = bypass_payload()
        return {"authenticated": True, "sub": payload.get("sub")}

    payload = verify_token(bam_session or "")
    if not payload:
        raise HTTPException(status_code=401, detail="Não autenticado.")
    return {"authenticated": True, "sub": payload.get("sub")}
