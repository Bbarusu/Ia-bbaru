const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  Menu,
  dialog,
  nativeImage,
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
const closedTabs = [];
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
    canReopen: closedTabs.length > 0,
    zoom: tab ? Math.round(tab.view.webContents.getZoomFactor() * 100) : 100,
    find: tab?.find || null,
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
        if (input.shift) reopenTab();
        else if (tabs.length < 20) newTab();
        break;
      case "f":
        event.preventDefault();
        win.webContents.focus();
        win.webContents.send("browser:tool", "find");
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
  wc.on("did-start-navigation", (_event, _url, _inPlace, mainFrame) => {
    if (mainFrame) { tab.documentVersion = (tab.documentVersion || 0) + 1; tab.find = null; }
  });
  wc.on("found-in-page", (_event, result) => {
    tab.find = { matches: result.matches, activeMatchOrdinal: result.activeMatchOrdinal };
    publish();
  });
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
      { label: "Capturar print da página", enabled: isWeb(wc.getURL()), click: () => captureScreenshot(tab).catch(captureFailure) },
      { label: "Capturar área visível da imagem", enabled: params.mediaType === "image" && isWeb(wc.getURL()),
        click: () => captureImageAt(tab, params.x, params.y).catch(captureFailure) },
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
  if (isWeb(tab.url)) { closedTabs.push(tab.url); if (closedTabs.length > 20) closedTabs.shift(); }
  win.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  tabs = tabs.filter((t) => t !== tab);
  if (!tabs.length) newTab();
  else if (activeId === id) activate(tabs[tabs.length - 1].id);
  layout();
}
function reopenTab() {
  if (closedTabs.length && tabs.length < 20) newTab(closedTabs.pop());
}
function captureFailure(error) {
  workspace.webContents.send("workspace:changed", { captureError: { newValue: error.message } });
}
function store() {
  fs.writeFileSync(
    path.join(app.getPath("userData"), "workspace.json"),
    JSON.stringify(localData),
    { mode: 0o600 },
  );
}
function saveCapture(tab, text, media = undefined, title = undefined, originUrl = undefined) {
  if (
    !text?.trim() ||
    text.length > 38000 ||
    (!media && !isWeb(tab.view.webContents.getURL()))
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
    title: (title || tab.view.webContents.getTitle() || "Trecho selecionado").slice(
      0,
      120,
    ),
    url: originUrl ?? (isWeb(tab.view.webContents.getURL()) ? tab.view.webContents.getURL() : ""),
    text,
    ...(media ? { media } : {}),
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
function rasterAttachment(image, kind) {
  if (image.isEmpty()) throw new Error("Imagem inválida.");
  const size = image.getSize();
  if (size.width * size.height > 16000000) throw new Error("A imagem excede 16 megapixels.");
  let width = Math.min(size.width, 1920);
  for (;;) {
    const scaled = image.resize({ width });
    for (const quality of [90, 75, 60]) {
      const bytes = scaled.toJPEG(quality);
      if (bytes.length <= 480000) return { kind, data_url: "data:image/jpeg;base64," + bytes.toString("base64") };
    }
    if (width <= 160) throw new Error("Imagem grande demais. Capture uma área menor.");
    width = Math.max(160, Math.floor(width * .75));
  }
}
async function captureScreenshot(tab = active()) {
  if (capture) throw new Error("Salve ou descarte a captura pendente antes de capturar outra.");
  if (!tab || !isWeb(tab.view.webContents.getURL()) || expanded)
    throw new Error("Abra uma página visível antes de capturar o print.");
  const version = tab.documentVersion;
  const pixels = await tab.view.webContents.capturePage();
  if (tab !== active() || tab.documentVersion !== version || tab.view.webContents.isDestroyed())
    throw new Error("A página mudou. Capture novamente.");
  return saveCapture(tab, "Print da área visível. Descrição: ", rasterAttachment(pixels, "screenshot"), "Print: " + tab.title);
}
async function importImage() {
  if (capture) throw new Error("Salve ou descarte a captura pendente antes de importar outra.");
  const result = await dialog.showOpenDialog(win, { title: "Adicionar imagem ao projeto", properties: ["openFile"],
    filters: [{ name: "Imagens", extensions: ["png", "jpg", "jpeg", "webp"] }] });
  if (result.canceled) return null;
  const file = result.filePaths[0];
  if (fs.statSync(file).size > 10000000) throw new Error("Use uma imagem de até 10 MB.");
  const media = rasterAttachment(nativeImage.createFromBuffer(fs.readFileSync(file)), "image");
  return saveCapture(active(), "Imagem importada. Descrição: ", media, path.basename(file).slice(0, 120), "");
}
async function captureImageAt(tab, x, y) {
  if (capture) throw new Error("Salve ou descarte a captura pendente antes de capturar outra.");
  if (tab !== active() || expanded || !isWeb(tab.view.webContents.getURL()) || !Number.isFinite(x) || !Number.isFinite(y))
    throw new Error("Abra a imagem em uma página visível.");
  const version = tab.documentVersion;
  // Coordinates are finite numbers from Chromium's native context-menu event.
  // Read only geometry; do not fetch arbitrary image URLs or bypass CORS.
  const rect = await tab.view.webContents.executeJavaScript(`(() => {
    const image = document.elementFromPoint(${x}, ${y});
    if (!image || image.tagName !== 'IMG') return null;
    const r = image.getBoundingClientRect();
    const left = Math.max(0, Math.ceil(r.left)), top = Math.max(0, Math.ceil(r.top));
    return { x: left, y: top, width: Math.floor(Math.min(innerWidth, r.right) - left), height: Math.floor(Math.min(innerHeight, r.bottom) - top) };
  })()`);
  if (!rect || rect.width <= 0 || rect.height <= 0) throw new Error("Imagem não acessível neste quadro. Use o print da página.");
  const zoom = tab.view.webContents.getZoomFactor();
  const clip = Object.fromEntries(Object.entries(rect).map(([key, value]) => [key, Math.round(value * zoom)]));
  if (tab.documentVersion !== version) throw new Error("A página mudou. Capture novamente.");
  const pixels = await tab.view.webContents.capturePage(clip);
  if (tab !== active() || tab.documentVersion !== version) throw new Error("A página mudou. Capture novamente.");
  return saveCapture(tab, "Recorte visível de uma imagem da página. Descrição: ", rasterAttachment(pixels, "image"), "Imagem: " + tab.title);
}
async function capturePageText() {
  const tab = active();
  if (!tab || !isWeb(tab.view.webContents.getURL())) throw new Error("Abra uma página web.");
  const version = tab.documentVersion;
  const result = await tab.view.webContents.executeJavaScript("({text: (document.body?.innerText || '').slice(0, 38001)})");
  if (tab.documentVersion !== version || tab !== active()) throw new Error("A página mudou. Capture novamente.");
  if (result.text.length > 38000) throw new Error("A página excede 38.000 caracteres. Selecione o trecho desejado.");
  return saveCapture(tab, result.text);
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
          case "capture.screenshot":
            await captureScreenshot();
            break;
          case "capture.image":
            await importImage();
            break;
          case "capture.page":
            await capturePageText();
            break;
          case "minimize":
            win.minimize();
            break;
          case "reopen":
            reopenTab();
            break;
          case "zoom":
            if (!Number.isFinite(value) || value < 50 || value > 200) throw new Error("Zoom inválido.");
            active().view.webContents.setZoomFactor(value / 100);
            publish();
            break;
          case "find":
            if (!value || typeof value.text !== "string" || value.text.length > 500 || typeof value.forward !== "boolean") throw new Error("Busca inválida.");
            if (value.text.trim()) active().view.webContents.findInPage(value.text, { forward: value.forward, findNext: true });
            else { active().view.webContents.stopFindInPage("clearSelection"); active().find = null; publish(); }
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
        case "capture.screenshot":
        case "capture.image":
          try {
            return { ok: true, capture: msg.type === "capture.screenshot" ? await captureScreenshot() : await importImage() };
          } catch (error) { return { ok: false, error: { message: error.message } }; }
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
