export function sourceContent(title, url, text) {
  const safeText = text ?? "";
  const safeTitle = title ?? "";
  return url ? `${safeTitle}\nOrigem: ${url}\n\n${safeText}` : safeText;
}

export function taskState(status) {
  return (
    {
      planned: "Plano pronto",
      running: "Em execução",
      completed: "Concluída",
      failed: "Falhou",
      interrupted: "Interrompida",
      incomplete: "Resposta incompleta",
      queued: "Na fila",
      waiting: "Aguardando o gateway",
      blocked: "Aguardando correção",
      uncertain: "Resultado incerto",
      pending: "Pendente",
      in_flight: "Aguardando resposta",
    }[status] || "Estado desconhecido"
  );
}

export function validateDraft({ projectId, text, selectedModels, review }) {
  if (!projectId) return "Escolha ou crie um projeto.";
  if (!text.trim()) return "Descreva o que você quer fazer.";
  if (text.length > 8000) return "O pedido pode ter até 8.000 caracteres.";
  if (!selectedModels.length) return "Selecione um agente disponível.";
  if (review && selectedModels.length < 2)
    return "A revisão precisa de dois agentes diferentes.";
  return null;
}

export function formatBilling(billing) {
  return (
    {
      subscription_quota: "Assinatura (cota da conta)",
      api_key: "Chave de API",
      unknown: "Modalidade não informada",
    }[billing] || "Modalidade não informada"
  );
}

export function formatOutputLimit(outputLimit, maxOutputTokens) {
  const tokens =
    typeof maxOutputTokens === "number" && maxOutputTokens > 0
      ? ` (${maxOutputTokens} tokens)`
      : "";
  if (outputLimit === "enforced") return `Limite garantido${tokens}`;
  if (outputLimit === "best_effort") return `Limite indicativo${tokens}`;
  if (outputLimit === "none") return "Sem teto de saída";
  return "Limite padrão";
}

export function formatCancellation(cancellation) {
  return (
    {
      provider: "Cancelamento no provedor",
      local_process_only: "Cancelamento apenas local",
      none: "Sem cancelamento",
    }[cancellation] || "Cancelamento não informado"
  );
}

export function formatFinishReason(finishReason) {
  return (
    {
      reported: "Término informado pelo provedor",
      inferred: "Término inferido",
      stop: "Conclusão confirmada",
      length: "Limite de saída atingido",
      unknown: "Conclusão não confirmada",
    }[finishReason] || "Término padrão"
  );
}

export function formatUnavailableReason(reason, provider) {
  if (!reason) return "Indisponível neste computador";
  if (provider === "claude-code" && reason === "not_logged_in")
    return "Indisponível: faça login na sua conta Claude pelo comando claude no terminal.";
  return (
    {
      cli_not_installed: "Indisponível: CLI oficial não instalado",
      cli_not_runnable: "Indisponível: CLI oficial não pôde ser executado",
      cli_version_unsupported:
        "Indisponível: versão do CLI oficial incompatível",
      auth_status_unknown:
        "Indisponível: não foi possível verificar o login no CLI",
      not_logged_in: "Indisponível: faça login no CLI oficial",
      not_subscription_login:
        "Indisponível: requer login por assinatura no CLI oficial",
    }[reason] || `Indisponível (${reason})`
  );
}

export function describeTaskError(error) {
  if (!error) return "";
  return (
    {
      completion_unconfirmed:
        "Conclusão não confirmada pelo provedor (completion_unconfirmed). A saída recebida foi preservada abaixo para leitura e a revisão não foi iniciada.",
      output_token_limit_reached:
        "O limite de tokens de saída foi atingido. A resposta parcial foi preservada abaixo e a revisão não foi iniciada.",
      gateway_failed_outcome_may_be_unknown:
        "A comunicação com o gateway falhou durante a geração. O estado final no provedor não pôde ser confirmado.",
      gateway_preflight_failed:
        "O gateway de agentes não respondeu à verificação prévia. Nenhuma geração foi iniciada.",
      gateway_protocol_changed_replan_required:
        "A versão do contrato do gateway mudou desde o planejamento. Crie um novo plano.",
      model_unavailable_replan_required:
        "O agente planejado não está mais disponível. Crie um novo plano.",
      model_capabilities_changed_replan_required:
        "As garantias declaradas pelo agente mudaram após o planejamento. Crie um novo plano.",
      model_capabilities_missing_replan_required:
        "O catálogo não informou as capacidades exigidas pelo protocolo 1.1. Crie um novo plano.",
      output_limit_not_accepted:
        "Este plano exige aceite explícito para limite indicativo de saída.",
      model_tools_not_supported:
        "O agente exige uso de ferramentas não autorizado nesta versão.",
      visual_context_not_supported:
        "A captura está salva localmente. O gateway atual recebe apenas texto e não analisa imagens.",
      review_context_too_large:
        "O material somado à resposta principal ultrapassa o limite de contexto do revisor.",
      provider_quota_exceeded:
        "A cota da conta no provedor foi atingida durante a geração.",
      provider_not_authenticated:
        "A sessão no provedor expirou ou não está autenticada.",
      provider_not_logged_in: "Faça login no CLI oficial e depois confirme a retomada.",
      provider_not_subscription_login: "Entre no CLI oficial com sua assinatura antes de retomar.",
      provider_cli_not_installed: "Instale o CLI oficial antes de retomar.",
      provider_cli_not_runnable: "O CLI oficial não pode ser iniciado. Corrija sua configuração.",
      provider_cli_version_unsupported: "Atualize o CLI oficial para uma versão compatível.",
      provider_auth_status_unknown: "Não foi possível verificar o login no CLI oficial.",
      invalid_gateway_token: "Confira a credencial local do gateway antes de retomar.",
      gateway_busy: "O gateway está ocupado. A tarefa aguardará e usará o mesmo pedido.",
      request_in_progress: "O gateway ainda está processando este pedido. Aguardando confirmação.",
      provider_timeout: "O provedor excedeu o tempo de resposta. O resultado é incerto e não haverá repetição.",
      provider_error: "O Claude não conseguiu responder a este pedido.",
      provider_output_limit_reached: "A resposta ultrapassou o limite de saída de tokens. Aumente o limite indicativo para esta tarefa.",
      provider_model_requires_credits: "O modelo Claude selecionado exige créditos de uso adicionais na sua conta.",
      provider_model_unavailable: "O modelo Claude selecionado não está disponível no momento. Verifique os modelos disponíveis no CLI.",
      provider_model_mismatch: "A CLI tentou usar outro modelo diferente do autorizado; nenhuma resposta foi aceita.",
      provider_output_too_large: "A resposta retornada pelo provedor ultrapassou o tamanho máximo permitido.",
      provider_invalid_output: "A resposta do provedor não pôde ser interpretada corretamente.",
      request_outcome_uncertain: "O gateway não pode confirmar o resultado anterior. Não haverá repetição.",
      process_interrupted_outcome_unknown: "O aplicativo encerrou durante a chamada. O resultado é incerto e não haverá repetição.",
      gateway_request_failed: "A comunicação com o gateway falhou. Consulte o estado da tarefa antes de qualquer nova ação.",
      gateway_invalid_response: "O gateway retornou uma resposta inválida. Não haverá repetição.",
    }[error] || `A tarefa não foi concluída: ${error}`
  );
}

export function requiresLimitAcceptance(selectedModelIds, models) {
  if (!Array.isArray(selectedModelIds) || !Array.isArray(models)) return false;
  return models.some(
    (m) =>
      selectedModelIds.includes(m.id) &&
      m.capabilities &&
      m.capabilities.output_limit !== "enforced",
  );
}

export function decideIncomingCapture(currentState, incoming) {
  if (!incoming) return { action: "ignore" };
  const { modal, title, content, capture, busy } = currentState || {};
  if (modal === "source" && capture?.id === incoming.id) {
    return { action: "ignore" };
  }
  const hasUnsavedWork = Boolean(
    (title && title.trim()) || (content && content.trim()) || capture || busy,
  );
  if ((modal === "source" || busy) && hasUnsavedWork) {
    return { action: "queue", queuedCapture: incoming };
  }
  return {
    action: "open",
    capture: incoming,
    title: incoming.title,
    content: incoming.text,
  };
}

/**
 * @param {{
 *   models?: any[];
 *   selectedModelIds?: string[];
 *   kind?: string;
 *   preferredModelId?: string;
 *   reviewerModelId?: string;
 *   review?: boolean;
 * }} [params]
 */
export function resolveEffectiveRoles({
  models = [],
  selectedModelIds = [],
  kind = "study",
  preferredModelId = "",
  reviewerModelId = "",
  review = false,
} = {}) {
  const selected = models.filter(
    (m) => m.available && selectedModelIds.includes(m.id),
  );
  selected.sort((a, b) => {
    const aMatch = Array.isArray(a.task_kinds) && a.task_kinds.includes(kind) ? 0 : 1;
    const bMatch = Array.isArray(b.task_kinds) && b.task_kinds.includes(kind) ? 0 : 1;
    return aMatch - bMatch;
  });

  const autoWriterId = selected[0]?.id || "";
  const effectiveWriterId =
    preferredModelId && selectedModelIds.includes(preferredModelId)
      ? preferredModelId
      : autoWriterId;

  const candidateReviewers = selected.filter((m) => m.id !== effectiveWriterId);
  const autoReviewerId = candidateReviewers[0]?.id || "";
  const effectiveReviewerId =
    review && reviewerModelId && candidateReviewers.some((m) => m.id === reviewerModelId)
      ? reviewerModelId
      : review
        ? autoReviewerId
        : "";

  return {
    autoWriterId,
    effectiveWriterId,
    autoReviewerId,
    effectiveReviewerId,
    candidateReviewers,
  };
}
