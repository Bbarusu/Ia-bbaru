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
      provider_error:
        "O Claude não conseguiu responder a este pedido. O motivo ainda não foi identificado. Consulte o diagnóstico do gateway; o pedido não será repetido automaticamente.",
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

// ---------------------------------------------------------------------------
// Chat lateral: apresentação das tarefas existentes como conversa.
// Nenhuma destas funções cria contrato novo; elas apenas leem o catálogo e as
// tarefas que o backend já devolve.
// ---------------------------------------------------------------------------

export const CHAT_WORKING_STATES = ["queued", "running", "waiting", "in_flight"];

/** Modelos que o chat pode autorizar: disponíveis e, no contrato 1.1, sem ferramentas. */
export function eligibleChatModels(models, catalogVersion) {
  if (!Array.isArray(models)) return [];
  return models.filter(
    (m) =>
      m &&
      m.available &&
      (catalogVersion !== "1.1" ||
        (m.capabilities && m.capabilities.tools === "disabled")),
  );
}

/**
 * IDs enviados em allowed_model_ids. "auto" autoriza os modelos elegíveis, mas
 * nunca inclui Fable por conta própria: ele pode exigir créditos adicionais e
 * só entra quando a pessoa o escolhe pelo nome.
 */
export function resolveChatModelIds(choice, models, catalogVersion) {
  const eligible = eligibleChatModels(models, catalogVersion);
  if (choice && choice !== "auto")
    return eligible.filter((m) => m.id === choice).map((m) => m.id);
  return eligible.filter((m) => !/fable/i.test(m.id)).map((m) => m.id);
}

/** Tarefas do projeto em ordem de conversa (mais antiga primeiro), a partir de `since`. */
export function chatTurns(tasks, since) {
  if (!Array.isArray(tasks)) return [];
  const start = since ? Date.parse(since) : NaN;
  return tasks
    .filter((t) => {
      if (!t || Number.isNaN(start)) return Boolean(t);
      const created = Date.parse(t.created_at);
      return Number.isNaN(created) || created >= start;
    })
    .slice()
    .sort((a, b) => {
      const da = Date.parse(a.created_at);
      const db = Date.parse(b.created_at);
      if (Number.isNaN(da) || Number.isNaN(db) || da === db) return 0;
      return da - db;
    });
}

/** Fase de um turno, derivada só do estado real da tarefa. */
export function chatTurnPhase(task) {
  const status = task?.status;
  if (status === "completed") return "answered";
  if (CHAT_WORKING_STATES.includes(status)) return "working";
  if (status === "planned") return "awaiting_consent";
  if (status === "blocked") return "blocked";
  if (status === "uncertain") return "uncertain";
  if (status === "incomplete") return "incomplete";
  if (status === "failed" || status === "interrupted") return "failed";
  return "unknown";
}

/** Texto de atividade real. Não há streaming: a resposta chega inteira. */
export function chatActivityLabel(status) {
  return (
    {
      queued: "Preparando o pedido…",
      waiting: "Aguardando o gateway local…",
      running: "Aguardando o Claude…",
      in_flight: "Aguardando o Claude…",
    }[status] || "Aguardando…"
  );
}

const CHAT_LOGIN_ERRORS = [
  "provider_not_authenticated",
  "provider_not_logged_in",
  "provider_not_subscription_login",
  "provider_auth_status_unknown",
];
const CHAT_CLI_ERRORS = [
  "provider_cli_not_installed",
  "provider_cli_not_runnable",
  "provider_cli_version_unsupported",
];
const CHAT_UNCERTAIN_ERRORS = [
  "provider_timeout",
  "request_outcome_uncertain",
  "process_interrupted_outcome_unknown",
  "gateway_failed_outcome_may_be_unknown",
  "gateway_request_failed",
  "gateway_invalid_response",
];
const CHAT_REPLAN_ERRORS = [
  "model_unavailable_replan_required",
  "model_capabilities_changed_replan_required",
  "model_capabilities_missing_replan_required",
  "gateway_protocol_changed_replan_required",
];

/**
 * Mensagem de erro para a conversa: frase principal, orientação e tom.
 * `tone` "info" = saída preservada; "warn" = precisa de ação; "error" = falhou.
 * O código técnico não aparece aqui; fica nos detalhes recolhidos.
 */
export function describeChatError(error) {
  if (!error) return null;
  if (error === "provider_error")
    return {
      tone: "error",
      message: "O Claude não conseguiu responder a este pedido.",
      hint: "Seu texto e os materiais continuam preservados. O pedido não será repetido automaticamente.",
    };
  if (error === "provider_quota_exceeded")
    return {
      tone: "warn",
      message: "O limite de uso da sua conta Claude foi atingido.",
      hint: "Seu texto continua preservado. Envie de novo quando a cota for renovada.",
    };
  if (CHAT_LOGIN_ERRORS.includes(error))
    return {
      tone: "warn",
      message: "É preciso entrar na sua conta Claude para continuar.",
      hint: "Faça login pelo comando claude no terminal e depois retome este pedido.",
    };
  if (CHAT_CLI_ERRORS.includes(error))
    return {
      tone: "warn",
      message: "O Claude Code não pôde ser iniciado neste computador.",
      hint: "Confira a instalação em Conexões e depois retome este pedido.",
    };
  if (error === "completion_unconfirmed")
    return {
      tone: "info",
      message: "Resposta recebida, mas o término não foi confirmado.",
      hint: "O texto recebido está preservado abaixo e pode estar incompleto.",
    };
  if (
    error === "output_token_limit_reached" ||
    error === "provider_output_limit_reached"
  )
    return {
      tone: "info",
      message: "A resposta parou no limite de saída.",
      hint: "O texto recebido até esse ponto está preservado abaixo.",
    };
  if (CHAT_UNCERTAIN_ERRORS.includes(error))
    return {
      tone: "warn",
      message: "Não foi possível confirmar o resultado deste pedido.",
      hint: "A geração pode ter usado sua cota. O pedido não será repetido automaticamente.",
    };
  if (CHAT_REPLAN_ERRORS.includes(error))
    return {
      tone: "warn",
      message: "O modelo ou o contrato mudou depois que este pedido foi criado.",
      hint: "Escolha um modelo disponível e envie a mensagem de novo.",
    };
  if (error === "output_limit_not_accepted")
    return {
      tone: "warn",
      message: "Este pedido precisa do aceite do limite indicativo.",
      hint: "Marque o aceite e envie a mensagem de novo.",
    };
  if (error === "visual_context_not_supported")
    return {
      tone: "warn",
      message: "O Claude ainda não analisa prints e imagens por aqui.",
      hint: "A captura continua salva no seu computador. Envie um trecho de texto.",
    };
  if (error === "review_context_too_large")
    return {
      tone: "warn",
      message: "O contexto ficou grande demais para a revisão.",
      hint: "Reduza os materiais anexados e envie de novo.",
    };
  if (
    error === "gateway_preflight_failed" ||
    error === "invalid_gateway_token" ||
    error === "gateway_busy" ||
    error === "request_in_progress"
  )
    return {
      tone: "warn",
      message: "O gateway local não está pronto para este pedido.",
      hint: "Nenhuma resposta foi gerada. Confira Conexões e depois retome.",
    };
  return {
    tone: "error",
    message: "Este pedido não foi concluído.",
    hint: "Seu texto continua preservado. Veja os detalhes técnicos para o diagnóstico.",
  };
}

/** Validação do envio no chat. Projeto não é pré-requisito: é criado no envio. */
export function validateChatDraft({ text, modelIds, online }) {
  if (!online) return "Conecte o componente local para enviar.";
  if (!text || !text.trim()) return "Escreva uma mensagem.";
  if (text.length > 8000) return "A mensagem pode ter até 8.000 caracteres.";
  if (!Array.isArray(modelIds) || !modelIds.length)
    return "Nenhum modelo Claude disponível. Veja Conexões.";
  return null;
}
