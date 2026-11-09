const api = window.navigatorApp;
const $ = (id) => document.getElementById(id);
let state,
  ownMessage = "";

const DEFAULT_BOOKMARKS = [
  { title: "NotebookLM", url: "https://notebooklm.google.com/" },
  { title: "Claude", url: "https://claude.ai/" },
  { title: "ChatGPT", url: "https://chatgpt.com/" },
  { title: "Gemini", url: "https://gemini.google.com/" },
];

const subtabsByTab = new Map();

function loadBookmarks() {
  try {
    const raw = localStorage.getItem("ia-bbaru:bookmarks");
    const parsed = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.length) return parsed;
  } catch {}
  return DEFAULT_BOOKMARKS;
}

function saveBookmarks(items) {
  try {
    localStorage.setItem("ia-bbaru:bookmarks", JSON.stringify(items));
  } catch {}
}

let bookmarks = loadBookmarks();

function ensureSubtabs(tab) {
  if (!tab) return [];
  let list = subtabsByTab.get(tab.id);
  if (!list || !list.length) {
    list = [
      {
        id: "main",
        title: tab.title || "Principal",
        url: tab.url || "",
        active: true,
      },
    ];
    subtabsByTab.set(tab.id, list);
  } else {
    const current = list.find((s) => s.active) || list[0];
    current.title = tab.title || current.title || "Sub-aba";
    current.url = tab.url || "";
  }
  return list;
}

async function command(action, value) {
  const result = await api.command(action, value);
  ownMessage = result.ok ? "" : result.error;
  renderMessage();
}

function renderMessage() {
  const activeTab = state?.tabs.find((t) => t.id === state.activeId);
  const errorText = ownMessage || state?.startupError || activeTab?.error || "";
  const msgEl = $("message");
  msgEl.textContent =
    errorText ||
    (activeTab?.loading
      ? `Carregando ${activeTab.title || "página"}…`
      : "Seu navegador. Seu contexto. Seus agentes.");
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

function renderSubbar(activeTab) {
  const subtabsEl = $("subtabs");
  subtabsEl.replaceChildren();
  const subs = ensureSubtabs(activeTab);

  for (const sub of subs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "subtab-chip" + (sub.active ? " active" : "");
    btn.textContent = sub.title || "Sub-aba";
    btn.title = sub.url ? `${sub.title} — ${sub.url}` : sub.title;
    btn.onclick = () => {
      for (const item of subs) item.active = item.id === sub.id;
      renderSubbar(activeTab);
      command("navigate", sub.url || "");
    };
    subtabsEl.appendChild(btn);
  }

  const addSub = document.createElement("button");
  addSub.type = "button";
  addSub.className = "subtab-chip add";
  addSub.textContent = "+ Sub-aba";
  addSub.title = "Criar sub-aba nesta aba";
  addSub.onclick = () => {
    if (!activeTab) return;
    for (const item of subs) item.active = false;
    subs.push({
      id: String(Date.now()),
      title: `Sub-aba ${subs.length + 1}`,
      url: "",
      active: true,
    });
    renderSubbar(activeTab);
    command("navigate", "");
  };
  subtabsEl.appendChild(addSub);

  const bookmarksEl = $("bookmarks");
  bookmarksEl.replaceChildren();
  for (const bm of bookmarks) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "bookmark-chip";
    chip.textContent = `★ ${bm.title}`;
    chip.title = bm.url;
    chip.onclick = () => command("navigate", bm.url);
    bookmarksEl.appendChild(chip);
  }

  const isBookmarked =
    Boolean(activeTab?.url) && bookmarks.some((b) => b.url === activeTab.url);
  $("bookmark-toggle").classList.toggle("active", isBookmarked);
}

function render(next) {
  state = next;
  $("tabs").replaceChildren();
  for (const tab of next.tabs) {
    const isActive = tab.id === next.activeId;
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
    choose.role = "tab";
    choose.setAttribute("aria-selected", String(isActive));
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
      subtabsByTab.delete(tab.id);
      command("close", tab.id);
    };

    item.append(choose, close);
    $("tabs").append(item);
  }

  const tab = next.tabs.find((t) => t.id === next.activeId);
  if (document.activeElement !== $("address")) {
    $("address").value = tab?.url || "";
  }
  $("back").disabled = !next.back;
  $("forward").disabled = !next.forward;
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

$("minimize").onclick = () => {
  if (state?.panel) command("panel");
};

$("power").onclick = () => {
  window.close();
};

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
  const tabButtons = Array.from($("tabs").querySelectorAll('[role="tab"]'));
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
    command("new");
  }
});

api.subscribe(render);
api.state().then(render);
api.focusAddress(() => {
  $("address").focus();
  $("address").select();
});
