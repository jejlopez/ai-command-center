// research_brief — takes a topic, pulls memory, and produces a structured brief.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "research_brief",
  title: "Research Brief",
  description: "Generate a structured research brief on any topic using memory and reasoning.",
  version: "0.1.0",
  scopes: ["memory.read", "llm.cloud"],
  routerHint: "complex_reasoning",
  triggers: [{ kind: "manual" }],
  inputs: [
    { name: "topic", type: "string", required: true, description: "Topic to research" },
    { name: "depth", type: "string", required: false, description: "quick, standard, or deep" },
  ],
};

export const researchBrief: Skill = {
  manifest,
  async run(ctx) {
    const topic = String(ctx.inputs["topic"] ?? "");
    if (!topic.trim()) return { error: "No topic provided" };

    const depth = String(ctx.inputs["depth"] ?? "standard");
    const maxTokens = depth === "deep" ? 1200 : depth === "quick" ? 300 : 600;

    const recalled = await ctx.memory.recall({
      q: topic,
      enhanced: true,
      limit: depth === "deep" ? 20 : 10,
    });

    const facts = recalled.compiled || "(no facts in memory)";
    const hitCount = recalled.hits?.length ?? recalled.nodes.length;

    const prompt = [
      `Write a ${depth} research brief on: ${topic}`,
      "",
      "Structure:",
      "## Summary (2-3 sentences)",
      "## What We Know (from memory)",
      "## Key Questions (what we don't know yet)",
      "## Recommended Next Steps",
      "",
      "Facts from memory:",
      facts,
      "",
      `Depth: ${depth}. ${depth === "quick" ? "Keep it tight." : depth === "deep" ? "Be thorough." : "Balance depth and brevity."}`,
    ].join("\n");

    try {
      const out = await ctx.callModel({
        kind: "complex_reasoning",
        system: "You are JARVIS, producing a research brief. Use the provided facts as your primary source. Be analytical, not generic.",
        prompt,
        maxTokens,
      });
      return {
        brief: out.text.trim(),
        topic,
        depth,
        factsUsed: hitCount,
        model: out.model,
        costUsd: out.costUsd,
      };
    } catch (err: any) {
      return {
        brief: `Could not generate brief. ${hitCount} relevant facts found for "${topic}".`,
        topic,
        depth,
        factsUsed: hitCount,
        fallback: true,
      };
    }
  },
};
