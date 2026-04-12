// draft_reply — given email/message context, drafts a concise reply.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "draft_reply",
  title: "Draft Reply",
  description: "Draft a reply to an email or message using memory context.",
  version: "0.1.0",
  scopes: ["memory.read", "llm.cloud"],
  routerHint: "chat",
  triggers: [{ kind: "manual" }],
  inputs: [
    { name: "message", type: "string", required: true, description: "The message to reply to" },
    { name: "tone", type: "string", required: false, description: "Tone: professional, friendly, brief" },
    { name: "context", type: "string", required: false, description: "Extra context or instructions" },
  ],
};

export const draftReply: Skill = {
  manifest,
  async run(ctx) {
    const message = String(ctx.inputs["message"] ?? "");
    if (!message.trim()) return { error: "No message provided" };

    const tone = String(ctx.inputs["tone"] ?? "professional");
    const extra = ctx.inputs["context"] ? String(ctx.inputs["context"]) : "";

    const recalled = await ctx.memory.recall({ q: message, limit: 5 });
    const facts = recalled.compiled || "(no relevant memory)";

    const prompt = [
      `Draft a ${tone} reply to this message:`,
      "",
      message,
      "",
      "Relevant context from memory:",
      facts,
      extra ? `\nAdditional instructions: ${extra}` : "",
      "",
      "Write ONLY the reply text, ready to send. No meta-commentary.",
    ].join("\n");

    try {
      const out = await ctx.callModel({
        kind: "chat",
        system: "You are JARVIS, drafting replies on behalf of the user. Match the requested tone. Be concise.",
        prompt,
        maxTokens: 400,
      });
      return { draft: out.text.trim(), tone, model: out.model, costUsd: out.costUsd };
    } catch (err: any) {
      return { error: err?.message ?? String(err), fallback: true };
    }
  },
};
