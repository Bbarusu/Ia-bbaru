import { useEffect, useState } from "react";

/**
 * Dados do navegador persistidos no processo principal. localStorage é lido
 * somente para migração única; mudanças chegam pelo IPC restrito.
 */
export type HistoryEntry = { title: string; url: string; time?: string; at?: string };
export type Bookmark = { title: string; url: string };

type BrowserSnapshot = { revision: number; preferences: Record<string, string>; history: HistoryEntry[]; bookmarks: Bookmark[];
  downloadFolder?: string; downloads: {id: string; name: string; state: string; received: number; total: number}[] };
let snapshot: BrowserSnapshot | null = null;
let ready: Promise<void> | null = null;
const listeners = new Set<() => void>();
function apply(value: BrowserSnapshot) { snapshot = value; listeners.forEach(fn => fn()); }
export async function browserAction(operation: string, params: object = {}) {
  if (!window.iaDesktop) throw new Error("Abra o Yuki para alterar estes ajustes.");
  const value = await window.iaDesktop.runtime.sendMessage({ type: "browser.data", operation, params });
  apply(value); return value as BrowserSnapshot;
}
function legacy() {
  const parse = (key: string) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
  const preferences: Record<string, string> = {};
  for (const key of ["yuki:history-retention", "yuki:show-bookmarks"]) {
    const value = localStorage.getItem(key); if (value !== null) preferences[key] = value;
  }
  return { history: parse("yuki:history"), bookmarks: parse("yuki:bookmarks") || parse("ia-bbaru:bookmarks"), preferences };
}
function start() {
  if (ready || !window.iaDesktop) return;
  window.iaDesktop.storage.onChanged.addListener((changes: any) => { if (changes.browserData?.newValue) apply(changes.browserData.newValue); });
  ready = browserAction("migrate", legacy()).then(() => {
    for (const key of ["yuki:history", "yuki:bookmarks", "ia-bbaru:bookmarks", "yuki:history-retention", "yuki:show-bookmarks"]) localStorage.removeItem(key);
  }).catch(reportBrowserError);
}
export function reportBrowserError(error: unknown) {
  window.dispatchEvent(new CustomEvent("yuki:browser-error", { detail: error instanceof Error ? error.message : "Não foi possível salvar o ajuste." }));
}
export function useBrowserData() {
  const [, update] = useState(0);
  useEffect(() => { const changed = () => update(value => value + 1); listeners.add(changed); start(); return () => { listeners.delete(changed); }; }, []);
  return snapshot;
}
export function useStored(key: string): [string | null, (value: string | null) => void] {
  const data = useBrowserData();
  const name = key.slice(5);
  const value = name === "history" ? JSON.stringify(data?.history || []) : name === "bookmarks" ? JSON.stringify(data?.bookmarks || []) : data?.preferences[key] ?? null;
  const [display, setDisplay] = useState<string | null>(value);
  useEffect(() => setDisplay(value), [value]);
  return [display, next => {
    setDisplay(next);
    const changed = name === "history" || name === "bookmarks" ? JSON.parse(next || "[]") : next;
    void browserAction("set", { key, value: changed, revision: data?.revision }).catch(error => { setDisplay(value); reportBrowserError(error); });
  }];
}
export function useStoredList<T>(key: string): [T[], (items: T[]) => void] {
  const [raw, write] = useStored(key);
  return [JSON.parse(raw || "[]"), items => write(JSON.stringify(items))];
}

/** Mesma regra da barra: mantém só o que está dentro do prazo escolhido (dias). */
export function pruneHistory(items: HistoryEntry[], days: number) {
  if (!days) return items;
  const limit = Date.now() - days * 86400000;
  return items.filter((item) => !item.at || Date.parse(item.at) >= limit);
}

export function dayLabel(at?: string) {
  if (!at) return "Anteriores";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "Anteriores";
  const today = new Date();
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((start(today) - start(date)) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  return date.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
}

export function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
