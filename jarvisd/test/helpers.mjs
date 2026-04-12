// Integration test helpers for jarvisd.
// Spawns a dedicated daemon on a non-default port under an isolated JARVIS_HOME.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const JARVISD_ROOT = resolve(__dirname, "..");
const TEST_PORT = 8900;
const TEST_HOST = "127.0.0.1";
const BASE_URL = `http://${TEST_HOST}:${TEST_PORT}`;

async function waitForHealth(baseUrl, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/health`);
      if (res.ok) return;
      lastErr = new Error(`health ${res.status}`);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`daemon did not become healthy: ${lastErr?.message ?? "unknown"}`);
}

export async function startDaemon() {
  const home = mkdtempSync(join(tmpdir(), "jarvisd-test-"));
  const env = {
    ...process.env,
    JARVIS_PORT: String(TEST_PORT),
    JARVIS_HOME: home,
    // Keep pino output quiet unless debugging
    LOG_LEVEL: "error",
  };

  const child = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: JARVISD_ROOT,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stderrBuf = "";
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => {
    stderrBuf += d.toString();
  });

  const exited = new Promise((_, reject) => {
    child.once("exit", (code) => {
      reject(new Error(`jarvisd exited early (code=${code}). stderr:\n${stderrBuf}`));
    });
  });

  try {
    await Promise.race([waitForHealth(BASE_URL), exited]);
  } catch (err) {
    try { child.kill("SIGKILL"); } catch {}
    try { rmSync(home, { recursive: true, force: true }); } catch {}
    throw err;
  }

  // Remove early-exit rejection now that it's up
  child.removeAllListeners("exit");

  const daemon = {
    baseUrl: BASE_URL,
    home,
    async stop() {
      await new Promise((resolve) => {
        child.once("exit", () => resolve());
        try {
          child.kill("SIGTERM");
        } catch {
          resolve();
        }
        // Hard kill after 3s
        setTimeout(() => {
          try { child.kill("SIGKILL"); } catch {}
        }, 3000).unref();
      });
      try { rmSync(home, { recursive: true, force: true }); } catch {}
    },
  };
  return daemon;
}

function makeUrl(path) {
  if (path.startsWith("http")) return path;
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function getJson(path) {
  const res = await fetch(makeUrl(path));
  const text = await res.text();
  let body;
  try { body = text.length ? JSON.parse(text) : null; } catch { body = text; }
  return { status: res.status, body };
}

export async function postJson(path, body) {
  const res = await fetch(makeUrl(path), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? "{}" : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = text.length ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

export async function del(path) {
  const res = await fetch(makeUrl(path), { method: "DELETE" });
  const text = await res.text();
  let parsed;
  try { parsed = text.length ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed };
}

export async function unlockVault() {
  return postJson("/vault/unlock");
}

export async function ollamaReachable() {
  try {
    const res = await fetch("http://127.0.0.1:11434/api/tags", {
      signal: AbortSignal.timeout(500),
    });
    return res.ok;
  } catch {
    return false;
  }
}
