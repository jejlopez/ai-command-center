// iteration_engine — Elon framework: self-improving system.
// Analyzes last 30 days of learning_events to find what works vs doesn't.
// Drafts updated versions of bottom-performing skill prompts.
// Queues changes as approvals — nothing changes without Samuel's OK.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import { approvals } from "../lib/approvals.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "iteration_engine",
  title: "Iteration Engine",
  description: "Monthly self-improvement: analyze what worked/didn't, draft updated prompts for bottom performers, queue for approval.",
  version: "1.0.0",
  scopes: ["llm.cloud", "memory.read"],
  routerHint: "chat",
  triggers: [
    { kind: "cron", expr: "0 9 1 * *" }, // 1st of every month 9am
    { kind: "manual" },
  ],
  inputs: [],
};

export const iterationEngine: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    ctx.log("iteration_engine.start");

    // Pull learning events from last 30 days
    const learningEvents = db.prepare(`
      SELECT * FROM value_estimate_feedback
      ORDER BY created_at DESC LIMIT 50
    `).all() as any[];

    // Pull email draft feedback (approved vs rejected)
    const emailFeedback = db.prepare(`
      SELECT * FROM draft_edit_feedback
      ORDER BY created_at DESC LIMIT 50
    `).all() as any[];

    // Pull approval decisions
    const approvalDecisions = db.prepare(`
      SELECT skill, decision, reason, payload
      FROM approvals
      WHERE decision IS NOT NULL
        AND requested_at >= datetime('now', '-30 days')
      ORDER BY requested_at DESC LIMIT 100
    `).all() as any[];

    // Aggregate by skill
    const skillStats: Record<string, { approved: number; denied: number; reasons: string[] }> = {};
    for (const a of approvalDecisions) {
      const skill = a.skill || "unknown";
      if (!skillStats[skill]) skillStats[skill] = { approved: 0, denied: 0, reasons: [] };
      if (a.decision === "approve") skillStats[skill].approved++;
      else {
        skillStats[skill].denied++;
        if (a.reason) skillStats[skill].reasons.push(a.reason);
      }
    }

    // Email performance
    const emailStats = {
      total: emailFeedback.length,
      subjectChanged: emailFeedback.filter((e: any) => e.subject_changed).length,
      toneChanged: emailFeedback.filter((e: any) => e.tone_changed).length,
      shortened: emailFeedback.filter((e: any) => e.shortened).length,
      avgOriginalLen: emailFeedback.length > 0
        ? Math.round(emailFeedback.reduce((s: number, e: any) => s + (e.original_length || 0), 0) / emailFeedback.length)
        : 0,
      avgEditedLen: emailFeedback.length > 0
        ? Math.round(emailFeedback.reduce((s: number, e: any) => s + (e.edited_length || 0), 0) / emailFeedback.length)
        : 0,
    };

    // Value estimate performance
    const valueStats = {
      total: learningEvents.length,
      denied: learningEvents.filter((e: any) => e.decision === "rejected").length,
      avgOverestimate: 0,
    };
    const overestimates = learningEvents.filter((e: any) => e.corrected_value && e.original_estimate > e.corrected_value);
    if (overestimates.length > 0) {
      valueStats.avgOverestimate = Math.round(
        overestimates.reduce((s: number, e: any) => s + (e.original_estimate - e.corrected_value), 0) / overestimates.length
      );
    }

    const dataBlock = `
SKILL APPROVAL RATES (last 30 days):
${Object.entries(skillStats).map(([skill, data]) => {
  const total = data.approved + data.denied;
  const rate = total > 0 ? Math.round((data.approved / total) * 100) : 0;
  return `  ${skill}: ${rate}% approved (${data.approved}/${total})${data.reasons.length > 0 ? `\n    Denial reasons: ${data.reasons.slice(0, 3).join(" | ")}` : ""}`;
}).join("\n")}

EMAIL DRAFT PERFORMANCE:
  Total edits: ${emailStats.total}
  Subject changed: ${emailStats.subjectChanged} (${emailStats.total > 0 ? Math.round(emailStats.subjectChanged / emailStats.total * 100) : 0}%)
  Tone changed: ${emailStats.toneChanged} (${emailStats.total > 0 ? Math.round(emailStats.toneChanged / emailStats.total * 100) : 0}%)
  Shortened: ${emailStats.shortened} (${emailStats.total > 0 ? Math.round(emailStats.shortened / emailStats.total * 100) : 0}%)
  Avg length: ${emailStats.avgOriginalLen} → ${emailStats.avgEditedLen} chars

VALUE ESTIMATE PERFORMANCE:
  Total: ${valueStats.total} | Denied: ${valueStats.denied}
  Avg overestimate: $${valueStats.avgOverestimate.toLocaleString()}`;

    const result = await ctx.callModel({
      kind: "chat",
      system: "You are a systems optimization engineer. Analyze performance data and propose specific, measurable improvements to AI skill prompts.",
      prompt: `Analyze Jarvis's last 30 days of performance. Find what's working and what needs iteration.

${dataBlock}

Return a JSON object:
{
  "overall_approval_rate": <percentage>,
  "top_performers": [{"skill": "<name>", "approval_rate": <n>, "why_it_works": "<reason>"}],
  "bottom_performers": [{"skill": "<name>", "approval_rate": <n>, "main_issue": "<what users keep correcting>"}],
  "email_insights": {
    "too_long": <true|false>,
    "wrong_tone_pct": <percentage>,
    "recommendation": "<specific prompt change>"
  },
  "value_estimate_insights": {
    "bias_direction": "over" | "under" | "accurate",
    "recommendation": "<specific prompt change>"
  },
  "prompt_updates": [
    {"skill": "<name>", "current_issue": "<problem>", "proposed_change": "<exact new instruction to add to the prompt>", "expected_improvement": "<what should change>"}
  ]
}`,
      maxTokens: 700,
    });

    let analysis: any;
    try {
      analysis = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
    } catch {
      analysis = { raw: result.text.trim() };
    }

    // Queue prompt updates as approvals
    const promptUpdates = analysis.prompt_updates || [];
    for (const update of promptUpdates) {
      approvals.enqueue({
        title: `Prompt update: ${update.skill}`,
        reason: `${update.current_issue} → ${update.expected_improvement}`,
        skill: "iteration_engine",
        riskLevel: "medium",
        payload: {
          target_skill: update.skill,
          current_issue: update.current_issue,
          proposed_change: update.proposed_change,
          expected_improvement: update.expected_improvement,
        },
      });
    }

    db.prepare(`
      INSERT INTO jarvis_outputs(id, kind, title, body, created_at, skill)
      VALUES (?, 'iteration', ?, ?, datetime('now'), 'iteration_engine')
    `).run(crypto.randomUUID(), `Iteration Report — ${promptUpdates.length} updates proposed`, JSON.stringify(analysis));

    audit({
      actor: "jarvis",
      action: "iteration.completed",
      metadata: { skillsAnalyzed: Object.keys(skillStats).length, updatesProposed: promptUpdates.length },
    });

    return analysis;
  },
};
