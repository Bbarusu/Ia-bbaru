"""Consumer-owned allowlist. Never display provider-supplied messages or actions."""

ERROR_STATUS = {
    "invalid_gateway_token": 401,
    **{code: 422 for code in ("invalid_request", "unknown_model", "context_too_large",
        "max_output_tokens_above_profile", "missing_previous_output", "output_limit_not_accepted",
        "visual_input_not_accepted", "visual_input_not_supported", "attachment_changed_replan_required")},
    **{code: 409 for code in ("request_id_conflict", "request_in_progress", "request_outcome_uncertain")},
    "gateway_busy": 429, "provider_quota_exceeded": 429, "provider_rate_limited": 429, "provider_timeout": 504,
    **{code: 502 for code in ("provider_error", "provider_invalid_output", "provider_empty_output",
        "provider_output_too_large", "provider_model_mismatch", "output_limit_not_honored",
        "completion_unconfirmed", "gateway_internal_error", "provider_output_limit_reached", "visual_input_unconfirmed")},
    **{code: 503 for code in ("provider_unavailable", "provider_not_authenticated",
        "provider_cli_not_installed", "provider_cli_not_runnable", "provider_cli_version_unsupported",
        "provider_auth_status_unknown", "provider_not_logged_in", "provider_not_subscription_login",
        "provider_output_limit_not_enforced", "provider_model_requires_credits", "provider_model_unavailable")},
}
WAIT_CODES = {"gateway_busy", "request_in_progress"}
PRESTART_CODES = {"provider_cli_not_installed", "provider_cli_not_runnable",
    "provider_cli_version_unsupported", "provider_auth_status_unknown", "provider_not_logged_in",
    "provider_not_subscription_login", "provider_output_limit_not_enforced", "invalid_gateway_token"}
UNCERTAIN_CODES = {"provider_timeout", "request_outcome_uncertain", "gateway_request_failed",
                   "gateway_invalid_response", "gateway_not_configured"}


def error_message(code):
    if code in {"provider_not_logged_in", "provider_not_authenticated", "provider_not_subscription_login"}:
        return "Confira o login por assinatura no CLI oficial do provedor."
    return {
        "provider_error": "O Claude não conseguiu responder. Consulte o diagnóstico do gateway; não haverá repetição automática.",
        "provider_quota_exceeded": "A cota foi atingida. Confira a disponibilidade e a renovação no Claude Code.",
        "provider_rate_limited": "O Claude limitou as requisições. Confira a disponibilidade antes de enviar um novo pedido.",
        "provider_model_requires_credits": "Este modelo exige créditos adicionais. Confira /model no Claude Code e escolha outro modelo autorizado.",
        "provider_model_unavailable": "O modelo solicitado não está disponível; nenhuma troca automática foi autorizada.",
        "provider_output_limit_reached": "A resposta excedeu o limite de saída. A CLI não forneceu texto parcial. Você pode ajustar o limite em um novo pedido.",
        "gateway_busy": "O gateway está ocupado. A tarefa aguardará na fila.",
        "request_in_progress": "O gateway ainda está processando esta etapa.",
        "request_outcome_uncertain": "O resultado é incerto. A chamada não será repetida.",
        "provider_timeout": "O provedor demorou e pode ter consumido cota. Não haverá repetição automática.",
        "invalid_gateway_token": "Confira a credencial local do gateway.",
        "output_limit_not_accepted": "Esta tarefa precisa aceitar o limite indicativo.",
        "unknown_model": "O modelo não está configurado no gateway.",
        "completion_unconfirmed": "O provedor não confirmou a conclusão. A resposta disponível foi preservada.",
    }.get(code, "O gateway não concluiu a operação. Confira a configuração local.")
