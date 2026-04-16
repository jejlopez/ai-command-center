// meeting_intelligence — transcribe meetings, analyze sentiment, generate battle cards,
// update deal scores, draft follow-ups. Triggered via POST /meetings/process webhook.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "meeting_intelligence",
  title: "Meeting Intelligence",
  description: "Process meeting recordings: transcribe, analyze, generate battle cards, update deal score, draft follow-up email.",
  version: "1.0.0",
  scopes: ["llm.cloud", "memory.write", "memory.read"],
  routerHint: "chat",
  triggers: [{ kind: "manual" }],
  inputs: [
    { name: "dealId", type: "string", required: false, description: "Deal ID this meeting is about" },
    { name: "transcript", type: "string", required: false, description: "Meeting transcript text" },
    { name: "attendees", type: "string", required: false, description: "Comma-separated attendee names" },
    { name: "meetingType", type: "string", required: false, description: "discovery | demo | negotiation | check_in" },
    { name: "notes", type: "string", required: false, description: "Manual meeting notes if no transcript" },
  ],
};

export const meetingIntelligence: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    const dealId = ctx.inputs["dealId"] ? String(ctx.inputs["dealId"]) : undefined;
    const transcript = ctx.inputs["transcript"] ? String(ctx.inputs["transcript"]) : "";
    const attendees = ctx.inputs["attendees"] ? String(ctx.inputs["attendees"]) : "";
    const meetingType = String(ctx.inputs["meetingType"] ?? "discovery");
    const notes = ctx.inputs["notes"] ? String(ctx.inputs["notes"]) : "";

    const content = transcript || notes;
    if (!content) return { error: "Need transcript or notes to analyze" };

    ctx.log("meeting_intelligence.start", { dealId, meetingType, contentLen: content.length });

    // Get deal context
    let dealContext = "";
    if (dealId) {
      const deal = db.prepare("SELECT * FROM crm_deals WHERE id = ?").get(dealId) as any;
      if (deal) {
        dealContext = `Deal: ${deal.org_name || deal.title} — Stage: ${deal.stage} — $${(deal.value || 0).toLocaleString()}\nContact: ${deal.contact_name || ""}`;
      }
    }

    // Step 1: Analyze the meeting
    const analysisResult = await ctx.callModel({
      kind: "chat",
      system: "You are a sales intelligence analyst for a 3PL logistics company. Analyze meetings for actionable insights.",
      prompt: `Analyze this ${meetingType} meeting.

${dealContext}
Attendees: ${attendees}

Meeting content:
${content.slice(0, 4000)}

Return a JSON object:
{
  "summary": "<3 sentence summary>",
  "key_points": ["<point 1>", "<point 2>", "<point 3>"],
  "objections_raised": ["<objection>"],
  "buying_signals": ["<signal>"],
  "commitments_made": ["<who committed to what>"],
  "next_steps": ["<action item with owner>"],
  "deal_temperature": "hot" | "warm" | "cold",
  "battle_card": {
    "competitor_mentions": ["<competitor name + context>"],
    "price_sensitivity": "low" | "medium" | "high",
    "decision_timeline": "<when they plan to decide>",
    "key_stakeholders": ["<name — role — stance>"]
  },
  "follow_up_email_draft": "<draft follow-up email under 100 words, signed Samuel Eddi>"
}`,
      maxTokens: 800,
    });

    let analysis: any;
    try {
      analysis = JSON.parse(analysisResult.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
    } catch {
      analysis = { summary: analysisResult.text.trim(), key_points: [], next_steps: [] };
    }

    // Step 2: Store meeting record
    const meetingId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO crm_activities(id, deal_id, type, subject, done, due_date, synced_at)
      VALUES (?, ?, 'meeting', ?, 1, date('now'), datetime('now'))
    `).run(meetingId, dealId, `${meetingType} meeting — ${analysis.summary?.slice(0, 80) || "processed"}`);

    // Step 3: Update deal engagement based on temperature
    if (dealId && analysis.deal_temperature) {
      db.prepare("UPDATE crm_deals SET engagement = ?, notes_summary = COALESCE(notes_summary, '') || ? WHERE id = ?")
        .run(analysis.deal_temperature, `\n---\n[Meeting ${meetingType}] ${analysis.summary || ""}`, dealId);
    }

    // Step 4: Store in memory for future context
    try {
      await ctx.memory.remember({
        kind: "event" as any,
        label: `Meeting: ${attendees || dealId || "unknown"} (${meetingType})`,
        body: JSON.stringify(analysis, null, 2),
        trust: 0.9,
      });
    } catch {}

    audit({
      actor: "jarvis",
      action: "meeting.analyzed",
      subject: dealId || meetingId,
      metadata: { meetingType, temperature: analysis.deal_temperature, nextSteps: analysis.next_steps?.length },
    });

    return {
      meetingId,
      ...analysis,
    };
  },
};
