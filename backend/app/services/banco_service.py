"""
BancoService — stub para futura integração bancária / Open Finance / Nubank.

PRONTO PARA INTEGRAÇÃO:
  - Conectar via Open Finance v2 ou API Nubank
  - Buscar extrato automático (OFX, JSON, CSV)
  - Importar movimentações para conciliacoes_storage
  - Autenticação OAuth2 com o banco

Como integrar no futuro:
  1. Adicione as credenciais no .env (BANCO_CLIENT_ID, BANCO_CLIENT_SECRET, etc.)
  2. Implemente _authenticate() e _fetch_extrato()
  3. Chame sync_extrato() de um job agendado (APScheduler ou Celery)
"""

import logging
from datetime import date
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── Constantes de ponto de extensão ──────────────────────────────────────
# Quando integrar, defina no .env:
#   BANCO_PROVIDER=nubank | inter | btg | sicoob | ...
#   BANCO_CLIENT_ID=...
#   BANCO_CLIENT_SECRET=...
#   BANCO_API_URL=https://api.nubank.com.br/...


class BancoService:
    """
    Integração bancária futura.

    Métodos marcados com [STUB] retornam dados vazios propositalmente.
    Substituir pela implementação real quando as credenciais estiverem disponíveis.
    """

    def get_status(self) -> Dict[str, Any]:
        """[STUB] Retorna status da conexão com o banco."""
        return {
            "conectado":  False,
            "provedor":   None,
            "mensagem":   "Integração bancária ainda não configurada.",
            "proximo_passo": "Adicione BANCO_CLIENT_ID e BANCO_CLIENT_SECRET no .env",
        }

    def get_extrato(
        self,
        data_inicio: Optional[date] = None,
        data_fim:    Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        """[STUB] Retorna movimentações importadas do banco."""
        logger.info("[BancoService] get_extrato chamado — stub, retornando vazio.")
        return []

    def sync_extrato(self) -> Dict[str, Any]:
        """
        [STUB] Sincroniza extrato do banco com movimentacoes_storage.
        Futuro: chamar via job agendado todo dia às 07:00.
        """
        logger.info("[BancoService] sync_extrato chamado — stub, nenhuma ação.")
        return {
            "ok":          True,
            "sincronizado": 0,
            "mensagem":    "Sincronização automática ainda não implementada.",
        }

    def gerar_link_cobranca(
        self,
        cliente:    str,
        valor:      float,
        vencimento: date,
        descricao:  str = "",
    ) -> Dict[str, Any]:
        """
        [STUB] Gera link de cobrança / boleto / Pix para o cliente.
        Futuro: integrar com Asaas, Pagar.me, Gerencianet, ou API do banco.
        """
        logger.info("[BancoService] gerar_link_cobranca chamado — stub.")
        return {
            "ok":          False,
            "mensagem":    "Emissão de cobrança ainda não implementada.",
            "link":        None,
            "boleto_url":  None,
            "pix_copia_cola": None,
        }
