// Reviewer sub-agent — validates Coder output.
//
// Reads the diff, checks spec compliance, code quality, test coverage.
// Starts at Haiku (pattern matching is cheap), escalates if complex.
// Returns typed verdict: approve / request_changes / reject.

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "reviewer_agent",
  title: "Reviewer Agent",
  description: "Code review: reads diffs, validates spec compliance, checks quality. Cheap by default.",
  version: "0.1.0",
  scopes: ["llm.cloud", "llm.local", "fs.vault.read"],
  routerHint: "summary",
  triggers: [{ kind: "manual" }],
  inputs: [
    { name: "spec", type: "string", required: false, description: "The original task spec to review against" },
    { name: "files", type: "string", required: false, description: "Comma-separated file paths to review" },
    { name: "cwd", type: "string", required: false, description: "Working directory for git diff" },
    { name: "coderOutput", type: "string", required: false, description: "JSON output from coder_agent to review" },
  ],
};

function safeExec(cmd: string, cwd?: string): string {
  try {
    return execSync(cmd, {
      cwd: cwd ?? process.cwd(),
      timeout: 15000,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).slice(0, 6000);
  } catch (err: any) {
    return (err.stdout ?? "").slice(0, 3000);
  }
}

export const reviewerAgent: Skill = {
  manifest: {
    ...manifest,
    costTier: "cheap",
    escalationTier: "standard",
    maxRetries: 0,
  } as any,

  async run(ctx) {
    const cwd = ctx.inputs["cwd"] ? String(ctx.inputs["cwd"]) : process.cwd();
    const spec = ctx.inputs["spec"] ? String(ctx.inputs["spec"]) : undefined;
    const tier = String(ctx.inputs["_tier"] ?? "cheap");

    const reviewKind = tier === "premium" ? "complex_reasoning" as const : tier === "standard" ? "chat" as const : "summary" as const;

    // Collect diff
    ctx.log("reviewer.step", { step: "collect_diff" });
    const diff = safeExec("git diff", cwd);
    const diffStat = safeExec("git diff --stat", cwd);

    if (!diff.trim()) {
      return {
        verdict: "no_changes",
        message: "No changes to review.",
        step: "complete",
      };
    }

    // Collect file contents if specified
    const filePaths = ctx.inputs["files"]
      ? String(ctx.inputs["files"]).split(",").map(f => f.trim())
      : [];

    const fileContents: Record<string, string> = {};
    for (const fp of filePaths) {
      try {
        if (existsSync(fp)) fileContents[fp] = readFileSync(fp, "utf8").slice(0, 3000);
      } catch { /* skip */ }
    }

    // Parse coder output if provided
    let coderSummary = "";
    if (ctx.inputs["coderOutput"]) {
      try {
        const co = typeof ctx.inputs["coderOutput"] === "string"
          ? JSON.parse(ctx.inputs["coderOutput"])
          : ctx.inputs["coderOutput"];
        coderSummary = [
          `Task: ${co.task}`,
          `Plan: ${co.plan}`,
          `Files written: ${co.filesWritten?.join(", ")}`,
          `Tests passed: ${co.testsPassed}`,
        ].join("\n");
      } catch { /* ignore */ }
    }

    // Review prompt
    ctx.log("reviewer.step", { step: "review" });

    const prompt = [
      "Review this code change. Be specific and actionable.",
      "",
      spec ? `Original spec:\n${spec}` : "",
      "",
      `Diff stats:\n${diffStat}`,
      "",
      `Full diff:\n${diff.slice(0, 4000)}`,
      "",
      coderSummary ? `Coder's summary:\n${coderSummary}` : "",
      "",
      Object.keys(fileContents).length > 0
        ? `File contents:\n${Object.entries(fileContents).map(([p, c]) => `--- ${p} ---\n${c}`).join("\n\n")}`
        : "",
      "",
      "Evaluate:",
      "1. SPEC COMPLIANCE — does the change match the spec? Anything missing or extra?",
      "2. CORRECTNESS — any bugs, edge cases, or logic errors?",
      "3. SECURITY — any injection, leaks, or unsafe patterns?",
      "4. QUALITY — naming, structure, DRY, unnecessary complexity?",
      "5. TESTS — are there tests? Do they cover the important cases?",
      "",
      "Verdict: APPROVE, REQUEST_CHANGES, or REJECT",
      "For REQUEST_CHANGES, list specific items to fix.",
      "",
      "Format your response as:",
      "VERDICT: <approve|request_changes|reject>",
      "SUMMARY: <1-2 sentences>",
      "ISSUES:",
      "- <issue 1>",
      "- <issue 2>",
    ].filter(Boolean).join("\n");

    try {
      const out = await ctx.callModel({
        kind: reviewKind,
        system: "You are a strict code reviewer. Be specific. No filler. Catch real bugs, not style preferences.",
        prompt,
        maxTokens: 600,
      });

      const text = out.text.trim();

      // Parse verdict
      const verdictMatch = text.match(/VERDICT:\s*(approve|request_changes|reject)/i);
      const verdict = verdictMatch
        ? verdictMatch[1].toLowerCase()
        : text.toLowerCase().includes("approve") ? "approve" : "request_changes";

      const summaryMatch = text.match(/SUMMARY:\s*(.+)/i);
      const summary = summaryMatch ? summaryMatch[1].trim() : text.split("\n")[0];

      const issuesMatch = text.match(/ISSUES:\s*\n([\s\S]*)/i);
      const issues = issuesMatch
        ? issuesMatch[1].split("\n").filter(l => l.trim().startsWith("-")).map(l => l.trim().slice(2))
        : [];

      return {
        verdict,
        summary,
        issues,
        diffLines: diff.split("\n").length,
        filesChanged: diffStat.split("\n").filter(l => l.includes("|")).length,
        model: out.model,
        costUsd: out.costUsd,
        step: "complete",
      };
    } catch (err: any) {
      return {
        verdict: "error",
        summary: `Review failed: ${err.message}`,
        issues: [],
        step: "review_failed",
      };
    }
  },
};
