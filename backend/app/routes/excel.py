"""
Rota /excel — mantida por compatibilidade com o frontend.
Retorna informações estáticas (dados agora estão no Firestore).
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/sheets")
def list_sheets():
    """Informações sobre a fonte de dados atual (Firestore)."""
    return {
        "status":      "ok",
        "arquivo":     None,
        "carregado":   False,
        "abas":        [],
        "total_abas":  0,
        "mapeamento":  {},
        "usando_mock": False,
        "fonte":       "firestore",
        "mensagem":    "Dados migrados para Firestore. Excel não é mais utilizado.",
    }
