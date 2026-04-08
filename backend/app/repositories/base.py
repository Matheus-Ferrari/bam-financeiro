"""
FirestoreRepository — CRUD genérico baseado no Firestore.

Interface idêntica ao JsonStorage anterior para facilitar a troca de
implementação sem alterar as rotas e serviços que a consomem.

Estrutura Firestore:
  companies/{company_id}/{collection}/{doc_id}
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from app.firebase_app import COMPANY_ID, get_db

logger = logging.getLogger(__name__)


class FirestoreRepository:
    """Armazenamento CRUD genérico baseado em subcoleção do Firestore."""

    def __init__(self, collection_name: str, company_id: str = COMPANY_ID):
        self._collection = collection_name
        self._company_id = company_id

    # ── Referência interna ────────────────────────────────────────────

    def _ref(self):
        return (
            get_db()
            .collection("companies")
            .document(self._company_id)
            .collection(self._collection)
        )

    # ── CRUD público ──────────────────────────────────────────────────

    def all(self) -> List[Dict[str, Any]]:
        """Retorna todos os documentos da coleção."""
        docs = self._ref().stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

    def get(self, id: str) -> Optional[Dict[str, Any]]:
        """Retorna um documento pelo ID ou None."""
        doc = self._ref().document(str(id)).get()
        if doc.exists:
            return {"id": doc.id, **doc.to_dict()}
        return None

    def create(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Cria um novo documento com ID gerado automaticamente."""
        now = _now_iso()
        doc_id = str(uuid.uuid4())
        item = {k: v for k, v in data.items() if k != "id"}
        item.setdefault("criado_em",     now)
        item.setdefault("atualizado_em", now)
        self._ref().document(doc_id).set(item)
        logger.debug("Criado %s/%s", self._collection, doc_id)
        return {"id": doc_id, **item}

    def update(self, id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Atualiza campos de um documento existente."""
        doc_ref = self._ref().document(str(id))
        snap = doc_ref.get()
        if not snap.exists:
            return None
        updates = {k: v for k, v in data.items() if k != "id"}
        updates["atualizado_em"] = _now_iso()
        doc_ref.update(updates)
        merged = {**snap.to_dict(), **updates}
        return {"id": id, **merged}

    def delete(self, id: str) -> bool:
        """Exclui um documento. Retorna True se encontrado, False caso contrário."""
        doc_ref = self._ref().document(str(id))
        if not doc_ref.get().exists:
            return False
        doc_ref.delete()
        logger.debug("Excluído %s/%s", self._collection, id)
        return True

    def find_by(self, field: str, value: Any) -> List[Dict[str, Any]]:
        """Retorna documentos onde `field == value`."""
        docs = self._ref().where(field, "==", value).stream()
        return [{"id": doc.id, **doc.to_dict()} for doc in docs]

    def upsert_by(self, match_field: str, match_value: Any, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Atualiza o primeiro documento onde `match_field == match_value`,
        ou cria um novo se não encontrar.
        """
        existing = self.find_by(match_field, match_value)
        if existing:
            return self.update(str(existing[0]["id"]), data) or existing[0]
        payload = {**data, match_field: match_value}
        return self.create(payload)


# ── Helpers ───────────────────────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
