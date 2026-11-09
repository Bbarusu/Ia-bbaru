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
  $("message").textContent =
    ownMessage ||
    state?.startupError ||
    state?.tabs.find((t) => t.id === state.activeId)?.error ||
    "Seu navegador. Seu contexto. Seus agentes.";
}
function render(next) {
  state = next;
  $("tabs").replaceChildren();
  for (const tab of next.tabs) {
    const item = document.createElement("div");
    item.className = `tab ${tab.id === next.activeId ? "active" : ""}`;
    const choose = document.createElement("button");
    choose.className = "choose";
    choose.role = "tab";
    choose.setAttribute("aria-selected", String(tab.id === next.activeId));
    choose.textContent = (tab.loading ? "◌ " : "") + tab.title;
    choose.title = tab.title;
    choose.onclick = () => command("activate", tab.id);
    const close = document.createElement("button");
    close.className = "close";
    close.textContent = "×";
    close.setAttribute("aria-label", `Fechar ${tab.title}`);
    close.onclick = () => command("close", tab.id);
    item.append(choose, close);
    $("tabs").append(item);
  }
  const tab = next.tabs.find((t) => t.id === next.activeId);
  if (document.activeElement !== $("address"))
    $("address").value = tab?.url || "";
  $("back").disabled = !next.back;
  $("forward").disabled = !next.forward;
  $("panel").setAttribute("aria-pressed", String(next.panel));
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
])
  $(id).onclick = () => command(id);
$("navigation").onsubmit = (event) => {
  event.preventDefault();
  const value = $("address").value;
  $("address").blur();
  command("navigate", value);
};
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
