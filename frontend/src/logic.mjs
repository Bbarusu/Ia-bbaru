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
      (catalogVersion === "1" ||
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
  if (choice && choice !== "auto" && !isResponseProfile(choice))
    return eligible.filter((m) => m.id === choice).map((m) => m.id);
  return eligible.filter((m) => !/fable/i.test(m.id)).map((m) => m.id);
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
      running: "Claude está pensando…",
      in_flight: "Claude está pensando…",
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
      tone: "warn",
      message: "O Claude não conseguiu responder a este pedido.",
      hint: "Seu texto e os materiais continuam preservados. O pedido não será repetido automaticamente.",
    };
  if (error === "provider_quota_exceeded")
    return {
      tone: "warn",
      message: "O limite de uso da sua conta Claude foi atingido.",
      hint: "Seu texto continua preservado. Confira a disponibilidade no Claude Code; o horário de renovação não foi informado.",
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
  if (error === "provider_output_limit_reached")
    return {
      tone: "warn",
      message: "O Claude atingiu o limite de saída deste pedido.",
      hint: "A CLI não entregou o texto parcial. Revise o limite antes de um novo envio; não haverá repetição automática.",
    };
  if (error === "provider_model_requires_credits" || error === "provider_model_unavailable")
    return {
      tone: "warn",
      message: error === "provider_model_requires_credits" ? "Este modelo exige créditos de uso na sua conta." : "Este modelo não está disponível para sua conta agora.",
      hint: "Confira /model no Claude Code e escolha um modelo disponível. Não houve troca automática de modelo.",
    };
  if (error === "provider_rate_limited")
    return { tone: "warn", message: "O Claude limitou a taxa de pedidos.", hint: "Confira a disponibilidade no Claude Code. Não haverá repetição automática." };
  if (error === "output_token_limit_reached")
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

/** Nome curto do modelo para a pílula e o cabeçalho da resposta (ex.: "Sonnet"). */
export function shortModelName(model) {
  if (!model) return "Claude";
  const match = /^Claude Code \(([^)]+)\)/i.exec(model.label || "");
  if (match) {
    const alias = match[1].trim();
    return alias.charAt(0).toUpperCase() + alias.slice(1);
  }
  return model.label || model.id || "Claude";
}

/**
 * Troca, só na exibição, os ids das fontes citadas pelo Claude pelo título da
 * fonte, para respostas antigas. O gateway atual pede o título diretamente.
 */
export function readableAnswer(output, context) {
  let text = typeof output === "string" ? output : "";
  if (!Array.isArray(context)) return text;
  for (const source of context) {
    if (!source || typeof source.id !== "string" || source.id.length < 8) continue;
    const title = (source.title || "fonte").trim() || "fonte";
    text = text.split(source.id).join(`“${title}”`);
  }
  return text;
}

// ---------------------------------------------------------------------------
// Conversas (contrato docs/ENTREGA_BACKEND_CHAT.md). Só montam e conferem os
// corpos; quem envia, persiste e consulta é o App, pelo backend real.
// ---------------------------------------------------------------------------

/** Perfis do backend: regra de preferência de modelo, não avaliação de qualidade. */
export const RESPONSE_PROFILES = [
  { id: "quick", label: "Rápido", hint: "Prefere Haiku" },
  { id: "normal", label: "Normal", hint: "Prefere Sonnet" },
  { id: "deep", label: "Profundo", hint: "Prefere Opus" },
];

export function isResponseProfile(choice) {
  return RESPONSE_PROFILES.some((p) => p.id === choice);
}

/** Teto padrão de novos chats (1–4096); o aceite cobre até este valor. */
export const CHAT_MAX_OUTPUT_TOKENS = 2048;

/** Captura do runtime (capture.page/selection) → snapshot de texto do turno. */
export function captureSnapshot(capture) {
  if (!capture || capture.media || typeof capture.text !== "string" || !capture.text.trim())
    return null;
  return {
    capture_id: capture.id,
    // "text": texto colado pela pessoa, sem página de origem (F-4).
    kind: capture.kind === "page" || capture.kind === "text" ? capture.kind : "selection",
    title: (capture.title?.trim() || "Trecho da página").slice(0, 120),
    content: capture.text,
    url: capture.url || null,
    document_id: capture.document_id || null,
    captured_at: capture.captured_at || null,
    // Metadados aditivos da Frente 2 (opcionais no TextSnapshot).
    ...(capture.tab_id ? { tab_id: capture.tab_id } : {}),
    ...(Number.isInteger(capture.documentVersion) ? { documentVersion: capture.documentVersion } : {}),
  };
}

/** A captura anexada é de outro documento que o aberto agora (navegou/recarregou). */
export function captureIsStale(capture, pageStatus) {
  if (!capture || !pageStatus || !capture.document_id) return false;
  return capture.document_id !== pageStatus.document_id;
}

/** O aceite da conversa cobre este envio? (mesmas regras que o backend confere) */
export function consentCovers(consent, { modelIds, maxOutputTokens = CHAT_MAX_OUTPUT_TOKENS, visual = false }) {
  if (!consent || !consent.id || !Array.isArray(consent.allowed_model_ids)) return false;
  if (!Array.isArray(modelIds) || !modelIds.length) return false;
  if (!modelIds.every((id) => consent.allowed_model_ids.includes(id))) return false;
  if (maxOutputTokens > consent.max_output_tokens) return false;
  return !visual || consent.allow_visual_input === true;
}

/** Visão só aparece quando o catálogo 1.2 declara imagem para todos os modelos autorizados. */
export function visionAvailable(models, modelIds, catalogVersion) {
  if (!["1.2", "1.3"].includes(catalogVersion) || !Array.isArray(modelIds) || !modelIds.length) return false;
  return modelIds.every((id) => {
    const model = (models || []).find((m) => m.id === id);
    return model?.input?.image?.supported === true;
  });
}

/**
 * Corpo de conversations.turns.send. Montado uma vez e persistido inteiro antes
 * do envio; reenviar exige o MESMO corpo com o MESMO turn_id.
 */
export function buildTurn({
  turnId,
  instruction,
  choice,
  modelIds,
  consent,
  acceptedLimit = false,
  review = false,
  sourceIds = /** @type {string[]} */ ([]),
  snapshots = /** @type {any[]} */ ([]),
  visual = false,
  attachments = /** @type {any[]} */ ([]),
}) {
  const explicit = choice && choice !== "auto" && !isResponseProfile(choice);
  const turn = {
    turn_id: turnId,
    instruction,
    kind: "general",
    allowed_model_ids: [...modelIds],
    mode: review ? "review" : "single",
    confirmed: !consent,
    allow_unenforced_output_limit: consent ? consent.allow_unenforced_output_limit === true : acceptedLimit === true,
    max_output_tokens: CHAT_MAX_OUTPUT_TOKENS,
    source_ids: [...sourceIds],
    attachments,
    snapshots: snapshots.filter(Boolean),
    allow_visual_input: visual === true,
  };
  if (explicit) turn.preferred_model_id = choice;
  else if (isResponseProfile(choice)) turn.response_profile = choice;
  if (consent) turn.consent_id = consent.id;
  return turn;
}

/** Corpo do aceite único da conversa (somente após ação da pessoa). */
export function buildConsent({ modelIds, acceptedLimit = false, visual = false }) {
  return {
    policy_version: "1",
    confirmed: true,
    allowed_model_ids: [...modelIds],
    allow_unenforced_output_limit: acceptedLimit === true,
    allow_visual_input: visual === true,
    max_output_tokens: CHAT_MAX_OUTPUT_TOKENS,
  };
}

/**
 * Sem resposta definitiva do backend: o turno pode ter sido criado. Só consultar
 * ou reenviar o mesmo corpo; nunca gerar outro turn_id.
 */
export function sendOutcomeUnknown(error) {
  const code = error?.code;
  return !code || /^http_5\d\d$/.test(code) || ["outcome_unknown", "backend_unavailable", "conversation_changed"].includes(code);
}

/** Recusa do aceite da conversa: pede novo aceite, sem reenviar sozinho. */
export function consentRejected(error) {
  return ["conversation_consent_revoked", "conversation_consent_scope_changed"].includes(error?.code);
}

/** Título da conversa a partir da primeira mensagem (até 60 caracteres). */
export function conversationTitle(text) {
  const line = String(text || "").trim().split("\n")[0].trim() || "Nova conversa";
  return line.length > 60 ? `${line.slice(0, 59).trimEnd()}…` : line;
}

/** Duração medida pelo backend; ausente (ex.: após crash) não vira zero. */
export function formatDuration(ms) {
  if (typeof ms !== "number" || !Number.isFinite(ms) || ms < 0) return "";
  return ms < 1000
    ? `${ms} ms`
    : `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s`;
}
