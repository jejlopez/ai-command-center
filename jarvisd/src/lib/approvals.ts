import { randomUUID } from "node:crypto";
import { db } from "../db/db.js";
import { audit } from "./audit.js";
import { episodic } from "./episodic.js";
import { bus } from "./events.js";
import type { Approval } from "../../../shared/types.js";

export type RiskLevel = "low" | "medium" | "high";
export type Decision = "approve" | "deny";

export interface EnqueueInput {
  title: string;
  reason: string;
  skill: string;
  riskLevel: RiskLevel;
  payload: Record<string, unknown>;
}

type ApprovalHandler = (payload: Record<string, unknown>) => Promise<unknown> | unknown;
const handlers = new Map<string, ApprovalHandler>();

export function registerApprovalHandler(skill: string, fn: ApprovalHandler): void {
  handlers.set(skill, fn);
}

function rowToApproval(row: any): Approval {
  return {
    id: row.id,
    title: row.title,
    reason: row.reason,
    riskLevel: row.risk_level,
    requestedAt: row.requested_at,
    skill: row.skill,
    payload: JSON.parse(row.payload),
  };
}

export const approvals = {
  enqueue(input: EnqueueInput): Approval {
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO approvals(id, title, reason, risk_level, skill, payload, requested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, input.title, input.reason, input.riskLevel, input.skill, JSON.stringify(input.payload), now);

    audit({
      actor: `skill:${input.skill}`,
      action: "approval.enqueue",
      subject: id,
      metadata: { title: input.title, risk: input.riskLevel },
    });

    return {
      id,
      title: input.title,
      reason: input.reason,
      riskLevel: input.riskLevel,
      requestedAt: now,
      skill: input.skill,
      payload: input.payload,
    };
  },

  pending(): Approval[] {
    const rows = db
      .prepare("SELECT * FROM approvals WHERE decided_at IS NULL ORDER BY requested_at ASC")
      .all() as any[];
    return rows.map(rowToApproval);
  },

  get(id: string): Approval | null {
    const row = db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as any;
    return row ? rowToApproval(row) : null;
  },

  async decide(id: string, decision: Decision, reason?: string): Promise<{ ok: boolean; result?: unknown; error?: string }> {
    const row = db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as any;
    if (!row) return { ok: false, error: "not found" };
    if (row.decided_at) return { ok: false, error: "already decided" };

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE approvals SET decided_at = ?, decision = ?, decision_reason = ? WHERE id = ?`
    ).run(now, decision, reason ?? null, id);

    audit({
      actor: "user",
      action: `approval.${decision}`,
      subject: id,
      reason,
      metadata: { skill: row.skill, title: row.title },
    });

    bus.emit("approval.decided", {
      id,
      decision,
      reason,
      skill: row.skill,
      payload: JSON.parse(row.payload),
    });

    episodic.snapshot({
      kind: "approval",
      title: `${decision} — ${row.title}`,
      body: { id, decision, reason, skill: row.skill, payload: JSON.parse(row.payload) },
      actor: "user",
    });

    if (decision === "deny") {
      return { ok: true };
    }

    const handler = handlers.get(row.skill);
    if (!handler) {
      audit({
        actor: "system",
        action: "approval.execute.skipped",
        subject: id,
        reason: `no handler for ${row.skill}`,
      });
      return { ok: true, result: { executed: false, reason: "no handler registered" } };
    }

    try {
      const payload = JSON.parse(row.payload);
      const result = await handler(payload);
      audit({
        actor: "system",
        action: "approval.execute.ok",
        subject: id,
        metadata: { skill: row.skill },
      });
      return { ok: true, result };
    } catch (err: any) {
      audit({
        actor: "system",
        action: "approval.execute.fail",
        subject: id,
        reason: err.message,
      });
      return { ok: false, error: err.message };
    }
  },
};

// Built-in demo handler so the UI loop works end-to-end without a real skill.
registerApprovalHandler("crm.push_contact", async (payload) => {
  return { pushed: true, echoed: payload };
});
