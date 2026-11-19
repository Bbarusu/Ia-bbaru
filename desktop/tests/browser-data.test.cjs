const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const { BrowserData } = require("../browser-data.cjs");
const { Downloads } = require("../downloads.cjs");
function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "yuki-browser-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "browser.json");
  return { dir, file, store: new BrowserData(file) };
}
test("legacy migration is once-only, preserves empty bookmarks and survives restart", t => {
  const { store, file } = setup(t);
  const history = [{ url: "https://example.org/", title: "Old page", at: "2026-11-17T12:00:00Z" }];
  store.migrate({ history, bookmarks: [], preferences: { "yuki:show-bookmarks": "0" } });
  store.visit("https://example.com/", "New page");
  const reopened = new BrowserData(file);
  reopened.migrate({ history, bookmarks: [{ title: "must not return", url: "https://example.org/" }] });
  assert.equal(reopened.snapshot().history.length, 2);
  assert.deepEqual(reopened.snapshot().bookmarks, []);
  assert.equal(reopened.snapshot().preferences["yuki:show-bookmarks"], "0");
  assert.equal(reopened.snapshot().history[1].title, "Old page");
});
test("only known preferences and safe bookmarks can persist; retention preserves undated imports", t => {
  const { store } = setup(t);
  store.migrate({ history: [{ title: "Undated", url: "https://example.org/" }, { title: "Old", url: "https://example.com/", at: "2000-01-01T00:00:00Z" }] });
  store.set("yuki:history-retention", "1");
  assert.equal(store.snapshot().history.length, 1);
  for (const [key, value] of [["evil", "1"], ["yuki:startup", "shell"], ["yuki:bookmarks", [{ title: "bad", url: "javascript:alert(1)" }]]])
    assert.throws(() => store.set(key, value));
  const before = store.snapshot();
  store.visit("https://new.example/", "New");
  assert.throws(() => store.set("yuki:history", [], before.revision));
  const current = store.snapshot();
  store.set("yuki:history", [current.history[0]], current.revision);
  assert.deepEqual(store.snapshot().history, [current.history[0]]);
  store.set("yuki:history", [], store.snapshot().revision);
  assert.deepEqual(store.snapshot().history, []);
});
test("downloads require a save dialog, preserve final state, cancel and never auto-resume", t => {
  const { store, dir, file } = setup(t);
  const manager = new Downloads(store, dir);
  const item = new EventEmitter();
  Object.assign(item, { getFilename: () => "example.txt", getTotalBytes: () => 42,
    getReceivedBytes: () => 20, getSavePath: () => path.join(dir, "example.txt"), isPaused: () => false,
    setSaveDialogOptions(options) { this.options = options; }, cancel() { this.emit("done", {}, "cancelled"); } });
  manager.accept(item);
  assert.equal(item.options.defaultPath, path.join(dir, "example.txt"));
  assert.ok(item.options.properties.includes("showOverwriteConfirmation"));
  const id = manager.rows[0].id;
  assert.throws(() => manager.completedPath(id));
  item.emit("updated", {}, "progressing");
  const restarted = new Downloads(new BrowserData(file), dir);
  assert.equal(restarted.rows[0].state, "interrupted");
  assert.equal(restarted.active.size, 0);
  manager.cancel(id);
  assert.equal(manager.rows[0].state, "cancelled");
  manager.clear(); assert.equal(manager.rows.length, 0);
});
