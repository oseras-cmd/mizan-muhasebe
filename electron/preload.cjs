const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mizanDesktop", true);
contextBridge.exposeInMainWorld("mizanVersion", null);
contextBridge.exposeInMainWorld("mizanBridge", {
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  checkUpdates: () => ipcRenderer.invoke("app:check-updates"),
});

// Sync sürümü ana süreçten al ve window.mizanVersion'a yaz
ipcRenderer.invoke("app:get-version").then((v) => {
  window.mizanVersion = v;
});
