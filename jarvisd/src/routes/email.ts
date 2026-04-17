// Email routes — triage results, draft management, approval send.
// Every send goes through the approval gateway.

import type { FastifyInstance } from "fastify";
import { db } from "../db/db.js";
import { checkAction, validateApproval, listPendingApprovals } from "../lib/approval_gateway.js";
import { createDraft, updateDraft, sendDraft, getMessage, getThread, markAsRead, gmailConnectionStatus } from "../lib/providers/gmail_actions.js";
import { audit } from "../lib/audit.js";

export async function emailRoutes(app: FastifyInstance) {
  // --- Connection status (for frontend status dot) ---

  app.get("/email/connection-status", async () => {
    const gmail = gmailConnectionStatus();
    return { gmail, connected: gmail === "connected" };
  });

  // --- Triage results ---

  app.get("/email/triage", async (req) => {
    const { category, limit } = req.query as any;
    const l = Math.min(Number(limit ?? 50), 200);
    if (category) {
      return db.prepare(
        "SELECT * FROM email_triage WHERE category = ? ORDER BY created_at DESC LIMIT ?"
      ).all(category, l);
    }
    return db.prepare(
      "SELECT * FROM email_triage ORDER BY created_at DESC LIMIT ?"
    ).all(l);
  });

  app.get("/email/triage/stats", async () => {
    const rows = db.prepare(
      "SELECT category, COUNT(*) as count FROM email_triage GROUP BY category"
    ).all() as any[];
    return rows.reduce((acc: any, r: any) => { acc[r.category] = r.count; return acc; }, {});
  });

  // --- Single message (full body from Gmail API) ---

  app.get<{ Params: { messageId: string } }>("/email/message/:messageId", async (req, reply) => {
    try {
      const msg = await getMessage((req.params as any).messageId);
      // Attach linked deal/lead from triage table if present
      const triage = db.prepare(
        "SELECT id, category, draft_id FROM email_triage WHERE message_id = ?"
      ).get((req.params as any).messageId) as any;
      return { ...msg, triage: triage ?? null };
    } catch (err: any) {
      return reply.code(502).send({ error: `Gmail fetch failed: ${err.message}` });
    }
  });

  // --- Full thread (all messages in a thread) ---

  app.get<{ Params: { threadId: string } }>("/email/thread/:threadId", async (req, reply) => {
    try {
      const messages = await getThread((req.params as any).threadId);
      return { messages };
    } catch (err: any) {
      return reply.code(502).send({ error: `Gmail thread fetch failed: ${err.message}` });
    }
  });

  // --- Mark as read ---

  app.post<{ Params: { messageId: string } }>("/email/message/:messageId/read", async (req, reply) => {
    try {
      await markAsRead((req.params as any).messageId);
      return { ok: true };
    } catch (err: any) {
      return reply.code(502).send({ error: `Mark read failed: ${err.message}` });
    }
  });

  // --- Send now (create draft + send immediately) ---

  app.post("/email/send-now", async (req, reply) => {
    const { to, subject, body, threadId } = req.body as any;
    if (!to || !subject || !body) {
      return reply.code(400).send({ error: "to, subject, body required" });
    }
    try {
      const draft = await createDraft(to, subject, body, threadId);
      // Auto-approve for send-now (user already clicked Send Now)
      const gate = checkAction("send_email", draft.draftId);
      const result = await sendDraft(draft.draftId, gate.approvalToken ?? "");
      audit({
        actor: "user",
        action: "gmail.send_now",
        subject: result.messageId,
        metadata: { to, subject: subject.slice(0, 80) },
      });
      return { ok: true, messageId: result.messageId };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // --- Drafts ---

  app.get("/email/drafts", async (req) => {
    const { status, limit } = req.query as any;
    const l = Math.min(Number(limit ?? 20), 100);
    if (status) {
      return db.prepare(
        "SELECT * FROM email_drafts WHERE status = ? ORDER BY created_at DESC LIMIT ?"
      ).all(status, l);
    }
    return db.prepare(
      "SELECT * FROM email_drafts ORDER BY created_at DESC LIMIT ?"
    ).all(l);
  });

  app.get<{ Params: { id: string } }>("/email/drafts/:id", async (req, reply) => {
    const row = db.prepare("SELECT * FROM email_drafts WHERE id = ?").get((req.params as any).id);
    if (!row) return reply.code(404).send({ error: "Draft not found" });
    return row;
  });

  // Create a draft (JARVIS or user-initiated)
  app.post("/email/drafts", async (req, reply) => {
    const { to, subject, body, threadId } = req.body as any;
    if (!to || !subject || !body) {
      return reply.code(400).send({ error: "to, subject, body required" });
    }

    try {
      const gmail = await createDraft(to, subject, body, threadId);
      const id = crypto.randomUUID();

      db.prepare(
        `INSERT INTO email_drafts(id, gmail_draft_id, thread_id, to_addr, subject, body_original, status)
         VALUES (?, ?, ?, ?, ?, ?, 'review_needed')`
      ).run(id, gmail.draftId, threadId ?? null, to, subject, body);

      return { id, gmailDraftId: gmail.draftId, status: "review_needed" };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // Update draft (user edits)
  app.put<{ Params: { id: string } }>("/email/drafts/:id", async (req, reply) => {
    const draft = db.prepare("SELECT * FROM email_drafts WHERE id = ?").get((req.params as any).id) as any;
    if (!draft) return reply.code(404).send({ error: "Draft not found" });

    const { subject, body } = req.body as any;
    const editedBody = body ?? draft.body_original;
    const editedSubject = subject ?? draft.subject;

    // Update in Gmail if draft exists there
    if (draft.gmail_draft_id) {
      try {
        await updateDraft(draft.gmail_draft_id, draft.to_addr, editedSubject, editedBody);
      } catch (err: any) {
        // Gmail update failed — still save locally
        audit({ actor: "user", action: "gmail.draft.update_fail", subject: draft.id, reason: err.message });
      }
    }

    // Capture edit feedback
    const subjectChanged = editedSubject !== draft.subject ? 1 : 0;
    const shortened = editedBody.length < draft.body_original.length ? 1 : 0;

    db.prepare(
      `UPDATE email_drafts SET body_edited = ?, subject = ?, status = 'review_needed', updated_at = datetime('now') WHERE id = ?`
    ).run(editedBody, editedSubject, draft.id);

    // Record structured edit feedback
    db.prepare(
      `INSERT INTO draft_edit_feedback(draft_id, draft_type, subject_changed, shortened, original_length, edited_length)
       VALUES (?, 'email', ?, ?, ?, ?)`
    ).run(draft.id, subjectChanged, shortened, draft.body_original.length, editedBody.length);

    return { ok: true, status: "review_needed" };
  });

  // Approve a draft (generates approval token)
  app.post<{ Params: { id: string } }>("/email/drafts/:id/approve", async (req, reply) => {
    const draft = db.prepare("SELECT * FROM email_drafts WHERE id = ?").get((req.params as any).id) as any;
    if (!draft) return reply.code(404).send({ error: "Draft not found" });

    const gate = checkAction("send_email", draft.id);

    db.prepare("UPDATE email_drafts SET status = 'approved', approved_at = datetime('now') WHERE id = ?").run(draft.id);

    return { ok: true, status: "approved", approvalToken: gate.approvalToken, expiresIn: 300 };
  });

  // Send a draft (REQUIRES approval token)
  app.post<{ Params: { id: string } }>("/email/drafts/:id/send", async (req, reply) => {
    const draft = db.prepare("SELECT * FROM email_drafts WHERE id = ?").get((req.params as any).id) as any;
    if (!draft) return reply.code(404).send({ error: "Draft not found" });
    if (!draft.gmail_draft_id) return reply.code(400).send({ error: "No Gmail draft to send" });

    const { approvalToken } = req.body as any;
    if (!approvalToken) return reply.code(400).send({ error: "approvalToken required" });

    try {
      const result = await sendDraft(draft.gmail_draft_id, approvalToken);
      db.prepare(
        "UPDATE email_drafts SET status = 'sent', sent_at = datetime('now') WHERE id = ?"
      ).run(draft.id);
      return { ok: true, status: "sent", messageId: result.messageId };
    } catch (err: any) {
      return reply.code(403).send({ error: err.message });
    }
  });

  // Reject a draft
  app.post<{ Params: { id: string } }>("/email/drafts/:id/reject", async (req, reply) => {
    const draft = db.prepare("SELECT * FROM email_drafts WHERE id = ?").get((req.params as any).id) as any;
    if (!draft) return reply.code(404).send({ error: "Draft not found" });

    db.prepare("UPDATE email_drafts SET status = 'rejected', updated_at = datetime('now') WHERE id = ?").run(draft.id);
    return { ok: true, status: "rejected" };
  });

  // --- Approvals ---

  app.get("/email/approvals", async () => listPendingApprovals());

  // --- Protected senders ---

  app.get("/email/protected", async () => {
    return db.prepare("SELECT * FROM protected_senders").all();
  });

  app.post("/email/protected", async (req) => {
    const { email, reason } = req.body as any;
    if (!email) return { error: "email required" };
    db.prepare("INSERT OR IGNORE INTO protected_senders(email, reason) VALUES (?, ?)").run(email.toLowerCase(), reason ?? null);
    return { ok: true };
  });

  app.delete<{ Params: { email: string } }>("/email/protected/:email", async (req) => {
    db.prepare("DELETE FROM protected_senders WHERE email = ?").run((req.params as any).email.toLowerCase());
    return { ok: true };
  });
}
