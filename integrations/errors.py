"""Sanitized gateway errors.

Bodies follow the briefing: {"error": {"code": ..., "message": ...}}.
Messages are fixed strings: never provider output, prompts, paths or secrets.
"""


class GatewayError(Exception):
    def __init__(self, status: int, code: str, message: str, next_action: str | None = None):
        super().__init__(code)
        self.status = status
        self.code = code
        self.message = message
        self.next_action = next_action
        # Sanitized signature (integrations/failures.py). Stored locally; never
        # part of the HTTP body.
        self.diagnostic: dict | None = None

    def body(self) -> dict:
        error = {"code": self.code, "message": self.message}
        if self.next_action:
            error["next_action"] = self.next_action
        return {"error": error}


def unauthorized():
    return GatewayError(401, "invalid_gateway_token", "Credencial do gateway inválida")


def invalid_request(code="invalid_request", message="Entrada inválida"):
    return GatewayError(422, code, message)


def unknown_model():
    return GatewayError(422, "unknown_model", "Modelo não configurado no gateway")


def context_too_large():
    return GatewayError(422, "context_too_large", "Entrada excede o limite configurado do modelo")


def request_id_conflict():
    return GatewayError(409, "request_id_conflict", "request_id já usado com outro conteúdo")


def request_in_progress():
    return GatewayError(409, "request_in_progress", "Requisição com este request_id em andamento")


def request_outcome_uncertain():
    return GatewayError(
        409, "request_outcome_uncertain",
        "Resultado anterior incerto; o gateway não repete a chamada automaticamente",
    )


def busy():
    return GatewayError(429, "gateway_busy", "Gateway já está executando outra geração")


def quota_exceeded():
    return GatewayError(
        429, "provider_quota_exceeded", "Limite de uso do provedor atingido",
        "Aguarde a renovação da cota do plano; o gateway não troca para API paga.",
    )


def provider_error(code="provider_error"):
    return GatewayError(502, code, "Erro do provedor")


def provider_unavailable(code="provider_unavailable", next_action=None):
    return GatewayError(503, code, "Provedor indisponível", next_action)


def provider_timeout():
    return GatewayError(
        504, "provider_timeout",
        "Tempo esgotado; a chamada pode ter consumido cota",
    )


def output_limit_not_accepted():
    return GatewayError(
        422, "output_limit_not_accepted",
        "O modelo não garante o teto de saída e a tarefa não aceitou essa limitação",
    )


def completion_unconfirmed():
    # Contract 1 has no value for an unconfirmed completion; never fabricate stop/length.
    return GatewayError(502, "completion_unconfirmed", "Provedor não confirmou o término da resposta")
