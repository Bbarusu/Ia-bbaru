import { useEffect, useState } from "react";

/**
 * Dados do navegador guardados pela barra (desktop/ui/shell.js) no localStorage
 * de file://, que o painel compartilha. O evento `storage` avisa o outro lado,
 * então editar aqui atualiza a barra sem passar pelo runtime.
 */
export type HistoryEntry = { title: string; url: string; time?: string; at?: string };
export type Bookmark = { title: string; url: string };

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function readList<T>(key: string): T[] {
  try {
    const parsed = JSON.parse(read(key) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Valor guardado + atualização quando a barra muda o mesmo item. */
export function useStored(key: string): [string | null, (value: string | null) => void] {
  const [value, setValue] = useState(() => read(key));
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) setValue(read(key));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);
  const write = (next: string | null) => {
    try {
      if (next === null) localStorage.removeItem(key);
      else localStorage.setItem(key, next);
    } catch {}
    setValue(next);
  };
  return [value, write];
}

export function useStoredList<T>(key: string): [T[], (items: T[]) => void] {
  const [raw, write] = useStored(key);
  const items = raw === null ? [] : readList<T>(key);
  return [items, (next) => write(JSON.stringify(next))];
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
