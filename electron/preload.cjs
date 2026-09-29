const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mizanDesktop", true);
contextBridge.exposeInMainWorld("mizanVersion", null);
contextBridge.exposeInMainWorld("mizanBridge", {
  getVersion: () => ipcRenderer.invoke("app:get-version"),
  checkUpdates: () => ipcRenderer.invoke("app:check-updates"),
  /** TCMB günlük kur XML'ini ana süreç üzerinden çeker (CORS yok) */
  fetchTcmb: () => ipcRenderer.invoke("tcmb:fetch-today"),
});

// Sync sürümü ana süreçten al ve window.mizanVersion'a yaz
ipcRenderer.invoke("app:get-version").then((v) => {
  window.mizanVersion = v;
});
