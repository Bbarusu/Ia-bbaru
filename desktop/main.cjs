const { BrowserData } = require("./browser-data.cjs");
const { Downloads } = require("./downloads.cjs");
const { captureFullPage } = require("./page-capture.cjs");
const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  session,
  Menu,
  dialog,
  nativeImage,
  shell,
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
  browserData,
  downloads,
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
    panelWidth: expanded ? win.getContentSize()[0] : Math.min(localData.panelWidth || PANEL, Math.max(320, Math.floor(win.getContentSize()[0] * 0.65))),
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
  if (workspace && !workspace.webContents.isDestroyed())
    workspace.webContents.send("workspace:changed", { activePage: { newValue: contextStatus() } });
}
function contextStatus() {
  const tab = active();
  const url = tab?.view.webContents.getURL() || "";
  const document_id = tab && isWeb(url) ? `${tab.id}:${tab.documentVersion || 0}` : null;
  return { document_id, tab_id: document_id ? tab.id : null, documentVersion: document_id ? tab.documentVersion || 0 : null, url: isWeb(url) ? url : null, title: tab?.title || "",
    has_video: tab?.mediaStatus?.version === tab?.documentVersion && !!tab?.mediaStatus?.has_video,
    has_captions: tab?.mediaStatus?.version === tab?.documentVersion && !!tab?.mediaStatus?.has_captions,
    capture_is_current: Boolean(document_id && !tab.loading && capture?.document_id === document_id && capture?.url === url) };
}
function focusWorkspace() {
  if (panel && workspace && !workspace.webContents.isDestroyed()) {
    workspace.webContents.focus();
    workspace.webContents.send("workspace:changed", { focusComposer: { newValue: Date.now() } });
  }
}
function layout() {
  if (!win || win.isDestroyed()) return;
  const [w, h] = win.getContentSize();
  const panelWidth = expanded
    ? w
    : Math.min(localData.panelWidth || PANEL, Math.max(320, Math.floor(w * 0.65)));
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
        if (input.shift) {
          panel = !panel; expanded = false; layout(); focusWorkspace(); break;
        }
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
  const target = url || (browserData.state.preferences["yuki:new-tab"] === "blank" ? "about:blank" : pathToFileURL(homeFile).href);
  tab.view.webContents.loadURL(target).catch(() => {});
}
function newTab(url = null) {
  if (tabs.length >= 20)
    throw new Error("Feche uma aba antes de abrir outra (limite de 20).");
  const view = new WebContentsView({
    webPreferences: {
      session: session.fromPartition("persist:web"),
      preload: path.join(__dirname, "home-preload.cjs"),
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
  wc.setZoomFactor(Number(browserData.state.preferences["yuki:default-zoom"]) / 100);
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
    if (mainFrame) { tab.documentVersion = (tab.documentVersion || 0) + 1; tab.find = null; publish(); }
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
    if (tab === active() && isWeb(tab.url)) void videoStatus(tab).then(publish).catch(() => {});
    if (isWeb(tab.url)) browserData.visit(tab.url, tab.title);
    publish();
  });
  const location = () => {
    tab.documentVersion = (tab.documentVersion || 0) + 1;
    const url = wc.getURL();
    tab.url = isWeb(url) ? url : "";
    browserData.session(tabs.map(t => t.url));
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
    const version = tab.documentVersion, origin = wc.getURL();
    Menu.buildFromTemplate([
      { label: "Capturar print da página", enabled: isWeb(wc.getURL()), click: () => captureScreenshot(tab).catch(captureFailure) },
      { label: "Capturar área visível da imagem", enabled: params.mediaType === "image" && isWeb(wc.getURL()),
        click: () => captureImageAt(tab, params.x, params.y).catch(captureFailure) },
      {
        label: "Perguntar ao Claude sobre a seleção",
        enabled: !!selected && selected.length <= 38000 && isWeb(wc.getURL()),
        click: () => {
          try {
            if (wc.isDestroyed() || tab !== active() || tab.loading || tab.documentVersion !== version || wc.getURL() !== origin)
              throw new Error("A página mudou. Selecione o trecho novamente.");
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
  browserData.session(tabs.map(t => t.url));
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
  const file = path.join(app.getPath("userData"), "workspace.json"), temp = file + "." + randomUUID() + ".tmp";
  try { fs.writeFileSync(temp, JSON.stringify(localData), { mode: 0o600 }); fs.renameSync(temp, file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}

function saveCapture(tab, text, media = undefined, title = undefined, originUrl = undefined, kind = "selection") {
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
    kind: media?.kind || kind,
    document_id: originUrl === "" ? null : `${tab.id}:${tab.documentVersion || 0}`,
    tab_id: originUrl === "" ? null : tab.id,
    documentVersion: originUrl === "" ? null : tab.documentVersion || 0,
    captured_at: new Date().toISOString(),
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
  let width = Math.max(1, Math.floor(size.width * Math.min(1, 1920 / size.width, 2000 / size.height)));
  for (;;) {
    const scaled = image.resize({ width });
    for (const quality of [90, 75, 60]) {
      const bytes = scaled.toJPEG(quality);
      if (scaled.getSize().height <= 2000 && bytes.length <= 480000) return { kind, data_url: "data:image/jpeg;base64," + bytes.toString("base64") };
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
async function capturePageVisual() {
  if (capture) throw new Error("Salve ou descarte a captura pendente antes de capturar outra.");
  const tab = active();
  if (!tab || expanded || !isWeb(tab.view.webContents.getURL())) throw new Error("Abra uma página web visível.");
  if (tab.loading) throw new Error("Aguarde a página terminar de carregar.");
  const version = tab.documentVersion, url = tab.view.webContents.getURL();
  const image = await captureFullPage(tab.view.webContents, () =>
    tab === active() && !tab.loading && tab.documentVersion === version && tab.view.webContents.getURL() === url);
  let media = { kind: "screenshot", data_url: image.data_url };
  const pixels = nativeImage.createFromDataURL(image.data_url);
  const size = pixels.getSize();
  if (size.width > 2000 || size.height > 2000) media = rasterAttachment(pixels, "screenshot");
  return saveCapture(tab, "Print da página inteira. Descrição: ",
    media, "Página inteira: " + tab.title);
}
// Run only on explicit capture.page. Navigation invalidates the snapshot.
function readPageContext() {
  const clip = (text, limit) => text.length <= limit ? text : text.slice(0, limit - 16) + " […] [parcial]";
  const visible = el => el.checkVisibility({ visibilityProperty: true, opacityProperty: true });
  const root = [...document.querySelectorAll("main, [role=main]")].find(visible)
    || [...document.querySelectorAll("article")].find(visible) || document.body;
  function primaryText(root, limit) {
    const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const chunks = [];
    let length = 0;
    while (walker.nextNode() && length <= limit) {
      const node = walker.currentNode, el = node.parentElement;
      if (!el || el.closest("nav,aside,footer,script,style,form,textarea,[contenteditable],[role=navigation],[role=menu]")) continue;
      const value = node.textContent.trim();
      if (!value || !visible(el) || !el.getClientRects().length) continue;
      chunks.push(value.slice(0, limit + 1)); length += value.length + 1;
    }
    return clip(chunks.join(" "), limit);
  }
  const headings = [...root.querySelectorAll("h1,h2,h3")].filter(visible)
    .map(el => el.tagName + ": " + el.innerText.trim()).join("\n");
  const parts = ["Título: " + clip(document.title, 300), "URL: " + clip(location.href, 1600),
    "Descrição: " + clip(document.querySelector('meta[name="description" i]')?.content || "", 600),
    "Seções: " + clip(headings, 1800)];
  for (const video of [...document.querySelectorAll("video")].slice(0, 5)) {
    const info = { titulo: clip(video.title || video.getAttribute("aria-label") || document.title, 200),
      currentTime: video.currentTime, duration: Number.isFinite(video.duration) ? video.duration : null,
      estado: video.paused || video.ended ? "paused" : "playing" };
    const cues = [];
    let chars = 0;
    for (const track of video.textTracks) {
      if (!["captions", "subtitles"].includes(track.kind)) continue;
      for (const cue of track.cues || []) {
        if (chars >= 1200) break;
        if (cue.text) { cues.push(clip(cue.text, 1200)); chars += cue.text.length + 1; }
      }
    }
    const chapter = [...video.textTracks].find(t => t.kind === "chapters")?.activeCues?.[0];
    if (chapter?.text) info.capitulo = clip(chapter.text, 200);
    parts.push("Vídeo: " + JSON.stringify(info), "Legendas acessíveis: " + (clip(cues.join(" "), 1200) || "indisponíveis"));
  }
  if (document.querySelector("video")) {
    const panel = [...document.querySelectorAll('[id*="transcript" i], [aria-label*="transcri" i], [data-transcript]')]
      .find(el => visible(el) && !el.matches("button,a") && el.innerText?.trim());
    parts.push("Painel de transcrição: " + (panel ? clip(panel.innerText, 3000) : "indisponível"));
  }
  for (const frame of [...document.querySelectorAll("iframe")].filter(visible).slice(0, 4)) {
    const doc = frame.contentDocument;
    if (!doc?.body || !/^https?:$/.test(doc.location.protocol) || doc.location.origin !== location.origin) continue;
    const body = doc.querySelector("main,article") || doc.body;
    parts.push("Quadro: " + clip(doc.title, 200) + "\n" + primaryText(body, 1500));
  }
  parts.push("Texto principal:");
  const header = parts.join("\n") + "\n";
  return header + primaryText(root, 38000 - header.length);
}
async function videoStatus(tab) {
  if (!tab || tab.loading || !isWeb(tab.view.webContents.getURL())) return {};
  const version = tab.documentVersion;
  const status = await tab.view.webContents.executeJavaScriptInIsolatedWorld(1001, [{ code: `(() => {
    const videos = [...document.querySelectorAll("video")];
    return { has_video: !!videos.length, has_captions: videos.some(v => [...v.textTracks].some(t =>
      ["captions","subtitles"].includes(t.kind) && t.cues?.length > 0)) };
  })()` }]);
  if (tab === active() && version === tab.documentVersion) tab.mediaStatus = { version, ...status };
  return contextStatus();
}
async function captureVideoFrame() {
  const tab = active();
  if (!tab || tab.loading || expanded || !isWeb(tab.view.webContents.getURL())) throw new Error("Abra uma página com vídeo visível.");
  const version = tab.documentVersion;
  const wc = tab.view.webContents;
  const rect = await wc.executeJavaScriptInIsolatedWorld(1001, [{ code: `(() => {
    const videos = [...document.querySelectorAll("video")].filter(v => v.checkVisibility()).sort((a,b) => Number(a.paused)-Number(b.paused));
    for (const video of videos) {
      const r = video.getBoundingClientRect();
      const x = Math.max(0,r.left), y = Math.max(0,r.top);
      const width = Math.min(innerWidth,r.right)-x, height = Math.min(innerHeight,r.bottom)-y;
      if (width > 1 && height > 1 && !video.mediaKeys) return {x,y,width,height};
    }
    return null;
  })()` }]);
  const current = () => tab === active() && !wc.isDestroyed() && tab.documentVersion === version && !tab.loading && !expanded;
  if (!rect || !current()) throw new Error("Quadro de vídeo indisponível.");
  const clip = Object.fromEntries(Object.entries(rect).map(([k,v]) => [k, Math.round(v * wc.getZoomFactor())]));
  const pixels = await wc.capturePage(clip);
  if (!current()) throw new Error("A página mudou. Capture novamente.");
  return saveCapture(tab, "Quadro visível do vídeo.", rasterAttachment(pixels,"screenshot"), "Quadro: " + tab.title);
}
async function capturePageText() {
  const tab = active();
  if (!tab || !isWeb(tab.view.webContents.getURL())) throw new Error("Abra uma página web.");
  if (tab.loading) throw new Error("Aguarde a página terminar de carregar.");
  const version = tab.documentVersion;
  const text = await tab.view.webContents.executeJavaScriptInIsolatedWorld(1001, [{ code: `(${readPageContext.toString()})()` }]);
  if (tab.documentVersion !== version || tab !== active() || tab.loading) throw new Error("A página mudou. Capture novamente.");
  return saveCapture(tab, text, undefined, undefined, undefined, "page");
}
async function selectCapture() {
  const tab = active();
  if (!tab || !isWeb(tab.view.webContents.getURL()))
    throw new Error("Abra uma página e selecione um trecho.");
  if (tab.loading) throw new Error("Aguarde a página terminar de carregar.");
  const before = tab.view.webContents.getURL();
  const version = tab.documentVersion;
  // Fixed script, only after a user's capture action. No credentials or page-wide scrape.
  const text = await tab.view.webContents.executeJavaScript(
    "window.getSelection().toString()",
  );
  if (before !== tab.view.webContents.getURL() || tab !== active() || tab.documentVersion !== version || tab.loading)
    throw new Error("A página mudou. Selecione o trecho novamente.");
  return saveCapture(tab, text);
}
function homeData() {
  return { preferences: browserData.state.preferences, bookmarks: browserData.state.bookmarks };
}
function notifyBrowserData(data) {
  if (win && !win.isDestroyed()) win.webContents.send("browser:data", data);
  if (workspace && !workspace.webContents.isDestroyed()) workspace.webContents.send("workspace:changed", { browserData: { newValue: data } });
  for (const tab of tabs) if (!tab.view.webContents.isDestroyed() && tab.view.webContents.getURL() === pathToFileURL(homeFile).href)
    tab.view.webContents.send("home:data", { preferences: data.preferences, bookmarks: data.bookmarks });
}
async function browserOperation(operation, params = {}) {
  if (!params || typeof params !== "object" || Array.isArray(params) || JSON.stringify(params).length > 2_000_000)
    throw new Error("Pedido de navegador inválido.");
  switch (operation) {
    case "get": browserData.prune(); return browserData.snapshot();
    case "migrate": return browserData.migrate(params);
    case "set": return browserData.set(params.key, params.value, params.revision);
    case "downloads.cancel": downloads.cancel(params.id); return browserData.snapshot();
    case "downloads.clear": downloads.clear(); return browserData.snapshot();
    case "downloads.show": shell.showItemInFolder(downloads.completedPath(params.id)); return browserData.snapshot();
    case "downloads.folder": {
      const result = await dialog.showOpenDialog(win, { title: "Pasta dos downloads", properties: ["openDirectory", "createDirectory"] });
      if (!result.canceled) browserData.commit({ ...browserData.state, downloadFolder: result.filePaths[0] });
      return browserData.snapshot();
    }
    case "privacy.clearSiteData": {
      const choice = await dialog.showMessageBox(win, { type: "question", buttons: ["Cancelar", "Limpar dados"], defaultId: 0, cancelId: 0,
        message: "Limpar cookies, cache e dados dos sites?", detail: "Você sairá das contas dos sites. Conversas, materiais e login da CLI Claude serão preservados." });
      if (choice.response === 1) {
        const web = session.fromPartition("persist:web");
        await web.clearStorageData(); await web.clearCache();
      }
      return browserData.snapshot();
    }
    default: throw new Error("Operação de navegador indisponível.");
  }
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
    browserData = new BrowserData(path.join(app.getPath("userData"), "browser.json"), notifyBrowserData);
    downloads = new Downloads(browserData, app.getPath("downloads"));
    for (const s of [
      session.defaultSession,
      session.fromPartition("persist:web"),
    ]) {
      s.setPermissionRequestHandler((_wc, _permission, callback) =>
        callback(false),
      );
      s.setPermissionCheckHandler(() => false);
      s.on("will-download", (event, item, contents) => {
        if (s !== session.fromPartition("persist:web") || !tabs.some(t => t.view.webContents === contents) || !isWeb(item.getURL())) {
          event.preventDefault(); return;
        }
        downloads.accept(item);
      });
    }
    win = new BrowserWindow({
      frame: process.platform !== "win32",
      width: 1440,
      height: 960,
      minWidth: 900,
      minHeight: 640,
      backgroundColor: "#08090b",
      title: "Ia-bbaru",
      icon: path.join(__dirname, "ui", "icon.png"),
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
    ipcMain.handle("browser:data", (event, operation, params) => {
      assertSender(event, win.webContents, shellFile);
      return browserOperation(operation, params);
    });
    const homeSender = event => tabs.some(t => trustedFrame(event, t.view.webContents, homeFile));
    ipcMain.handle("home:get", event => { if (!homeSender(event)) throw new Error("Origem não autorizada."); return homeData(); });
    ipcMain.handle("home:ask", event => {
      if (!homeSender(event)) throw new Error("Origem não autorizada.");
      panel = true; expanded = false; layout(); focusWorkspace();
    });
    ipcMain.handle("browser:state", (event) => {
      assertSender(event, win.webContents, shellFile);
      return snapshot();
    });
    ipcMain.handle("browser:command", async (event, action, value) => {
      assertSender(event, win.webContents, shellFile);
      try {
        switch (action) {
          case "navigate":
            let target = webURL(value);
            if (target?.startsWith("https://www.google.com/search?q=")) {
              const query = new URL(target).searchParams.get("q");
              const engine = browserData.state.preferences["yuki:search-engine"];
              if (engine === "bing") target = "https://www.bing.com/search?q=" + encodeURIComponent(query);
              if (engine === "duckduckgo") target = "https://duckduckgo.com/?q=" + encodeURIComponent(query);
            }
            navigate(active(), target);
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
            focusWorkspace();
            break;
          case "panel.resize":
            if (!Number.isFinite(value) || value < 320 || value > 800) throw new Error("Largura inválida.");
            localData.panelWidth = Math.round(value); store(); layout();
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
          case "capture.page.visual":
            await capturePageVisual();
            break;
          case "capture.page":
            await capturePageText();
            break;
          case "maximize":
            if (win.isMaximized()) win.unmaximize(); else win.maximize();
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
        case "browser.data":
          return browserOperation(msg.operation, msg.params);
        case "bridge.request":
          validateEnvelope(msg.request);
          await serviceReady;
          return service.request(msg.request);
        case "capture.read":
          return capture;
        case "context.status":
          await videoStatus(active());
          return contextStatus();
        case "capture.video.frame":
          try { return { ok: true, capture: await captureVideoFrame() }; }
          catch (error) { return { ok: false, error: { message: error.message } }; }
        case "capture.page.visual":
          try { return { ok: true, capture: await capturePageVisual() }; }
          catch (error) { return { ok: false, error: { message: error.message } }; }
        case "capture.page":
          try { return { ok: true, capture: await capturePageText() }; }
          catch (error) { return { ok: false, error: { message: error.message } }; }
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
        (key === "pending-send" || key === "last-project" ||
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
            ([k, v]) => !valid(k) || typeof v !== "string" || Buffer.byteLength(v) > (k === "pending-send" ? 4000000 : 8000),
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
    const restore = browserData.state.preferences["yuki:startup"] === "restore" ? [...browserData.state.session] : [];
    if (restore.length) restore.forEach(url => newTab(url)); else newTab();
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
