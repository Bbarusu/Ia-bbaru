import test from "node:test";
import assert from "node:assert/strict";
import {
  sourceContent,
  taskState,
  formatBilling,
  formatOutputLimit,
  formatCancellation,
  formatFinishReason,
  formatUnavailableReason,
  describeTaskError,
  requiresLimitAcceptance,
  decideIncomingCapture,
} from "../src/logic.mjs";

test("capture preserves selected text and provenance", () => {
  const hostile = "<script>doSomething()</script>";
  assert.equal(
    sourceContent("Aula", "https://example.com", hostile),
    `Aula\nOrigem: https://example.com\n\n${hostile}`,
  );
  assert.equal(sourceContent("Nota", "", hostile), hostile);
});

test("partial or failed results are never labelled as successful", () => {
  for (const state of ["failed", "incomplete", "interrupted", "unknown"]) {
    assert.notEqual(taskState(state), "Concluída");
  }
  assert.equal(taskState("completed"), "Concluída");
});

test("1.1 capability helpers translate billing, output limits, cancellation and finish reasons accurately", () => {
  assert.equal(
    formatBilling("subscription_quota"),
    "Assinatura (cota da conta)",
  );
  assert.equal(formatBilling("api_key"), "Chave de API");
  assert.equal(formatBilling("unknown"), "Modalidade não informada");

  assert.equal(
    formatOutputLimit("enforced", 64),
    "Limite garantido (64 tokens)",
  );
  assert.equal(
    formatOutputLimit("best_effort", 128),
    "Limite indicativo (128 tokens)",
  );
  assert.equal(formatOutputLimit("none", null), "Sem teto de saída");

  assert.equal(formatCancellation("provider"), "Cancelamento no provedor");
  assert.equal(
    formatCancellation("local_process_only"),
    "Cancelamento apenas local",
  );
  assert.equal(formatCancellation("none"), "Sem cancelamento");

  // Capability finish_reason: "reported" means the provider reports stop reason (not confirmed before execution)
  assert.equal(
    formatFinishReason("reported"),
    "Término informado pelo provedor",
  );
  assert.doesNotMatch(formatFinishReason("reported"), /confirmad/i);
  assert.equal(formatFinishReason("inferred"), "Término inferido");

  // Result finish_reason: "stop" vs "unknown"
  assert.equal(formatFinishReason("stop"), "Conclusão confirmada");
  assert.equal(formatFinishReason("length"), "Limite de saída atingido");
  assert.equal(formatFinishReason("unknown"), "Conclusão não confirmada");
});

test("formatUnavailableReason translates real gateway catalog codes and never presents quota as catalog reason", () => {
  const realCodes = {
    cli_not_installed: /CLI oficial não instalado/i,
    cli_not_runnable: /não pôde ser executado/i,
    cli_version_unsupported: /versão do CLI oficial incompatível/i,
    auth_status_unknown: /verificar o login no CLI/i,
    not_logged_in: /faça login no CLI oficial/i,
    not_subscription_login: /login por assinatura no CLI oficial/i,
  };

  for (const [code, pattern] of Object.entries(realCodes)) {
    const label = formatUnavailableReason(code);
    assert.match(label, /^Indisponível:/);
    assert.match(label, pattern);
    assert.doesNotMatch(label, new RegExp(code));
    assert.doesNotMatch(label, /cota|limite de uso/i);
  }

  // Unknown or missing codes fall back to generic text without inventing quota reasons
  assert.equal(formatUnavailableReason(null), "Indisponível neste computador");
  assert.equal(
    formatUnavailableReason("future_code"),
    "Indisponível (future_code)",
  );
  assert.equal(
    formatUnavailableReason("rate_limited"),
    "Indisponível (rate_limited)",
  );
});

test("requiresLimitAcceptance identifies selected models without enforced output limit", () => {
  const catalog = [
    {
      id: "enforced:model",
      capabilities: { output_limit: "enforced" },
    },
    {
      id: "best:model",
      capabilities: { output_limit: "best_effort" },
    },
    {
      id: "none:model",
      capabilities: { output_limit: "none" },
    },
  ];
  assert.equal(requiresLimitAcceptance(["enforced:model"], catalog), false);
  assert.equal(requiresLimitAcceptance(["best:model"], catalog), true);
  assert.equal(
    requiresLimitAcceptance(["enforced:model", "none:model"], catalog),
    true,
  );
});

test("describeTaskError translates completion_unconfirmed and other gateway errors clearly", () => {
  const unconfirmed = describeTaskError("completion_unconfirmed");
  assert.ok(unconfirmed);
  assert.match(unconfirmed, /Conclusão não confirmada pelo provedor/i);
  assert.match(unconfirmed, /preservada abaixo para leitura/i);

  const limitReached = describeTaskError("output_token_limit_reached");
  assert.ok(limitReached);
  assert.match(limitReached, /limite de tokens de saída foi atingido/i);

  assert.equal(describeTaskError(null), "");
});

test("decideIncomingCapture protects unsaved manual drafts, edited captures and in-flight saves", () => {
  const capA = { id: "cap-a", title: "Aula A", text: "Trecho A" };
  const capB = { id: "cap-b", title: "Aula B", text: "Trecho B" };

  // Modal closed -> open incoming capture immediately
  assert.deepEqual(
    decideIncomingCapture(
      { modal: null, title: "", content: "", capture: null, busy: false },
      capA,
    ),
    { action: "open", capture: capA, title: "Aula A", content: "Trecho A" },
  );

  // Modal open on empty manual source -> open incoming capture immediately
  assert.deepEqual(
    decideIncomingCapture(
      { modal: "source", title: "  ", content: "", capture: null, busy: false },
      capA,
    ),
    { action: "open", capture: capA, title: "Aula A", content: "Trecho A" },
  );

  // Modal open with manual draft text -> queue incoming capture
  assert.deepEqual(
    decideIncomingCapture(
      {
        modal: "source",
        title: "Rascunho",
        content: "Minhas notas",
        capture: null,
        busy: false,
      },
      capA,
    ),
    { action: "queue", queuedCapture: capA },
  );

  // Modal open with capture A being reviewed/edited -> queue capture B
  assert.deepEqual(
    decideIncomingCapture(
      {
        modal: "source",
        title: "Aula A editada",
        content: "Trecho A",
        capture: capA,
        busy: false,
      },
      capB,
    ),
    { action: "queue", queuedCapture: capB },
  );

  // Modal busy saving -> queue incoming capture even if fields were cleared
  assert.deepEqual(
    decideIncomingCapture(
      { modal: null, title: "", content: "", capture: null, busy: true },
      capB,
    ),
    { action: "queue", queuedCapture: capB },
  );

  // Duplicate event for the exact same active capture -> ignore
  assert.deepEqual(
    decideIncomingCapture(
      {
        modal: "source",
        title: "Aula A editada",
        content: "Trecho A",
        capture: capA,
        busy: false,
      },
      capA,
    ),
    { action: "ignore" },
  );
});

// ---- Chat lateral ----
import {
  chatActivityLabel,
  chatTurnPhase,
  describeChatError,
  readableAnswer,
  shortModelName,
  eligibleChatModels,
  resolveChatModelIds,
  validateChatDraft,
} from "../src/logic.mjs";

const caps = (tools = "disabled") => ({
  output_limit: "best_effort",
  cancellation: "local_process_only",
  finish_reason: "reported",
  billing: "subscription_quota",
  streaming: false,
  tools,
});

test("chat: só modelos disponíveis e sem ferramentas são elegíveis no contrato 1.1", () => {
  const models = [
    { id: "claude-code:sonnet", available: true, capabilities: caps() },
    { id: "claude-code:haiku", available: false, capabilities: caps() },
    { id: "claude-code:opus", available: true, capabilities: caps("restricted") },
    { id: "claude-code:old", available: true },
  ];
  assert.deepEqual(
    eligibleChatModels(models, "1.1").map((m) => m.id),
    ["claude-code:sonnet"],
  );
  // No contrato 1 não há capacidades declaradas; vale a disponibilidade.
  assert.deepEqual(
    eligibleChatModels(models, "1").map((m) => m.id),
    ["claude-code:sonnet", "claude-code:opus", "claude-code:old"],
  );
  assert.deepEqual(eligibleChatModels(null, "1.1"), []);
});

test("chat: automático nunca autoriza Fable; escolha manual autoriza só o escolhido", () => {
  const models = [
    { id: "claude-code:sonnet", available: true, capabilities: caps() },
    { id: "claude-code:fable", available: true, capabilities: caps() },
  ];
  assert.deepEqual(resolveChatModelIds("auto", models, "1.1"), ["claude-code:sonnet"]);
  assert.deepEqual(resolveChatModelIds("", models, "1.1"), ["claude-code:sonnet"]);
  assert.deepEqual(resolveChatModelIds("claude-code:fable", models, "1.1"), ["claude-code:fable"]);
  // Um modelo que deixou de ser elegível não é enviado.
  assert.deepEqual(resolveChatModelIds("claude-code:gone", models, "1.1"), []);
});

test("chat: fase do turno vem do estado real da tarefa", () => {
  assert.equal(chatTurnPhase({ status: "planned" }), "awaiting_consent");
  assert.equal(chatTurnPhase({ status: "blocked" }), "blocked");
  for (const status of ["queued", "running", "waiting", "in_flight"])
    assert.equal(chatTurnPhase({ status }), "working");
  assert.equal(chatTurnPhase({ status: "completed" }), "answered");
  assert.equal(chatTurnPhase({ status: "incomplete" }), "incomplete");
  assert.equal(chatTurnPhase({ status: "uncertain" }), "uncertain");
  assert.equal(chatTurnPhase({ status: "failed" }), "failed");
  assert.equal(chatTurnPhase({ status: "interrupted" }), "failed");
  assert.equal(chatTurnPhase({ status: "novo" }), "unknown");
  assert.equal(chatActivityLabel("queued"), "Preparando o pedido…");
  assert.equal(chatActivityLabel("running"), "Claude está pensando…");
});

test("chat: provider_error não sugere causa não comprovada nem expõe o código", () => {
  const info = describeChatError("provider_error");
  assert.equal(info.message, "O Claude não conseguiu responder a este pedido.");
  assert.doesNotMatch(`${info.message} ${info.hint}`, /login|cota|limite|provider_error/i);
  assert.match(info.hint, /não será repetido/);
});

test("chat: causas conhecidas trazem a ação correspondente", () => {
  assert.match(describeChatError("provider_quota_exceeded").message, /limite de uso/);
  assert.match(describeChatError("provider_not_logged_in").hint, /login/);
  assert.equal(describeChatError("completion_unconfirmed").tone, "info");
  assert.equal(describeChatError("output_token_limit_reached").tone, "info");
  assert.match(describeChatError("provider_timeout").hint, /não será repetido/);
  assert.match(describeChatError("visual_context_not_supported").message, /prints e imagens/);
  const unknown = describeChatError("codigo_novo");
  assert.doesNotMatch(unknown.message, /codigo_novo/);
  assert.equal(describeChatError(null), null);
});

test("chat: envio não exige projeto, mas exige conexão, texto e modelo", () => {
  assert.equal(validateChatDraft({ text: "Oi", modelIds: ["m"], online: true }), null);
  assert.match(validateChatDraft({ text: "Oi", modelIds: ["m"], online: false }), /Conecte/);
  assert.match(validateChatDraft({ text: "  ", modelIds: ["m"], online: true }), /Escreva/);
  assert.match(validateChatDraft({ text: "x".repeat(8001), modelIds: ["m"], online: true }), /8\.000/);
  assert.match(validateChatDraft({ text: "Oi", modelIds: [], online: true }), /Nenhum modelo/);
});

test("chat: nome curto do modelo vem do alias do Claude Code", () => {
  assert.equal(shortModelName({ id: "claude-code:sonnet", label: "Claude Code (sonnet) - assinatura" }), "Sonnet");
  assert.equal(shortModelName({ id: "fixture:study", label: "Agente de teste local" }), "Agente de teste local");
  assert.equal(shortModelName(undefined), "Claude");
});

test("chat: ids de fontes citados viram o título só na exibição", () => {
  const id = "3ca05830-926f-47ca-96d8-0ccfe7399a4d";
  const context = [{ id, title: "Aula de teste", content: "x" }];
  assert.equal(
    readableAnswer(`Resumo do trecho (fonte: ${id}).`, context),
    "Resumo do trecho (fonte: “Aula de teste”).",
  );
  // Um id incompleto não é adivinhado.
  assert.equal(readableAnswer("-47ca-96d8-0ccfe7399a4d).", context), "-47ca-96d8-0ccfe7399a4d).");
  assert.equal(readableAnswer(null, context), "");
  assert.equal(readableAnswer("sem fontes", undefined), "sem fontes");
});

// ---- Conversas (contrato 16/11/2026) ----
import {
  buildConsent,
  buildTurn,
  captureIsStale,
  captureSnapshot,
  consentCovers,
  consentRejected,
  conversationTitle,
  formatDuration,
  sendOutcomeUnknown,
  visionAvailable,
} from "../src/logic.mjs";

test("conversa: perfil autoriza os modelos automáticos (sem Fable) e vai como response_profile", () => {
  const models = [
    { id: "claude-code:sonnet", available: true, capabilities: caps() },
    { id: "claude-code:fable", available: true, capabilities: caps() },
  ];
  assert.deepEqual(resolveChatModelIds("deep", models, "1.2"), ["claude-code:sonnet"]);
  const turn = buildTurn({ turnId: "t1", instruction: "Oi", choice: "deep", modelIds: ["claude-code:sonnet"] });
  assert.equal(turn.response_profile, "deep");
  assert.equal("preferred_model_id" in turn, false);
  assert.equal(turn.kind, "general");
  const explicit = buildTurn({ turnId: "t2", instruction: "Oi", choice: "claude-code:fable", modelIds: ["claude-code:fable"] });
  assert.equal(explicit.preferred_model_id, "claude-code:fable");
  assert.equal("response_profile" in explicit, false);
});

test("conversa: sem aceite, confirmed só true no envio individual; com aceite usa consent_id", () => {
  const single = buildTurn({ turnId: "t", instruction: "x", choice: "normal", modelIds: ["m"], acceptedLimit: true });
  assert.equal(single.confirmed, true);
  assert.equal(single.allow_unenforced_output_limit, true);
  assert.equal("consent_id" in single, false);
  const consent = { id: "c1", allowed_model_ids: ["m"], max_output_tokens: 2048, allow_unenforced_output_limit: true };
  const covered = buildTurn({ turnId: "t", instruction: "x", choice: "normal", modelIds: ["m"], consent });
  assert.equal(covered.confirmed, false);
  assert.equal(covered.consent_id, "c1");
  assert.equal(covered.max_output_tokens, 2048);
  assert.equal(buildTurn({ turnId: "t", instruction: "x", modelIds: ["m"], review: true }).mode, "review");
});

test("conversa: aceite cobre só os mesmos modelos, teto e visão", () => {
  const consent = { id: "c", allowed_model_ids: ["a", "b"], max_output_tokens: 2048, allow_visual_input: false };
  assert.equal(consentCovers(consent, { modelIds: ["a"] }), true);
  assert.equal(consentCovers(consent, { modelIds: ["a", "z"] }), false);
  assert.equal(consentCovers(consent, { modelIds: ["a"], maxOutputTokens: 4096 }), false);
  assert.equal(consentCovers(consent, { modelIds: ["a"], visual: true }), false);
  assert.equal(consentCovers(null, { modelIds: ["a"] }), false);
  assert.equal(consentCovers(consent, { modelIds: [] }), false);
  const body = buildConsent({ modelIds: ["a"], acceptedLimit: true });
  assert.deepEqual(body, {
    policy_version: "1", confirmed: true, allowed_model_ids: ["a"],
    allow_unenforced_output_limit: true, allow_visual_input: false, max_output_tokens: 2048,
  });
});

test("conversa: captura vira snapshot de texto; imagem não; contexto antigo é identificado", () => {
  const cap = { id: "k", kind: "page", title: " Aula ", url: "https://e.org/a", text: "corpo",
    document_id: "1:2", captured_at: "2026-11-16T10:00:00Z" };
  assert.deepEqual(captureSnapshot(cap), { capture_id: "k", kind: "page", title: "Aula", content: "corpo",
    url: "https://e.org/a", document_id: "1:2", captured_at: "2026-11-16T10:00:00Z" });
  assert.equal(captureSnapshot({ ...cap, kind: undefined }).kind, "selection");
  const typed = captureSnapshot({ ...cap, tab_id: "t-1", documentVersion: 0, extra: "x" });
  assert.equal(typed.tab_id, "t-1");
  assert.equal(typed.documentVersion, 0);
  assert.equal("extra" in typed, false, "só campos tipados");
  assert.equal(captureSnapshot({ ...cap, media: { kind: "image" } }), null);
  assert.equal(captureSnapshot({ ...cap, text: "  " }), null);
  assert.equal(captureIsStale(cap, { document_id: "1:2" }), false);
  assert.equal(captureIsStale(cap, { document_id: "1:3" }), true);
  assert.equal(captureIsStale(cap, null), false);
});

test("conversa: envio perdido só consulta/reenvia o mesmo turno; recusa de aceite pede novo aceite", () => {
  assert.equal(sendOutcomeUnknown(new Error("ipc")), true);
  assert.equal(sendOutcomeUnknown({ code: "outcome_unknown" }), true);
  for (const code of ["http_500", "http_502", "http_503", "http_504"])
    assert.equal(sendOutcomeUnknown({ code }), true);
  assert.equal(sendOutcomeUnknown({ code: "http_422" }), false);
  assert.equal(sendOutcomeUnknown({ code: "conversation_changed" }), true);
  assert.equal(sendOutcomeUnknown({ code: "conversation_busy" }), false);
  assert.equal(sendOutcomeUnknown({ code: "context_too_large" }), false);
  assert.equal(consentRejected({ code: "conversation_consent_revoked" }), true);
  assert.equal(consentRejected({ code: "conversation_busy" }), false);
});

test("conversa: visão só com catálogo 1.2 e imagem declarada em todos os modelos", () => {
  const models = [
    { id: "s", input: { image: { supported: true } } },
    { id: "h", input: { image: { supported: false } } },
  ];
  assert.equal(visionAvailable(models, ["s"], "1.2"), true);
  assert.equal(visionAvailable(models, ["s"], "1.1"), false);
  assert.equal(visionAvailable(models, ["s", "h"], "1.2"), false);
  assert.equal(visionAvailable(models, [], "1.2"), false);
});

test("conversa: título e duração", () => {
  assert.equal(conversationTitle("  Explique o segundo ponto\nmais"), "Explique o segundo ponto");
  assert.equal(conversationTitle(""), "Nova conversa");
  assert.equal(conversationTitle("a".repeat(80)).length, 60);
  assert.equal(formatDuration(850), "850 ms");
  assert.equal(formatDuration(3200), "3,2 s");
  assert.equal(formatDuration(undefined), "");
});

// ---- I9: erros tipados do gateway 1.2 dentro da conversa ----
test("I9: créditos, modelo indisponível, taxa e teto têm mensagem própria, sem código cru nem promessa", () => {
  const credits = describeChatError("provider_model_requires_credits");
  assert.equal(credits.tone, "warn");
  assert.match(credits.message, /créditos/);
  assert.match(credits.hint, /Não houve troca automática de modelo/);
  const unavailable = describeChatError("provider_model_unavailable");
  assert.match(unavailable.message, /não está disponível/);
  assert.match(unavailable.hint, /Não houve troca automática/);
  const rate = describeChatError("provider_rate_limited");
  assert.match(rate.message, /taxa/);
  assert.match(rate.hint, /Não haverá repetição automática/);
  const limit = describeChatError("provider_output_limit_reached");
  assert.match(limit.message, /limite de saída/);
  assert.match(limit.hint, /não entregou o texto parcial/);
  for (const info of [credits, unavailable, rate, limit]) {
    assert.doesNotMatch(`${info.message} ${info.hint}`, /provider_/, "não expõe o código");
    assert.doesNotMatch(`${info.message} ${info.hint}`, /\d{1,2}h|\d{1,2}:\d{2}/, "não promete horário");
  }
});

test("F-4: texto colado vira snapshot kind text, sem origem, e não entra no pedido", () => {
  const snap = captureSnapshot({ id: "p1", kind: "text", title: "Texto colado", text: "conteúdo colado" });
  assert.deepEqual(snap, { capture_id: "p1", kind: "text", title: "Texto colado", content: "conteúdo colado",
    url: null, document_id: null, captured_at: null });
  const turn = buildTurn({ turnId: "t", instruction: "Resuma o texto colado.", choice: "normal", modelIds: ["m"], snapshots: [snap] });
  assert.equal(turn.instruction, "Resuma o texto colado.");
  assert.equal(turn.snapshots[0].content, "conteúdo colado");
});
