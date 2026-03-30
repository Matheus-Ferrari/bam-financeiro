"""
NotificacaoService — stub para notificações futuras por e-mail e WhatsApp.

PRONTO PARA INTEGRAÇÃO:
  - E-mail via SendGrid / SES / Resend
  - WhatsApp via Twilio, Z-API, Evolution API, ou WPPConnect
  - Lembrete de vencimento no dia anterior
  - Confirmação de recebimento
  - Alerta de inadimplência

Fluxo planejado:
  1. Job diário verifica clientes com vencimento amanhã
  2. Envia mensagem pela forma_cobranca_preferida do cliente
  3. Registra status: enviada | visualizada | confirmada | sem_resposta
"""

import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


class NotificacaoService:
    """
    Envio de notificações por e-mail e WhatsApp.
    Métodos [STUB] prontos para implementação real.
    """

    def enviar_email(
        self,
        destinatario: str,
        assunto:      str,
        corpo:        str,
        html:         bool = False,
    ) -> Dict[str, Any]:
        """
        [STUB] Envia e-mail para o destinatário.
        Futuro: integrar com SendGrid (SENDGRID_API_KEY no .env).
        """
        logger.info("[NotificacaoService] enviar_email para=%s — stub.", destinatario)
        return {
            "ok":       False,
            "mensagem": "Envio de e-mail ainda não implementado.",
            "provider": "SendGrid (pendente configuração)",
        }

    def enviar_whatsapp(
        self,
        numero:    str,
        mensagem:  str,
    ) -> Dict[str, Any]:
        """
        [STUB] Envia mensagem WhatsApp.
        Futuro: integrar com Evolution API ou Z-API (WHATSAPP_API_URL no .env).
        """
        logger.info("[NotificacaoService] enviar_whatsapp para=%s — stub.", numero)
        return {
            "ok":       False,
            "mensagem": "Envio de WhatsApp ainda não implementado.",
            "provider": "Evolution API / Z-API (pendente configuração)",
        }

    def enviar_lembrete_vencimento(
        self,
        cliente_nome:  str,
        valor:         float,
        vencimento:    str,
        canal:         str = "whatsapp",   # whatsapp | email
        contato:       str = "",
    ) -> Dict[str, Any]:
        """
        [STUB] Envia lembrete de vencimento para o cliente.
        Futuro: chamado pelo CobrancaService.processar_cobracas_automaticas().
        """
        logger.info("[NotificacaoService] lembrete para %s via %s — stub.", cliente_nome, canal)
        return {
            "ok":       False,
            "canal":    canal,
            "mensagem": "Notificação automática ainda não implementada.",
        }

    def enviar_confirmacao_recebimento(
        self,
        cliente_nome: str,
        valor:        float,
        data:         str,
        canal:        str = "whatsapp",
        contato:      str = "",
    ) -> Dict[str, Any]:
        """[STUB] Confirma recebimento para o cliente após marcar como pago."""
        logger.info("[NotificacaoService] confirmação para %s — stub.", cliente_nome)
        return {
            "ok":       False,
            "mensagem": "Confirmação automática ainda não implementada.",
        }
