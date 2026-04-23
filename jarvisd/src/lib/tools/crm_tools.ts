import { z } from "zod";
import { getDeals, isPipedriveConnected } from "../providers/pipedrive.js";
import { defineTool, type ToolResult } from "./types.js";

export const searchDeals = defineTool({
  name: "search_deals",
  description:
    "Search the user's CRM deals (Pipedrive synced into local DB). Returns deals matching a text query, filtered by status. Use before answering deal-specific questions or drafting outreach.",
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe("Substring match against org name, title, or contact. Omit for top open deals."),
    status: z.enum(["open", "won", "lost", "all"]).optional().describe("Deal status (default open)"),
    limit: z.number().int().min(1).max(50).optional().describe("Max deals (default 10)"),
  }),
  anthropicSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Substring match on org/title/contact" },
      status: { type: "string", enum: ["open", "won", "lost", "all"] },
      limit: { type: "integer", minimum: 1, maximum: 50 },
    },
    additionalProperties: false,
  },
  requiresApproval: false,
  riskLevel: "low",
  async run(input, ctx): Promise<ToolResult> {
    if (!isPipedriveConnected()) {
      return { content: "Pipedrive not connected.", isError: true };
    }
    const status = input.status ?? "open";
    ctx.log("tool.search_deals", { query: input.query, status });
    const deals = getDeals(undefined, status === "all" ? undefined : status);
    const needle = (input.query ?? "").toLowerCase().trim();
    const filtered = needle
      ? deals.filter((d: any) =>
          [d.org_name, d.title, d.contact_name, d.contact_email]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(needle)
        )
      : deals;
    const sliced = filtered.slice(0, input.limit ?? 10);
    if (!sliced.length) {
      return { content: `No deals matched query="${input.query ?? ""}" status=${status}.` };
    }
    const lines = sliced.map(
      (d: any) =>
        `- [${d.id}] ${d.org_name || d.title} — ${d.stage} — $${Math.round(d.value || 0).toLocaleString()} — ${d.contact_name || ""}`
    );
    return { content: lines.join("\n"), meta: { total: filtered.length } };
  },
});
