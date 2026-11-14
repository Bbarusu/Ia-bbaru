// Real Electron, real Python backend and real native bridge. No provider account.
const { _electron: electron } = require("playwright");
const { expect } = require("@playwright/test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { randomUUID } = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");

async function main() {
  const profile = fs.mkdtempSync(
    path.join(os.tmpdir(), "ia-bbaru-browser-test-"),
  );
  const artifacts = path.resolve(__dirname, "../../artifacts/chromium");
  fs.mkdirSync(artifacts, { recursive: true });
  const generations = [];
  const server = http.createServer((req, res) => {
    if (req.url === "/v1/connections") {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ connections: [
        { provider: "claude-code", version: "2.1.307", installed: true, ready: true, configured_models: ["claude-code:fixture"] },
      ] }));
      return;
    }
    if (req.url === "/fixture-image.svg") {
      res.setHeader("Content-Type", "image/svg+xml");
      res.end('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"><rect width="160" height="90" fill="blue"/></svg>');
      return;
    }
    if (req.url === "/v1.1/generate" && req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => { body += chunk; });
      req.on("end", () => {
        const request = JSON.parse(body);
        generations.push(request);
        setTimeout(() => {
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ protocol_version: "1.1", request_id: request.request_id,
            model_id: request.model_id, output: "Resposta simulada da fila durável.", finish_reason: "stop" }));
        }, 800);
      });
      return;
    }
    if (req.url === "/v1.1/models") {
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          protocol_version: "1.1",
          models: [
            {
              id: "fixture:study",
              provider: "claude-code",
              label: "Agente de teste local",
              available: true,
              task_kinds: ["study"],
              context_char_limit: 80000,
              max_output_tokens: 64,
              capabilities: {
                output_limit: "best_effort",
                cancellation: "local_process_only",
                finish_reason: "reported",
                billing: "subscription_quota",
                streaming: false,
                tools: "disabled",
              },
              unavailable_reason: null,
            },
          ],
        }),
      );
      return;
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      '<!doctype html><html lang="pt-BR"><head><title>Aula de teste</title></head><body style="background:#f4f4f7;color:#222;padding:45px;font:20px sans-serif"><h1>Material da faculdade</h1><p id="source">A fotossíntese transforma energia luminosa em energia química.</p><a href="/segunda">Segunda página</a><button onclick="window.open(\'/popup\')">Abrir outra aba</button><p><img id="diagram" src="/fixture-image.svg" alt="Diagrama de teste" /></p></body></html>',
    );
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  let app;
  const env = { ...process.env, IA_BBARU_PROFILE_DIR: profile };
  env.GATEWAY_URL = url;
  env.GATEWAY_TOKEN = "fixture-only-not-a-secret-0123456789";
  env.GATEWAY_PROTOCOL_VERSION = "1.1";
  delete env.IA_BBARU_REAL_TEST;
  const launch = () =>
    electron.launch({
      args: [
        path.resolve(__dirname, ".."),
        ...(process.env.IA_BBARU_TEST_NO_SANDBOX === "1"
          ? ["--no-sandbox"]
          : []),
      ],
      chromiumSandbox: process.env.IA_BBARU_TEST_NO_SANDBOX !== "1",
      env,
      timeout: 60000,
    });
  async function workspacePage() {
    await expect
      .poll(
        () =>
          app
            .windows()
            .find((p) => p.url().includes("/frontend/dist/index.html")),
        { timeout: 30000 },
      )
      .toBeTruthy();
    return app
      .windows()
      .find((p) => p.url().includes("/frontend/dist/index.html"));
  }
  try {
    app = await launch();
    const shell = await app.firstWindow();
    const workspace = await workspacePage();
    await expect(
      workspace.getByText("Backend local ativo", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    const secondCode = await new Promise((resolve, reject) => {
      const args = [
        path.resolve(__dirname, ".."),
        ...(process.env.IA_BBARU_TEST_NO_SANDBOX === "1"
          ? ["--no-sandbox"]
          : []),
      ];
      const child = spawn(require("electron"), args, {
        env,
        stdio: ["ignore", "ignore", "pipe"],
      });
      let diagnostic = "";
      child.stderr.on("data", (data) => {
        diagnostic = (diagnostic + data.toString()).slice(-2000);
      });
      const timer = setTimeout(() => {
        child.kill();
        reject(new Error("Second instance did not exit"));
      }, 10000);
      child.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.once("exit", (code, signal) => {
        clearTimeout(timer);
        if (code !== 0)
          reject(
            new Error(
              `Second instance exited ${code}/${signal}: ${diagnostic}`,
            ),
          );
        else resolve(code);
      });
    });
    assert.equal(secondCode, 0);
    // No painel lateral, projetos e áreas ficam no menu "Mais opções" do topo.
    const openArea = async (page, name) => {
      await page.getByRole("button", { name: "Mais opções", exact: true }).click();
      // O papel menuitem vem do focusgroup do Chromium; o Playwright não o infere.
      await page.locator(".header-menu").getByRole("button", { name, exact: false }).click();
    };
    await openArea(workspace, "Novo projeto");
    await workspace.getByLabel("Nome do projeto").fill("Teste Chromium");
    await workspace
      .getByRole("dialog")
      .getByRole("button", { name: "Criar projeto", exact: true })
      .click();
    await expect(workspace.locator("#project")).not.toHaveValue("");
    await shell.locator("#address").fill(url);
    await shell.locator("#address").press("Enter");
    await expect
      .poll(() => app.windows().find((p) => p.url().startsWith(url)))
      .toBeTruthy();
    const web = app.windows().find((p) => p.url().startsWith(url));
    await expect(web.locator("h1")).toHaveText("Material da faculdade");
    assert.deepEqual(
      await web.evaluate(() => ({
        node: typeof process,
        require: typeof require,
        bridge: typeof window.iaDesktop,
        shell: typeof window.navigatorApp,
      })),
      {
        node: "undefined",
        require: "undefined",
        bridge: "undefined",
        shell: "undefined",
      },
    );
    await web.locator("a").click();
    await expect(web).toHaveURL(url + "/segunda");
    await shell.getByRole("button", { name: "Voltar", exact: true }).click();
    await expect(web).toHaveURL(url + "/");
    await web.evaluate(() => {
      const range = document.createRange();
      range.selectNodeContents(document.querySelector("#source"));
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(range);
    });
    await shell.locator("#capture").click();
    await expect(workspace.getByRole("dialog")).toBeVisible();
    await expect(workspace.locator("dialog textarea")).toHaveValue(
      /fotossíntese/,
    );
    await workspace
      .getByRole("button", { name: "Salvar no projeto", exact: true })
      .click();
    await expect(workspace.getByRole("dialog")).not.toBeVisible();
    const saved = await workspace.evaluate(async () => {
      const req = (operation, params = {}) =>
        window.iaDesktop.runtime.sendMessage({
          type: "bridge.request",
          request: {
            protocol_version: "0",
            request_id: crypto.randomUUID(),
            operation,
            params,
          },
        });
      const p = await req("projects.list");
      const s = await req("sources.list", { project_id: p.data.items[0].id });
      return { projects: p.data.items, sources: s.data.items };
    });
    assert.equal(saved.projects[0].title, "Teste Chromium");
    assert.equal(saved.sources.length, 1);
    const sourceId = saved.sources[0].id;
    const detail = await workspace.evaluate(
      async ({ project, source }) =>
        window.iaDesktop.runtime.sendMessage({
          type: "bridge.request",
          request: {
            protocol_version: "0",
            request_id: crypto.randomUUID(),
            operation: "sources.get",
            params: { project_id: project, source_id: source },
          },
        }),
      { project: saved.projects[0].id, source: sourceId },
    );
    assert.match(detail.data.content, /fotossíntese/);
    assert.ok(detail.data.content.includes(url));
    // Chat lateral: sem modal e sem cadastro manual de plano. Nada é salvo nem
    // gerado antes dos aceites desta mensagem.
    const listTasks = () =>
      workspace.evaluate(
        (project) =>
          window.iaDesktop.runtime.sendMessage({
            type: "bridge.request",
            request: {
              protocol_version: "0",
              request_id: crypto.randomUUID(),
              operation: "tasks.list",
              params: { project_id: project },
            },
          }),
        saved.projects[0].id,
      );
    await workspace
      .getByLabel("Modelo Claude")
      .selectOption({ label: "Agente de teste local" });
    await expect(workspace.locator("#instruction")).toBeVisible();
    await workspace
      .locator("#instruction")
      .fill("Explique este material em uma frase.");
    await workspace.locator("#instruction").press("Enter");
    const confirmSend = workspace.getByRole("group", { name: "Confirmar envio" });
    const sendToClaude = confirmSend.getByRole("button", {
      name: "Enviar ao Claude",
      exact: true,
    });
    await expect(sendToClaude).toBeDisabled();
    await confirmSend
      .getByRole("checkbox", {
        name: "Aceito o limite indicativo para esta tarefa",
      })
      .check();
    // O aceite do limite sozinho não autoriza a execução.
    await expect(sendToClaude).toBeDisabled();
    assert.equal((await listTasks()).data.items.length, 0);
    assert.equal(generations.length, 0);
    await expect(workspace.getByRole("dialog")).toHaveCount(0);
    await workspace.screenshot({ path: path.join(artifacts, "execution-consent.png") });
    await confirmSend
      .getByRole("checkbox", { name: "Autorizo executar esta tarefa com minha conta" })
      .check();
    await sendToClaude.click();
    // The worker continues while the panel is hidden.
    await shell.locator("#panel").click();
    await expect.poll(() => generations.length).toBe(1);
    await shell.locator("#panel").click();
    // A resposta aparece na conversa, sem abrir diálogo.
    await expect(
      workspace
        .getByRole("log", { name: "Conversa com o Claude" })
        .getByText("Resposta simulada da fila durável.", { exact: true }),
    ).toBeVisible({ timeout: 15000 });
    await expect(workspace.getByRole("dialog")).toHaveCount(0);
    await expect(workspace.locator("#instruction")).toHaveValue("");
    await expect(workspace.locator("#instruction")).toBeVisible();
    const tasks = await listTasks();
    assert.equal(tasks.data.items.length, 1);
    const task = await workspace.evaluate(
      (id) =>
        window.iaDesktop.runtime.sendMessage({
          type: "bridge.request",
          request: {
            protocol_version: "0",
            request_id: crypto.randomUUID(),
            operation: "tasks.get",
            params: { task_id: id },
          },
        }),
      tasks.data.items[0].id,
    );
    assert.equal(task.data.allow_unenforced_output_limit, true);
    assert.equal(task.data.gateway_protocol_version, "1.1");
    assert.equal(task.data.status, "completed");
    assert.equal(generations[0].request_id, `${task.data.id}:0`);
    assert.equal(generations[0].allow_unenforced_output_limit, true);
    assert.equal(generations.length, 1);
    await workspace.screenshot({ path: path.join(artifacts, "execution-completed.png") });
    // Detalhes técnicos ficam recolhidos e continuam acessíveis para diagnóstico.
    await expect(workspace.getByText("Limite indicativo (64 tokens)")).not.toBeVisible();
    await workspace.getByText("Detalhes técnicos", { exact: true }).click();
    await workspace
      .getByRole("button", { name: "Abrir detalhes da tarefa", exact: true })
      .click();
    await expect(workspace.getByRole("dialog").getByRole("heading", { name: "Concluída", exact: true })).toBeVisible();
    await expect(
      workspace.getByRole("dialog").getByText("Assinatura (cota da conta)"),
    ).toBeVisible();
    await expect(
      workspace.getByRole("dialog").getByText("Limite indicativo (64 tokens)"),
    ).toBeVisible();
    await expect(
      workspace
        .getByRole("dialog")
        .getByText(/Término informado pelo provedor/),
    ).toBeVisible();
    assert.equal(await workspace.locator("dialog").evaluate((dialog) => dialog.scrollWidth <= dialog.clientWidth), true);
    await workspace
      .getByRole("dialog")
      .getByRole("button", { name: "Fechar", exact: true })
      .click();
    // Os aceites valem só para a mensagem enviada; a próxima começa desmarcada.
    await workspace.locator("#instruction").fill("Segunda mensagem");
    await workspace.getByRole("button", { name: "Enviar", exact: true }).click();
    await expect(
      confirmSend.getByRole("checkbox", {
        name: "Aceito o limite indicativo para esta tarefa",
      }),
    ).not.toBeChecked();
    await expect(
      confirmSend.getByRole("checkbox", {
        name: "Autorizo executar esta tarefa com minha conta",
      }),
    ).not.toBeChecked();
    await confirmSend.getByRole("button", { name: "Cancelar", exact: true }).click();
    // Cancelar preserva o rascunho e não cria tarefa.
    await expect(workspace.locator("#instruction")).toHaveValue("Segunda mensagem");
    assert.equal((await listTasks()).data.items.length, 1);
    await workspace.locator("#instruction").fill("");
    const rejected = await workspace.evaluate(async () => {
      try {
        await window.iaDesktop.runtime.sendMessage({
          type: "bridge.request",
          request: {
            protocol_version: "0",
            request_id: crypto.randomUUID(),
            operation: "tasks.execute",
            params: {},
          },
        });
        return false;
      } catch {
        return true;
      }
    });
    assert.equal(rejected, true);
    await shell.locator("#address").fill("file:///etc/passwd");
    await shell.locator("#address").press("Enter");
    await expect(shell.locator("#message")).toContainText("HTTP ou HTTPS");
    await expect(web).toHaveURL(url + "/");
    await shell.getByRole("button", { name: "Nova aba", exact: true }).click();
    await expect(shell.locator("#tabs .choose")).toHaveCount(2);
    await shell.locator("#tabs .choose").last().focus();
    await shell.locator("#tabs .choose").last().press("ArrowLeft");
    await expect(shell.locator("#tabs .choose").first()).toHaveAttribute("aria-pressed", "true");
    await expect(shell.locator("#tabs .choose").first()).toBeFocused();
    if (process.env.AXE_CORE_PATH) {
      await shell.evaluate(fs.readFileSync(process.env.AXE_CORE_PATH, "utf8"));
      const violations = await shell.evaluate(async () => (await axe.run(document, {
        runOnly: { type: "rule", values: ["aria-required-children", "aria-required-parent", "aria-allowed-attr", "aria-prohibited-attr"] },
      })).violations);
      assert.deepEqual(violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), []);
    }
    await shell
      .getByRole("button", { name: "Fechar Nova aba", exact: true })
      .click();
    await expect(shell.locator("#tabs .choose")).toHaveCount(1);
    // A new capture while manually editing must not erase the draft (Path A: save then review queued).
    await openArea(workspace, "Biblioteca");
    await workspace
      .getByRole("button", { name: "Adicionar texto", exact: true })
      .click();
    await workspace.getByLabel("Título", { exact: true }).fill("Meu rascunho");
    await workspace.locator("dialog textarea").fill("Texto manual preservado");
    await shell.locator("#capture").click();
    await expect(workspace.getByLabel("Título", { exact: true })).toHaveValue(
      "Meu rascunho",
    );
    await expect(
      workspace.getByText(
        "Uma nova captura está aguardando. Conclua o material atual.",
      ),
    ).toBeVisible();
    await workspace
      .getByRole("button", { name: "Salvar no projeto", exact: true })
      .click();
    await workspace
      .getByRole("button", { name: "Revisar nova captura", exact: true })
      .click();
    await expect(workspace.getByLabel("Título", { exact: true })).toHaveValue(
      "Aula de teste",
    );
    await workspace
      .getByRole("button", { name: "Descartar trecho", exact: true })
      .click();
    // Path B: explicit replacement confirmation inside the modal when a capture arrives during manual drafting.
    await workspace
      .getByRole("button", { name: "Adicionar texto", exact: true })
      .click();
    await workspace
      .getByLabel("Título", { exact: true })
      .fill("Rascunho substituível");
    await workspace
      .locator("dialog textarea")
      .fill("Rascunho que será substituído pelo botão explícito");
    await shell.locator("#capture").click();
    await expect(workspace.getByLabel("Título", { exact: true })).toHaveValue(
      "Rascunho substituível",
    );
    await workspace
      .getByRole("button", {
        name: "Substituir pela captura em espera",
        exact: true,
      })
      .click();
    await expect(workspace.getByLabel("Título", { exact: true })).toHaveValue(
      "Aula de teste",
    );
    await workspace
      .getByRole("button", { name: "Descartar trecho", exact: true })
      .click();
    // Verify shell accessibility (.brand has no prohibited aria-label, #panel contrast >= 4.5:1)
    const shellA11y = await shell.evaluate(() => {
      const brand = document.querySelector(".brand");
      const panel = document.getElementById("panel");
      const style = window.getComputedStyle(panel);
      const parseRgb = (str) => str.match(/\d+/g).map(Number);
      const lum = ([r, g, b]) => {
        const a = [r, g, b].map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      };
      const l1 = lum(parseRgb(style.color));
      const l2 = lum(parseRgb(style.backgroundColor));
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      return {
        brandAriaLabel: brand ? brand.getAttribute("aria-label") : null,
        panelContrast: ratio,
      };
    });
    assert.equal(shellA11y.brandAriaLabel, null);
    assert.ok(
      shellA11y.panelContrast >= 4.5,
      `Expected #panel contrast >= 4.5, got ${shellA11y.panelContrast}`,
    );
    // Verify expanded workspace mode and semantic project list.
    await expect(shell.locator("#panel")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(shell.locator("#expand")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await shell.locator("#expand").click();
    await expect(shell.locator("#expand")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      workspace.locator('ul.project-list > li > button[aria-current="true"]'),
    ).toHaveText("Teste Chromium");
    assert.equal(
      await workspace.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      true,
    );
    await workspace.screenshot({
      path: path.join(artifacts, "workspace-expanded.png"),
    });
    await shell.locator("#expand").click();
    await expect(shell.locator("#expand")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await shell.locator("#address").fill("");
    await shell.locator("#address").press("Enter");
    await expect(web).toHaveTitle("Nova aba");
    // Verify minimum window size 900x640 has no horizontal overflow across views.
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(900, 640);
    });
    for (const view of [shell, workspace, web]) {
      assert.equal(
        await view.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
        true,
      );
    }
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows()[0].setSize(1440, 920);
    });
    const screenshot = await app.evaluate(async ({ BrowserWindow }) =>
      (await BrowserWindow.getAllWindows()[0].capturePage())
        .toPNG()
        .toString("base64"),
    );
    fs.writeFileSync(
      path.join(artifacts, "shell.png"),
      Buffer.from(screenshot, "base64"),
    );
    // capturePage covers the shell surface; capture each child view separately.
    await workspace.screenshot({ path: path.join(artifacts, "workspace.png") });
    await web.screenshot({ path: path.join(artifacts, "new-tab.png") });
    // Optional OS capture includes the native child views in one image (Linux/X11).
    if (process.platform === "linux" && process.env.DISPLAY) {
      const id = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]
          .getNativeWindowHandle()
          .readUInt32LE(0),
      );
      const shot = spawnSync(
        "import",
        ["-window", String(id), path.join(artifacts, "browser-native.png")],
        { timeout: 10000 },
      );
      if (shot.error || shot.status !== 0)
        console.log(
          "Native screenshot unavailable; individual view screenshots saved.",
        );
    }
    // Exercise the new browser tools against the actual remote WebContents.
    await shell.locator("#address").fill(url);
    await shell.locator("#address").press("Enter");
    await expect(web.locator("h1")).toHaveText("Material da faculdade");
    await shell.locator("#zoom-toggle").click();
    await shell.getByRole("button", { name: "125%", exact: true }).click();
    await expect.poll(() => app.evaluate(({ webContents }, url) => webContents.getAllWebContents().find((w) => w.getURL().startsWith(url)).getZoomFactor(), url)).toBe(1.25);
    await shell.getByRole("button", { name: "100%", exact: true }).click();
    await shell.locator("#find-toggle").click();
    await shell.locator(".tool-input").fill("fotossíntese");
    await shell.locator(".tool-input").press("Enter");
    await expect(shell.locator("#subbar-tool [role=status]")).toContainText("1 / 1");
    await shell.locator(".tool-close-btn").click();
    await shell.locator("#capture-print").click();
    await expect(workspace.getByRole("dialog").getByRole("heading")).toHaveText("Revisar captura visual");
    await expect(workspace.locator("dialog img")).toBeVisible();
    await workspace.getByRole("button", { name: "Salvar no projeto", exact: true }).click();
    await expect(workspace.getByRole("dialog")).not.toBeVisible();
    const imageSource = await workspace.evaluate(async (project) => {
      const call = (operation, params) => window.iaDesktop.runtime.sendMessage({ type: "bridge.request", request: {
        protocol_version: "0", request_id: crypto.randomUUID(), operation, params }});
      const list = await call("sources.list", { project_id: project });
      const media = list.data.items.find((s) => s.media);
      return (await call("sources.get", { project_id: project, source_id: media.id })).data;
    }, saved.projects[0].id);
    assert.equal(imageSource.media.kind, "screenshot");
    assert.ok(imageSource.media.data_url.startsWith("data:image/jpeg;base64,"));
    assert.ok(!imageSource.content.includes("base64"));
    // Intercept only the native menu presentation; invoke the actual callback
    // registered by the runtime for the user's right-click on the fixture image.
    await app.evaluate(({ Menu }) => {
      globalThis.originalBuildMenu = Menu.buildFromTemplate;
      Menu.buildFromTemplate = (template) => { globalThis.imageMenu = template; return { popup() {} }; };
    });
    await web.locator("#diagram").click({ button: "right" });
    await expect.poll(() => app.evaluate(() => Boolean(globalThis.imageMenu))).toBe(true);
    await app.evaluate(async ({ Menu }) => {
      const entry = globalThis.imageMenu.find((item) => item.label === "Capturar área visível da imagem");
      if (!entry?.enabled) throw new Error("Image capture menu unavailable");
      await entry.click();
      Menu.buildFromTemplate = globalThis.originalBuildMenu;
    });
    await expect(workspace.getByRole("dialog").getByRole("heading")).toHaveText("Revisar captura visual");
    await expect(workspace.locator("dialog img")).toBeVisible();
    await workspace.getByRole("button", { name: "Salvar no projeto", exact: true }).click();
    await expect(workspace.getByRole("dialog")).not.toBeVisible();
    await workspace.screenshot({ path: path.join(artifacts, "media-library.png") });
    await workspace.getByRole("button", { name: "Capturar imagem", exact: true }).click();
    const tinyImage = await workspace.evaluate(() => {
      const canvas = document.createElement("canvas"); canvas.width = 32; canvas.height = 24;
      const context = canvas.getContext("2d"); context.fillStyle = "blue"; context.fillRect(0, 0, 32, 24);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    await workspace.locator('dialog input[type=file]').setInputFiles({ name: "tiny.png", mimeType: "image/png", buffer: Buffer.from(tinyImage, "base64") });
    await expect(workspace.getByLabel("Título", { exact: true })).toHaveValue("Imagem: tiny.png");
    await expect(workspace.locator("dialog img")).toBeVisible();
    await expect(workspace.locator("dialog textarea")).not.toHaveValue(/base64/);
    await workspace.getByRole("button", { name: "Salvar no projeto", exact: true }).click();
    await expect(workspace.getByRole("dialog")).not.toBeVisible();
    await openArea(workspace, "Conexões");
    await expect(workspace.getByText("Claude Code · 2.1.307", { exact: true })).toBeVisible();
    const versions = await app.evaluate(() => process.versions);
    await app.close();
    app = null;
    app = await launch();
    const reopened = await workspacePage();
    await expect(
      reopened.getByText("Backend local ativo", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    const persisted = await reopened.evaluate(() =>
      window.iaDesktop.runtime.sendMessage({
        type: "bridge.request",
        request: {
          protocol_version: "0",
          request_id: crypto.randomUUID(),
          operation: "projects.list",
          params: {},
        },
      }),
    );
    assert.equal(persisted.data.items[0].title, "Teste Chromium");
    fs.writeFileSync(
      path.join(artifacts, "smoke.json"),
      JSON.stringify(
        {
          electron: versions.electron,
          chromium: versions.chrome,
          chromiumSandbox: process.env.IA_BBARU_TEST_NO_SANDBOX !== "1",
          checks: [
            "native backend startup",
            "single instance per profile",
            "project creation",
            "web navigation and back",
            "remote isolation",
            "selection capture and SQLite source",
            "chat send without modal; nothing saved or generated before consents",
            "1.1 acceptance required per message and persisted",
            "answer shown in the conversation; technical details collapsed",
            "1.1 capability badges in task details dialog (Término informado pelo provedor)",
            "synchronous execution denied; durable enqueue confirmed",
            "native zoom and findInPage",
            "native screenshot and separate local image storage",
            "file navigation denied",
            "tabs",
            "manual draft preserved (save then review queued)",
            "manual draft explicit replacement confirmation",
            "shell brand aria-label removed and #panel contrast >= 4.5",
            "expanded workspace and semantic project list",
            "minimum window size 900x640 no overflow",
            "restart persistence",
          ],
          realAccount: false,
        },
        null,
        2,
      ),
    );
    console.log(
      "Chromium UI passed: navigation, isolation, real backend, capture, draft preservation and restart persistence.",
    );
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(profile, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    });
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
