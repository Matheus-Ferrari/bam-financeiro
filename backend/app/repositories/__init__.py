"""
Repositórios Firestore — singletons por entidade.

Importar daqui para acessar as coleções de dados.
"""

from app.repositories.base import FirestoreRepository

# ── Entidades CRUD (equivalentes às antigas JsonStorage) ────────────────
clientes_repo              = FirestoreRepository("clientes")
cortes_repo                = FirestoreRepository("cortes")
quick_updates_repo         = FirestoreRepository("quick_updates")
movimentacoes_repo         = FirestoreRepository("movimentacoes")
caixa_repo                 = FirestoreRepository("caixa")
projetos_adicionais_repo   = FirestoreRepository("projetos_adicionais")
comissoes_repo             = FirestoreRepository("comissoes")
despesas_locais_repo       = FirestoreRepository("despesas_locais")
conciliacao_repo           = FirestoreRepository("conciliacao")
status_overrides_repo      = FirestoreRepository("status_overrides")

# ── Entidades migradas do Excel ──────────────────────────────────────────
receitas_repo              = FirestoreRepository("receitas")
despesas_repo              = FirestoreRepository("despesas")

__all__ = [
    "clientes_repo",
    "cortes_repo",
    "quick_updates_repo",
    "movimentacoes_repo",
    "caixa_repo",
    "projetos_adicionais_repo",
    "comissoes_repo",
    "despesas_locais_repo",
    "conciliacao_repo",
    "status_overrides_repo",
    "receitas_repo",
    "despesas_repo",
]
