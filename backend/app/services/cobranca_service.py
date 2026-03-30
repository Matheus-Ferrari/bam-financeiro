"""
CobrancaService — stub para emissão futura de cobranças automáticas.

PRONTO PARA INTEGRAÇÃO:
  - Emitir boleto (Asaas, Pagar.me, Gerencianet, Stripe)
  - Gerar link de pagamento Pix
  - Agendar cobrança recorrente no dia 25
  - Registrar status: agendada → enviada → visualizada → paga

Regra de negócio:
  - Clientes com cobrar_automaticamente=True e dia_pagamento=25
    devem receber cobrança automática todo mês no dia 23 (2 dias antes)
  - Status de cobrança: agendada | enviada | visualizada | paga
"""

import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional

from app.services.storage_service import clientes_storage

logger = logging.getLogger(__name__)


class CobrancaService:
    """
    Emissão e controle de cobranças automáticas.
    Métodos [STUB] prontos para implementação real.
    """

    def get_clientes_para_cobrar_hoje(self) -> List[Dict[str, Any]]:
        """
        Retorna clientes que devem ser cobrados hoje.
        Lógica: cobrar_automaticamente=True E dia_pagamento = hoje.day + 2.
        """
        hoje = date.today()
        dia_alvo = hoje.day + 2  # cobra 2 dias antes do vencimento

        return [
            c for c in clientes_storage.all()
            if c.get("cobrar_automaticamente") is True
            and int(c.get("dia_pagamento") or 0) == dia_alvo
            and c.get("status") == "ativo"
            and c.get("status_pagamento") != "pago"
        ]

    def emitir_cobranca(
        self,
        cliente_id:  str,
        valor:       float,
        vencimento:  date,
        descricao:   str = "",
    ) -> Dict[str, Any]:
        """
        [STUB] Emite cobrança para o cliente.
        Futuro: chamar Asaas/Pagar.me/banco e salvar status no JSON.
        """
        logger.info("[CobrancaService] emitir_cobranca cliente=%s — stub.", cliente_id)
        return {
            "ok":            False,
            "mensagem":      "Emissão de cobrança ainda não implementada.",
            "boleto_url":    None,
            "pix_copia_cola": None,
            "link_pagamento": None,
            "cobranca_id":   None,
            "status":        "agendada",
        }

    def processar_cobracas_automaticas(self) -> Dict[str, Any]:
        """
        [STUB] Job diário: emite cobranças para os clientes elegíveis de hoje.
        Futuro: chamar via APScheduler, Celery beat ou cron às 08:00.
        """
        elegíveis = self.get_clientes_para_cobrar_hoje()
        logger.info("[CobrancaService] %d clientes elegíveis — stub, nenhuma ação.", len(elegíveis))
        return {
            "ok":            True,
            "elegíveis":     len(elegíveis),
            "emitidas":      0,
            "mensagem":      "Automação de cobrança ainda não implementada.",
            "clientes":      [c.get("nome") for c in elegíveis],
        }

    def registrar_status_cobranca(
        self,
        cliente_id: str,
        status:     str,   # agendada | enviada | visualizada | paga
        observacao: str = "",
    ) -> Dict[str, Any]:
        """Registra manualmente o status de cobrança de um cliente."""
        resultado = clientes_storage.update(
            cliente_id,
            {
                "cobranca_status":       status,
                "cobranca_atualizado_em": datetime.now().isoformat(),
                "cobranca_obs":          observacao,
            },
        )
        if not resultado:
            return {"ok": False, "mensagem": "Cliente não encontrado."}
        return {"ok": True, "cliente_id": cliente_id, "status": status}
