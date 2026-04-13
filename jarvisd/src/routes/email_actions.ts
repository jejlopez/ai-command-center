import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendEmail } from "../lib/providers/gmail_send.js";
import { approvals, registerApprovalHandler } from "../lib/approvals.js";
import { audit } from "../lib/audit.js";

const SendBody = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  replyToMessageId: z.string().optional(),
  threadId: z.string().optional(),
  skipApproval: z.boolean().optional().default(false),
});

// Register approval handler so approved emails actually get sent
registerApprovalHandler("gmail.send", async (payload) => {
  const opts = payload as {
    to: string;
    subject: string;
    body: string;
    cc?: string;
    bcc?: string;
    replyToMessageId?: string;
    threadId?: string;
  };
  return sendEmail(opts);
});

export async function emailActionsRoutes(app: FastifyInstance): Promise<void> {
  // POST /email/send
  app.post("/email/send", async (req, reply) => {
    const parsed = SendBody.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return { error: parsed.error.message };
    }

    const { skipApproval, ...emailOpts } = parsed.data;

    if (skipApproval === true) {
      // Send immediately — caller takes responsibility
      try {
        const result = await sendEmail(emailOpts);
        audit({
          actor: "route:email_send",
          action: "email.send.direct",
          subject: result.messageId,
          metadata: { to: emailOpts.to, subject: emailOpts.subject, skipApproval: true },
        });
        return { status: "sent", messageId: result.messageId, threadId: result.threadId };
      } catch (err: any) {
        audit({
          actor: "route:email_send",
          action: "email.send.error",
          reason: err.message,
          metadata: { to: emailOpts.to, subject: emailOpts.subject },
        });
        reply.code(500);
        return { error: err.message };
      }
    }

    // Default: queue for approval
    const isReply = !!emailOpts.replyToMessageId;
    const approval = approvals.enqueue({
      title: isReply
        ? `Reply to thread: ${emailOpts.subject}`
        : `Send email: ${emailOpts.subject}`,
      reason: `Outbound email to ${emailOpts.to}`,
      skill: "gmail.send",
      riskLevel: "low",
      payload: emailOpts as Record<string, unknown>,
    });

    audit({
      actor: "route:email_send",
      action: "email.send.queued",
      subject: approval.id,
      metadata: { to: emailOpts.to, subject: emailOpts.subject, isReply },
    });

    reply.code(202);
    return { status: "pending_approval", approvalId: approval.id };
  });
}
