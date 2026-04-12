// Coder sub-agent — spec-first coding workflow.
//
// Steps: read files → plan → implement minimally → test → summarize
// Cost cascade: Haiku for mechanical work, Sonnet for planning, Opus if stuck.
// Produces typed output with files changed, tests run, and a diff summary.

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "coder_agent",
  title: "Coder Agent",
  description: "Spec-first coding: read → plan → implement → test → summarize. Cost-cascading model selection.",
  version: "0.1.0",
  scopes: ["llm.cloud", "llm.local", "fs.vault.read", "fs.vault.write"],
  routerHint: "routine_code",
  triggers: [{ kind: "manual" }],
  inputs: [
    { name: "task", type: "string", required: true, description: "What to build or fix" },
    { name: "files", type: "string", required: false, description: "Comma-separated file paths to read for context" },
    { name: "cwd", type: "string", required: false, description: "Working directory" },
    { name: "testCmd", type: "string", required: false, description: "Command to run tests (e.g. npm test)" },
    { name: "dryRun", type: "boolean", required: false, description: "Plan only, don't write files" },
  ],
};

function safeExec(cmd: string, cwd?: string, timeoutMs = 30000): { ok: boolean; output: string } {
  try {
    const output = execSync(cmd, {
      cwd: cwd ?? process.cwd(),
      timeout: timeoutMs,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { ok: true, output: output.slice(0, 4000) };
  } catch (err: any) {
    return { ok: false, output: ((err.stdout ?? "") + (err.stderr ?? "")).slice(0, 2000) };
  }
}

function readFileSafe(path: string): string | null {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

export const coderAgent: Skill = {
  manifest: {
    ...manifest,
    // Sub-agent metadata
    costTier: "cheap",
    escalationTier: "standard",
    maxRetries: 1,
  } as any,

  async run(ctx) {
    const task = String(ctx.inputs["task"] ?? "");
    if (!task.trim()) return { error: "No task provided" };

    const cwd = ctx.inputs["cwd"] ? String(ctx.inputs["cwd"]) : process.cwd();
    const testCmd = ctx.inputs["testCmd"] ? String(ctx.inputs["testCmd"]) : undefined;
    const dryRun = Boolean(ctx.inputs["dryRun"]);
    const tier = String(ctx.inputs["_tier"] ?? "cheap");

    // Determine model kind based on tier
    const planKind = tier === "cheap" ? "chat" as const : tier === "premium" ? "complex_reasoning" as const : "chat" as const;
    const implKind = tier === "cheap" ? "classification" as const : "chat" as const;

    // Step 1: Read context files
    ctx.log("coder.step", { step: "read_files" });
    const filePaths = ctx.inputs["files"]
      ? String(ctx.inputs["files"]).split(",").map(f => f.trim())
      : [];

    const fileContents: Record<string, string> = {};
    for (const fp of filePaths) {
      const content = readFileSafe(fp);
      if (content) fileContents[fp] = content.slice(0, 3000);
    }

    // Also read from memory for context
    let memoryContext = "";
    try {
      const recalled = await ctx.memory.recall({ q: task, limit: 5 });
      memoryContext = recalled.compiled || "";
    } catch { /* best effort */ }

    // Step 2: Plan (uses more capable model)
    ctx.log("coder.step", { step: "plan" });

    const contextBlock = Object.entries(fileContents)
      .map(([path, content]) => `--- ${path} ---\n${content}`)
      .join("\n\n");

    const planPrompt = [
      `Task: ${task}`,
      "",
      contextBlock ? `Existing code:\n${contextBlock}` : "",
      memoryContext ? `Memory context:\n${memoryContext}` : "",
      "",
      "Create a minimal implementation plan:",
      "1. List files to create or modify (exact paths)",
      "2. For each file, describe the change in 1-2 sentences",
      "3. List what tests to add",
      "4. Estimate complexity: trivial / moderate / complex",
      "",
      "Be minimal — only change what's necessary. No refactoring beyond the task.",
      "Output as structured text, not code.",
    ].filter(Boolean).join("\n");

    let plan: string;
    try {
      const out = await ctx.callModel({
        kind: planKind,
        system: "You are a senior engineer. Create minimal, precise implementation plans. No fluff.",
        prompt: planPrompt,
        maxTokens: 600,
      });
      plan = out.text.trim();
    } catch (err: any) {
      return { error: `Planning failed: ${err.message}`, step: "plan" };
    }

    if (dryRun) {
      return {
        plan,
        filesRead: Object.keys(fileContents),
        mode: "dry_run",
        step: "plan",
      };
    }

    // Step 3: Implement (uses cheaper model for mechanical work)
    ctx.log("coder.step", { step: "implement" });

    const implPrompt = [
      `Task: ${task}`,
      `Plan:\n${plan}`,
      "",
      contextBlock ? `Current code:\n${contextBlock}` : "",
      "",
      "Implement the plan. For each file, output the COMPLETE file content.",
      "Format: FILE:<path>\n```\n<content>\n```",
      "",
      "Only output files that need changes. Be minimal.",
    ].filter(Boolean).join("\n");

    let implementation: string;
    try {
      const out = await ctx.callModel({
        kind: implKind,
        system: "You are an expert coder. Output only code, no explanations. Minimal, correct, tested.",
        prompt: implPrompt,
        maxTokens: 2000,
      });
      implementation = out.text.trim();
    } catch (err: any) {
      return {
        error: `Implementation failed: ${err.message}`,
        plan,
        step: "implement",
      };
    }

    // Parse FILE: blocks and write them
    const filePattern = /FILE:(.+?)\n```(?:\w*)\n([\s\S]*?)```/g;
    const writtenFiles: string[] = [];
    let match;

    while ((match = filePattern.exec(implementation)) !== null) {
      const filePath = match[1].trim();
      const content = match[2];

      try {
        writeFileSync(filePath, content, "utf8");
        writtenFiles.push(filePath);
        ctx.log("coder.write", { file: filePath, bytes: content.length });
      } catch (err: any) {
        ctx.log("coder.write_fail", { file: filePath, error: err.message });
      }
    }

    // Step 4: Test
    ctx.log("coder.step", { step: "test" });
    let testResult = { ok: true, output: "no test command provided" };

    if (testCmd) {
      testResult = safeExec(testCmd, cwd, 60000);
      ctx.log("coder.test", { ok: testResult.ok, output: testResult.output.slice(0, 500) });
    }

    // Step 5: Summarize
    ctx.log("coder.step", { step: "summarize" });

    const diffResult = safeExec("git diff --stat", cwd);

    return {
      task,
      plan,
      filesWritten: writtenFiles,
      filesRead: Object.keys(fileContents),
      testsPassed: testResult.ok,
      testOutput: testResult.output.slice(0, 1000),
      diff: diffResult.output.slice(0, 1000),
      step: "complete",
    };
  },
};
