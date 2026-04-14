// Claude Code CLI provider — uses your subscription plan (no API cost).
// Uses temp files for prompts to avoid shell escaping issues with long text.

import { execFile, spawn } from "node:child_process";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { ProviderCallInput, ProviderCallOutput } from "./anthropic.js";

// Resolve claude binary — check common install locations if not in PATH
function findClaudeBin(): string {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const home = homedir();
  const candidates = [
    `${home}/.local/bin/claude`,
    `${home}/.claude/bin/claude`,
    "/usr/local/bin/claude",
    "/opt/homebrew/bin/claude",
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return "claude";
}

const CLAUDE_BIN = findClaudeBin();
const TIMEOUT_MS = 120_000; // 2 minutes for web search queries

let cliAvailable: boolean | null = null;

export async function isCliAvailable(): Promise<boolean> {
  if (cliAvailable !== null) return cliAvailable;
  try {
    const version = await execPromise(CLAUDE_BIN, ["--version"]);
    cliAvailable = version.trim().length > 0;
  } catch {
    cliAvailable = false;
  }
  return cliAvailable;
}

export function resetCliCheck(): void {
  cliAvailable = null;
}

export interface CliCallOptions extends ProviderCallInput {
  allowWebSearch?: boolean;
}

export async function callClaudeCli(input: CliCallOptions): Promise<ProviderCallOutput> {
  // Write prompt and system prompt to temp files to avoid shell escaping issues
  const id = randomUUID().slice(0, 8);
  const promptFile = join(tmpdir(), `jarvis-prompt-${id}.txt`);
  const systemFile = input.system ? join(tmpdir(), `jarvis-system-${id}.txt`) : null;

  try {
    writeFileSync(promptFile, input.prompt, "utf-8");
    if (systemFile && input.system) {
      writeFileSync(systemFile, input.system, "utf-8");
    }

    const maxTurns = input.allowWebSearch ? "3" : "1";

    const args = [
      "-p", `$(cat ${promptFile})`,
    ];

    // Actually, execFile doesn't go through shell, so we need to read the file
    // and pass content. But execFile properly escapes arguments, so the issue
    // was something else. Let's use spawn with stdin instead.

    const text = await execWithStdin(CLAUDE_BIN, [
      "--output-format", "text",
      "--max-turns", maxTurns,
      "--model", mapModel(input.model),
      ...(systemFile ? ["--append-system-prompt-file", systemFile] : []),
      ...(input.maxTokens ? ["--max-tokens", String(input.maxTokens)] : []),
      ...(input.allowWebSearch ? ["--allowedTools", "WebSearch"] : []),
    ], input.prompt);

    return {
      text: text.trim(),
      tokensIn: 0,
      tokensOut: 0,
    };
  } finally {
    try { unlinkSync(promptFile); } catch {}
    if (systemFile) try { unlinkSync(systemFile); } catch {}
  }
}

function mapModel(model: string): string {
  if (model.includes("opus")) return "opus";
  if (model.includes("haiku")) return "haiku";
  return "sonnet";
}

/** Execute CLI with prompt piped via stdin to avoid argument length/escaping issues */
function execWithStdin(cmd: string, args: string[], stdin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // spawn is imported at top of file
    const child = spawn(cmd, args, {
      timeout: TIMEOUT_MS,
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, NO_COLOR: "1" },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (d: Buffer) => { stdout += d.toString(); });
    child.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });

    // Pipe the user prompt via stdin so it doesn't hit shell argument limits
    child.stdin.write(stdin);
    child.stdin.end();

    child.on("close", (code: number) => {
      if (code !== 0) {
        // Filter out the "no stdin" warning — we're sending stdin so this shouldn't happen,
        // but if it does, don't fail on it
        const isJustWarning = stderr.includes("no stdin data") && stdout.trim().length > 0;
        if (isJustWarning) {
          resolve(stdout);
          return;
        }
        reject(new Error(`claude cli exited ${code}: ${stderr.slice(0, 200)}`));
        return;
      }
      resolve(stdout);
    });

    child.on("error", (err: Error) => {
      reject(new Error(`claude cli failed: ${err.message}`));
    });
  });
}

function execPromise(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 10_000 }, (err, stdout) => {
      if (err) return reject(err);
      resolve(stdout);
    });
  });
}
