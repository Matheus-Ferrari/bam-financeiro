"""
Firebase Admin SDK — inicialização única para toda a aplicação.

Ordem de resolução das credenciais (primeira que funcionar é usada):
  1. FIREBASE_SECRET_NAME  — nome de um secret no Google Cloud Secret Manager
                             que contém o JSON completo da Service Account.
                             O projeto GCP é lido de FIREBASE_PROJECT_ID.
  2. FIREBASE_CREDENTIALS_PATH — caminho local para o JSON (fallback dev).
  3. Application Default Credentials (Cloud Run, GKE, etc.).

Variáveis de ambiente:
  FIREBASE_SECRET_NAME     – nome do secret no Secret Manager (ex: firebase-sa)
  FIREBASE_SECRET_VERSION  – versão do secret (padrão: "latest")
  FIREBASE_PROJECT_ID      – Google Cloud Project ID
  FIREBASE_COMPANY_ID      – ID da empresa default (tenant padrão)
  FIREBASE_CREDENTIALS_PATH – (fallback local) caminho para serviceAccountKey.json
"""

import json
import logging
import os
from typing import Any, Optional

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials, firestore

logger = logging.getLogger(__name__)

_db: Optional[Any] = None  # firestore.Client — typed as Any to avoid import-time resolution

# Tenant padrão — todas as operações sem Bearer-token usarão este ID.
COMPANY_ID: str = os.getenv("FIREBASE_COMPANY_ID", "bam")


def _load_secret(project_id: str, secret_name: str, version: str = "latest") -> dict:
    """
    Busca o JSON da Service Account guardado como secret no Secret Manager.
    Retorna o dict parsed ou levanta RuntimeError.
    """
    from google.cloud import secretmanager  # lazy import — instalado em runtime

    client   = secretmanager.SecretManagerServiceClient()
    resource = f"projects/{project_id}/secrets/{secret_name}/versions/{version}"
    response = client.access_secret_version(request={"name": resource})
    payload  = response.payload.data.decode("utf-8")
    return json.loads(payload)


def _init_firebase() -> None:
    """Inicializa o Firebase Admin SDK (idempotente)."""
    global _db

    if firebase_admin._apps:
        _db = firestore.client()
        return

    project_id   = os.getenv("FIREBASE_PROJECT_ID",       "").strip()
    secret_name  = os.getenv("FIREBASE_SECRET_NAME",      "").strip()
    secret_ver   = os.getenv("FIREBASE_SECRET_VERSION",   "latest").strip()
    cred_path    = os.getenv("FIREBASE_CREDENTIALS_PATH", "").strip()

    if secret_name:
        # ── 1. Secret Manager ───────────────────────────────────────────────
        if not project_id:
            raise RuntimeError(
                "FIREBASE_PROJECT_ID é obrigatório quando FIREBASE_SECRET_NAME está definido. "
                "Defina FIREBASE_PROJECT_ID=bam-financeiro no .env ou nas variáveis de ambiente."
            )
        logger.info(
            "[Firebase] Modo: Secret Manager — secret='%s' versão='%s' projeto='%s'",
            secret_name, secret_ver, project_id,
        )
        try:
            sa_dict = _load_secret(project_id, secret_name, secret_ver)
        except Exception as exc:
            raise RuntimeError(
                f"Falha ao ler o secret '{secret_name}' (v{secret_ver}) do projeto '{project_id}'. "
                f"Verifique se o secret existe, se a Service Account tem permissão "
                f"'Secret Manager Secret Accessor' e se FIREBASE_PROJECT_ID está correto. "
                f"Detalhe: {exc}"
            ) from exc
        cred = credentials.Certificate(sa_dict)
        firebase_admin.initialize_app(cred, {"projectId": project_id})
        logger.info("[Firebase] Credenciais carregadas do Secret Manager com sucesso.")

    elif cred_path:
        # ── 2. Arquivo local (dev) ───────────────────────────────────────────
        logger.info("[Firebase] Modo: arquivo local — '%s'", cred_path)
        cred = credentials.Certificate(cred_path)
        options = {"projectId": project_id} if project_id else {}
        firebase_admin.initialize_app(cred, options)
        logger.info("[Firebase] Credenciais carregadas do arquivo local com sucesso.")

    elif project_id:
        # ── 3. Application Default Credentials (Cloud Run, GCE, etc.) ───
        logger.info("[Firebase] Modo: Application Default Credentials — projeto: %s", project_id)
        firebase_admin.initialize_app(options={"projectId": project_id})
        logger.info("[Firebase] ADC configurado com sucesso.")

    else:
        raise RuntimeError(
            "Nenhuma credencial Firebase configurada. Defina uma das opções:\n"
            "  Opção A (producão): FIREBASE_SECRET_NAME + FIREBASE_PROJECT_ID\n"
            "  Opção B (dev local): FIREBASE_CREDENTIALS_PATH\n"
            "  Opção C (Cloud Run/GCE): FIREBASE_PROJECT_ID (ADC automático)"
        )

    _db = firestore.client()
    logger.info("[Firebase] Inicializado com sucesso — projeto: %s", project_id or "(ADC)")


def get_db() -> Any:
    """Retorna cliente Firestore, inicializando na primeira chamada."""
    global _db
    if _db is None:
        _init_firebase()
    return _db


def verify_firebase_token(id_token: str) -> Optional[dict]:
    """
    Verifica um Firebase ID token.
    Retorna o decoded token (dict) ou None se inválido.
    """
    if not id_token:
        return None
    try:
        # Garante que Firebase está inicializado
        get_db()
        return firebase_auth.verify_id_token(id_token)
    except Exception as exc:
        logger.debug("Token Firebase inválido: %s", exc)
        return None
