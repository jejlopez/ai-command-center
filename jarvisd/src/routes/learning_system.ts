// Learning system — historical email analysis, ongoing learning loop, intelligence dashboard.

import type { FastifyInstance } from "fastify";
import { db } from "../db/db.js";
import { callModel } from "../lib/skills.js";
import { audit } from "../lib/audit.js";

export async function learningSystemRoutes(app: FastifyInstance) {

  // ── PART 1: Historical email analysis ──────────────────────────────────────

  app.post("/learning/analyze-history", async (req, reply) => {
    // Get all of Samuel's sent emails from email_triage (backfilled from Gmail)
    const samuelEmails = db.prepare(`
      SELECT * FROM email_triage
      WHERE LOWER(from_addr) LIKE '%samuele@3plcenter%'
         OR LOWER(from_addr) LIKE '%samuel eddi%'
      ORDER BY created_at DESC LIMIT 200
    `).all() as any[];

    if (samuelEmails.length < 5) {
      return reply.code(400).send({ error: `Only ${samuelEmails.length} emails found. Need at least 5.` });
    }

    // Build a sample of Samuel's writing for the LLM to analyze
    const emailSamples = samuelEmails.slice(0, 50).map((e: any) => {
      const subject = e.subject || "(no subject)";
      const snippet = (e.snippet || "").slice(0, 300);
      return `Subject: ${subject}\nSnippet: ${snippet}`;
    }).join("\n---\n");

    const result = await callModel({
      kind: "chat",
      system: "You are a communication style analyst. Analyze email writing patterns with precision.",
      prompt: `Analyze these ${Math.min(samuelEmails.length, 50)} emails from Samuel Eddi (VP Sales, 3PL Center) and extract his writing style profile.

${emailSamples}

Return a JSON object:
{
  "greeting_patterns": ["<pattern 1>", "<pattern 2>"],
  "sign_off_patterns": ["<pattern 1>", "<pattern 2>"],
  "avg_sentence_length": "<short/medium/long>",
  "tone": "<formal/casual/direct/warm>",
  "formality_level": <1-10>,
  "key_phrases": ["<phrases he uses often>"],
  "response_style": {
    "to_pricing_questions": "<how he handles pricing>",
    "to_meeting_requests": "<how he confirms meetings>",
    "to_follow_ups": "<how he follows up>",
    "to_objections": "<how he handles pushback>"
  },
  "structure_pattern": "<typical email structure>",
  "avg_length_words": <estimated average>,
  "personality_traits": ["<trait 1>", "<trait 2>"],
  "do_not": ["<things he never does in emails>"]
}`,
      maxTokens: 600,
    }, { skill: "learning_analyzer" });

    let profile: any;
    try {
      profile = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
    } catch {
      profile = { raw: result.text.trim() };
    }

    const confidence = Math.min(0.95, samuelEmails.length / 100);

    // Store the style profile
    db.prepare(`
      INSERT INTO jarvis_style_profile(id, email_count, confidence, profile, updated_at)
      VALUES ('current', ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        email_count=excluded.email_count, confidence=excluded.confidence,
        profile=excluded.profile, updated_at=datetime('now')
    `).run(samuelEmails.length, confidence, JSON.stringify(profile));

    // Store as learning event
    db.prepare(`
      INSERT INTO jarvis_learning(id, type, data, confidence, created_at)
      VALUES (?, 'historical_style', ?, ?, datetime('now'))
    `).run(crypto.randomUUID(), JSON.stringify({
      email_count: samuelEmails.length,
      profile,
    }), confidence);

    // Update stats
    updateStats();

    audit({
      actor: "jarvis",
      action: "learning.historical_analysis",
      metadata: { emails: samuelEmails.length, confidence },
    });

    return {
      emailsAnalyzed: samuelEmails.length,
      confidence: Math.round(confidence * 100),
      profile,
    };
  });

  // ── Get style profile for use in drafting ──────────────────────────────────

  app.get("/learning/style-profile", async () => {
    const profile = db.prepare("SELECT * FROM jarvis_style_profile WHERE id = 'current'").get() as any;
    if (!profile) return { exists: false };
    return {
      exists: true,
      emailCount: profile.email_count,
      confidence: Math.round(profile.confidence * 100),
      profile: JSON.parse(profile.profile),
      updatedAt: profile.updated_at,
    };
  });

  // ── PART 2: Ongoing learning — log events ──────────────────────────────────

  app.post("/learning/log", async (req) => {
    const { type, data, deal_id, contact } = req.body as any;
    if (!type || !data) return { error: "type and data required" };

    db.prepare(`
      INSERT INTO jarvis_learning(id, type, data, deal_id, contact, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(crypto.randomUUID(), type, JSON.stringify(data), deal_id ?? null, contact ?? null);

    updateStats();
    return { ok: true };
  });

  // ── Weekly analysis skill trigger ──────────────────────────────────────────

  app.post("/learning/weekly-analysis", async () => {
    // Get last 7 days of learning events
    const events = db.prepare(`
      SELECT * FROM jarvis_learning
      WHERE created_at >= datetime('now', '-7 days')
      ORDER BY created_at DESC
    `).all() as any[];

    if (events.length === 0) return { message: "No learning events this week" };

    const byType: Record<string, number> = {};
    for (const e of events) {
      byType[e.type] = (byType[e.type] || 0) + 1;
    }

    // Get email edit patterns
    const emailEdits = events.filter((e: any) => e.type === "email_edit");
    const approvalPatterns = events.filter((e: any) => e.type === "approval_pattern");

    const editData = emailEdits.map((e: any) => {
      try { return JSON.parse(e.data); } catch { return {}; }
    });

    const result = await callModel({
      kind: "chat",
      prompt: `Analyze Jarvis's learning progress this week.

Events by type: ${JSON.stringify(byType)}
Total events: ${events.length}
Email edits: ${emailEdits.length}
Approval patterns: ${approvalPatterns.length}

${editData.length > 0 ? `Edit patterns:\n${editData.slice(0, 10).map((d: any) =>
  `Original: ${(d.original || "").slice(0, 80)}\nEdited: ${(d.edited || "").slice(0, 80)}\nReason: ${d.reason || "none"}`
).join("\n---\n")}` : "No email edits this week."}

Return JSON:
{
  "summary": "<2 sentence weekly summary>",
  "improving_areas": ["<area getting better>"],
  "needs_work": ["<area still being corrected>"],
  "accuracy_estimate": <0-100>,
  "recommendation": "<one specific improvement>"
}`,
      maxTokens: 400,
    }, { skill: "weekly_analysis" });

    let analysis: any;
    try {
      analysis = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
    } catch {
      analysis = { summary: result.text.trim() };
    }

    // Store analysis
    db.prepare(`
      INSERT INTO jarvis_learning(id, type, data, confidence, created_at)
      VALUES (?, 'weekly_analysis', ?, ?, datetime('now'))
    `).run(crypto.randomUUID(), JSON.stringify({ ...analysis, eventCount: events.length, byType }), (analysis.accuracy_estimate ?? 50) / 100);

    // Update stats with accuracy
    db.prepare(`
      UPDATE jarvis_learning_stats SET accuracy_pct = ?, last_analysis = datetime('now'), updated_at = datetime('now')
      WHERE id = 'current'
    `).run(analysis.accuracy_estimate ?? 50);

    audit({
      actor: "jarvis",
      action: "learning.weekly_analysis",
      metadata: { events: events.length, accuracy: analysis.accuracy_estimate },
    });

    return { events: events.length, byType, analysis };
  });

  // ── Intelligence dashboard data ────────────────────────────────────────────

  app.get("/learning/dashboard", async () => {
    const stats = db.prepare("SELECT * FROM jarvis_learning_stats WHERE id = 'current'").get() as any;
    const profile = db.prepare("SELECT * FROM jarvis_style_profile WHERE id = 'current'").get() as any;

    // Count events by type
    const byType = db.prepare(`
      SELECT type, COUNT(*) as cnt FROM jarvis_learning GROUP BY type
    `).all() as any[];

    // Today's events
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = (db.prepare(
      "SELECT COUNT(*) as cnt FROM jarvis_learning WHERE created_at >= ?"
    ).get(today + "T00:00:00") as any)?.cnt || 0;

    // Recent events
    const recent = db.prepare(`
      SELECT type, data, created_at FROM jarvis_learning
      ORDER BY created_at DESC LIMIT 10
    `).all() as any[];

    // Confidence by task type
    const confidenceByType = db.prepare(`
      SELECT type, AVG(confidence) as avg_conf, COUNT(*) as cnt
      FROM jarvis_learning WHERE confidence > 0
      GROUP BY type
    `).all() as any[];

    return {
      totalEvents: stats?.total_events || 0,
      eventsToday: todayCount,
      accuracyPct: stats?.accuracy_pct || 0,
      lastAnalysis: stats?.last_analysis,
      styleProfile: profile ? {
        exists: true,
        emailCount: profile.email_count,
        confidence: Math.round(profile.confidence * 100),
        updatedAt: profile.updated_at,
      } : { exists: false },
      eventsByType: byType.reduce((acc: any, r: any) => { acc[r.type] = r.cnt; return acc; }, {}),
      confidenceByType: confidenceByType.map((r: any) => ({
        type: r.type,
        confidence: Math.round(r.avg_conf * 100),
        events: r.cnt,
      })),
      recentEvents: recent.map((r: any) => ({
        type: r.type,
        createdAt: r.created_at,
        preview: (() => { try { const d = JSON.parse(r.data); return d.summary || d.reason || d.company || Object.keys(d).slice(0, 3).join(", "); } catch { return ""; } })(),
      })),
    };
  });

  // ── Helper: update aggregate stats ─────────────────────────────────────────

  function updateStats() {
    const total = (db.prepare("SELECT COUNT(*) as cnt FROM jarvis_learning").get() as any)?.cnt || 0;
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = (db.prepare("SELECT COUNT(*) as cnt FROM jarvis_learning WHERE created_at >= ?").get(today + "T00:00:00") as any)?.cnt || 0;

    db.prepare(`
      INSERT INTO jarvis_learning_stats(id, total_events, events_today, today_date, updated_at)
      VALUES ('current', ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        total_events=excluded.total_events, events_today=excluded.events_today,
        today_date=excluded.today_date, updated_at=datetime('now')
    `).run(total, todayCount, today);
  }
}
