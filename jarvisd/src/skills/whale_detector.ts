// whale_detector — daily scan of all leads for high-value signals.
// Flags potential whales in the morning brief and updates lead scores.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "whale_detector",
  title: "Whale Detector",
  description: "Daily scan of leads for high-value signals: enterprise domains, volume mentions, competitor frustration, urgency cues.",
  version: "1.0.0",
  scopes: ["llm.cloud", "memory.read"],
  routerHint: "chat",
  triggers: [
    { kind: "cron", expr: "0 8 * * 1-5" }, // weekday 8am
    { kind: "manual" },
  ],
  inputs: [],
};

// Known enterprise/high-value domain patterns
const WHALE_DOMAINS = /fortune500|enterprise|corp|global|international|group|holdings/i;
const WHALE_COMPANIES = /amazon|shopify|walmart|target|costco|nike|adidas|unilever|nestle|spacex|tesla/i;

export const whaleDetector: Skill = {
  manifest: { ...manifest, costTier: "cheap" } as any,

  async run(ctx) {
    ctx.log("whale_detector.start");

    // Pull all active leads and new-stage deals
    const leads = db.prepare(`
      SELECT * FROM crm_deals
      WHERE status = 'open'
        AND (value IS NULL OR value = 0)
      ORDER BY created_at DESC LIMIT 200
    `).all() as any[];

    if (leads.length === 0) return { whales: [], message: "No leads to scan" };

    const whales: any[] = [];

    for (const lead of leads) {
      let score = 0;
      const signals: string[] = [];
      const name = (lead.org_name || lead.title || "").toLowerCase();
      const notes = (lead.notes_summary || "").toLowerCase();
      const email = (lead.contact_email || "").toLowerCase();

      // Signal: Known large company
      if (WHALE_COMPANIES.test(name)) {
        score += 40;
        signals.push("Known enterprise company");
      }

      // Signal: Enterprise domain
      if (WHALE_DOMAINS.test(name) || WHALE_DOMAINS.test(email)) {
        score += 20;
        signals.push("Enterprise domain pattern");
      }

      // Signal: High volume mentions in notes
      const palletMatch = notes.match(/(\d[\d,]*)\s*pallets?/);
      const orderMatch = notes.match(/(\d[\d,]*)\s*(orders?|shipments?|packages?)/);
      const parsedPallets = palletMatch ? parseInt(palletMatch[1].replace(/,/g, "")) : 0;
      const parsedOrders = orderMatch ? parseInt(orderMatch[1].replace(/,/g, "")) : 0;

      if (parsedPallets > 100) { score += 30; signals.push(`${parsedPallets} pallets mentioned`); }
      else if (parsedPallets > 30) { score += 15; signals.push(`${parsedPallets} pallets mentioned`); }

      if (parsedOrders > 2000) { score += 30; signals.push(`${parsedOrders} orders/mo mentioned`); }
      else if (parsedOrders > 500) { score += 15; signals.push(`${parsedOrders} orders mentioned`); }

      // Signal: Competitor frustration
      if (/switching|frustrated|unhappy|leaving|current 3pl|looking for new/i.test(notes)) {
        score += 20;
        signals.push("Competitor frustration detected");
      }

      // Signal: Urgency cues
      if (/asap|urgent|immediately|this week|need help now|launch|go live/i.test(notes)) {
        score += 15;
        signals.push("Urgency cues in notes");
      }

      // Signal: Multiple SKUs
      const skuMatch = notes.match(/(\d+)\s*skus?/);
      if (skuMatch && parseInt(skuMatch[1]) > 50) {
        score += 10;
        signals.push(`${skuMatch[1]} SKUs`);
      }

      // Signal: Advanced in pipeline
      const stage = (lead.stage || "").toLowerCase();
      if (stage.includes("negotiat") || stage.includes("proposal")) {
        score += 10;
        signals.push("Advanced pipeline stage");
      }

      // Signal: High activity count
      if (lead.total_activities > 20) {
        score += 10;
        signals.push(`${lead.total_activities} activities logged`);
      }

      if (score >= 30) {
        whales.push({
          id: lead.id,
          company: lead.org_name || lead.title,
          contact: lead.contact_name,
          email: lead.contact_email,
          stage: lead.stage,
          score,
          signals,
          estimatedVolume: parsedPallets > 0 || parsedOrders > 0
            ? `${parsedPallets || "?"} pallets, ${parsedOrders || "?"} orders/mo`
            : "Unknown",
        });
      }
    }

    // Sort by score descending
    whales.sort((a, b) => b.score - a.score);

    // Store results
    if (whales.length > 0) {
      db.prepare(`
        INSERT INTO jarvis_outputs(id, kind, title, body, created_at, skill)
        VALUES (?, 'whale_alert', ?, ?, datetime('now'), 'whale_detector')
      `).run(crypto.randomUUID(), `${whales.length} whale${whales.length > 1 ? "s" : ""} detected`, JSON.stringify(whales));
    }

    audit({
      actor: "jarvis",
      action: "whale.scan.completed",
      metadata: { scanned: leads.length, whalesFound: whales.length, topWhale: whales[0]?.company },
    });

    return { scanned: leads.length, whales };
  },
};
