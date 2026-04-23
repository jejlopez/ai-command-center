import { z } from "zod";
import { registry } from "../skills.js";
import { runSkill } from "../workflow.js";
import { defineTool, type ToolDef, type ToolResult } from "./types.js";

// Skills that have first-class tools — route those through the dedicated tool
// instead of through run_skill.
const RESERVED = new Set(["master_email_agent", "proposal_generator"]);

function allowedSkillNames(): string[] {
  return registry.list().map((m) => m.name).filter((n) => !RESERVED.has(n));
}

function skillMenu(): string {
  // Sort alphabetically — registry.list() preserves insertion order, which
  // is deterministic within a daemon lifetime but drifts if skills get
  // registered in a different order on restart. Sorting keeps the prompt
  // cache stable across restarts.
  const items = registry
    .list()
    .filter((m) => !RESERVED.has(m.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (!items.length) return "(no skills registered yet)";
  return items.map((m) => `- ${m.name}: ${m.description}`).join("\n");
}

const BASE_DESCRIPTION =
  "Run a registered Jarvis skill by name. Use this only when no first-class tool fits (email → draft_email; proposals → create_proposal; memory → search_memory/remember; calendar → get_calendar; deals → search_deals).\n\nAvailable skills (name: description):\n{{SKILL_MENU}}";

const runSkillTool = defineTool({
  name: "run_skill",
  description: BASE_DESCRIPTION,
  inputSchema: z.object({
    name: z
      .string()
      .min(1)
      .describe("Skill name. Must be one of the registered skills listed in the description."),
    inputs: z
      .record(z.unknown())
      .optional()
      .describe("Skill-specific input object. See each skill's manifest.inputs."),
  }),
  anthropicSchema: {
    type: "object",
    properties: {
      name: { type: "string" },
      inputs: { type: "object", additionalProperties: true },
    },
    required: ["name"],
    additionalProperties: false,
  },
  requiresApproval: false,
  riskLevel: "medium",
  async run(input, ctx): Promise<ToolResult> {
    if (!allowedSkillNames().includes(input.name)) {
      return {
        content: `Unknown or reserved skill: "${input.name}". First-class tools exist for email drafting (draft_email) and proposals (create_proposal). Other available: ${allowedSkillNames().join(", ") || "(none)"}.`,
        isError: true,
      };
    }
    ctx.log("tool.run_skill", { name: input.name });
    const run = await runSkill(input.name, {
      inputs: (input.inputs as Record<string, unknown>) ?? {},
      triggeredBy: "manual",
    });
    if (run.status !== "completed") {
      return {
        content: `Skill ${input.name} ${run.status}: ${run.error ?? "(no error message)"}`,
        isError: true,
      };
    }
    const preview =
      typeof run.output === "string"
        ? run.output
        : JSON.stringify(run.output ?? {}, null, 2).slice(0, 4000);
    return { content: preview, costUsd: run.costUsd, meta: { runId: run.id } };
  },
});

/**
 * Build the run_skill tool with the menu of available skills baked into its
 * description. Call per-request so the menu reflects the current registry.
 */
export function buildRunSkillTool(): ToolDef {
  return {
    ...runSkillTool,
    description: BASE_DESCRIPTION.replace("{{SKILL_MENU}}", skillMenu()),
  };
}
