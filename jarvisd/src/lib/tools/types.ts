// Agentic tool-use types. Each tool is a Zod-validated function Claude can call
// during the manual agentic loop in providers/anthropic.ts.

import type { z } from "zod";

export interface ToolContext {
  runId: string;
  log: (msg: string, meta?: Record<string, unknown>) => void;
}

export interface ToolResult {
  content: string;
  isError?: boolean;
  queued?: boolean;
  approvalId?: string;
  costUsd?: number;
  meta?: Record<string, unknown>;
}

export interface AnthropicInputSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: false | true;
  // Open index signature so the shape is assignable to Anthropic's Tool.InputSchema
  // without casting at the call site.
  [key: string]: unknown;
}

/**
 * Uniform tool definition. The run function accepts `unknown` so the array of
 * tools is contravariantly sound; the real per-tool typing lives inside
 * `defineTool()` below, which validates input via the Zod schema before
 * delegating to the typed implementation.
 */
export interface ToolDef {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  anthropicSchema: AnthropicInputSchema;
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high";
  run: (input: unknown, ctx: ToolContext) => Promise<ToolResult>;
}

/**
 * Define a tool with full TypeScript inference on the run function's input.
 * The returned ToolDef validates incoming tool_use input via the Zod schema
 * at call time, so malformed input from Claude throws a ZodError which the
 * loop catches and returns as an error tool_result.
 */
export function defineTool<S extends z.ZodTypeAny>(def: {
  name: string;
  description: string;
  inputSchema: S;
  anthropicSchema: AnthropicInputSchema;
  requiresApproval: boolean;
  riskLevel: "low" | "medium" | "high";
  run: (input: z.infer<S>, ctx: ToolContext) => Promise<ToolResult>;
}): ToolDef {
  return {
    name: def.name,
    description: def.description,
    inputSchema: def.inputSchema,
    anthropicSchema: def.anthropicSchema,
    requiresApproval: def.requiresApproval,
    riskLevel: def.riskLevel,
    run: (input, ctx) => def.run(def.inputSchema.parse(input), ctx),
  };
}
