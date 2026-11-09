const api = window.navigatorApp;
const $ = (id) => document.getElementById(id);
let state,
  ownMessage = "";

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
    close.textContent = "×";
    close.setAttribute("aria-label", `Fechar ${tab.title}`);
    close.title = `Fechar ${tab.title}`;
    close.onclick = () => command("close", tab.id);

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
