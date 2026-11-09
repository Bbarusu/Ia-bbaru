export function sourceContent(title, url, text) {
  return url ? `${title}\nOrigem: ${url}\n\n${text}` : text;
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
      reported: "Término confirmado",
      inferred: "Término inferido",
      stop: "Conclusão confirmada",
      length: "Limite de saída atingido",
      unknown: "Conclusão não confirmada",
    }[finishReason] || "Término padrão"
  );
}

export function formatUnavailableReason(reason) {
  if (!reason) return "Indisponível neste computador";
  return (
    {
      cli_not_installed: "CLI oficial não instalado neste computador",
      not_authenticated: "Sessão não autenticada no CLI oficial",
      subscription_required: "Requer assinatura elegível ativa",
      api_key_missing: "Chave de API não configurada",
      rate_limited: "Limite de uso atingido temporariamente",
      model_tools_not_supported:
        "Requer ferramentas não autorizadas nesta versão",
      provider_unavailable: "Provedor indisponível no momento",
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
      review_context_too_large:
        "O material somado à resposta principal ultrapassa o limite de contexto do revisor.",
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
