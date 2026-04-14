// follow_up_nagger — daily 9am scan for stale follow-up tasks in memory.
// Any task node not updated in 3+ days gets a nudge stored in jarvis_outputs.
// Cron: 9am weekdays.

import { randomUUID } from "node:crypto";
import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import { memory } from "../lib/memory.js";
import { bus } from "../lib/events.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const STALE_DAYS = 3;

const manifest: SkillManifest = {
  name: "follow_up_nagger",
  title: "Follow-Up Nagger",
  description:
    "Scans memory for follow-up tasks older than 3 days and generates a reminder nudge with suggested action.",
  version: "0.1.0",
  scopes: ["memory.read"],
  routerHint: "summary",
  triggers: [
    { kind: "cron", expr: "0 9 * * 1-5" },
    { kind: "manual" },
  ],
};

interface StaleFollowUp {
  id: string;
  label: string;
  body: string | null;
  updatedAt: string;
  daysStale: number;
  trust: number;
  suggestedAction: string;
}

const FOLLOW_UP_KEYWORDS = [
  "follow up", "follow-up", "followup",
  "check in", "check-in",
  "remind", "reminder",
  "ping", "reach out",
  "get back", "respond", "reply",
  "waiting", "pending",
];

function isFollowUpTask(label: string, body: string | null): boolean {
  const text = `${label} ${body ?? ""}`.toLowerCase();
  return FOLLOW_UP_KEYWORDS.some((kw) => text.includes(kw));
}

function suggestAction(node: { label: string; body: string | null; daysStale: number }): string {
  const label = node.label.toLowerCase();
  const body = (node.body ?? "").toLowerCase();
  const combined = `${label} ${body}`;

  if (combined.includes("email") || combined.includes("reply") || combined.includes("respond")) {
    return `Send a follow-up email regarding "${node.label}".`;
  }
  if (combined.includes("call") || combined.includes("phone") || combined.includes("ping")) {
    return `Schedule a quick call to follow up on "${node.label}".`;
  }
  if (combined.includes("meeting") || combined.includes("meet")) {
    return `Book a meeting to advance "${node.label}".`;
  }
  if (node.daysStale >= 7) {
    return `Escalate or close out "${node.label}" — it's been over a week.`;
  }
  return `Touch base on "${node.label}" to keep momentum going.`;
}

export const followUpNagger: Skill = {
  manifest,
  async run(ctx) {
    const runId = randomUUID();
    audit({ actor: "skill:follow_up_nagger", action: "follow_up_nagger.run.start", subject: runId });

    const cutoffMs = Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000;

    // Gather all task nodes from memory.
    const allTasks = memory.list("task", 100);

    const stale: StaleFollowUp[] = [];

    for (const node of allTasks) {
      const updatedMs = Date.parse(node.updatedAt);
      if (!Number.isFinite(updatedMs) || updatedMs >= cutoffMs) continue;

      // Include if it looks like a follow-up OR is just any overdue task.
      const looksLikeFollowUp = isFollowUpTask(node.label, node.body);
      const daysStale = Math.floor((Date.now() - updatedMs) / (1000 * 60 * 60 * 24));

      // Skip very old low-trust nodes — they've probably been abandoned intentionally.
      if (daysStale > 30 && node.trust < 0.3) continue;

      stale.push({
        id: node.id,
        label: node.label,
        body: node.body,
        updatedAt: node.updatedAt,
        daysStale,
        trust: node.trust,
        suggestedAction: suggestAction({ label: node.label, body: node.body, daysStale }),
      });
    }

    // Sort: highest trust + most stale first.
    stale.sort((a, b) => b.trust * b.daysStale - a.trust * a.daysStale);

    const topStale = stale.slice(0, 10);

    const now = new Date().toISOString();

    if (topStale.length === 0) {
      audit({
        actor: "skill:follow_up_nagger",
        action: "follow_up_nagger.run.complete",
        subject: runId,
        metadata: { stale: 0 },
      });
      ctx.log("follow_up_nagger.clean", { message: "No stale follow-ups found." });
      return { runId, stale: 0 };
    }

    const nudges = topStale.map((f) => ({
      type: "follow_up",
      taskId: f.id,
      title: `Follow-up needed: "${f.label}"`,
      detail: f.body ? f.body.slice(0, 120) : undefined,
      daysStale: f.daysStale,
      suggestedAction: f.suggestedAction,
      urgency: f.daysStale >= 7 ? ("high" as const) : ("medium" as const),
    }));

    const outputId = randomUUID();

    db.prepare(
      `INSERT INTO jarvis_outputs(id, kind, title, body, created_at, skill)
       VALUES (?, 'nudge', ?, ?, ?, 'follow_up_nagger')`
    ).run(
      outputId,
      `Follow-Up Reminders — ${now.slice(0, 10)}`,
      JSON.stringify({ runId, nudges, generatedAt: now }),
      now
    );

    audit({
      actor: "skill:follow_up_nagger",
      action: "follow_up_nagger.run.complete",
      subject: runId,
      metadata: { stale: topStale.length, outputId },
    });

    bus.emit("follow_up_nagger.nudges", { runId, count: topStale.length, outputId });
    ctx.log("follow_up_nagger.complete", { stale: topStale.length });

    return {
      runId,
      stale: topStale.length,
      nudges: nudges.map((n) => ({ title: n.title, daysStale: n.daysStale })),
    };
  },
};
