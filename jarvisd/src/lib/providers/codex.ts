// Codex CLI agent — shells out to `codex exec` for coding tasks.
// This lets JARVIS delegate real coding work to OpenAI Codex as an agent.

import { execFile } from "node:child_process";

export interface CodexExecInput {
  prompt: string;
  model?: string;         // e.g. "o3", "o4-mini", "gpt-4o"
  cwd?: string;           // working directory for codex
  timeoutMs?: number;     // default 120s
}

export interface CodexExecOutput {
  text: string;
  exitCode: number;
  model: string;
}

export async function callCodex(opts: CodexExecInput): Promise<CodexExecOutput> {
  const model = opts.model ?? "o4-mini";
  const timeout = opts.timeoutMs ?? 120_000;

  const args = ["exec"];
  args.push("-c", `model="${model}"`);
  args.push(opts.prompt);

  return new Promise((resolve, reject) => {
    const child = execFile("codex", args, {
      cwd: opts.cwd ?? process.cwd(),
      timeout,
      maxBuffer: 1024 * 1024 * 5, // 5MB
      env: { ...process.env },
    }, (error, stdout, stderr) => {
      if (error && !stdout) {
        reject(new Error(`codex exec failed: ${error.message}\nstderr: ${stderr}`));
        return;
      }
      resolve({
        text: stdout.trim() || stderr.trim() || "(no output)",
        exitCode: error ? (error as any).code ?? 1 : 0,
        model,
      });
    });
  });
}

export async function codexReview(opts: { cwd?: string; timeoutMs?: number } = {}): Promise<CodexExecOutput> {
  const timeout = opts.timeoutMs ?? 120_000;

  return new Promise((resolve, reject) => {
    execFile("codex", ["exec", "review"], {
      cwd: opts.cwd ?? process.cwd(),
      timeout,
      maxBuffer: 1024 * 1024 * 5,
      env: { ...process.env },
    }, (error, stdout, stderr) => {
      if (error && !stdout) {
        reject(new Error(`codex review failed: ${error.message}\nstderr: ${stderr}`));
        return;
      }
      resolve({
        text: stdout.trim() || stderr.trim() || "(no output)",
        exitCode: error ? (error as any).code ?? 1 : 0,
        model: "codex-review",
      });
    });
  });
}

export async function isCodexAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    execFile("codex", ["--version"], { timeout: 5000 }, (error) => {
      resolve(!error);
    });
  });
}
