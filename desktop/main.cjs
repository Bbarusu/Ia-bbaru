const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  Menu,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { randomUUID } = require("node:crypto");
const { LocalService } = require("./local-service.cjs");
const { webURL, trustedFrame, validateEnvelope } = require("./policy.cjs");

const root = path.resolve(__dirname, "..");
const shellFile = path.join(__dirname, "ui", "index.html");
const homeFile = path.join(__dirname, "ui", "home.html");
const workspaceFile = path.join(root, "frontend", "dist", "index.html");
if (process.env.IA_BBARU_PROFILE_DIR)
  app.setPath("userData", path.resolve(process.env.IA_BBARU_PROFILE_DIR));
app.setName("Ia-bbaru");
if (!app.requestSingleInstanceLock()) {
  app.quit();
  return; // Do not start a second backend for the same profile.
}
let win,
  workspace,
  service,
  startupError = "",
  stopped = false;
let tabs = [],
  activeId,
  panel = true,
  expanded = false,
  localData = {},
  capture = null;
const TOP = 106,
  PANEL = 440;

function active() {
  return tabs.find((t) => t.id === activeId);
}
function snapshot() {
  const tab = active();
  return {
    tabs: tabs.map((t) => ({
      id: t.id,
      title: t.title,
      url: t.url,
      loading: t.loading,
      error: t.error,
    })),
    activeId,
    panel,
    expanded,
    back: tab?.view.webContents.navigationHistory.canGoBack() || false,
    forward: tab?.view.webContents.navigationHistory.canGoForward() || false,
    startupError,
    chromium: process.versions.chrome,
  };
}
function publish() {
  if (win && !win.isDestroyed())
    win.webContents.send("browser:state", snapshot());
}
function layout() {
  if (!win || win.isDestroyed()) return;
  const [w, h] = win.getContentSize();
  const panelWidth = expanded
    ? w
    : Math.min(PANEL, Math.max(360, Math.floor(w * 0.45)));
  for (const t of tabs) {
    t.view.setVisible(t.id === activeId && !expanded);
    t.view.setBounds({
      x: 0,
      y: TOP,
      width: Math.max(1, w - (panel ? panelWidth : 0)),
      height: Math.max(1, h - TOP),
    });
  }
  if (workspace) {
    workspace.setVisible(panel);
    workspace.setBounds({
      x: expanded ? 0 : w - panelWidth,
      y: TOP,
      width: panelWidth,
      height: Math.max(1, h - TOP),
    });
  }
  publish();
}
function isWeb(value) {
  try {
    const url = new URL(value);
    return (
      ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}
function keyboard(contents) {
  contents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || !(input.control || input.meta)) return;
    switch (input.key.toLowerCase()) {
      case "l":
        event.preventDefault();
        win.webContents.focus();
        win.webContents.send("browser:focus-address");
        break;
      case "t":
        event.preventDefault();
        if (tabs.length < 20) newTab();
        break;
      case "w":
        event.preventDefault();
        closeTab(activeId);
        break;
      case "r":
        event.preventDefault();
        active()?.view.webContents.reload();
        break;
    }
  });
}
function protectInternal(contents, file) {
  const allowed = pathToFileURL(file).href;
  contents.on("will-navigate", (event, url) => {
    if (url !== allowed) event.preventDefault();
  });
  contents.on("will-frame-navigate", (event) => {
    if (event.url !== allowed) event.preventDefault();
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isWeb(url)) newTab(url);
    return { action: "deny" };
  });
  contents.on("will-attach-webview", (event) => event.preventDefault());
}
function activate(id) {
  if (tabs.some((t) => t.id === id)) {
    activeId = id;
    expanded = false;
    layout();
  }
}
function navigate(tab, url) {
  tab.error = "";
  const target = url || pathToFileURL(homeFile).href;
  tab.view.webContents.loadURL(target).catch(() => {});
}
function newTab(url = null) {
  if (tabs.length >= 20)
    throw new Error("Feche uma aba antes de abrir outra (limite de 20).");
  const view = new WebContentsView({
    webPreferences: {
      session: session.fromPartition("persist:web"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  view.setBackgroundColor("#101113");
  const tab = {
    id: randomUUID(),
    title: "Nova aba",
    url: "",
    loading: false,
    error: "",
    view,
  };
  tabs.push(tab);
  win.contentView.addChildView(view);
  // Keep the workspace above web content in the view hierarchy.
  if (workspace) {
    win.contentView.removeChildView(workspace);
    win.contentView.addChildView(workspace);
  }
  const wc = view.webContents;
  keyboard(wc);
  wc.setWindowOpenHandler(({ url }) => {
    if (isWeb(url) && tabs.length < 20) newTab(url);
    return { action: "deny" };
  });
  wc.on("will-navigate", (event, url) => {
    if (!isWeb(url)) event.preventDefault();
  });
  wc.on("will-frame-navigate", (event) => {
    if (!isWeb(event.url) && event.url !== "about:blank")
      event.preventDefault();
  });
  wc.on("will-redirect", (event, url) => {
    if (!isWeb(url)) event.preventDefault();
  });
  wc.on("will-attach-webview", (event) => event.preventDefault());
  wc.on("page-title-updated", (_event, title) => {
    tab.title = title.slice(0, 160) || "Sem título";
    publish();
  });
  wc.on("did-start-loading", () => {
    tab.loading = true;
    publish();
  });
  wc.on("did-stop-loading", () => {
    tab.loading = false;
    publish();
  });
  const location = () => {
    const url = wc.getURL();
    tab.url = isWeb(url) ? url : "";
    publish();
  };
  wc.on("did-navigate", location);
  wc.on("did-navigate-in-page", location);
  wc.on("did-fail-load", (_event, code, _description, _url, main) => {
    if (main && code !== -3) {
      tab.error =
        "Não foi possível abrir esta página. Confira o endereço e a conexão.";
      publish();
    }
  });
  wc.on("render-process-gone", () => {
    tab.error = "Esta aba foi interrompida. Recarregue para continuar.";
    publish();
  });
  wc.on("context-menu", (_event, params) => {
    const selected = params.selectionText?.trim();
    Menu.buildFromTemplate([
      {
        label: "Adicionar seleção ao Ia-bbaru",
        enabled: !!selected && selected.length <= 38000 && isWeb(wc.getURL()),
        click: () => {
          try {
            saveCapture(tab, selected);
          } catch (error) {
            workspace.webContents.send("workspace:changed", {
              captureError: { newValue: error.message },
            });
          }
        },
      },
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { label: "Recarregar", click: () => wc.reload() },
    ]).popup({ window: win });
  });
  activate(tab.id);
  navigate(tab, url);
  return tab;
}
function closeTab(id) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return;
  win.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  tabs = tabs.filter((t) => t !== tab);
  if (!tabs.length) newTab();
  else if (activeId === id) activate(tabs[tabs.length - 1].id);
  layout();
}
function store() {
  fs.writeFileSync(
    path.join(app.getPath("userData"), "workspace.json"),
    JSON.stringify(localData),
    { mode: 0o600 },
  );
}
function saveCapture(tab, text) {
  if (
    !text?.trim() ||
    text.length > 38000 ||
    !isWeb(tab.view.webContents.getURL())
  )
    throw new Error(
      "Selecione um trecho de até 38.000 caracteres em uma página web.",
    );
  if (capture)
    throw new Error(
      "Salve ou descarte o trecho pendente antes de capturar outro.",
    );
  capture = {
    id: randomUUID(),
    title: (tab.view.webContents.getTitle() || "Trecho selecionado").slice(
      0,
      120,
    ),
    url: tab.view.webContents.getURL(),
    text,
  };
  localData.pendingCapture = capture;
  store();
  panel = true;
  layout();
  workspace.webContents.send("workspace:changed", {
    pendingCapture: { newValue: capture },
  });
  return capture;
}
async function selectCapture() {
  const tab = active();
  if (!tab || !isWeb(tab.view.webContents.getURL()))
    throw new Error("Abra uma página e selecione um trecho.");
  const before = tab.view.webContents.getURL();
  // Fixed script, only after a user's capture action. No credentials or page-wide scrape.
  const text = await tab.view.webContents.executeJavaScript(
    "window.getSelection().toString()",
  );
  if (before !== tab.view.webContents.getURL())
    throw new Error("A página mudou. Selecione o trecho novamente.");
  return saveCapture(tab, text);
}
function assertSender(event, contents, file) {
  if (!trustedFrame(event, contents, file))
    throw new Error("Origem não autorizada.");
}

app
  .whenReady()
  .then(async () => {
    Menu.setApplicationMenu(null);
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    try {
      localData = JSON.parse(
        fs.readFileSync(
          path.join(app.getPath("userData"), "workspace.json"),
          "utf8",
        ),
      );
    } catch {}
    capture = localData.pendingCapture || null;
    for (const s of [
      session.defaultSession,
      session.fromPartition("persist:web"),
    ]) {
      s.setPermissionRequestHandler((_wc, _permission, callback) =>
        callback(false),
      );
      s.setPermissionCheckHandler(() => false);
      s.on("will-download", (event) => event.preventDefault());
    }
    win = new BrowserWindow({
      width: 1440,
      height: 960,
      minWidth: 900,
      minHeight: 640,
      backgroundColor: "#08090b",
      title: "Ia-bbaru",
      webPreferences: {
        preload: path.join(__dirname, "shell-preload.cjs"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    protectInternal(win.webContents, shellFile);
    keyboard(win.webContents);
    workspace = new WebContentsView({
      webPreferences: {
        preload: path.join(__dirname, "workspace-preload.cjs"),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    protectInternal(workspace.webContents, workspaceFile);
    keyboard(workspace.webContents);
    workspace.setBackgroundColor("#08090b");
    win.contentView.addChildView(workspace);
    service = new LocalService(
      root,
      path.join(app.getPath("userData"), "local"),
    );
    const serviceReady = service.start().catch((error) => {
      startupError = error.message;
      publish();
      throw error;
    });
    // Requests wait for startup; avoid an unhandled rejection before the first request.
    serviceReady.catch(() => {});
    ipcMain.handle("browser:state", (event) => {
      assertSender(event, win.webContents, shellFile);
      return snapshot();
    });
    ipcMain.handle("browser:command", async (event, action, value) => {
      assertSender(event, win.webContents, shellFile);
      try {
        switch (action) {
          case "navigate":
            navigate(active(), webURL(value));
            break;
          case "new":
            newTab(value ? webURL(value) : null);
            break;
          case "activate":
            activate(value);
            break;
          case "close":
            closeTab(value);
            break;
          case "back":
            if (active().view.webContents.navigationHistory.canGoBack())
              active().view.webContents.navigationHistory.goBack();
            break;
          case "forward":
            if (active().view.webContents.navigationHistory.canGoForward())
              active().view.webContents.navigationHistory.goForward();
            break;
          case "reload":
            active().view.webContents.reload();
            break;
          case "panel":
            panel = !panel;
            expanded = false;
            layout();
            break;
          case "expand":
            panel = true;
            expanded = !expanded;
            layout();
            break;
          case "capture":
            await selectCapture();
            break;
          default:
            throw new Error("Ação não disponível.");
        }
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    });
    ipcMain.handle("workspace:message", async (event, msg) => {
      assertSender(event, workspace.webContents, workspaceFile);
      if (!msg || typeof msg !== "object")
        throw new Error("Mensagem inválida.");
      switch (msg.type) {
        case "bridge.request":
          validateEnvelope(msg.request);
          await serviceReady;
          return service.request(msg.request);
        case "capture.read":
          return capture;
        case "capture.clear":
          if (capture?.id === msg.id) {
            capture = null;
            delete localData.pendingCapture;
            store();
          }
          return { ok: true };
        case "capture.selection":
          try {
            return { ok: true, capture: await selectCapture() };
          } catch (error) {
            return { ok: false, error: { message: error.message } };
          }
        case "workspace.open":
          panel = true;
          expanded = !expanded;
          layout();
          return { ok: true };
        default:
          throw new Error("Mensagem não permitida.");
      }
    });
    ipcMain.handle("workspace:storage", (event, operation, value) => {
      assertSender(event, workspace.webContents, workspaceFile);
      const valid = (key) =>
        typeof key === "string" &&
        (key === "last-project" ||
          key === "captureError" ||
          /^draft:[\w-]{1,64}$/.test(key));
      if (operation === "get" && valid(value))
        return { [value]: localData[value] || "" };
      if (operation === "remove" && valid(value)) {
        delete localData[value];
        store();
        return;
      }
      if (
        operation === "set" &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        const entries = Object.entries(value);
        if (
          entries.length > 10 ||
          entries.some(
            ([k, v]) => !valid(k) || typeof v !== "string" || v.length > 8000,
          )
        )
          throw new Error("Rascunho inválido.");
        for (const [key, val] of entries) localData[key] = val;
        store();
        return;
      }
      throw new Error("Operação de armazenamento inválida.");
    });
    win.on("resize", layout);
    win.webContents.on("did-finish-load", publish);
    win.on("closed", () => {
      for (const t of tabs)
        if (!t.view.webContents.isDestroyed()) t.view.webContents.close();
      if (!workspace.webContents.isDestroyed()) workspace.webContents.close();
      service.stop();
    });
    await win.loadFile(shellFile);
    if (!fs.existsSync(workspaceFile)) {
      startupError = "Compile a interface com npm run build em desktop/.";
      publish();
    } else await workspace.webContents.loadFile(workspaceFile);
    newTab();
    layout();
  })
  .catch((error) => {
    console.error("Ia-bbaru: falha ao iniciar a interface.", error.message);
    app.quit();
  });
app.on("second-instance", () => {
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", (event) => {
  if (!stopped) {
    event.preventDefault();
    stopped = true;
    Promise.resolve(service?.stop()).finally(() => app.quit());
  }
});
