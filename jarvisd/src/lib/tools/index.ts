// Tool registry for the agentic loop. The loop in providers/anthropic.ts
// calls buildAnthropicToolList() to get the Claude-facing tool definitions,
// and findCustomTool(name) to dispatch tool_use blocks back to local runners.

import type { ToolDef } from "./types.js";
import { searchMemory, remember } from "./memory_tools.js";
import { searchEmails, draftEmail } from "./email_tools.js";
import { searchDeals } from "./crm_tools.js";
import { getCalendar } from "./calendar_tools.js";
import { createProposal } from "./proposal_tool.js";
import { buildRunSkillTool } from "./skill_tool.js";

// Anthropic-native server-side tool — Claude runs it, we never see a tool_use
// block for it (it's resolved inside the messages.create call).
// TODO(phase-later): upgrade @anthropic-ai/sdk (currently 0.88.0) and move to
// `web_search_20260209` + `web_fetch_20260209` for dynamic filtering support.
export const ANTHROPIC_NATIVE_TOOLS = [
  { type: "web_search_20250305" as const, name: "web_search" as const, max_uses: 3 },
];

/**
 * Build the client-executed tool list. Called per agentic loop so run_skill's
 * description reflects the currently registered skills.
 */
export function buildCustomTools(): ToolDef[] {
  return [
    searchMemory,
    remember,
    searchEmails,
    draftEmail,
    searchDeals,
    getCalendar,
    createProposal,
    buildRunSkillTool(),
  ];
}

/** Look up a custom tool by name (for dispatching a tool_use block). */
export function findCustomTool(name: string): ToolDef | null {
  return buildCustomTools().find((t) => t.name === name) ?? null;
}

/** Convert a custom ToolDef into the Anthropic API tool-definition shape. */
export function toAnthropicTool(def: ToolDef) {
  return {
    name: def.name,
    description: def.description,
    input_schema: def.anthropicSchema,
  };
}

/** Full tool list for `messages.create({ tools })` / `.stream({ tools })`. */
export function buildAnthropicToolList() {
  const custom = buildCustomTools().map(toAnthropicTool);
  return [...custom, ...ANTHROPIC_NATIVE_TOOLS];
}

export type { ToolDef, ToolResult, ToolContext } from "./types.js";
