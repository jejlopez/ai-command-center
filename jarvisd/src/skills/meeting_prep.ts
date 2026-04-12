// meeting_prep — pulls facts from memory and drafts briefing notes for the
// user's next (or specified) meeting.

import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "meeting_prep",
  title: "Meeting prep",
  description: "Prepare context for your next meeting.",
  version: "0.1.0",
  scopes: ["memory.read", "llm.cloud"],
  routerHint: "complex_reasoning",
  triggers: [{ kind: "manual" }],
  inputs: [
    {
      name: "topic",
      type: "string",
      required: false,
      description: "Specific meeting topic to prep for",
    },
  ],
};

export const meetingPrep: Skill = {
  manifest,
  async run(ctx) {
    const topicRaw = ctx.inputs["topic"];
    const topic =
      typeof topicRaw === "string" && topicRaw.trim().length > 0
        ? topicRaw.trim()
        : "next meeting";

    const recalled = await ctx.memory.recall({
      q: topic,
      enhanced: true,
      limit: 10,
    });

    const facts = recalled.compiled || "(no facts in memory)";
    const prompt = [
      `You are preparing briefing notes for a meeting about ${topic}. Based on the facts below, write:`,
      "(1) who's involved",
      "(2) recent history",
      "(3) 3 good questions to ask",
      "(4) what to avoid",
      "",
      "Facts:",
      facts,
    ].join("\n");

    try {
      const out = await ctx.callModel({
        kind: "complex_reasoning",
        system:
          "You are JARVIS, the user's chief of staff. Produce tight, useful meeting prep notes. No fluff.",
        prompt,
        maxTokens: 600,
      });
      return {
        text: out.text.trim(),
        facts: recalled.hits?.length ?? recalled.nodes.length ?? 0,
        topic,
        model: out.model,
        costUsd: out.costUsd,
      };
    } catch (err: any) {
      ctx.log("meeting_prep.model.fail", { error: err?.message ?? String(err) });
      return {
        text: `Could not reach the model. ${recalled.nodes.length} relevant facts in memory for "${topic}".`,
        facts: recalled.nodes.length,
        topic,
        fallback: true,
      };
    }
  },
};
