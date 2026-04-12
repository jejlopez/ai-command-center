// doc_summarize — turn a blob of text into 3 bullets + a 1-line TL;DR.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "doc_summarize",
  title: "Doc summarize",
  description: "Summarize arbitrary document text into 3 bullets and a TL;DR.",
  version: "0.1.0",
  scopes: ["llm.cloud"],
  routerHint: "summary",
  triggers: [{ kind: "manual" }],
  inputs: [
    {
      name: "text",
      type: "string",
      required: true,
      description: "Document text to summarize",
    },
  ],
};

export const docSummarize: Skill = {
  manifest,
  async run(ctx) {
    const raw = ctx.inputs["text"];
    if (typeof raw !== "string" || raw.trim().length === 0) {
      throw new Error("text input is required");
    }
    const text = raw;

    try {
      const out = await ctx.callModel({
        kind: "summary",
        system: "Summarize this in 3 bullets + a 1-line TL;DR.",
        prompt: text,
        maxTokens: 400,
      });
      return {
        text: out.text.trim(),
        charsIn: text.length,
        model: out.model,
        costUsd: out.costUsd,
      };
    } catch (err: any) {
      ctx.log("doc_summarize.model.fail", {
        error: err?.message ?? String(err),
      });
      return {
        text: `Summary unavailable (model call failed). Input length: ${text.length} chars.`,
        charsIn: text.length,
        fallback: true,
      };
    }
  },
};
