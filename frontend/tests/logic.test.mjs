import test from "node:test";
import assert from "node:assert/strict";
import {
  sourceContent,
  taskState,
  validateDraft,
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

test("planning requires context owner, a prompt and available selected agents", () => {
  const valid = {
    projectId: "p",
    text: "Explique",
    selectedModels: ["a"],
    review: false,
  };
  assert.equal(validateDraft(valid), null);
  for (const change of [
    { projectId: "" },
    { text: " " },
    { text: "x".repeat(8001) },
    { selectedModels: [] },
    { review: true },
  ]) {
    assert.ok(validateDraft({ ...valid, ...change }));
  }
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
  chatTurns,
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

test("chat: turnos em ordem cronológica e limitados ao início da conversa", () => {
  const tasks = [
    { id: "c", created_at: "2026-11-11T12:00:00Z" },
    { id: "a", created_at: "2026-11-11T10:00:00Z" },
    { id: "b", created_at: "2026-11-11T11:00:00Z" },
  ];
  assert.deepEqual(chatTurns(tasks).map((t) => t.id), ["a", "b", "c"]);
  assert.deepEqual(
    chatTurns(tasks, "2026-11-11T10:30:00Z").map((t) => t.id),
    ["b", "c"],
  );
  assert.deepEqual(tasks.map((t) => t.id), ["c", "a", "b"], "não altera a lista original");
  assert.deepEqual(chatTurns(undefined), []);
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
