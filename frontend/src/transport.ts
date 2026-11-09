import type { Capture } from "./types";

export const demo = new URLSearchParams(location.search).get("demo") === "1";
export const inFirefox = !!window.browser?.runtime?.sendMessage;
export const inDesktop = !!window.iaDesktop;
export const localBridge = window.iaDesktop || window.browser;
export async function request<T>(
  operation: string,
  params: object = {},
): Promise<T> {
  if (demo) {
    const { demoRequest } = await import("./demo");
    return demoRequest(operation, params) as T;
  }
  if (!localBridge)
    throw new Error(
      "Abra o navegador Yuki ou a extensão Firefox para conectar ao componente local.",
    );
  const response = await localBridge.runtime.sendMessage({
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
  if (!localBridge) return null;
  return localBridge.runtime.sendMessage({ type: "capture.read" });
}
export async function clearCapture(id: string) {
  if (localBridge)
    await localBridge.runtime.sendMessage({ type: "capture.clear", id });
}
export async function selectCapture(): Promise<Capture> {
  if (!localBridge)
    throw new Error("Selecione um texto em uma página aberta no navegador.");
  const result = await localBridge.runtime.sendMessage({
    type: "capture.selection",
  });
  if (!result?.ok)
    throw new Error(
      result?.error?.message || "Não foi possível capturar a seleção.",
    );
  return result.capture;
}
export async function expand() {
  if (localBridge)
    await localBridge.runtime.sendMessage({ type: "workspace.open" });
}
export async function readDraft(key: string): Promise<string> {
  if (localBridge) return (await localBridge.storage.local.get(key))[key] || "";
  return localStorage.getItem(key) || "";
}
export async function writeDraft(key: string, text: string) {
  if (localBridge) await localBridge.storage.local.set({ [key]: text });
  else localStorage.setItem(key, text);
}
