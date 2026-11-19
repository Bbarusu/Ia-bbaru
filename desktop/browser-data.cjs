const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const DEFAULTS = {
  "yuki:history-retention": "", "yuki:show-bookmarks": "1",
  "yuki:startup": "new", "yuki:new-tab": "home", "yuki:search-engine": "google",
  "yuki:default-zoom": "100", "yuki:new-tab-background": "neve",
  "yuki:home-welcome": "1", "yuki:home-bookmarks": "1", "yuki:home-ask": "1",
};
const CHOICES = {
  "yuki:history-retention": ["", "1", "7", "30"], "yuki:show-bookmarks": ["0", "1"],
  "yuki:startup": ["new", "restore"], "yuki:new-tab": ["home", "blank"],
  "yuki:search-engine": ["google", "bing", "duckduckgo"],
  "yuki:default-zoom": ["80", "90", "100", "110", "125", "150"],
  "yuki:new-tab-background": ["gelo", "neve", "liso"],
  "yuki:home-welcome": ["0", "1"], "yuki:home-bookmarks": ["0", "1"], "yuki:home-ask": ["0", "1"],
};
function web(value) {
  try { const u = new URL(value); return typeof value === "string" && value.length <= 8192 &&
    ["http:", "https:"].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
function entries(items, history) {
  if (!Array.isArray(items) || items.length > 5000) throw new Error("Lista de navegação inválida.");
  return items.map(item => {
    if (!item || !web(item.url) || typeof item.title !== "string" || item.title.length > 300)
      throw new Error("Item de navegação inválido.");
    const row = { title: item.title, url: item.url };
    if (history) {
      if (item.at != null && (!Number.isFinite(Date.parse(item.at)) || typeof item.at !== "string"))
        throw new Error("Data do histórico inválida.");
      if (item.at) row.at = item.at;
      if (typeof item.time === "string") row.time = item.time.slice(0, 30);
    }
    return row;
  });
}
class BrowserData {
  constructor(file, changed = () => {}) {
    this.file = file; this.changed = changed;
    this.state = { revision: 0, version: 1, migrated: false, preferences: { ...DEFAULTS }, history: [],
      bookmarks: [{ title: "Claude", url: "https://claude.ai/" }], session: [], downloads: [] };
    if (fs.existsSync(file)) {
      const saved = JSON.parse(fs.readFileSync(file, "utf8"));
      if (saved.version !== 1) throw new Error("Versão dos dados do navegador não suportada.");
      this.state = { ...this.state, ...saved, preferences: { ...DEFAULTS, ...saved.preferences } };
    }
    this.prune();
  }
  commit(next) {
    next = { ...next, revision: this.state.revision + 1 };
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const temp = this.file + "." + randomUUID() + ".tmp";
    try { fs.writeFileSync(temp, JSON.stringify(next), { mode: 0o600 }); fs.renameSync(temp, this.file); }
    finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
    this.state = next; this.changed(this.snapshot());
  }
  snapshot() { return structuredClone({ ...this.state, session: undefined }); }
  prune() {
    const days = Number(this.state.preferences["yuki:history-retention"]);
    if (!days) return;
    const history = this.state.history.filter(row => !row.at || Date.parse(row.at) >= Date.now() - days * 86400000);
    if (history.length !== this.state.history.length) this.commit({ ...this.state, history });
  }
  migrate(raw) {
    if (this.state.migrated) return this.snapshot();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Migração inválida.");
    const next = structuredClone(this.state);
    // Import the original arrays once. Empty bookmarks are intentional, not defaults.
    for (const key of ["history", "bookmarks"]) if (raw[key] != null) {
      const old = entries(raw[key], key === "history");
      const current = key === "bookmarks" ? [] : next[key];
      const seen = new Set();
      next[key] = [...old, ...current].filter(row => {
        const signature = key === "history" ? JSON.stringify(row) : row.url;
        if (seen.has(signature)) return false;
        seen.add(signature); return true;
      });
    }
    for (const [key, value] of Object.entries(raw.preferences || {}))
      if (CHOICES[key]?.includes(value)) next.preferences[key] = value;
    next.migrated = true; this.commit(next); this.prune(); return this.snapshot();
  }
  set(key, value, revision) {
    const next = structuredClone(this.state);
    if (key === "yuki:history" || key === "yuki:bookmarks") {
      const name = key.slice(5);
      const wanted = entries(value, name === "history");
      if (name === "history") {
        if (revision !== this.state.revision) throw new Error("O histórico mudou. Confira a lista atualizada e tente novamente.");
        // Renderer may delete history but never invent visits or overwrite new ones.
        const identity = row => JSON.stringify([row.url, row.title, row.at, row.time]);
        const ids = new Set(wanted.map(identity));
        next.history = next.history.filter(row => ids.has(identity(row)));
      } else next.bookmarks = [...new Map(wanted.map(row => [row.url, row])).values()];
    } else {
      value = value === null ? DEFAULTS[key] : value;
      if (!CHOICES[key]?.includes(value)) throw new Error("Preferência inválida.");
      next.preferences[key] = value;
    }
    this.commit(next); this.prune(); return this.snapshot();
  }
  visit(url, title) {
    if (!web(url)) return;
    this.commit({ ...this.state, history: [{ url, title: String(title || url).slice(0, 300), at: new Date().toISOString() },
      ...this.state.history.filter(row => row.url !== url)].slice(0, 5000) });
    this.prune();
  }
  session(urls) {
    if (JSON.stringify(urls) !== JSON.stringify(this.state.session))
      this.commit({ ...this.state, session: urls.filter(web).slice(0, 20) });
  }
  downloads(rows) { this.commit({ ...this.state, downloads: rows }); }
}
module.exports = { BrowserData, DEFAULTS, CHOICES, web };
