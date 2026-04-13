// Claude Code CLI provider — uses your subscription plan (no API cost).
// Falls back gracefully if the CLI is not installed or times out.

import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
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
const TIMEOUT_MS = 60_000;

let cliAvailable: boolean | null = null;

/** Check once if the claude CLI exists and is authenticated. */
export async function isCliAvailable(): Promise<boolean> {
  if (cliAvailable !== null) return cliAvailable;
  try {
    const version = await exec(CLAUDE_BIN, ["--version"]);
    cliAvailable = version.trim().length > 0;
  } catch {
    cliAvailable = false;
  }
  return cliAvailable;
}

/** Reset the cached availability check (for testing). */
export function resetCliCheck(): void {
  cliAvailable = null;
}

export interface CliCallOptions extends ProviderCallInput {
  allowWebSearch?: boolean;
}

export async function callClaudeCli(input: CliCallOptions): Promise<ProviderCallOutput> {
  const args = [
    "-p", buildPrompt(input),
    "--output-format", "text",
    "--max-turns", "1",
    "--model", mapModel(input.model),
  ];

  if (input.maxTokens) {
    args.push("--max-tokens", String(input.maxTokens));
  }

  if (input.allowWebSearch) {
    args.push("--allowedTools", "mcp__claude_ai_web_search__web_search");
  }

  const text = await exec(CLAUDE_BIN, args);

  return {
    text: text.trim(),
    tokensIn: 0,  // CLI doesn't report token counts
    tokensOut: 0,
  };
}

function buildPrompt(input: ProviderCallInput): string {
  if (input.system) {
    return `${input.system}\n\n${input.prompt}`;
  }
  return input.prompt;
}

/** Map internal model names to CLI-compatible model flags. */
function mapModel(model: string): string {
  if (model.includes("opus")) return "opus";
  if (model.includes("haiku")) return "haiku";
  return "sonnet"; // default
}

function exec(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: TIMEOUT_MS, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`claude cli failed: ${err.message}${stderr ? ` — ${stderr}` : ""}`));
        return;
      }
      resolve(stdout);
    });
  });
}
