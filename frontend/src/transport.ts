import type { Capture } from "./types";

export const demo = new URLSearchParams(location.search).get("demo") === "1";
export const inFirefox = !!window.browser?.runtime?.sendMessage;
export async function request<T>(
  operation: string,
  params: object = {},
): Promise<T> {
  if (demo) {
    const { demoRequest } = await import("./demo");
    return demoRequest(operation, params) as T;
  }
  if (!inFirefox)
    throw new Error(
      "Abra a extensão no Firefox para conectar ao componente local.",
    );
  const response = await window.browser.runtime.sendMessage({
    type: "bridge.request",
    request: {
      protocol_version: "0",
      request_id: crypto.randomUUID(),
      operation,
      params,
    },
  });
  if (!response?.ok)
    throw new Error(
      response?.error?.message || "Componente local indisponível.",
    );
  return response.data;
}
export async function pendingCapture(): Promise<Capture | null> {
  if (!inFirefox) return null;
  return window.browser.runtime.sendMessage({ type: "capture.read" });
}
export async function clearCapture(id: string) {
  if (inFirefox)
    await window.browser.runtime.sendMessage({ type: "capture.clear", id });
}
export async function selectCapture(): Promise<Capture> {
  if (!inFirefox)
    throw new Error(
      "No Firefox, selecione um texto e use “Adicionar ao Ia-bbaru” no menu de contexto.",
    );
  const result = await window.browser.runtime.sendMessage({
    type: "capture.selection",
  });
  if (!result?.ok)
    throw new Error(
      result?.error?.message || "Não foi possível capturar a seleção.",
    );
  return result.capture;
}
export async function expand() {
  if (inFirefox)
    await window.browser.runtime.sendMessage({ type: "workspace.open" });
}
export async function readDraft(key: string): Promise<string> {
  if (inFirefox)
    return (await window.browser.storage.local.get(key))[key] || "";
  return localStorage.getItem(key) || "";
}
export async function writeDraft(key: string, text: string) {
  if (inFirefox) await window.browser.storage.local.set({ [key]: text });
  else localStorage.setItem(key, text);
}
