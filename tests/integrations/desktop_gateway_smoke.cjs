// Chromium app (Codex, desktop/) + this gateway over real HTTP, provider = CLI test double.
// No real account, no generation. Run from a checkout that combines
// codex/chromium-browser with this branch, after `npm --prefix desktop ci` and
// `npm --prefix desktop run build`:
//
//   IA_BBARU_PYTHON=<python with requirements> node tests/integrations/desktop_gateway_smoke.cjs
//
// Checks: real 1.1 catalog in the panel, selection, acceptance required, plan
// persisted with the gateway's capabilities, tasks.execute still refused, zero
// generations, and "not logged in" shown as unavailable (never as available).
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const net = require("node:net");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { randomBytes, randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");

const ROOT = path.resolve(__dirname, "../..");
const desktopRequire = createRequire(path.join(ROOT, "desktop", "package.json"));
const { _electron: electron } = desktopRequire("playwright");
const { expect } = desktopRequire("@playwright/test");
const PYTHON = process.env.IA_BBARU_PYTHON;
const MODEL_LABEL = "Claude Code (sonnet) - assinatura";

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function startGateway(token, record, extraEnv) {
  const port = await freePort();
  const env = { ...process.env, GATEWAY_TOKEN: token, FAKE_CLAUDE_RECORD: record, ...extraEnv };
  delete env.IA_BBARU_REAL_TEST;
  const child = spawn(PYTHON, [path.join(__dirname, "fixtures", "fake_gateway.py"), String(port)],
    { cwd: ROOT, env, stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  let stderr = "";
  child.stderr.on("data", (d) => { stderr = (stderr + d).slice(-2000); });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(url + "/health")).ok) return { child, url }; } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  child.kill();
  throw new Error("Gateway de teste não iniciou: " + stderr);
}

async function withApp(gateway, token, profile, body) {
  const env = { ...process.env, IA_BBARU_PROFILE_DIR: profile, GATEWAY_URL: gateway.url,
    GATEWAY_TOKEN: token, GATEWAY_PROTOCOL_VERSION: "1.1" };
  delete env.IA_BBARU_REAL_TEST;
  const noSandbox = process.env.IA_BBARU_TEST_NO_SANDBOX === "1";
  const app = await electron.launch({
    args: [path.join(ROOT, "desktop"), ...(noSandbox ? ["--no-sandbox"] : [])],
    chromiumSandbox: !noSandbox, env, timeout: 60000,
  });
  try {
    await expect.poll(() => app.windows().find((p) => p.url().includes("/frontend/dist/index.html")),
      { timeout: 30000 }).toBeTruthy();
    const workspace = app.windows().find((p) => p.url().includes("/frontend/dist/index.html"));
    await expect(workspace.getByText("Backend local ativo", { exact: true })).toBeVisible({ timeout: 30000 });
    const bridge = (operation, params = {}) => workspace.evaluate(
      ([operation, params]) => window.iaDesktop.runtime.sendMessage({ type: "bridge.request",
        request: { protocol_version: "0", request_id: crypto.randomUUID(), operation, params } }),
      [operation, params]);
    await body(workspace, bridge);
  } finally {
    await app.close();
  }
}

async function main() {
  assert.ok(PYTHON, "Defina IA_BBARU_PYTHON com o Python que tem requirements.txt");
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ia-bbaru-gw-desktop-"));
  const token = randomBytes(32).toString("hex");
  const record = path.join(scratch, "generation-record.json");
  const results = [];

  // A — logged in through the subscription: catalog, selection, acceptance, plan.
  let gateway = await startGateway(token, record, { FAKE_CLAUDE_LOGIN: "claude.ai" });
  try {
    await withApp(gateway, token, path.join(scratch, "profile-a"), async (workspace, bridge) => {
      const models = await bridge("models.list");
      assert.equal(models.ok, true, JSON.stringify(models));
      assert.equal(models.data.protocol_version, "1.1");
      const model = models.data.models[0];
      assert.equal(model.id, "claude-code:sonnet");
      assert.equal(model.available, true);
      assert.equal(model.capabilities.output_limit, "best_effort");
      assert.equal(model.capabilities.billing, "subscription_quota");
      results.push("catálogo 1.1 real do gateway no painel");

      await workspace.getByRole("button", { name: "Novo projeto", exact: true }).first().click();
      await workspace.getByLabel("Nome do projeto").fill("Gateway no Chromium");
      await workspace.getByRole("dialog").getByRole("button", { name: "Criar projeto", exact: true }).click();
      await expect(workspace.locator("#project")).not.toHaveValue("");

      const card = workspace.getByRole("button", { name: MODEL_LABEL, exact: false });
      await expect(card).toBeEnabled();
      await card.click();
      await expect(card).toHaveAttribute("aria-pressed", "true");
      await workspace.locator("#instruction").fill("Explique a fotossíntese em uma frase, com acentuação.");
      await workspace.getByRole("button", { name: "Criar plano", exact: true }).click();
      await expect(workspace.getByText("Aceite o limite indicativo antes de criar este plano.",
        { exact: true })).toBeVisible();
      results.push("sem aceite, o painel não envia o plano");

      await workspace.getByRole("checkbox", { name: "Aceito o limite indicativo para esta tarefa" }).check();
      await workspace.getByRole("button", { name: "Criar plano", exact: true }).click();
      await expect(workspace.getByRole("dialog")).toBeVisible();
      const project = (await bridge("projects.list")).data.items[0].id;
      const listed = await bridge("tasks.list", { project_id: project });
      const task = (await bridge("tasks.get", { task_id: listed.data.items[0].id })).data;
      assert.equal(task.status, "planned");
      assert.equal(task.gateway_protocol_version, "1.1");
      assert.equal(task.allow_unenforced_output_limit, true);
      assert.equal(task.plan[0].model_id, "claude-code:sonnet");
      assert.equal(task.plan[0].max_output_tokens, 128);
      assert.equal(task.plan[0].capabilities.output_limit, "best_effort");
      assert.match(task.instruction, /acentuação/);
      results.push("plano persistido com aceite e capacidades do gateway (teto 128)");

      const refused = await workspace.evaluate(async () => {
        try {
          await window.iaDesktop.runtime.sendMessage({ type: "bridge.request", request: {
            protocol_version: "0", request_id: crypto.randomUUID(), operation: "tasks.execute", params: {} } });
          return false;
        } catch { return true; }
      });
      assert.equal(refused, true);
      results.push("tasks.execute continua recusado pela ponte");
    });
  } finally {
    gateway.child.kill();
  }
  assert.equal(fs.existsSync(record), false, "Nenhuma geração deveria ter ocorrido");
  results.push("nenhuma geração no provedor (dublê não foi chamado com -p)");

  // B — not logged in: the model must appear unavailable, with the contract's reason.
  gateway = await startGateway(token, record, { FAKE_CLAUDE_LOGIN: "none" });
  try {
    await withApp(gateway, token, path.join(scratch, "profile-b"), async (workspace, bridge) => {
      const model = (await bridge("models.list")).data.models[0];
      assert.equal(model.available, false);
      assert.equal(model.unavailable_reason, "not_logged_in");
      const card = workspace.getByRole("button", { name: MODEL_LABEL, exact: false });
      await expect(card).toBeDisabled();
      await expect(card).toContainText("Indisponível");
      const reasonShown = await workspace.getByText(/login|not_logged_in|entrar/i).count();
      results.push(`sem login: modelo indisponível (unavailable_reason=not_logged_in; motivo exibido no painel: ${reasonShown > 0 ? "sim" : "não"})`);
    });
  } finally {
    gateway.child.kill();
  }
  assert.equal(fs.existsSync(record), false);
  fs.rmSync(scratch, { recursive: true, force: true });
  for (const line of results) console.log("OK  " + line);
  console.log("Gateway + Chromium verificados com o dublê do CLI; nenhuma conta usada.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
