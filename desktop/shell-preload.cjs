const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("navigatorApp", {
  data: (operation, params) => ipcRenderer.invoke("browser:data", operation, params),
  onData: callback => ipcRenderer.on("browser:data", (_event, data) => callback(data)),
  command: (action, value) =>
    ipcRenderer.invoke("browser:command", action, value),
  state: () => ipcRenderer.invoke("browser:state"),
  openTool: (callback) => ipcRenderer.on("browser:tool", (_event, name) => callback(name)),
  focusAddress: (callback) => {
    ipcRenderer.on("browser:focus-address", () => callback());
  },
  subscribe: (callback) => {
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("browser:state", listener);
    return () => ipcRenderer.removeListener("browser:state", listener);
  },
});
