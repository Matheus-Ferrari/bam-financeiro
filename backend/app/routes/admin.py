"""
Rotas /admin — operações administrativas da aplicação.

Proteção:
  - Se AUTH_BYPASS=true (dev): permite sem autenticação.
  - Caso contrário: requer Bearer Firebase com role=admin
    e companyId == FIREBASE_COMPANY_ID.

NÃO alterar endpoints existentes do frontend — estas rotas são exclusivamente
para operações de manutenção/deploy.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Header, HTTPException, status

from app.utils.auth import auth_bypass_enabled

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(authorization: Optional[str]) -> None:
    """
    Verifica se o caller tem permissão para ações administrativas.

    Permite se auth_bypass_enabled() (somente dev).
    Caso contrário, valida Bearer Firebase + role=admin + companyId correto.
    """
    if auth_bypass_enabled():
        logger.debug("admin: bypass de autenticação ativo (dev).")
        return

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Autenticação necessária. Envie: Authorization: Bearer <firebase_id_token>",
            headers={"WWW-Authenticate": "Bearer"},
        )

    id_token = authorization[len("Bearer "):]

    from app.firebase_app import verify_firebase_token, get_db, COMPANY_ID

    decoded = verify_firebase_token(id_token)
    if not decoded:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token Firebase inválido ou expirado.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    uid = decoded.get("uid", "")

    # Busca dados do usuário no Firestore
    try:
        db       = get_db()
        user_doc = db.collection("users").document(uid).get()
    except Exception as exc:
        logger.error("admin: falha ao consultar Firestore para uid=%s: %s", uid, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Falha ao verificar permissões no Firestore.",
        )

    if not user_doc.exists:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Usuário uid={uid} não encontrado em users/.",
        )

    user_data  = user_doc.to_dict()
    user_company = user_data.get("companyId", "")
    user_role    = user_data.get("role", "")

    if user_company != COMPANY_ID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Acesso negado: companyId '{user_company}' != '{COMPANY_ID}'.",
        )

    if user_role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Acesso negado: role '{user_role}' != 'admin'.",
        )

    logger.info("admin: acesso autorizado para uid=%s (role=admin, company=%s).", uid, COMPANY_ID)


@router.post("/bootstrap", summary="Bootstrap do Firestore (idempotente)")
def bootstrap(authorization: Optional[str] = Header(default=None)):
    """
    Cria a estrutura mínima no Firestore para a empresa configurada.

    Idempotente — pode ser chamado múltiplas vezes com segurança.

    Ações:
    - Cria/confirma o documento ``companies/{FIREBASE_COMPANY_ID}``.
    - Materializa cada coleção essencial criando o doc interno ``_meta``
      (invisível para o app, somente para tornar a coleção existente no console).

    Proteção:
    - ``AUTH_BYPASS=true`` (dev): sem autenticação necessária.
    - Produção: requer ``Authorization: Bearer <firebase_id_token>``
      com ``role=admin`` e ``companyId`` correto no Firestore.
    """
    _require_admin(authorization)

    from app.firebase_app import COMPANY_ID
    from app.services.bootstrap_service import bootstrap_firestore

    try:
        resultado = bootstrap_firestore(COMPANY_ID)
    except Exception as exc:
        logger.error("Erro no bootstrap: %s", exc)
        raise HTTPException(status_code=500, detail=f"Erro no bootstrap: {exc}")

    return {
        "ok":         True,
        "company_id": COMPANY_ID,
        "resultado":  resultado,
    }
