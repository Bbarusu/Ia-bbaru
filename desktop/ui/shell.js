const api = window.navigatorApp;
const $ = (id) => document.getElementById(id);
let state,
  ownMessage = "",
  activeSubbarMode = null, // null | "find" | "zoom" | "history" | "security" | "capture-media"
  currentZoom = 100,
  findQuery = "";

const DEFAULT_BOOKMARKS = [
  { title: "Claude", url: "https://claude.ai/" },
];



function loadBookmarks() {
  try {
    const raw =
      localStorage.getItem("yuki:bookmarks") ||
      localStorage.getItem("ia-bbaru:bookmarks");
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {}
  return DEFAULT_BOOKMARKS;
}

function saveBookmarks(items) {
  try {
    localStorage.setItem("yuki:bookmarks", JSON.stringify(items));
  } catch {}
}

function loadHistory() {
  try {
    const raw = localStorage.getItem("yuki:history");
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

function saveHistory(items) {
  try {
    localStorage.setItem("yuki:history", JSON.stringify(items.slice(0, 30)));
  } catch {}
}

let bookmarks = loadBookmarks();
let visitHistory = loadHistory();

function recordVisit(tab) {
  if (!tab?.url || !/^https?:\/\//i.test(tab.url)) return;
  const entry = {
    title: (tab.title || tab.url).slice(0, 48),
    url: tab.url,
    time: new Date().toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
  visitHistory = [
    entry,
    ...visitHistory.filter((item) => item.url !== tab.url),
  ].slice(0, 25);
  saveHistory(visitHistory);
}

async function command(action, value) {
  const result = await api.command(action, value);
  ownMessage = result.ok ? "" : result.error;
  renderMessage();
  return result;
}

function renderMessage() {
  const activeTab = state?.tabs.find((t) => t.id === state.activeId);
  const errorText = ownMessage || state?.startupError || activeTab?.error || "";
  const msgEl = $("message");
  msgEl.textContent =
    errorText ||
    (activeTab?.loading
      ? `Carregando ${activeTab.title || "página"}…`
      : "❄ Yuki · Seu navegador. Seu contexto. Seus agentes.");
  msgEl.classList.toggle("has-error", Boolean(errorText));
}

function createPowerIconSvg() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "11");
  svg.setAttribute("height", "11");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M12 3.5v7.5M6.8 6.8a7.5 7.5 0 1 0 10.4 0");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.65");
  path.setAttribute("stroke-linecap", "round");
  svg.appendChild(path);
  return svg;
}

function updateSiteSecurityBadge(activeTab) {
  const badge = $("site-security");
  if (!badge) return;
  const url = activeTab?.url || "";
  if (!url) {
    badge.textContent = "❄";
    badge.title = "Página interna isolada do Yuki (Nova aba)";
  } else if (url.startsWith("https://")) {
    badge.textContent = "🔒";
    badge.title = `Endereço HTTPS (${url})`;
  } else {
    badge.textContent = "ⓘ";
    badge.title = `Conexão HTTP (${url}) · Sandbox Chromium ativo`;
  }
}

function closeSubbarTool() {
  if (activeSubbarMode === "find") command("find", { text: "", forward: true });
  activeSubbarMode = null;
  renderSubbar(state?.tabs.find((t) => t.id === state?.activeId));
}

function setSubbarTool(mode, mediaKind = "") {
  if (activeSubbarMode === mode && !mediaKind) {
    closeSubbarTool();
    return;
  }
  activeSubbarMode = mode;
  renderSubbar(state?.tabs.find((t) => t.id === state?.activeId), mediaKind);
}

function renderSubbarToolContent(activeTab, mediaKind = "") {
  const toolEl = $("subbar-tool");
  const defEl = $("subbar-default");
  if (!activeSubbarMode) {
    toolEl.hidden = true;
    defEl.hidden = false;
    return;
  }

  defEl.hidden = true;
  toolEl.hidden = false;
  toolEl.replaceChildren();

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "tool-close-btn";
  closeBtn.textContent = "✕";
  closeBtn.title = "Voltar para a barra de favoritos";
  closeBtn.onclick = closeSubbarTool;

  if (activeSubbarMode === "find") {
    const label = document.createElement("span");
    label.className = "tool-label";
    label.textContent = "⌕ Buscar na página:";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "tool-input";
    input.placeholder = "Digite um termo para localizar…";
    input.value = findQuery;
    input.oninput = (e) => {
      findQuery = e.target.value;
    };
    input.onkeydown = (e) => {
      if (e.key === "Escape") closeSubbarTool();
      if (e.key === "Enter" && findQuery.trim()) {
        command("find", { text: findQuery, forward: true });
      }
    };

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "context-chip";
    prevBtn.textContent = "↑ Anterior";
    prevBtn.onclick = () => {
      if (findQuery.trim()) {
        command("find", { text: findQuery, forward: false });
      }
    };

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "context-chip";
    nextBtn.textContent = "↓ Próxima";
    nextBtn.onclick = () => {
      if (findQuery.trim()) {
        command("find", { text: findQuery, forward: true });
      }
    };

    const count = document.createElement("span");
    count.setAttribute("role", "status");
    count.textContent = state?.find ? `${state.find.activeMatchOrdinal} / ${state.find.matches}` : "";
    toolEl.append(label, input, prevBtn, nextBtn, count, closeBtn);
    setTimeout(() => input.focus(), 10);
    return;
  }

  if (activeSubbarMode === "zoom") {
    const label = document.createElement("span");
    label.className = "tool-label";
    label.textContent = `Zoom da página (${currentZoom}%):`;

    for (const step of [80, 90, 100, 110, 125, 150]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "context-chip" + (currentZoom === step ? " active" : "");
      btn.textContent = `${step}%`;
      btn.onclick = () => {
        command("zoom", step);
      };
      toolEl.appendChild(btn);
    }

    toolEl.appendChild(closeBtn);
    return;
  }

  if (activeSubbarMode === "history") {
    const label = document.createElement("span");
    label.className = "tool-label";
    label.textContent = "🕘 Histórico recente:";
    toolEl.appendChild(label);

    if (!visitHistory.length) {
      const empty = document.createElement("span");
      empty.className = "tool-note";
      empty.textContent = "Nenhuma página web visitada ainda nesta sessão.";
      toolEl.appendChild(empty);
    } else {
      for (const item of visitHistory.slice(0, 5)) {
        const link = document.createElement("button");
        link.type = "button";
        link.className = "bookmark-chip";
        link.textContent = `${item.title} (${item.time})`;
        link.title = item.url;
        link.onclick = () => {
          closeSubbarTool();
          command("navigate", item.url);
        };
        toolEl.appendChild(link);
      }
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "context-chip";
      clearBtn.textContent = "Limpar";
      clearBtn.onclick = () => {
        visitHistory = [];
        saveHistory([]);
        renderSubbarToolContent(activeTab);
      };
      toolEl.appendChild(clearBtn);
    }

    toolEl.appendChild(closeBtn);
    return;
  }

  if (activeSubbarMode === "security") {
    const label = document.createElement("span");
    label.className = "tool-label";
    const url = activeTab?.url || "yuki://nova-aba";
    label.textContent = url.startsWith("https://")
      ? "🔒 Endereço HTTPS"
      : url.startsWith("http://")
        ? "ⓘ HTTP local/padrão"
        : "❄ Página interna Yuki";

    const details = document.createElement("span");
    details.className = "tool-note";
    details.textContent =
      "Sandbox Chromium ativo · Sem acesso a Node/IPC · Cookies isolados dos agentes CLI.";

    toolEl.append(label, details, closeBtn);
    return;
  }

  if (activeSubbarMode === "capture-media") {
    const isPrint = mediaKind === "print";
    const badge = document.createElement("span");
    badge.className = "tool-label";
    badge.textContent = isPrint
      ? "📸 Capturar Print da Tela:"
      : "🖼 Capturar Imagem da Página:";

    const info = document.createElement("span");
    info.className = "tool-note";
    info.textContent = isPrint
      ? "Use o painel lateral (+ Material → aba Print / Ctrl+V) ou clique com botão direito na página."
      : "Use o painel lateral (+ Material → aba Imagem) para colar ou importar imagens da página.";

    const openPanelBtn = document.createElement("button");
    openPanelBtn.type = "button";
    openPanelBtn.className = "context-chip active";
    openPanelBtn.textContent = "❄ Abrir no Painel Yuki →";
    openPanelBtn.onclick = () => {
      if (!state?.panel) command("panel");
      closeSubbarTool();
    };

    toolEl.append(badge, info, openPanelBtn, closeBtn);
  }
}

function renderSubbar(activeTab, mediaKind = "") {
  const bookmarksEl = $("bookmarks");
  bookmarksEl.replaceChildren();
  for (const bm of bookmarks) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "bookmark-chip";
    chip.textContent = bm.title;
    chip.title = bm.url;
    chip.onclick = () => command("navigate", bm.url);
    bookmarksEl.appendChild(chip);
  }

  const isBookmarked =
    Boolean(activeTab?.url) && bookmarks.some((b) => b.url === activeTab.url);
  $("bookmark-toggle").classList.toggle("active", isBookmarked);
  updateSiteSecurityBadge(activeTab);
  renderSubbarToolContent(activeTab, mediaKind);
}

function render(next) {
  state = next;
  const focusedTabId = document.activeElement?.dataset.tabId;
  $("tabs").replaceChildren();
  for (const tab of next.tabs) {
    const isActive = tab.id === next.activeId;
    if (isActive && !tab.loading && tab.url) {
      recordVisit(tab);
    }
    const item = document.createElement("div");
    item.className = [
      "tab",
      isActive ? "active" : "",
      tab.loading ? "loading" : "",
      tab.error ? "has-error" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const choose = document.createElement("button");
    choose.type = "button";
    choose.className = "choose";
    // These controls switch separate WebContents, not DOM tabpanels.
    // A labelled group of toggle buttons also keeps close buttons accessible.
    choose.dataset.tabId = tab.id;
    choose.tabIndex = isActive ? 0 : -1;
    choose.setAttribute("aria-pressed", String(isActive));
    choose.textContent = (tab.loading ? "◌ " : "") + tab.title;
    choose.title = tab.url ? `${tab.title} — ${tab.url}` : tab.title;
    choose.onclick = () => command("activate", tab.id);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "close";
    close.appendChild(createPowerIconSvg());
    close.setAttribute("aria-label", `Fechar ${tab.title}`);
    close.title = `Encerrar aba ${tab.title}`;
    close.onclick = () => {
      command("close", tab.id);
    };

    item.append(choose, close);
    $("tabs").append(item);
  }
  if (focusedTabId) {
    [...$("tabs").querySelectorAll(".choose")].find((button) => button.dataset.tabId === focusedTabId)?.focus();
  }

  const tab = next.tabs.find((t) => t.id === next.activeId);
  if (document.activeElement !== $("address")) {
    $("address").value = tab?.url || "";
  }
  $("back").disabled = !next.back;
  $("forward").disabled = !next.forward;
  $("reopen-tab").disabled = !next.canReopen;
  currentZoom = next.zoom || 100;
  $("zoom-toggle").textContent = `${currentZoom}%`;
  $("panel").setAttribute("aria-pressed", String(Boolean(next.panel)));
  $("panel").classList.toggle("active", Boolean(next.panel));
  $("expand").setAttribute("aria-pressed", String(Boolean(next.expanded)));
  $("expand").classList.toggle("active", Boolean(next.expanded));
  renderSubbar(tab);
  renderMessage();
}

for (const id of [
  "new",
  "back",
  "forward",
  "reload",
  "capture",
  "panel",
  "expand",
]) {
  $(id).onclick = () => command(id);
}

$("home").onclick = () => command("navigate", "");

$("reopen-tab").onclick = () => command("reopen");
$("minimize").onclick = () => command("minimize");

$("power").onclick = () => {
  window.close();
};

$("site-security").onclick = () => setSubbarTool("security");
$("find-toggle").onclick = () => setSubbarTool("find");
$("zoom-toggle").onclick = () => setSubbarTool("zoom");
$("history-toggle").onclick = () => setSubbarTool("history");

$("capture-print").onclick = () => command("capture.screenshot");
$("capture-image").onclick = () => command("capture.image");

document.querySelectorAll("[data-context]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const kind = btn.getAttribute("data-context");
    command(kind === "summarize" ? "capture.page" : kind === "print" ? "capture.screenshot" : "capture.image");
  });
});

$("bookmark-toggle").onclick = () => {
  const tab = state?.tabs.find((t) => t.id === state.activeId);
  if (!tab?.url) {
    ownMessage = "Abra uma página web para salvar nos favoritos.";
    renderMessage();
    return;
  }
  const exists = bookmarks.some((b) => b.url === tab.url);
  if (exists) {
    bookmarks = bookmarks.filter((b) => b.url !== tab.url);
  } else {
    bookmarks = [
      ...bookmarks,
      { title: (tab.title || tab.url).slice(0, 28), url: tab.url },
    ];
  }
  saveBookmarks(bookmarks);
  renderSubbar(tab);
};

$("navigation").onsubmit = (event) => {
  event.preventDefault();
  const value = $("address").value;
  $("address").blur();
  command("navigate", value);
};

$("address").addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    const tab = state?.tabs.find((t) => t.id === state.activeId);
    $("address").value = tab?.url || "";
    ownMessage = "";
    renderMessage();
    $("address").blur();
  }
});

$("tabs").addEventListener("keydown", (event) => {
  const tabButtons = Array.from($("tabs").querySelectorAll('.choose'));
  const index = tabButtons.indexOf(document.activeElement);
  if (index === -1 || !tabButtons.length) return;
  let nextIndex = -1;
  if (event.key === "ArrowRight") nextIndex = (index + 1) % tabButtons.length;
  else if (event.key === "ArrowLeft")
    nextIndex = (index - 1 + tabButtons.length) % tabButtons.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = tabButtons.length - 1;
  if (nextIndex !== -1) {
    event.preventDefault();
    tabButtons[nextIndex].focus();
    tabButtons[nextIndex].click();
  }
});

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "l") {
    event.preventDefault();
    $("address").focus();
    $("address").select();
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "t") {
    event.preventDefault();
    if (event.shiftKey) {
      $("reopen-tab").click();
    } else {
      command("new");
    }
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") {
    event.preventDefault();
    setSubbarTool("find");
  }
});

api.subscribe(render);
api.state().then(render);
api.focusAddress(() => {
  $("address").focus();
  $("address").select();
});

api.openTool((name) => { if (name === "find") setSubbarTool("find"); });
