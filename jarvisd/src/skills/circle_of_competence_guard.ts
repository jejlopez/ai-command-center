// circle_of_competence_guard — Buffett framework: stay in your circle.
// Scores every new lead: Inside / Border / Outside Samuel's sweet spot.
// Flags outside leads immediately. Adds circle_score to lead record.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "circle_of_competence_guard",
  title: "Circle of Competence Guard",
  description: "Score leads Inside/Border/Outside Samuel's sweet spot. Flag mismatches. Include in morning brief.",
  version: "1.0.0",
  scopes: ["llm.cloud"],
  routerHint: "summary",
  triggers: [
    { kind: "event", event: "lead.created" },
    { kind: "manual" },
  ],
  inputs: [
    { name: "dealId", type: "string", required: false, description: "Score a specific deal/lead" },
    { name: "scanAll", type: "boolean", required: false, description: "Scan all unscored leads" },
  ],
};

// Samuel's circle of competence
const INSIDE_SIGNALS = {
  industries: ["ecommerce", "e-commerce", "dtc", "direct to consumer", "shopify", "amazon fba",
    "subscription box", "consumer goods", "health & beauty", "supplements", "apparel", "fashion"],
  company_types: ["small business", "mid-size", "smb", "startup", "growing", "manufacturer"],
  geography: ["east coast", "new jersey", "new york", "pennsylvania", "connecticut", "northeast",
    "tri-state", "california", "los angeles", "la"],
  volume_range: { min_orders: 300, max_orders: 10000, min_pallets: 5, max_pallets: 500 },
  services: ["fulfillment", "pick and pack", "warehousing", "shipping", "storage", "kitting"],
};

const OUTSIDE_SIGNALS = {
  industries: ["freight only", "freight broker", "trucking", "cold storage only", "frozen",
    "hazmat", "pharmaceutical", "international only", "customs broker"],
  company_types: ["fortune 500", "fortune500", "enterprise", "government", "military"],
  disqualifiers: ["under $2k", "less than 2000", "under 2000/month", "just freight",
    "no warehousing", "international only", "cold chain only"],
};

function scoreCircle(deal: any): { zone: "inside" | "border" | "outside"; score: number; signals: string[]; flags: string[] } {
  const text = [
    deal.org_name || deal.title || "",
    deal.notes_summary || "",
    deal.contact_email || "",
    deal.stage || "",
  ].join(" ").toLowerCase();

  let insidePoints = 0;
  let outsidePoints = 0;
  const signals: string[] = [];
  const flags: string[] = [];

  // Check inside signals
  for (const industry of INSIDE_SIGNALS.industries) {
    if (text.includes(industry)) { insidePoints += 15; signals.push(`Industry match: ${industry}`); break; }
  }
  for (const type of INSIDE_SIGNALS.company_types) {
    if (text.includes(type)) { insidePoints += 10; signals.push(`Company type: ${type}`); break; }
  }
  for (const geo of INSIDE_SIGNALS.geography) {
    if (text.includes(geo)) { insidePoints += 10; signals.push(`Geography: ${geo}`); break; }
  }
  for (const svc of INSIDE_SIGNALS.services) {
    if (text.includes(svc)) { insidePoints += 10; signals.push(`Service needed: ${svc}`); break; }
  }

  // Check volume range
  const palletMatch = text.match(/(\d[\d,]*)\s*pallets?/);
  const orderMatch = text.match(/(\d[\d,]*)\s*(orders?|shipments?|packages?)/);
  const pallets = palletMatch ? parseInt(palletMatch[1].replace(/,/g, "")) : 0;
  const orders = orderMatch ? parseInt(orderMatch[1].replace(/,/g, "")) : 0;

  if (pallets > 0) {
    if (pallets >= INSIDE_SIGNALS.volume_range.min_pallets && pallets <= INSIDE_SIGNALS.volume_range.max_pallets) {
      insidePoints += 15;
      signals.push(`Volume in range: ${pallets} pallets`);
    } else if (pallets < INSIDE_SIGNALS.volume_range.min_pallets) {
      outsidePoints += 10;
      flags.push(`Low volume: only ${pallets} pallets`);
    } else {
      insidePoints += 5; // very large is still ok, just different
      signals.push(`Large volume: ${pallets} pallets`);
    }
  }

  if (orders > 0) {
    if (orders >= INSIDE_SIGNALS.volume_range.min_orders && orders <= INSIDE_SIGNALS.volume_range.max_orders) {
      insidePoints += 15;
      signals.push(`Order volume in sweet spot: ${orders}/mo`);
    } else if (orders < INSIDE_SIGNALS.volume_range.min_orders) {
      outsidePoints += 10;
      flags.push(`Low orders: ${orders}/mo (min 300)`);
    }
  }

  // Check outside signals
  for (const industry of OUTSIDE_SIGNALS.industries) {
    if (text.includes(industry)) { outsidePoints += 20; flags.push(`Outside industry: ${industry}`); break; }
  }
  for (const type of OUTSIDE_SIGNALS.company_types) {
    if (text.includes(type)) { outsidePoints += 15; flags.push(`Outside company type: ${type}`); break; }
  }
  for (const dq of OUTSIDE_SIGNALS.disqualifiers) {
    if (text.includes(dq)) { outsidePoints += 25; flags.push(`Disqualifier: ${dq}`); break; }
  }

  // Calculate zone
  const netScore = insidePoints - outsidePoints;
  let zone: "inside" | "border" | "outside";
  if (outsidePoints >= 20 && insidePoints < 15) zone = "outside";
  else if (netScore >= 20) zone = "inside";
  else if (netScore >= 0) zone = "border";
  else zone = "outside";

  // Normalize score 0-100
  const score = Math.max(0, Math.min(100, 50 + netScore));

  return { zone, score, signals, flags };
}

export const circleOfCompetenceGuard: Skill = {
  manifest: { ...manifest, costTier: "cheap" } as any,

  async run(ctx) {
    const specificDealId = ctx.inputs["dealId"] ? String(ctx.inputs["dealId"]) : undefined;
    const scanAll = ctx.inputs["scanAll"] === true || ctx.inputs["scanAll"] === "true";

    ctx.log("circle_of_competence_guard.start", { dealId: specificDealId, scanAll });

    let deals: any[];
    if (specificDealId) {
      const deal = db.prepare("SELECT * FROM crm_deals WHERE id = ?").get(specificDealId);
      deals = deal ? [deal] : [];
    } else if (scanAll) {
      deals = db.prepare("SELECT * FROM crm_deals WHERE status = 'open' AND jarvis_score IS NULL ORDER BY created_at DESC LIMIT 100").all() as any[];
    } else {
      // Default: scan recent unscored
      deals = db.prepare("SELECT * FROM crm_deals WHERE status = 'open' AND jarvis_score IS NULL ORDER BY created_at DESC LIMIT 20").all() as any[];
    }

    if (deals.length === 0) return { message: "No leads to score" };

    const results: any[] = [];
    const outsideAlerts: any[] = [];

    for (const deal of deals) {
      const { zone, score, signals, flags } = scoreCircle(deal);

      // Update deal with circle score
      db.prepare("UPDATE crm_deals SET jarvis_score = ? WHERE id = ?").run(score, deal.id);

      const result = {
        dealId: deal.id,
        company: deal.org_name || deal.title,
        contact: deal.contact_name,
        zone,
        score,
        signals,
        flags,
      };

      results.push(result);

      if (zone === "outside") {
        outsideAlerts.push(result);
      }
    }

    // Log outside alerts
    if (outsideAlerts.length > 0) {
      audit({
        actor: "jarvis",
        action: "circle.outside_detected",
        metadata: {
          count: outsideAlerts.length,
          companies: outsideAlerts.map(a => a.company).join(", "),
        },
      });
    }

    const inside = results.filter(r => r.zone === "inside").length;
    const border = results.filter(r => r.zone === "border").length;
    const outside = results.filter(r => r.zone === "outside").length;

    db.prepare(`
      INSERT INTO jarvis_outputs(id, kind, title, body, created_at, skill)
      VALUES (?, 'circle_check', ?, ?, datetime('now'), 'circle_of_competence_guard')
    `).run(
      crypto.randomUUID(),
      `Circle Check — ${inside} inside, ${border} border, ${outside} outside`,
      JSON.stringify({ results, summary: { inside, border, outside } }),
    );

    audit({
      actor: "jarvis",
      action: "circle.scored",
      metadata: { total: results.length, inside, border, outside },
    });

    return {
      scored: results.length,
      inside,
      border,
      outside,
      outsideAlerts: outsideAlerts.map(a => ({
        company: a.company,
        score: a.score,
        flags: a.flags,
      })),
      insideLeads: results.filter(r => r.zone === "inside").map(r => ({
        company: r.company,
        score: r.score,
        signals: r.signals,
      })),
    };
  },
};
