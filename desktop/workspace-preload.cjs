const { contextBridge, ipcRenderer } = require("electron");
const listeners = new Map();
contextBridge.exposeInMainWorld("iaDesktop", {
  runtime: {
    sendMessage: (message) => ipcRenderer.invoke("workspace:message", message),
  },
  storage: {
    local: {
      get: (key) => ipcRenderer.invoke("workspace:storage", "get", key),
      set: (values) => ipcRenderer.invoke("workspace:storage", "set", values),
      remove: (key) => ipcRenderer.invoke("workspace:storage", "remove", key),
    },
    onChanged: {
      addListener: (fn) => {
        const handler = (_event, data) => fn(data);
        listeners.set(fn, handler);
        ipcRenderer.on("workspace:changed", handler);
      },
      removeListener: (fn) => {
        const handler = listeners.get(fn);
        if (handler) ipcRenderer.removeListener("workspace:changed", handler);
        listeners.delete(fn);
      },
    },
  },
});
