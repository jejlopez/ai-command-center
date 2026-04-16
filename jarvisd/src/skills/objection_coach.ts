// objection_coach — tracks objection patterns across all deals, logs them,
// and surfaces recommendations when similar objections come up again.
// Triggered after deal stage changes.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "objection_coach",
  title: "Objection Coach",
  description: "Log and analyze sales objections across deals. Surface winning responses when similar objections appear.",
  version: "1.0.0",
  scopes: ["llm.cloud", "memory.read", "memory.write"],
  routerHint: "chat",
  triggers: [
    { kind: "event", event: "deal.stage_changed" },
    { kind: "manual" },
  ],
  inputs: [
    { name: "dealId", type: "string", required: false, description: "Deal ID" },
    { name: "objection", type: "string", required: false, description: "The objection text" },
    { name: "mode", type: "string", required: false, description: "log | analyze | coach" },
  ],
};

export const objectionCoach: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    const mode = String(ctx.inputs["mode"] ?? "analyze");
    const dealId = ctx.inputs["dealId"] ? String(ctx.inputs["dealId"]) : undefined;
    const objectionText = ctx.inputs["objection"] ? String(ctx.inputs["objection"]) : "";

    ctx.log("objection_coach.start", { mode, dealId });

    if (mode === "log" && objectionText && dealId) {
      // Log a new objection
      db.prepare(`
        INSERT INTO objection_log(id, deal_id, objection, created_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(crypto.randomUUID(), dealId, objectionText);

      audit({ actor: "user", action: "objection.logged", subject: dealId, metadata: { objection: objectionText.slice(0, 100) } });
      return { logged: true, objection: objectionText };
    }

    // Pull all objection history
    const allObjections = db.prepare(`
      SELECT o.*, d.org_name, d.title, d.stage, d.status, d.value
      FROM objection_log o
      LEFT JOIN crm_deals d ON d.id = o.deal_id
      ORDER BY o.created_at DESC LIMIT 100
    `).all() as any[];

    // Also pull from the Supabase objections table if any were synced
    const supaObjections = db.prepare(`
      SELECT * FROM crm_notes WHERE content LIKE '%objection%' OR content LIKE '%concern%' OR content LIKE '%pushback%'
      ORDER BY added_at DESC LIMIT 20
    `).all() as any[];

    const allText = [
      ...allObjections.map((o: any) => `[${o.status || "open"}] ${o.org_name || o.title || "?"}: "${o.objection}" (${o.response || "no response logged"})`),
      ...supaObjections.map((n: any) => `[note] ${(n.content || "").replace(/<[^>]*>/g, "").slice(0, 200)}`),
    ].join("\n");

    if (mode === "analyze") {
      // Analyze patterns across all objections
      const result = await ctx.callModel({
        kind: "chat",
        system: "You are a sales coach for a 3PL logistics company. Analyze objection patterns and recommend responses.",
        prompt: `Analyze these objections from ${allObjections.length} deals:

${allText || "No objections logged yet."}

Return a JSON object:
{
  "total_objections": <number>,
  "top_categories": [
    {"category": "<price|service|timing|competitor|trust>", "count": <n>, "example": "<example>", "best_response": "<recommended response>"}
  ],
  "won_despite_objection": <number of won deals that had objections>,
  "lost_due_to_objection": <number>,
  "coaching_tips": ["<tip 1>", "<tip 2>", "<tip 3>"]
}`,
        maxTokens: 500,
      });

      let analysis: any;
      try {
        analysis = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
      } catch {
        analysis = { summary: result.text.trim() };
      }

      audit({ actor: "jarvis", action: "objection.analyzed", metadata: { total: allObjections.length } });
      return analysis;

    } else if (mode === "coach" && objectionText) {
      // Real-time coaching: find similar past objections and what worked
      const result = await ctx.callModel({
        kind: "chat",
        system: "You are a sales coach. Help respond to this objection using past successful responses.",
        prompt: `The prospect just said: "${objectionText}"

Past objections and outcomes:
${allText.slice(0, 2000)}

Give me:
1. What type of objection this is (price/service/timing/competitor/trust)
2. How similar objections were handled in past deals
3. A recommended response (under 50 words)
4. A follow-up question to ask after addressing it`,
        maxTokens: 300,
      });

      return { objection: objectionText, coaching: result.text.trim() };
    }

    return { objections: allObjections.length, message: "Use mode=log, analyze, or coach" };
  },
};
