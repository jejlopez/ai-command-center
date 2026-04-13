// proposal_generator — generates a pricing proposal from deal data.
// Uses the pricing playbook to auto-calculate rates.
// Creates a proposal in the proposals table for user review + approval.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "proposal_generator",
  title: "Proposal Generator",
  description: "Generate a 3PL pricing proposal from deal volume data. Uses your pricing playbook. You approve before sending.",
  version: "0.1.0",
  scopes: ["llm.cloud", "memory.read"],
  routerHint: "chat",
  triggers: [{ kind: "manual" }],
  inputs: [
    { name: "dealId", type: "string", required: false, description: "CRM deal ID" },
    { name: "clientName", type: "string", required: false, description: "Client/org name" },
    { name: "contactEmail", type: "string", required: false, description: "Contact email" },
    { name: "pallets", type: "number", required: false, description: "Monthly pallet storage" },
    { name: "palletsIn", type: "number", required: false, description: "Monthly pallets received" },
    { name: "orders", type: "number", required: false, description: "Monthly orders" },
    { name: "picksPerOrder", type: "number", required: false, default: 3, description: "Avg picks per order" },
    { name: "productType", type: "string", required: false, description: "Product category" },
    { name: "fulfillmentType", type: "string", required: false, default: "b2c", description: "b2c, b2b, or mixed" },
  ],
};

// Pricing playbook defaults (from won deal analysis)
const PRICING = {
  storage_per_pallet: 17.50,
  receiving_per_pallet: 12.50,
  outbound_per_pallet: 12.50,
  order_processing: 1.75,
  pick_fee: 0.45,
  admin_fee: 199,
  bol_fee: 4.50,
  handling_minimum: 2500,
  storage_minimum: 1000,
};

export const proposalGenerator: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    const dealId = ctx.inputs["dealId"] ? String(ctx.inputs["dealId"]) : undefined;
    const clientName = ctx.inputs["clientName"] ? String(ctx.inputs["clientName"]) : "";
    const contactEmail = ctx.inputs["contactEmail"] ? String(ctx.inputs["contactEmail"]) : "";

    const pallets = Number(ctx.inputs["pallets"] ?? 0);
    const palletsIn = Number(ctx.inputs["palletsIn"] ?? pallets);
    const orders = Number(ctx.inputs["orders"] ?? 0);
    const picksPerOrder = Number(ctx.inputs["picksPerOrder"] ?? 3);
    const productType = String(ctx.inputs["productType"] ?? "general");
    const fulfillmentType = String(ctx.inputs["fulfillmentType"] ?? "b2c");

    // Get deal from DB if provided
    let deal: any = null;
    if (dealId) {
      deal = db.prepare("SELECT * FROM crm_deals WHERE id = ?").get(dealId);
    }

    const name = clientName || deal?.org_name || deal?.title || "Client";
    const email = contactEmail || deal?.contact_email || "";

    if (pallets === 0 && orders === 0 && !deal) {
      return { error: "Need volume data: pallets, orders, or a deal ID with operating model" };
    }

    // Calculate pricing
    const storageCost = pallets * PRICING.storage_per_pallet;
    const receivingCost = palletsIn * PRICING.receiving_per_pallet;
    const totalPicks = orders * picksPerOrder;
    const orderCost = orders * PRICING.order_processing;
    const pickCost = totalPicks * PRICING.pick_fee;
    const adminFee = PRICING.admin_fee;

    const handlingSubtotal = receivingCost + orderCost + pickCost;
    const handlingActual = Math.max(handlingSubtotal, PRICING.handling_minimum);
    const storageActual = Math.max(storageCost, PRICING.storage_minimum);

    const monthlyTotal = storageActual + handlingActual + adminFee;
    const annualTotal = monthlyTotal * 12;

    // Generate proposal narrative using LLM
    const prompt = [
      `Generate a professional 3PL proposal summary for:`,
      `Client: ${name}`,
      `Product type: ${productType}`,
      `Fulfillment: ${fulfillmentType}`,
      ``,
      `Monthly volumes:`,
      `- Storage: ${pallets} pallets`,
      `- Receiving: ${palletsIn} pallets/mo`,
      `- Orders: ${orders}/mo`,
      `- Picks: ${totalPicks}/mo (${picksPerOrder}/order)`,
      ``,
      `Pricing breakdown:`,
      `- Storage: ${pallets} × $${PRICING.storage_per_pallet} = $${storageCost.toFixed(2)}/mo${storageCost < PRICING.storage_minimum ? ` (minimum $${PRICING.storage_minimum} applies)` : ""}`,
      `- Receiving: ${palletsIn} × $${PRICING.receiving_per_pallet} = $${receivingCost.toFixed(2)}/mo`,
      `- Order processing: ${orders} × $${PRICING.order_processing} = $${orderCost.toFixed(2)}/mo`,
      `- Pick fees: ${totalPicks} × $${PRICING.pick_fee} = $${pickCost.toFixed(2)}/mo`,
      handlingSubtotal < PRICING.handling_minimum ? `- Handling minimum: $${PRICING.handling_minimum}/mo applies` : "",
      `- Admin fee: $${adminFee}/mo`,
      `- Monthly total: $${monthlyTotal.toFixed(2)}`,
      `- Annual estimate: $${annualTotal.toFixed(2)}`,
      ``,
      `Write a 3-paragraph proposal summary:`,
      `1. What we understand about their business and needs`,
      `2. What we're proposing (services, locations, capabilities)`,
      `3. Pricing summary and next steps`,
      ``,
      `Company: 3PL Center LLC. VP Sales: Samuel Eddi.`,
      `Tone: professional, confident, concise.`,
    ].filter(Boolean).join("\n");

    let narrative: string;
    try {
      const out = await ctx.callModel({
        kind: "chat",
        system: "You write professional 3PL logistics proposals. Be specific about the client's needs. No generic filler.",
        prompt,
        maxTokens: 500,
      });
      narrative = out.text.trim();
    } catch (err: any) {
      narrative = `Proposal for ${name}\n\nMonthly estimate: $${monthlyTotal.toFixed(2)}\nAnnual estimate: $${annualTotal.toFixed(2)}\n\nPlease contact Samuel Eddi for details.`;
    }

    // Build full proposal body
    const proposalBody = [
      `# 3PL Center — Proposal for ${name}`,
      ``,
      narrative,
      ``,
      `## Monthly Cost Breakdown`,
      ``,
      `| Service | Volume | Rate | Monthly |`,
      `|---------|--------|------|---------|`,
      `| Storage | ${pallets} pallets | $${PRICING.storage_per_pallet}/pallet | $${storageActual.toFixed(2)} |`,
      `| Receiving | ${palletsIn} pallets | $${PRICING.receiving_per_pallet}/pallet | $${receivingCost.toFixed(2)} |`,
      orders > 0 ? `| Order Processing | ${orders} orders | $${PRICING.order_processing}/order | $${orderCost.toFixed(2)} |` : "",
      orders > 0 ? `| Pick & Pack | ${totalPicks} picks | $${PRICING.pick_fee}/pick | $${pickCost.toFixed(2)} |` : "",
      `| Admin Fee | — | — | $${adminFee} |`,
      `| **Monthly Total** | | | **$${monthlyTotal.toFixed(2)}** |`,
      `| **Annual Estimate** | | | **$${annualTotal.toFixed(2)}** |`,
      ``,
      handlingSubtotal < PRICING.handling_minimum ? `*Note: Handling minimum of $${PRICING.handling_minimum}/mo applies.*\n` : "",
      storageCost < PRICING.storage_minimum ? `*Note: Storage minimum of $${PRICING.storage_minimum}/mo applies.*\n` : "",
      `---`,
      `Prepared by Samuel Eddi, VP Sales | 3PL Center LLC`,
      `samuele@3plcenter.com`,
    ].filter(Boolean).join("\n");

    // Store proposal
    const proposalId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO proposals(id, title, client_name, client_email, body_original, status, amount_usd)
      VALUES (?, ?, ?, ?, ?, 'review_needed', ?)
    `).run(proposalId, `${name} — 3PL Proposal`, name, email, proposalBody, annualTotal);

    // Update deal value if linked
    if (dealId) {
      db.prepare("UPDATE crm_deals SET value = ?, pricing_model = ? WHERE id = ?").run(
        annualTotal,
        JSON.stringify({
          storage: { pallets, rate: PRICING.storage_per_pallet, monthly: storageActual },
          receiving: { pallets: palletsIn, rate: PRICING.receiving_per_pallet, monthly: receivingCost },
          orders: { count: orders, rate: PRICING.order_processing, monthly: orderCost },
          picks: { count: totalPicks, rate: PRICING.pick_fee, monthly: pickCost },
          admin: adminFee,
          monthlyTotal,
          annualTotal,
        }),
        dealId,
      );
    }

    audit({
      actor: "jarvis",
      action: "proposal.generated",
      subject: proposalId,
      metadata: { client: name, annual: annualTotal, dealId },
    });

    return {
      proposalId,
      client: name,
      monthlyTotal,
      annualTotal,
      breakdown: {
        storage: { pallets, rate: PRICING.storage_per_pallet, monthly: storageActual },
        receiving: { pallets: palletsIn, rate: PRICING.receiving_per_pallet, monthly: receivingCost },
        orders: { count: orders, rate: PRICING.order_processing, monthly: orderCost },
        picks: { count: totalPicks, rate: PRICING.pick_fee, monthly: pickCost },
        admin: adminFee,
      },
      minimums: {
        handlingApplied: handlingSubtotal < PRICING.handling_minimum,
        storageApplied: storageCost < PRICING.storage_minimum,
      },
      status: "review_needed",
      narrative: narrative.slice(0, 300) + "...",
    };
  },
};
