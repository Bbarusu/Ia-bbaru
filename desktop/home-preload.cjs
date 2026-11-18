const { contextBridge, ipcRenderer } = require("electron");
// Expose no API to web pages, even though the preload accompanies the tab.
// The main process independently validates the exact home document and frame.
if (location.protocol === "file:" && location.pathname.endsWith("/ui/home.html")) {
  contextBridge.exposeInMainWorld("yukiHome", {
    get: () => ipcRenderer.invoke("home:get"),
    ask: () => ipcRenderer.invoke("home:ask"),
    subscribe: callback => ipcRenderer.on("home:data", (_event, value) => callback(value)),
  });
}
