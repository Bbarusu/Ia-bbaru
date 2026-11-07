/* All native traffic originates from our own extension pages, never page scripts. */
const HOST = 'ia_bbaru.bridge';
const BASE = browser.runtime.getURL('');
const operations = new Set(['bridge.info', 'health.get', 'projects.list', 'projects.create',
  'sources.list', 'sources.create', 'sources.get', 'models.list', 'tasks.list', 'tasks.plan', 'tasks.get']);
let port = null;
const pending = new Map();

function fail(code, message) { return { ok: false, error: { code, message } }; }
function bridge(request) {
  if (!request || request.protocol_version !== '0' || !operations.has(request.operation) ||
      !/^[a-f0-9-]{36}$/i.test(request.request_id || '') || pending.has(request.request_id)) {
    return Promise.resolve(fail('invalid_request', 'Pedido inválido.'));
  }
  if (!port) {
    port = browser.runtime.connectNative(HOST);
    port.onMessage.addListener(response => {
      const job = pending.get(response.request_id);
      if (job) { clearTimeout(job.timer); pending.delete(response.request_id); job.resolve(response); }
    });
    port.onDisconnect.addListener(() => {
      port = null;
      for (const job of pending.values()) {
        clearTimeout(job.timer);
        job.resolve(fail('host_disconnected', 'Componente local não instalado ou desconectado. Confira a instalação.'));
      }
      pending.clear();
    });
  }
  return new Promise(resolve => {
    const timer = setTimeout(() => {
      pending.delete(request.request_id);
      resolve(fail('outcome_unknown', 'Não recebemos a confirmação. Atualize a lista antes de repetir a ação.'));
    }, 20000);
    pending.set(request.request_id, { resolve, timer });
    try { port.postMessage(request); }
    catch { clearTimeout(timer); pending.delete(request.request_id); resolve(fail('host_disconnected', 'Componente local desconectado.')); }
  });
}

function normalizeCapture(title, url, text) {
  if (!/^https?:\/\//i.test(url || '')) throw new Error('Esta página não permite captura. Use uma página HTTP ou HTTPS.');
  if (!text || !text.trim()) throw new Error('Selecione um trecho da página primeiro.');
  if (text.length > 38000) throw new Error('O trecho ultrapassa 38.000 caracteres. Selecione uma parte menor.');
  return { id: crypto.randomUUID(), title: (title || 'Trecho da página').slice(0, 120), url, text };
}

browser.runtime.onMessage.addListener(async (message, sender) => {
  if (sender.id !== browser.runtime.id || !sender.url?.startsWith(BASE)) return;
  if (message.type === 'bridge.request') return bridge(message.request);
  if (message.type === 'workspace.open') { await browser.tabs.create({ url: browser.runtime.getURL('app/index.html') }); return { ok: true }; }
  if (message.type === 'capture.read') return (await browser.storage.local.get('pendingCapture')).pendingCapture || null;
  if (message.type === 'capture.clear') {
    const current = (await browser.storage.local.get('pendingCapture')).pendingCapture;
    if (current?.id === message.id) await browser.storage.local.remove('pendingCapture');
    return { ok: true };
  }
  if (message.type === 'capture.selection') {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !/^https?:\/\//i.test(tab.url || '')) throw new Error('Abra uma página e selecione um trecho.');
      const [result] = await browser.scripting.executeScript({ target: { tabId: tab.id }, func: () => window.getSelection()?.toString() || '' });
      const capture = normalizeCapture(tab.title, tab.url, result?.result);
      await browser.storage.local.set({ pendingCapture: capture });
      return { ok: true, capture };
    } catch (error) { return fail('capture_unavailable', error.message || 'Use o menu de contexto sobre o trecho selecionado.'); }
  }
});

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({ id: 'ia-bbaru-capture', title: 'Adicionar ao Ia-bbaru', contexts: ['selection'] });
});
browser.action.onClicked.addListener(() => browser.sidebarAction.open());
browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'ia-bbaru-capture') return;
  // open must run while Firefox still considers this a user gesture.
  browser.sidebarAction.open();
  try {
    const capture = normalizeCapture(tab?.title, info.pageUrl || tab?.url, info.selectionText);
    browser.storage.local.set({ pendingCapture: capture });
  } catch (error) { browser.storage.local.set({ captureError: error.message }); }
});
