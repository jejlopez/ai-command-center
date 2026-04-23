import { z } from "zod";
import { memory } from "../memory.js";
import { defineTool, type ToolResult } from "./types.js";

const NODE_KINDS = ["person", "project", "task", "fact", "event", "pref"] as const;

export const searchMemory = defineTool({
  name: "search_memory",
  description:
    "Search Jarvis's long-term memory (people, projects, facts, preferences) using hybrid vector + text + graph search. Returns compiled facts relevant to the query. Use this BEFORE answering questions about the user's contacts, deals, projects, or preferences — it's how you recall what you know across conversations.",
  inputSchema: z.object({
    query: z.string().min(1).describe("Natural-language query"),
    kinds: z.array(z.enum(NODE_KINDS)).optional().describe("Filter by node kind"),
    limit: z.number().int().min(1).max(20).optional().describe("Max nodes (default 5)"),
  }),
  anthropicSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Natural-language query" },
      kinds: {
        type: "array",
        items: { type: "string", enum: [...NODE_KINDS] },
        description: "Optional kind filter",
      },
      limit: { type: "integer", minimum: 1, maximum: 20, description: "Max nodes (default 5)" },
    },
    required: ["query"],
    additionalProperties: false,
  },
  requiresApproval: false,
  riskLevel: "low",
  async run(input, ctx): Promise<ToolResult> {
    ctx.log("tool.search_memory", { query: input.query });
    const result = await memory.recall({
      q: input.query,
      kinds: input.kinds,
      limit: input.limit ?? 5,
      maxTokens: 2000,
    });
    if (!result.compiled) return { content: "No relevant memories found." };
    return {
      content: result.compiled,
      meta: { nodeCount: result.nodes.length, tokenEstimate: result.tokenEstimate },
    };
  },
});

export const remember = defineTool({
  name: "remember",
  description:
    "Save a new fact, person, preference, or event into Jarvis's long-term memory. Use when the user shares something worth remembering across conversations — not for single-turn context.",
  inputSchema: z.object({
    kind: z.enum(NODE_KINDS).describe("Node kind"),
    label: z.string().min(1).max(200).describe("Short identifier"),
    body: z.string().max(4000).optional().describe("Full content of the memory"),
    trust: z.number().min(0).max(1).optional().describe("Confidence 0..1 (default 0.5)"),
  }),
  anthropicSchema: {
    type: "object",
    properties: {
      kind: { type: "string", enum: [...NODE_KINDS] },
      label: { type: "string", maxLength: 200 },
      body: { type: "string", maxLength: 4000 },
      trust: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["kind", "label"],
    additionalProperties: false,
  },
  requiresApproval: false,
  riskLevel: "low",
  async run(input, ctx): Promise<ToolResult> {
    ctx.log("tool.remember", { kind: input.kind, label: input.label });
    const node = memory.remember(input);
    return { content: `Remembered (${input.kind}): ${input.label} [id=${node.id}]` };
  },
});
