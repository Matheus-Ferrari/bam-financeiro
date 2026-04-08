"""
bootstrap_service.py
────────────────────
Garante a estrutura mínima do Firestore para o app funcionar.
Idempotente — pode ser chamado múltiplas vezes sem efeitos colaterais.
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

logger = logging.getLogger(__name__)

# Coleções essenciais do domínio.
# O doc "_meta" é criado em cada uma apenas para materializar a coleção,
# pois o Firestore não cria coleções vazias.
# O FirestoreRepository.all() filtra docs cujo id começa com "_".
_COLECOES_ESSENCIAIS: List[str] = [
    "receitas",
    "despesas",
    "clientes",
    "cortes",
    "movimentacoes",
    "caixa",
    "projetos_adicionais",
    "comissoes",
    "despesas_locais",
    "conciliacao",
    "status_overrides",
    "quick_updates",
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def bootstrap_firestore(company_id: str) -> Dict[str, Any]:
    """
    Garante a estrutura mínima no Firestore para a empresa informada.

    Ações realizadas:
      1) Cria o documento ``companies/{company_id}`` com campos mínimos,
         ou atualiza ``atualizadoEm`` se já existir.
      2) Para cada coleção essencial, cria o documento ``_meta`` dentro da
         coleção (somente se não existir), materializando-a no Firestore.

    Os documentos ``_meta`` ficam invisíveis para o ``FirestoreRepository``
    porque ``all()`` filtra ids que começam com ``_``.

    Retorna um resumo indicando o que foi criado vs. o que já existia.
    """
    from app.firebase_app import get_db

    db  = get_db()
    now = _now_iso()

    summary: Dict[str, Any] = {
        "company_id":        company_id,
        "empresa_criada":    False,
        "empresa_existia":   False,
        "colecoes_criadas":  [],
        "colecoes_existiam": [],
    }

    # ── 1. Garante o doc da empresa ─────────────────────────────────────
    company_ref = db.collection("companies").document(company_id)
    snap        = company_ref.get()

    if snap.exists:
        company_ref.update({"atualizadoEm": now})
        summary["empresa_existia"] = True
        logger.info("bootstrap: companies/%s já existe — atualizadoEm atualizado.", company_id)
    else:
        company_ref.set({
            "companyId":    company_id,
            "nome":         company_id,
            "criadoEm":     now,
            "atualizadoEm": now,
        })
        summary["empresa_criada"] = True
        logger.info("bootstrap: companies/%s criado.", company_id)

    # ── 2. Materializa coleções essenciais ───────────────────────────────
    for colecao in _COLECOES_ESSENCIAIS:
        meta_ref  = company_ref.collection(colecao).document("_meta")
        meta_snap = meta_ref.get()

        if meta_snap.exists:
            summary["colecoes_existiam"].append(colecao)
            logger.debug("bootstrap: %s/_meta já existe.", colecao)
        else:
            meta_ref.set({
                "colecao":      colecao,
                "inicializado": True,
                "criadoEm":     now,
            })
            summary["colecoes_criadas"].append(colecao)
            logger.info("bootstrap: coleção '%s' materializada (_meta criado).", colecao)

    logger.info(
        "bootstrap concluído: %d coleções criadas, %d já existiam.",
        len(summary["colecoes_criadas"]),
        len(summary["colecoes_existiam"]),
    )
    return summary
