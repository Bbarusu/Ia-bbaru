const path = require("node:path");
const { randomUUID } = require("node:crypto");
class Downloads {
  constructor(store, defaultFolder) {
    this.store = store; this.defaultFolder = defaultFolder; this.active = new Map();
    this.rows = store.state.downloads.map(row => ["progressing", "paused", "choosing"].includes(row.state)
      ? { ...row, state: "interrupted" } : row);
    if (JSON.stringify(this.rows) !== JSON.stringify(store.state.downloads)) this.save();
  }
  save() { this.store.downloads(this.rows); }
  accept(item) {
    const id = randomUUID();
    const name = path.basename(item.getFilename()).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 180) || "download";
    item.setSaveDialogOptions({ title: "Salvar download", defaultPath: path.join(this.store.state.downloadFolder || this.defaultFolder, name),
      properties: ["showOverwriteConfirmation", "createDirectory"] });
    const row = { id, name, state: "choosing", received: 0, total: item.getTotalBytes(), created_at: new Date().toISOString(), path: null };
    this.rows.unshift(row); this.active.set(id, item); this.save();
    let lastSaved = 0;
    item.on("updated", (_event, state) => {
      Object.assign(row, { state: state === "interrupted" ? "interrupted" : item.isPaused() ? "paused" : "progressing",
        received: item.getReceivedBytes(), total: item.getTotalBytes(), path: item.getSavePath() || null });
      if (Date.now() - lastSaved > 250) { lastSaved = Date.now(); this.save(); }
    });
    item.once("done", (_event, state) => {
      Object.assign(row, { state, received: item.getReceivedBytes(), path: item.getSavePath() || null });
      this.active.delete(id); this.save();
    });
  }
  cancel(id) {
    const item = this.active.get(id);
    if (!item) throw new Error("O download já terminou.");
    item.cancel();
  }
  clear() { this.rows = this.rows.filter(row => this.active.has(row.id)); this.save(); }
  completedPath(id) {
    const row = this.rows.find(row => row.id === id);
    if (!row || row.state !== "completed" || !row.path) throw new Error("Download não concluído.");
    return row.path;
  }
}
module.exports = { Downloads };
