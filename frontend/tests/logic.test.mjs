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
