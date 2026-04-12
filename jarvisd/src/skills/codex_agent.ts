// codex_agent — delegates coding tasks to OpenAI Codex CLI.
// JARVIS acts as the manager, Codex acts as the engineer.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";
import { callCodex, codexReview, isCodexAvailable } from "../lib/providers/codex.js";

const manifest: SkillManifest = {
  name: "codex_agent",
  title: "Codex Agent",
  description: "Delegate coding tasks to OpenAI Codex — code generation, refactoring, debugging, and code review.",
  version: "0.1.0",
  scopes: ["llm.cloud"],
  routerHint: "routine_code",
  triggers: [{ kind: "manual" }],
  inputs: [
    { name: "task", type: "string", required: true, description: "What to build, fix, or review" },
    { name: "mode", type: "string", required: false, description: "code (default), review, or debug" },
    { name: "model", type: "string", required: false, description: "Codex model: o4-mini (default), o3, gpt-4o" },
    { name: "cwd", type: "string", required: false, description: "Working directory (defaults to project root)" },
  ],
};

export const codexAgent: Skill = {
  manifest,
  async run(ctx) {
    const task = String(ctx.inputs["task"] ?? "");
    if (!task.trim()) return { error: "No task provided" };

    const mode = String(ctx.inputs["mode"] ?? "code");
    const model = String(ctx.inputs["model"] ?? "o4-mini");
    const cwd = ctx.inputs["cwd"] ? String(ctx.inputs["cwd"]) : undefined;

    // Check if codex is available
    const available = await isCodexAvailable();
    if (!available) {
      return { error: "Codex CLI not found. Install with: npm i -g @openai/codex" };
    }

    ctx.log("codex_agent.start", { mode, model, task: task.slice(0, 100) });

    try {
      if (mode === "review") {
        const out = await codexReview({ cwd, timeoutMs: 180_000 });
        return {
          text: out.text,
          mode: "review",
          exitCode: out.exitCode,
          model: out.model,
        };
      }

      // Enrich the prompt with memory context
      let enrichedTask = task;
      try {
        const recalled = await ctx.memory.recall({ q: task, limit: 5 });
        if (recalled.compiled && recalled.compiled.length > 20) {
          enrichedTask = [
            task,
            "",
            "Context from memory:",
            recalled.compiled,
          ].join("\n");
        }
      } catch { /* memory recall is best-effort */ }

      const out = await callCodex({
        prompt: enrichedTask,
        model,
        cwd,
        timeoutMs: 180_000,
      });

      return {
        text: out.text,
        mode,
        exitCode: out.exitCode,
        model: out.model,
      };
    } catch (err: any) {
      ctx.log("codex_agent.fail", { error: err?.message ?? String(err) });
      return {
        error: err?.message ?? String(err),
        mode,
        model,
      };
    }
  },
};
