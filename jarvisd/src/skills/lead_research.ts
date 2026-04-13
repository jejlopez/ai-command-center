// lead_research — auto-researches a new lead when it arrives.
// Browses their website, extracts company info, scores fit, drafts outreach email.

import { db } from "../db/db.js";
import { browse, isBrowserAvailable } from "../lib/providers/browser.js";
import { createDraft } from "../lib/providers/gmail_actions.js";
import { audit } from "../lib/audit.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "lead_research",
  title: "Lead Auto-Research",
  description: "Research a new lead: company website, products, legitimacy, 3PL fit score. Drafts personalized outreach email.",
  version: "0.1.0",
  scopes: ["net.out", "llm.cloud", "gmail.read", "memory.write"],
  routerHint: "summary",
  triggers: [{ kind: "manual" }],
  inputs: [
    { name: "leadId", type: "string", required: false, description: "CRM lead ID to research" },
    { name: "company", type: "string", required: false, description: "Company name or website URL" },
    { name: "contactName", type: "string", required: false, description: "Contact person name" },
    { name: "contactEmail", type: "string", required: false, description: "Contact email" },
    { name: "draftEmail", type: "boolean", required: false, default: true, description: "Draft outreach email?" },
  ],
};

export const leadResearch: Skill = {
  manifest: { ...manifest, costTier: "cheap", escalationTier: "standard" } as any,

  async run(ctx) {
    const leadId = ctx.inputs["leadId"] ? String(ctx.inputs["leadId"]) : undefined;
    const company = ctx.inputs["company"] ? String(ctx.inputs["company"]) : undefined;
    const contactName = ctx.inputs["contactName"] ? String(ctx.inputs["contactName"]) : undefined;
    const contactEmail = ctx.inputs["contactEmail"] ? String(ctx.inputs["contactEmail"]) : undefined;
    const shouldDraft = ctx.inputs["draftEmail"] !== false;

    // Get lead from DB if ID provided
    let lead: any = null;
    if (leadId) {
      lead = db.prepare("SELECT * FROM crm_leads WHERE id = ?").get(leadId);
    }

    const orgName = company ?? lead?.org_name ?? lead?.title ?? "";
    const name = contactName ?? lead?.contact_name ?? "";
    const email = contactEmail ?? lead?.contact_email ?? "";

    if (!orgName && !email) {
      return { error: "Need company name or contact email to research" };
    }

    ctx.log("lead_research.start", { company: orgName, contact: name });

    // Step 1: Browse company website
    let websiteData: any = null;
    const url = orgName.startsWith("http") ? orgName :
      orgName.includes(".") ? `https://${orgName}` :
      `https://www.${orgName.toLowerCase().replace(/\s+/g, "")}.com`;

    const browserOk = await isBrowserAvailable();
    if (browserOk) {
      try {
        websiteData = await browse(url, { timeoutMs: 10000 });
        ctx.log("lead_research.website", { url, title: websiteData.title });
      } catch {
        ctx.log("lead_research.website_fail", { url });
      }
    }

    // Step 2: Use LLM to analyze and structure the research
    const prompt = [
      `Research this company for a 3PL (third-party logistics) sales qualification:`,
      ``,
      `Company: ${orgName}`,
      `Contact: ${name}`,
      `Email: ${email}`,
      websiteData ? `\nWebsite content:\n${websiteData.text?.slice(0, 3000)}` : "",
      ``,
      `Provide a structured analysis:`,
      `1. WHAT THEY DO: 1-2 sentences`,
      `2. PRODUCTS: what they sell/ship`,
      `3. COMPANY SIZE: employees, revenue signals`,
      `4. LOCATION: where they're based`,
      `5. E-COMMERCE: Shopify/Amazon/DTC? Estimated order volume?`,
      `6. 3PL FIT: Would they need warehousing + fulfillment? B2C or B2B?`,
      `7. LEGITIMACY: Real business or questionable? (1-10 score)`,
      `8. FIT SCORE: For a 3PL with minimums of 300 orders/mo, rate HOT/WARM/COLD`,
      `9. KEY QUESTIONS: 3 discovery questions to ask on first call`,
      ``,
      `Be specific and concise. No fluff.`,
    ].filter(Boolean).join("\n");

    let research: string;
    try {
      const out = await ctx.callModel({
        kind: "summary",
        system: "You are a sales intelligence researcher for a 3PL logistics company. Be specific, factual, and concise.",
        prompt,
        maxTokens: 600,
      });
      research = out.text.trim();
    } catch (err: any) {
      research = websiteData
        ? `Website: ${websiteData.title}\n${websiteData.text?.slice(0, 500)}`
        : `Could not research: ${err.message}`;
    }

    // Step 3: Extract fit score from research
    let fitScore: "hot" | "warm" | "cold" = "warm";
    const lower = research.toLowerCase();
    if (lower.includes("fit score: hot") || lower.includes("rate hot")) fitScore = "hot";
    else if (lower.includes("fit score: cold") || lower.includes("rate cold")) fitScore = "cold";

    // Step 4: Update lead in DB
    if (leadId) {
      db.prepare(
        "UPDATE crm_leads SET research = ?, fit_score = ?, synced_at = datetime('now') WHERE id = ?"
      ).run(research, fitScore, leadId);
    }

    // Step 5: Store in memory
    try {
      await ctx.memory.remember({
        kind: "person" as any,
        label: name || orgName,
        body: research,
        trust: 0.7,
      });
    } catch { /* best effort */ }

    // Step 6: Draft outreach email
    let draftResult: any = null;
    if (shouldDraft && email && email.includes("@")) {
      const emailPrompt = [
        `Draft a personalized outreach email for a 3PL sales rep (Samuel Eddi, VP Sales at 3PL Center).`,
        ``,
        `Recipient: ${name} at ${orgName}`,
        `Email: ${email}`,
        ``,
        `Research about their company:`,
        research.slice(0, 800),
        ``,
        `The email should:`,
        `- Reference something specific about their business (from the research)`,
        `- Briefly explain how 3PL Center can help (warehousing, fulfillment, shipping)`,
        `- Include a CTA to book a discovery call`,
        `- Be under 150 words, professional but warm`,
        `- End with: Samuel Eddi, VP Sales | 3PL Center LLC`,
        ``,
        `Write ONLY the email body. No subject line header.`,
      ].join("\n");

      try {
        const out = await ctx.callModel({
          kind: "chat",
          system: "Write a concise, personalized sales outreach email. No generic templates. Reference their specific business.",
          prompt: emailPrompt,
          maxTokens: 300,
        });

        const emailBody = out.text.trim();
        const subject = `Let's Discuss Your 3PL Needs - Book a Time with 3PL Center`;

        try {
          const draft = await createDraft(email, subject, emailBody);
          draftResult = { draftId: draft.draftId, subject, to: email };

          if (leadId) {
            db.prepare("UPDATE crm_leads SET email_drafted = 1 WHERE id = ?").run(leadId);
          }

          // Also store in email_drafts
          db.prepare(
            `INSERT INTO email_drafts(id, gmail_draft_id, to_addr, subject, body_original, status)
             VALUES (?, ?, ?, ?, ?, 'review_needed')`
          ).run(crypto.randomUUID(), draft.draftId, email, subject, emailBody);

          ctx.log("lead_research.email_drafted", { to: email });
        } catch (err: any) {
          ctx.log("lead_research.draft_fail", { error: err.message });
          draftResult = { error: err.message, body: emailBody };
        }
      } catch (err: any) {
        ctx.log("lead_research.email_gen_fail", { error: err.message });
      }
    }

    audit({
      actor: "jarvis",
      action: "lead.researched",
      subject: leadId ?? orgName,
      metadata: { fitScore, hasWebsite: !!websiteData, emailDrafted: !!draftResult },
    });

    return {
      company: orgName,
      contact: name,
      email,
      research,
      fitScore,
      website: websiteData ? { title: websiteData.title, url: websiteData.url } : null,
      emailDraft: draftResult,
    };
  },
};
