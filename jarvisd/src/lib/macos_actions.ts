// macOS action runner for Computer Use (Phase 3, Day 1).
//
// Translates Anthropic's `computer_20251124` action verbs into shell-out
// invocations of native macOS tools. No external binary dependencies — uses
// only what ships with macOS (`screencapture`, `osascript`, `sips`).
//
// Coordinate space: Opus 4.7 returns coordinates 1:1 with the image pixels
// we send. We capture at native Retina resolution, downscale to API_WIDTH ×
// API_HEIGHT (default 1280×800) before sending, then scale Claude's
// coordinates back UP to native before clicking.
//
// Permissions required (per-Node-binary, via macOS Settings):
//   1. Privacy & Security → Screen Recording → enable Node
//   2. Privacy & Security → Accessibility → enable Node
// First failed call returns ScreenRecordingDeniedError / AccessibilityDeniedError
// with a friendly grant URL.
//
// Mouse + scroll require `cliclick` (Homebrew):  `brew install cliclick`
// cliclick is the de-facto macOS coordinate-click CLI; no Python deps.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtempSync, readFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { platform } from "node:os";

const execFileP = promisify(execFile);
const isMac = platform() === "darwin";

// cliclick path probing — Homebrew can install to /opt/homebrew/bin (Apple
// Silicon) or /usr/local/bin (Intel). We probe both.
const CLICLICK_CANDIDATES = [
  "/opt/homebrew/bin/cliclick",
  "/usr/local/bin/cliclick",
];
let cachedCliclickPath: string | null | undefined;

function findCliclick(): string | null {
  if (cachedCliclickPath !== undefined) return cachedCliclickPath;
  for (const p of CLICLICK_CANDIDATES) {
    if (existsSync(p)) {
      cachedCliclickPath = p;
      return p;
    }
  }
  cachedCliclickPath = null;
  return null;
}

export class CliclickMissingError extends Error {
  constructor() {
    super(
      "cliclick is not installed. Run:\n\n    brew install cliclick\n\nThen retry. (cliclick is a tiny macOS CLI used by Computer Use to send mouse clicks. ~50KB, no daemon, no privileges.)"
    );
    this.name = "CliclickMissingError";
  }
}

// What we send to Claude. Anthropic recommends 1280×800 for web apps.
export const API_WIDTH = 1280;
export const API_HEIGHT = 800;

export class MacOSActionError extends Error {
  constructor(message: string, public readonly hint?: string) {
    super(message);
    this.name = "MacOSActionError";
  }
}

export class ScreenRecordingDeniedError extends MacOSActionError {
  constructor() {
    super(
      "Screen Recording permission denied. Open System Settings → Privacy & Security → Screen Recording and enable Node (or your terminal). Then restart jarvisd.",
      "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
    );
    this.name = "ScreenRecordingDeniedError";
  }
}

export class AccessibilityDeniedError extends MacOSActionError {
  constructor() {
    super(
      "Accessibility permission denied. Open System Settings → Privacy & Security → Accessibility and enable Node (or your terminal). Then restart jarvisd.",
      "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
    );
    this.name = "AccessibilityDeniedError";
  }
}

function mustBeMac(): void {
  if (!isMac) {
    throw new MacOSActionError("Computer Use macOS actions only run on darwin");
  }
}

// ---------- Display sizing ----------

interface DisplaySize {
  nativeWidth: number;
  nativeHeight: number;
  scaleX: number; // native ÷ API
  scaleY: number;
}

let cachedDisplay: DisplaySize | null = null;

/** Read the main display's native resolution from system_profiler. */
export async function getDisplaySize(): Promise<DisplaySize> {
  mustBeMac();
  if (cachedDisplay) return cachedDisplay;

  // Cheap path: use AppleScript to query Finder for the main desktop bounds.
  // Returns "0, 0, 1512, 982" on a 14" MacBook, etc.
  const script = `tell application "Finder" to get bounds of window of desktop`;
  let nativeWidth = 1512; // sane default for 14" MBP
  let nativeHeight = 982;
  try {
    const { stdout } = await execFileP("osascript", ["-e", script], { timeout: 3000 });
    const parts = stdout.trim().split(",").map((s) => parseInt(s.trim(), 10));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n) && n > 0)) {
      nativeWidth = parts[2];
      nativeHeight = parts[3];
    }
  } catch {
    // Fall through to defaults
  }

  cachedDisplay = {
    nativeWidth,
    nativeHeight,
    scaleX: nativeWidth / API_WIDTH,
    scaleY: nativeHeight / API_HEIGHT,
  };
  return cachedDisplay;
}

/** Map an API-space coordinate (1280×800) to native screen space. */
export async function apiToNative(apiX: number, apiY: number): Promise<{ x: number; y: number }> {
  const d = await getDisplaySize();
  return {
    x: Math.round(apiX * d.scaleX),
    y: Math.round(apiY * d.scaleY),
  };
}

// ---------- Screenshot ----------

/**
 * Capture the full screen and return base64-encoded PNG sized to API_WIDTH ×
 * API_HEIGHT for sending to Claude.
 *
 * `screencapture -x` is silent (no shutter sound). Then we resize via `sips`
 * (built into macOS — no external dependencies).
 */
export async function screenshot(): Promise<{ base64: string; mediaType: "image/png" }> {
  mustBeMac();
  const dir = mkdtempSync(join(tmpdir(), "jarvis-cu-"));
  const rawPath = join(dir, "raw.png");
  const scaledPath = join(dir, "scaled.png");

  try {
    // -x: silent (no shutter), -t png: format, -C: capture cursor too (helps Claude)
    await execFileP("screencapture", ["-x", "-t", "png", "-C", rawPath], { timeout: 5000 });
  } catch (err: any) {
    // macOS returns exit 1 with a stderr message when Screen Recording is denied.
    const msg = (err?.stderr?.toString?.() ?? err?.message ?? "").toLowerCase();
    if (msg.includes("permission") || msg.includes("denied") || msg.includes("not authorized")) {
      throw new ScreenRecordingDeniedError();
    }
    throw new MacOSActionError(`screencapture failed: ${err?.message ?? err}`);
  }

  try {
    // Resize to API dimensions. -z is "max edges" — we pass H W to fit either.
    // sips prints to stdout; we capture the file at scaledPath.
    await execFileP(
      "sips",
      ["-z", String(API_HEIGHT), String(API_WIDTH), rawPath, "--out", scaledPath],
      { timeout: 5000 }
    );
    const buf = readFileSync(scaledPath);
    return { base64: buf.toString("base64"), mediaType: "image/png" };
  } catch (err: any) {
    throw new MacOSActionError(`sips resize failed: ${err?.message ?? err}`);
  } finally {
    try { unlinkSync(rawPath); } catch {}
    try { unlinkSync(scaledPath); } catch {}
  }
}

// ---------- Click / mouse ----------

/**
 * Click at API-space coordinates. The coords come from Claude in the same
 * pixel space as the screenshot we sent (1280×800). Internally we scale to
 * native for the actual click.
 */
export async function leftClick(apiX: number, apiY: number, modifier?: ClickModifier): Promise<void> {
  mustBeMac();
  const { x, y } = await apiToNative(apiX, apiY);
  await runMouseClickAt(x, y, modifier);
}

export type ClickModifier = "shift" | "control" | "option" | "command";

const MODIFIER_DOWN: Record<ClickModifier, string> = {
  shift: "shift down",
  control: "control down",
  option: "option down",
  command: "command down",
};

/**
 * Click at native screen coordinates via cliclick. Modifier keys (shift,
 * cmd, etc.) are passed via cliclick's `-w` / `kd:`/`ku:` syntax.
 */
async function runMouseClickAt(x: number, y: number, modifier?: ClickModifier): Promise<void> {
  const cliclick = findCliclick();
  if (!cliclick) throw new CliclickMissingError();

  try {
    if (modifier) {
      const modKey = CLICLICK_MODIFIER[modifier];
      // kd:<mod> sends key-down for the modifier; we click; then ku:<mod>
      // releases it. This is cliclick's documented modifier pattern.
      await execFileP(cliclick, [`kd:${modKey}`, `c:${x},${y}`, `ku:${modKey}`], {
        timeout: 3000,
      });
    } else {
      await execFileP(cliclick, [`c:${x},${y}`], { timeout: 3000 });
    }
  } catch (err: any) {
    const msg = (err?.stderr?.toString?.() ?? err?.message ?? "").toLowerCase();
    if (msg.includes("not authorized") || msg.includes("operation not permitted")) {
      throw new AccessibilityDeniedError();
    }
    throw new MacOSActionError(`click failed: ${err?.message ?? err}`);
  }
}

const CLICLICK_MODIFIER: Record<ClickModifier, string> = {
  shift: "shift",
  control: "ctrl",
  option: "alt",
  command: "cmd",
};

// ---------- Mouse move ----------

export async function mouseMove(apiX: number, apiY: number): Promise<void> {
  mustBeMac();
  const cliclick = findCliclick();
  if (!cliclick) throw new CliclickMissingError();
  const { x, y } = await apiToNative(apiX, apiY);
  try {
    await execFileP(cliclick, [`m:${x},${y}`], { timeout: 3000 });
  } catch (err: any) {
    if (/not authorized|operation not permitted/i.test(err?.stderr ?? err?.message ?? "")) {
      throw new AccessibilityDeniedError();
    }
    throw new MacOSActionError(`mouse_move failed: ${err?.message ?? err}`);
  }
}

// ---------- Type ----------

/**
 * Type a string at the current focus. AppleScript's `keystroke` is the most
 * reliable cross-app text injector. We escape backslashes and double quotes.
 */
export async function typeText(text: string): Promise<void> {
  mustBeMac();
  const escaped = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = `tell application "System Events" to keystroke "${escaped}"`;
  try {
    await execFileP("osascript", ["-e", script], { timeout: 30_000 });
  } catch (err: any) {
    if (/not authorized|operation not permitted/i.test(err?.stderr ?? err?.message ?? "")) {
      throw new AccessibilityDeniedError();
    }
    throw new MacOSActionError(`type failed: ${err?.message ?? err}`);
  }
}

// ---------- Key combos ----------

/**
 * Press a key or key combination. Anthropic's format is "ctrl+s", "cmd+a",
 * "Return", "Tab", etc. We translate to AppleScript's keystroke + modifier
 * vocabulary.
 */
export async function pressKey(combo: string): Promise<void> {
  mustBeMac();
  const parts = combo.toLowerCase().split("+").map((s) => s.trim());
  const modifiers: string[] = [];
  let key = "";
  for (const p of parts) {
    if (["shift", "ctrl", "control", "alt", "option", "cmd", "command", "super"].includes(p)) {
      modifiers.push(modifierAppleScript(p));
    } else {
      key = p;
    }
  }

  const script = buildKeyAppleScript(key, modifiers);
  try {
    await execFileP("osascript", ["-e", script], { timeout: 5000 });
  } catch (err: any) {
    if (/not authorized|operation not permitted/i.test(err?.stderr ?? err?.message ?? "")) {
      throw new AccessibilityDeniedError();
    }
    throw new MacOSActionError(`key "${combo}" failed: ${err?.message ?? err}`);
  }
}

function modifierAppleScript(m: string): string {
  switch (m) {
    case "shift": return "shift down";
    case "ctrl":
    case "control": return "control down";
    case "alt":
    case "option": return "option down";
    case "cmd":
    case "command":
    case "super": return "command down";
    default: return "";
  }
}

// AppleScript key codes for non-printable keys we care about.
// Keep this list focused; extend as needed.
const KEY_CODES: Record<string, number> = {
  return: 36,
  enter: 36,
  tab: 48,
  space: 49,
  delete: 51,
  escape: 53,
  esc: 53,
  left: 123,
  right: 124,
  down: 125,
  up: 126,
  home: 115,
  end: 119,
  pageup: 116,
  pagedown: 121,
  f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97, f7: 98, f8: 100, f9: 101,
  f10: 109, f11: 103, f12: 111,
};

function buildKeyAppleScript(key: string, modifiers: string[]): string {
  const usingClause = modifiers.length
    ? ` using {${modifiers.join(", ")}}`
    : "";
  const code = KEY_CODES[key];
  if (code !== undefined) {
    return `tell application "System Events" to key code ${code}${usingClause}`;
  }
  // Single-character key — keystroke
  const escaped = key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `tell application "System Events" to keystroke "${escaped}"${usingClause}`;
}

// ---------- Scroll ----------

/**
 * Scroll at API-space coordinates. We translate "down 3" to ~3 wheel ticks
 * via Quartz CGEventCreateScrollWheelEvent.
 */
export async function scroll(
  apiX: number,
  apiY: number,
  direction: "up" | "down" | "left" | "right",
  amount: number
): Promise<void> {
  mustBeMac();
  const { x, y } = await apiToNative(apiX, apiY);
  // Move cursor to position first (some apps require hover for scroll)
  await mouseMove(apiX, apiY);

  // Quartz scroll: positive y = up, negative y = down. Pixel units, ~10/tick.
  let dx = 0, dy = 0;
  const ticks = Math.max(1, Math.min(20, Math.round(amount)));
  if (direction === "down") dy = -ticks * 10;
  else if (direction === "up") dy = ticks * 10;
  else if (direction === "right") dx = -ticks * 10;
  else if (direction === "left") dx = ticks * 10;

  // cliclick's scroll: positive Y = up, negative Y = down (opposite of CGEvent
  // pixel units, but cliclick handles direction normalization internally).
  // We emit ticks in a small loop for smoother scrolling.
  const cliclick = findCliclick();
  if (!cliclick) throw new CliclickMissingError();
  const dyPerTick = direction === "down" ? -3 : direction === "up" ? 3 : 0;
  const dxPerTick = direction === "left" ? -3 : direction === "right" ? 3 : 0;
  try {
    for (let i = 0; i < ticks; i++) {
      // cliclick scroll syntax:  -p +/-X +/-Y
      // Older cliclick versions don't support scroll directly; fall back to
      // emitting key presses (page-down) if needed. For now we use the
      // documented `s:+0,-3` form available since cliclick 5.x.
      await execFileP(cliclick, [`s:${dxPerTick >= 0 ? "+" : ""}${dxPerTick},${dyPerTick >= 0 ? "+" : ""}${dyPerTick}`], {
        timeout: 2000,
      });
      await new Promise((r) => setTimeout(r, 30));
    }
    // Suppress unused-var warnings (dx/dy were the legacy CGEvent quantities)
    void dx; void dy;
  } catch (err: any) {
    if (/not authorized|operation not permitted/i.test(err?.stderr ?? err?.message ?? "")) {
      throw new AccessibilityDeniedError();
    }
    throw new MacOSActionError(`scroll failed: ${err?.message ?? err}`);
  }
}

// ---------- Wait ----------

export async function wait(seconds: number): Promise<void> {
  const ms = Math.max(0, Math.min(30_000, Math.round(seconds * 1000)));
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- App focus ----------

/**
 * Bring an application to the foreground. Useful for pre-flight ("focus
 * Chrome before starting the workflow"). Name match must be the app's
 * registered name (e.g. "Google Chrome", not "Chrome").
 */
export async function focusApp(appName: string): Promise<void> {
  mustBeMac();
  const escaped = appName.replace(/"/g, '\\"');
  const script = `tell application "${escaped}" to activate`;
  try {
    await execFileP("osascript", ["-e", script], { timeout: 5000 });
  } catch (err: any) {
    throw new MacOSActionError(`focus "${appName}" failed: ${err?.message ?? err}`);
  }
}

// ---------- Permission probe ----------

/**
 * Probe both required permissions without actually doing anything. Useful as
 * a startup check before kicking off a Computer Use task. Returns a list of
 * problems; empty list = ready.
 */
export async function probePermissions(): Promise<{ ok: boolean; problems: string[] }> {
  const problems: string[] = [];
  if (!isMac) {
    return { ok: false, problems: ["Computer Use only runs on macOS"] };
  }

  // 1. cliclick must be installed (mouse + scroll dependency)
  const cliclick = findCliclick();
  if (!cliclick) {
    problems.push("cliclick not installed — run: brew install cliclick");
  }

  // 2. Screen Recording — try a screenshot
  try {
    await screenshot();
  } catch (err: any) {
    if (err instanceof ScreenRecordingDeniedError) {
      problems.push("Screen Recording denied");
    } else {
      problems.push(`Screen capture failed: ${err.message}`);
    }
  }

  // 3. Accessibility — only testable if cliclick is present.
  // We probe with a no-op `m:` (mouse-move) to current location.
  if (cliclick) {
    try {
      // Get current cursor pos via cliclick `p` then re-set it (no-op move)
      const { stdout } = await execFileP(cliclick, ["p"], { timeout: 2000 });
      const trimmed = stdout.trim();
      // cliclick prints "X,Y"
      if (/^\d+,\d+$/.test(trimmed)) {
        await execFileP(cliclick, [`m:${trimmed}`], { timeout: 2000 });
      }
    } catch (err: any) {
      if (/not authorized|operation not permitted|accessibility/i.test(err?.stderr ?? err?.message ?? "")) {
        problems.push("Accessibility denied — grant cliclick (or Node) in Settings → Privacy & Security → Accessibility");
      } else {
        problems.push(`Accessibility probe failed: ${err.message}`);
      }
    }
  }

  return { ok: problems.length === 0, problems };
}
