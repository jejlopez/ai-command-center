import { z } from "zod";
import { listRecentMessages, gmailStatus } from "../providers/gmail.js";
import { approvals } from "../approvals.js";
import { defineTool, type ToolResult } from "./types.js";

// Compose structured filters into a Gmail search query string.
// Gmail query syntax: https://support.google.com/mail/answer/7190
function buildGmailQuery(opts: {
  query?: string;
  from?: string;
  unreadOnly?: boolean;
  since?: string;
  hasAttachments?: boolean;
}): string {
  const parts: string[] = [];
  if (opts.query && opts.query.trim()) parts.push(opts.query.trim());
  if (opts.from && opts.from.trim()) parts.push(`from:${opts.from.trim()}`);
  if (opts.unreadOnly) parts.push("is:unread");
  if (opts.since) parts.push(`after:${opts.since.replaceAll("-", "/")}`); // Gmail expects yyyy/mm/dd
  if (opts.hasAttachments) parts.push("has:attachment");
  // If no filters provided at all, default to recent inbox minus promos
  if (!parts.length) return "in:inbox -category:promotions";
  // Add -category:promotions unless the caller explicitly overrode it
  if (!parts.some((p) => p.includes("category:"))) parts.push("-category:promotions");
  return parts.join(" ");
}

export const searchEmails = defineTool({
  name: "search_emails",
  description:
    "Search the user's Gmail inbox. Compose with any combination of a free-form `query` and structured filters (`from`, `unread_only`, `since`, `has_attachments`). Returns messages with sender, subject, and snippet. Use to find context before drafting, check if a sender already replied, or summarize inbox state. Promotions are filtered by default.",
  inputSchema: z.object({
    query: z
      .string()
      .optional()
      .describe("Free-form Gmail search string (e.g. 'newer_than:7d subject:quote')"),
    from: z
      .string()
      .optional()
      .describe("Filter by sender email or domain (e.g. 'alex@acme.com' or 'acme.com')"),
    unread_only: z.boolean().optional().describe("Only return unread messages"),
    since: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "must be YYYY-MM-DD")
      .optional()
      .describe("Only messages after this date (YYYY-MM-DD)"),
    has_attachments: z.boolean().optional().describe("Only messages with attachments"),
    limit: z.number().int().min(1).max(25).optional().describe("Max messages (default 10)"),
  }),
  anthropicSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Free-form Gmail query" },
      from: { type: "string", description: "Sender email or domain" },
      unread_only: { type: "boolean" },
      since: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      has_attachments: { type: "boolean" },
      limit: { type: "integer", minimum: 1, maximum: 25 },
    },
    additionalProperties: false,
  },
  requiresApproval: false,
  riskLevel: "low",
  async run(input, ctx): Promise<ToolResult> {
    const status = gmailStatus();
    if (!status.linked) {
      return { content: "Gmail not connected. User must link Gmail in Settings.", isError: true };
    }
    const q = buildGmailQuery({
      query: input.query,
      from: input.from,
      unreadOnly: input.unread_only,
      since: input.since,
      hasAttachments: input.has_attachments,
    });
    ctx.log("tool.search_emails", { query: q });
    const msgs = await listRecentMessages(input.limit ?? 10, q);
    if (!msgs.length) return { content: `No emails found for query: ${q}` };
    const lines = msgs.map(
      (m) =>
        `- [${m.id}] ${m.from ?? "(unknown sender)"} — ${m.subject || "(no subject)"} :: ${(m.snippet || "").slice(0, 140)}`
    );
    return { content: `Query: ${q}\n${lines.join("\n")}`, meta: { count: msgs.length, query: q } };
  },
});

export const draftEmail = defineTool({
  name: "draft_email",
  description:
    "Draft an email reply or outreach. REQUIRES USER APPROVAL — the draft is queued for review, not sent. After calling this, tell the user what you drafted and then stop. Do not call further tools for this request.",
  inputSchema: z.object({
    to: z.string().email().describe("Recipient email address"),
    contactName: z.string().optional().describe("Recipient name"),
    subject: z.string().optional().describe("Subject line (generated if omitted)"),
    context: z.string().min(1).describe("What the email is about — the user's instruction"),
    tone: z.enum(["professional", "warm", "brief", "formal"]).optional().describe("Tone (default professional)"),
    dealId: z.string().optional().describe("Pipedrive deal ID to attach"),
    replyToMessageId: z.string().optional().describe("Gmail message ID if this is a reply"),
  }),
  anthropicSchema: {
    type: "object",
    properties: {
      to: { type: "string", format: "email" },
      contactName: { type: "string" },
      subject: { type: "string" },
      context: { type: "string" },
      tone: { type: "string", enum: ["professional", "warm", "brief", "formal"] },
      dealId: { type: "string" },
      replyToMessageId: { type: "string" },
    },
    required: ["to", "context"],
    additionalProperties: false,
  },
  requiresApproval: true,
  riskLevel: "medium",
  async run(input, ctx): Promise<ToolResult> {
    ctx.log("tool.draft_email.enqueue", { to: input.to });
    const approval = approvals.enqueue({
      title: `Draft email to ${input.contactName ?? input.to}`,
      reason: input.context.slice(0, 200),
      skill: "master_email_agent",
      riskLevel: "medium",
      payload: {
        mode: "draft_reply",
        contactEmail: input.to,
        contactName: input.contactName ?? "",
        context: input.context,
        tone: input.tone ?? "professional",
        dealId: input.dealId,
        messageId: input.replyToMessageId,
      },
    });
    return {
      content: `Email draft queued for approval (approval_id=${approval.id}). Tell the user what you proposed and stop — do not call any more tools for this request.`,
      queued: true,
      approvalId: approval.id,
    };
  },
});
