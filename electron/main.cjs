const { app, BrowserWindow, shell, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const https = require("https");

const GITHUB_REPO = "oseras-cmd/mizan-muhasebe";

function isNewerVersion(current, candidate) {
  const parse = (v) =>
    v
      .replace(/^v/i, "")
      .split(".")
      .map((n) => parseInt(n, 10) || 0);
  const a = parse(current);
  const b = parse(candidate);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (y > x) return true;
    if (y < x) return false;
  }
  return false;
}

function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: "GET", headers: headers || {} },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          if (res.headers.location) {
            fetchJson(res.headers.location, headers).then(resolve, reject);
          } else {
            reject(new Error("Redirect without location"));
          }
          res.resume();
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
    req.end();
  });
}

ipcMain.handle("app:get-version", () => app.getVersion());

// İsteğe bağlı yapılandırma: userData içinde mizan-updates.json dosyası
// { "repo": "sahip/depo", "token": "ghp_..." } — özel depolar için gerekir
function readUpdateConfig() {
  try {
    const cfgPath = path.join(app.getPath("userData"), "mizan-updates.json");
    if (fs.existsSync(cfgPath)) {
      return JSON.parse(fs.readFileSync(cfgPath, "utf8"));
    }
  } catch {
    // ignore
  }
  return {};
}

ipcMain.handle("app:check-updates", async () => {
  try {
    const cfg = readUpdateConfig();
    const repo = cfg.repo || GITHUB_REPO;
    const headers = {
      Accept: "application/vnd.github+json",
      "User-Agent": "Mizan-Desktop",
    };
    const token =
      cfg.token || process.env.MIZAN_GITHUB_TOKEN || "";
    if (token) headers.Authorization = `Bearer ${token}`;
    const payload = await fetchJson(
      `https://api.github.com/repos/${repo}/releases/latest`,
      headers,
    );
    const tag = (payload.tag_name || "").replace(/^v/i, "");
    if (!tag) return null;
    const exeAsset = (payload.assets || []).find((a) =>
      a.name.toLowerCase().endsWith(".exe"),
    );
    const currentVersion = app.getVersion();
    return {
      currentVersion,
      latestVersion: tag,
      updateAvailable: isNewerVersion(currentVersion, tag),
      releaseUrl:
        (exeAsset && exeAsset.browser_download_url) ||
        payload.html_url ||
        `https://github.com/${repo}/releases`,
      notes: (payload.body || "").slice(0, 500),
    };
  } catch {
    return null;
  }
});

// Portable: store userData next to the exe
const isPortable = process.env.PORTABLE_EXECUTABLE_DIR || process.env.ELECTRON_IS_PORTABLE;
if (isPortable) {
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
  app.setPath("userData", path.join(portableDir, "mizan-data"));
}

const DIST = path.join(__dirname, "..", "dist");
const FIXED_PORT = 27182; // Sabit port — localStorage her zaman aynı origin'de kalır

function createServer() {
  return new Promise((resolve, reject) => {
    const mimeTypes = {
      ".html": "text/html",
      ".js": "text/javascript",
      ".css": "text/css",
      ".json": "application/json",
      ".svg": "image/svg+xml",
      ".png": "image/png",
      ".ico": "image/x-icon",
      ".woff": "font/woff",
      ".woff2": "font/woff2",
    };

    const server = http.createServer((req, res) => {
      const urlPath = req.url.split("?")[0];
      let filePath = path.join(DIST, urlPath === "/" ? "index.html" : urlPath);

      // If file doesn't exist, serve index.html (SPA fallback)
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(DIST, "index.html");
      }

      const ext = path.extname(filePath);
      const contentType = mimeTypes[ext] || "application/octet-stream";

      try {
        const data = fs.readFileSync(filePath);
        res.writeHead(200, { "Content-Type": contentType });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end("Not found");
      }
    });

    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        // Port zaten mevcut — muhtemelen önceki instancia hâlâ çalışıyor
        // Sadece yeni pencere aç
        resolve({ server: null, port: FIXED_PORT });
      } else {
        reject(err);
      }
    });

    server.listen(FIXED_PORT, "127.0.0.1", () => {
      resolve({ server, port: FIXED_PORT });
    });
  });
}

function createWindow(baseUrl) {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: "Mizan",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.cjs"),
    },
    autoHideMenuBar: true,
    show: false,
  });

  win.loadURL(baseUrl);

  win.once("ready-to-show", () => {
    win.show();
  });

  // Open external links in system browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  return win;
}

app.whenReady().then(async () => {
  // Ensure userData directory exists
  const userDataPath = app.getPath("userData");
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  const { server, port } = await createServer();
  const baseUrl = `http://127.0.0.1:${port}`;
  createWindow(baseUrl);

  // Cleanup on exit
  app.on("window-all-closed", () => {
    if (server) server.close();
    app.quit();
  });
});

app.on("activate", async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const { server, port } = await createServer();
    createWindow(`http://127.0.0.1:${port}`);
  }
});
