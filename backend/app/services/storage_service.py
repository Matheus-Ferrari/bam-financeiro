"""
StorageService — aliases para os repositórios Firestore.

Mantém os nomes antigos (xxx_storage) para não quebrar os serviços e rotas
que importam daqui. Internamente delega para FirestoreRepository.
"""

from app.repositories import (
    caixa_repo as caixa_storage,
    clientes_repo as clientes_storage,
    comissoes_repo as comissoes_storage,
    conciliacao_repo as conciliacao_storage,
    cortes_repo as cortes_storage,
    despesas_locais_repo as despesas_locais_storage,
    movimentacoes_repo as movimentacoes_storage,
    projetos_adicionais_repo as projetos_adicionais_storage,
    quick_updates_repo as quick_updates_storage,
    status_overrides_repo as status_overrides_storage,
)

__all__ = [
    "clientes_storage",
    "cortes_storage",
    "quick_updates_storage",
    "movimentacoes_storage",
    "caixa_storage",
    "projetos_adicionais_storage",
    "comissoes_storage",
    "despesas_locais_storage",
    "conciliacao_storage",
    "status_overrides_storage",
]
