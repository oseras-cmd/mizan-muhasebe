const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");

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
