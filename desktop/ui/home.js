function render(data) {
  const p = data.preferences;
  document.body.dataset.background = p["yuki:new-tab-background"];
  document.querySelector("h1").hidden = p["yuki:home-welcome"] === "0";
  document.querySelector(".lead").hidden = p["yuki:home-welcome"] === "0";
  document.querySelector("#ask-claude").hidden = p["yuki:home-ask"] === "0";
  const nav = document.querySelector("nav");
  nav.hidden = p["yuki:home-bookmarks"] === "0";
  nav.replaceChildren();
  for (const bookmark of data.bookmarks) {
    const link = document.createElement("a"); link.href = bookmark.url;
    const label = document.createElement("strong"); label.textContent = bookmark.title;
    link.append(label); nav.append(link);
  }
}
if (window.yukiHome) {
  window.yukiHome.get().then(render);
  window.yukiHome.subscribe(render);
  document.querySelector("#ask-claude").onclick = () => window.yukiHome.ask();
}
