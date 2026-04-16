// relationship_capital_tracker — Buffett framework: relationships are assets.
// Score every contact 0-100, flag top assets and at-risk relationships,
// draft touchpoint emails for at-risk ones, queue for approval.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import { approvals } from "../lib/approvals.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "relationship_capital_tracker",
  title: "Relationship Capital Tracker",
  description: "Score contacts 0-100 on relationship strength. Flag top assets and at-risk. Draft touchpoints for at-risk relationships.",
  version: "1.0.0",
  scopes: ["llm.cloud", "memory.read"],
  routerHint: "chat",
  triggers: [
    { kind: "cron", expr: "0 16 * * 5" }, // Friday 4pm
    { kind: "manual" },
  ],
  inputs: [],
};

export const relationshipCapitalTracker: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    ctx.log("relationship_capital_tracker.start");

    // Pull all deals with contacts
    const deals = db.prepare(`
      SELECT id, org_name, title, contact_name, contact_email, stage, status, value,
             last_activity, total_activities, created_at, updated_at, won_time, engagement
      FROM crm_deals
      WHERE contact_name IS NOT NULL AND contact_name != ''
      ORDER BY value DESC
    `).all() as any[];

    // Score each contact
    const contacts: any[] = [];

    for (const d of deals) {
      let score = 0;
      const signals: string[] = [];

      // Recency — when was last interaction?
      const lastTouch = d.last_activity || d.updated_at || d.created_at;
      const daysSince = lastTouch ? Math.floor((Date.now() - new Date(lastTouch).getTime()) / 86400000) : 999;

      if (daysSince <= 7) { score += 25; signals.push("Active this week"); }
      else if (daysSince <= 14) { score += 20; signals.push("Active last 2 weeks"); }
      else if (daysSince <= 30) { score += 10; signals.push("Active last month"); }
      else if (daysSince <= 60) { score += 5; signals.push(`${daysSince}d since contact`); }
      else { signals.push(`${daysSince}d since contact — going cold`); }

      // Frequency — number of interactions
      const activities = d.total_activities || 0;
      if (activities >= 20) { score += 20; signals.push(`${activities} interactions (deep)`); }
      else if (activities >= 10) { score += 15; signals.push(`${activities} interactions`); }
      else if (activities >= 5) { score += 10; signals.push(`${activities} interactions`); }
      else { score += 2; signals.push(`Only ${activities} interactions`); }

      // Revenue — current and potential
      const value = d.value || 0;
      if (value >= 100000) { score += 25; signals.push(`$${(value / 1000).toFixed(0)}K revenue`); }
      else if (value >= 50000) { score += 20; signals.push(`$${(value / 1000).toFixed(0)}K revenue`); }
      else if (value >= 10000) { score += 10; signals.push(`$${(value / 1000).toFixed(0)}K revenue`); }
      else if (value > 0) { score += 5; signals.push(`$${value.toLocaleString()} revenue`); }

      // Deal status
      if (d.status === "won") { score += 15; signals.push("Won client — active revenue"); }
      else if (d.engagement === "hot") { score += 10; signals.push("Hot engagement"); }
      else if (d.status === "lost") { score -= 10; signals.push("Lost deal"); }

      // Trajectory — is the relationship improving or declining?
      let trajectory: "growing" | "stable" | "declining" = "stable";
      if (daysSince > 30 && activities < 5) { trajectory = "declining"; score -= 5; }
      else if (daysSince <= 7 && activities >= 10) { trajectory = "growing"; score += 5; }

      score = Math.max(0, Math.min(100, score));

      contacts.push({
        name: d.contact_name,
        email: d.contact_email,
        company: d.org_name || d.title,
        dealId: d.id,
        status: d.status,
        value,
        score,
        trajectory,
        daysSinceContact: daysSince,
        activities,
        signals,
      });
    }

    // Sort by score
    contacts.sort((a, b) => b.score - a.score);

    const topAssets = contacts.slice(0, 10);
    const atRisk = contacts
      .filter(c => c.score < 40 && c.status !== "lost" && c.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Draft touchpoint emails for at-risk relationships
    for (const contact of atRisk) {
      const draftResult = await ctx.callModel({
        kind: "chat",
        prompt: `Draft a personal touchpoint email to re-engage an at-risk business relationship.

Contact: ${contact.name} at ${contact.company}
Last contact: ${contact.daysSinceContact} days ago
Deal value: $${contact.value.toLocaleString()}
Status: ${contact.status}
Relationship score: ${contact.score}/100

This person has gone quiet. Write a warm, personal check-in.
Not salesy. Reference the relationship history.
Under 80 words. Sign off as Samuel.`,
        maxTokens: 150,
      });

      approvals.enqueue({
        title: `Re-engage: ${contact.name} (${contact.company}) — score ${contact.score}/100`,
        reason: `${contact.daysSinceContact}d since contact, $${contact.value.toLocaleString()} at risk, trajectory: ${contact.trajectory}`,
        skill: "relationship_capital_tracker",
        riskLevel: "low",
        payload: {
          contact_name: contact.name,
          contact_email: contact.email,
          company: contact.company,
          deal_id: contact.dealId,
          score: contact.score,
          days_since_contact: contact.daysSinceContact,
          value: contact.value,
          trajectory: contact.trajectory,
          message: draftResult.text.trim(),
        },
      });
    }

    db.prepare(`
      INSERT INTO jarvis_outputs(id, kind, title, body, created_at, skill)
      VALUES (?, 'relationship', ?, ?, datetime('now'), 'relationship_capital_tracker')
    `).run(
      crypto.randomUUID(),
      `Relationship Capital — ${contacts.length} contacts scored`,
      JSON.stringify({ topAssets, atRisk, totalContacts: contacts.length }),
    );

    audit({
      actor: "jarvis",
      action: "relationship.scored",
      metadata: { contacts: contacts.length, topScore: topAssets[0]?.score, atRiskCount: atRisk.length },
    });

    return {
      totalContacts: contacts.length,
      topAssets: topAssets.map(c => ({ name: c.name, company: c.company, score: c.score, value: c.value, trajectory: c.trajectory })),
      atRisk: atRisk.map(c => ({ name: c.name, company: c.company, score: c.score, value: c.value, daysSince: c.daysSinceContact })),
      touchpointsQueued: atRisk.length,
    };
  },
};
