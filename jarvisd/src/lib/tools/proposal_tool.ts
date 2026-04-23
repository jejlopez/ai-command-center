import { z } from "zod";
import { approvals } from "../approvals.js";
import { defineTool, type ToolResult } from "./types.js";

export const createProposal = defineTool({
  name: "create_proposal",
  description:
    "Generate a 3PL pricing proposal from deal volume data using the user's pricing playbook. REQUIRES APPROVAL — the proposal is queued for review before being attached to the deal. Needs at least (dealId) or (clientName + volume numbers). After calling this, tell the user what you proposed and stop.",
  inputSchema: z
    .object({
      dealId: z.string().optional().describe("Pipedrive deal ID if for an existing deal"),
      clientName: z.string().optional().describe("Client / org name (required if no dealId)"),
      contactEmail: z.string().email().optional(),
      pallets: z.number().nonnegative().optional().describe("Monthly pallet storage"),
      palletsIn: z.number().nonnegative().optional().describe("Monthly pallets received"),
      orders: z.number().nonnegative().optional().describe("Monthly orders"),
      picksPerOrder: z.number().positive().optional().describe("Avg picks per order (default 3)"),
      productType: z.string().optional().describe("Product category"),
      fulfillmentType: z
        .enum(["b2c", "b2b", "mixed"])
        .optional()
        .describe("Fulfillment type (default b2c)"),
    })
    .refine((d) => d.dealId || d.clientName, {
      message: "Either dealId or clientName is required",
    }),
  anthropicSchema: {
    type: "object",
    properties: {
      dealId: { type: "string" },
      clientName: { type: "string" },
      contactEmail: { type: "string", format: "email" },
      pallets: { type: "number", minimum: 0 },
      palletsIn: { type: "number", minimum: 0 },
      orders: { type: "number", minimum: 0 },
      picksPerOrder: { type: "number", exclusiveMinimum: 0 },
      productType: { type: "string" },
      fulfillmentType: { type: "string", enum: ["b2c", "b2b", "mixed"] },
    },
    additionalProperties: false,
  },
  requiresApproval: true,
  riskLevel: "medium",
  async run(input, ctx): Promise<ToolResult> {
    ctx.log("tool.create_proposal.enqueue", {
      dealId: input.dealId,
      clientName: input.clientName,
    });
    const approval = approvals.enqueue({
      title: `Proposal: ${input.clientName ?? input.dealId}`,
      reason: `Pricing proposal (pallets=${input.pallets ?? 0}, orders=${input.orders ?? 0})`,
      skill: "proposal_generator",
      riskLevel: "medium",
      payload: { ...input },
    });
    return {
      content: `Proposal queued for approval (approval_id=${approval.id}). Tell the user what you proposed and stop.`,
      queued: true,
      approvalId: approval.id,
    };
  },
});
