// JARVIS OS — Electron shell.
// Boots jarvisd + vite (dev) or loads built static files (prod),
// puts the web app in a frameless desktop window with a system tray
// and a global hotkey (⌘⇧J) to toggle.

const { app, BrowserWindow, Tray, Menu, globalShortcut, nativeImage, shell } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const http = require("node:http");

const isDev = !app.isPackaged;
const DAEMON_PORT = 8787;
const VITE_PORT = 5174;
const REPO_ROOT = path.resolve(__dirname, "..");

let mainWindow = null;
let tray = null;
let daemonProc = null;
let viteProc = null;

function waitForHttp(url, timeoutMs = 20000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      const req = http.get(url, (res) => {
        res.destroy();
        if (res.statusCode && res.statusCode < 500) return resolve();
        if (Date.now() - start > timeoutMs) return reject(new Error(`timeout ${url}`));
        setTimeout(tick, 300);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) return reject(new Error(`timeout ${url}`));
        setTimeout(tick, 300);
      });
    };
    tick();
  });
}

function startDaemon() {
  daemonProc = spawn("npm", ["run", "dev"], {
    cwd: path.join(REPO_ROOT, "jarvisd"),
    env: { ...process.env, JARVIS_PORT: String(DAEMON_PORT) },
    stdio: "inherit",
    shell: true,
  });
  daemonProc.on("exit", (code) => {
    console.log(`[jarvisd] exited with code ${code}`);
  });
}

function startVite() {
  if (!isDev) return;
  viteProc = spawn("npm", ["run", "dev", "--", "--port", String(VITE_PORT), "--strictPort"], {
    cwd: REPO_ROOT,
    stdio: "inherit",
    shell: true,
  });
  viteProc.on("exit", (code) => {
    console.log(`[vite] exited with code ${code}`);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#05070d",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL(`http://localhost:${VITE_PORT}/`);
  } else {
    mainWindow.loadFile(path.join(REPO_ROOT, "dist", "index.html"));
  }

  mainWindow.on("close", (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function buildTray() {
  // Simple cyan dot icon generated inline
  const icon = nativeImage.createFromDataURL(
    "data:image/svg+xml;base64," +
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18"><circle cx="9" cy="9" r="4" fill="#5de8ff"/></svg>`
      ).toString("base64")
  );
  tray = new Tray(icon);
  tray.setToolTip("JARVIS OS");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show JARVIS", click: () => mainWindow?.show() },
      { label: "Hide", click: () => mainWindow?.hide() },
      { type: "separator" },
      {
        label: "Lock Vault",
        click: () =>
          http
            .request({ host: "127.0.0.1", port: DAEMON_PORT, path: "/vault/lock", method: "POST" })
            .end(),
      },
      { type: "separator" },
      {
        label: "Quit",
        click: () => {
          app.isQuitting = true;
          app.quit();
        },
      },
    ])
  );
  tray.on("click", () => {
    if (mainWindow?.isVisible()) mainWindow.hide();
    else mainWindow?.show();
  });
}

async function main() {
  startDaemon();
  startVite();

  await waitForHttp(`http://127.0.0.1:${DAEMON_PORT}/health`).catch((e) => {
    console.error("daemon didn't come up:", e.message);
  });
  if (isDev) {
    await waitForHttp(`http://127.0.0.1:${VITE_PORT}/`).catch(() => {});
  }

  createWindow();
  buildTray();

  globalShortcut.register("CommandOrControl+Shift+J", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) mainWindow.hide();
    else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(main);

app.on("window-all-closed", (e) => {
  // Keep alive in tray.
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
  daemonProc?.kill();
  viteProc?.kill();
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
