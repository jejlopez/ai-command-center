// inbound_capture — when email_triage flags a new sender, auto-create a lead,
// research the company, draft a reply, and queue for approval.

import { db } from "../db/db.js";
import { audit } from "../lib/audit.js";
import { createDraft } from "../lib/providers/gmail_actions.js";
import { browse, isBrowserAvailable } from "../lib/providers/browser.js";
import type { Skill } from "../lib/skills.js";
import type { SkillManifest } from "../../../shared/types.js";

const manifest: SkillManifest = {
  name: "inbound_capture",
  title: "Inbound Capture",
  description: "Auto-captures new inbound leads from email: creates lead record, researches company, drafts personalized reply, queues approval.",
  version: "1.0.0",
  scopes: ["net.out", "llm.cloud", "memory.write"],
  routerHint: "chat",
  triggers: [
    { kind: "event", event: "email.new_sender" },
    { kind: "manual" },
  ],
  inputs: [
    { name: "fromAddr", type: "string", required: true, description: "Sender email address" },
    { name: "fromName", type: "string", required: false, description: "Sender name" },
    { name: "subject", type: "string", required: false, description: "Email subject" },
    { name: "snippet", type: "string", required: false, description: "Email preview text" },
    { name: "messageId", type: "string", required: false, description: "Gmail message ID" },
  ],
};

export const inboundCapture: Skill = {
  manifest: { ...manifest, costTier: "standard" } as any,

  async run(ctx) {
    const fromAddr = String(ctx.inputs["fromAddr"] ?? "");
    const fromName = ctx.inputs["fromName"] ? String(ctx.inputs["fromName"]) : "";
    const subject = ctx.inputs["subject"] ? String(ctx.inputs["subject"]) : "";
    const snippet = ctx.inputs["snippet"] ? String(ctx.inputs["snippet"]) : "";
    const messageId = ctx.inputs["messageId"] ? String(ctx.inputs["messageId"]) : "";

    if (!fromAddr || !fromAddr.includes("@")) {
      return { error: "Valid email address required" };
    }

    ctx.log("inbound_capture.start", { from: fromAddr, subject });

    // Check if we already have this contact
    const existingLead = db.prepare(
      "SELECT id FROM crm_leads WHERE contact_email = ? LIMIT 1"
    ).get(fromAddr) as any;

    if (existingLead) {
      return { skipped: true, reason: "Contact already exists as a lead", leadId: existingLead.id };
    }

    // Extract domain for company research
    const domain = fromAddr.split("@")[1] || "";
    const isPersonal = /gmail|yahoo|hotmail|outlook|icloud|aol/i.test(domain);
    const companyDomain = isPersonal ? "" : domain;

    // Step 1: Research the company via website
    let websiteData: any = null;
    if (companyDomain && await isBrowserAvailable()) {
      try {
        websiteData = await browse(`https://${companyDomain}`, { timeoutMs: 8000 });
        ctx.log("inbound_capture.website", { domain: companyDomain, title: websiteData?.title });
      } catch {}
    }

    // Step 2: LLM analysis — qualify and draft reply
    const result = await ctx.callModel({
      kind: "chat",
      system: "You are a sales intelligence system for a 3PL logistics company (3PL Center LLC). Qualify inbound leads and draft personalized replies.",
      prompt: `A new inbound email arrived. Qualify this lead and draft a reply.

From: ${fromName} <${fromAddr}>
Subject: ${subject}
Preview: ${snippet}
Company domain: ${companyDomain || "unknown (personal email)"}
${websiteData ? `Website: ${websiteData.title}\n${(websiteData.text || "").slice(0, 1000)}` : ""}

Return a JSON object:
{
  "company_name": "<extracted or inferred company name>",
  "qualification": "hot" | "warm" | "cold" | "spam",
  "qualification_reason": "<why this rating>",
  "what_they_need": "<inferred from subject/snippet>",
  "estimated_volume": "<if any volume clues>",
  "reply_draft": "<personalized reply under 100 words, signed Samuel Eddi, VP Sales | 3PL Center>",
  "reply_subject": "<reply subject line>"
}`,
      maxTokens: 400,
    });

    let analysis: any;
    try {
      analysis = JSON.parse(result.text.trim().replace(/```json?\n?/g, "").replace(/```/g, ""));
    } catch {
      analysis = { company_name: companyDomain || fromName, qualification: "warm", reply_draft: "" };
    }

    // Skip spam
    if (analysis.qualification === "spam") {
      audit({ actor: "jarvis", action: "inbound.spam_filtered", subject: fromAddr });
      return { filtered: true, reason: "Classified as spam" };
    }

    // Step 3: Create lead in CRM
    const leadId = `inb-${crypto.randomUUID().slice(0, 8)}`;
    db.prepare(`
      INSERT INTO crm_leads(id, title, org_name, contact_name, contact_email, source, status, created_at, synced_at)
      VALUES (?, ?, ?, ?, ?, 'inbound_email', 'active', datetime('now'), datetime('now'))
    `).run(
      leadId,
      analysis.company_name || fromName || fromAddr,
      analysis.company_name || companyDomain || "",
      fromName || "",
      fromAddr,
    );

    // Step 4: Draft reply and create Gmail draft
    let draftResult: any = null;
    if (analysis.reply_draft && fromAddr) {
      try {
        draftResult = await createDraft(
          fromAddr,
          analysis.reply_subject || `Re: ${subject}`,
          analysis.reply_draft,
        );
        db.prepare(
          `INSERT INTO email_drafts(id, gmail_draft_id, to_addr, subject, body_original, status)
           VALUES (?, ?, ?, ?, ?, 'review_needed')`
        ).run(crypto.randomUUID(), draftResult.draftId, fromAddr, analysis.reply_subject || `Re: ${subject}`, analysis.reply_draft);

        ctx.log("inbound_capture.draft_created", { to: fromAddr });
      } catch (err: any) {
        ctx.log("inbound_capture.draft_fail", { error: err.message });
      }
    }

    // Step 5: Store research in memory
    try {
      await ctx.memory.remember({
        kind: "person" as any,
        label: fromName || analysis.company_name || fromAddr,
        body: `Inbound lead from ${fromAddr}. ${analysis.qualification_reason || ""}. ${analysis.what_they_need || ""}`,
        trust: 0.7,
      });
    } catch {}

    audit({
      actor: "jarvis",
      action: "inbound.captured",
      subject: leadId,
      metadata: { from: fromAddr, company: analysis.company_name, qualification: analysis.qualification, drafted: !!draftResult },
    });

    return {
      leadId,
      company: analysis.company_name,
      qualification: analysis.qualification,
      qualificationReason: analysis.qualification_reason,
      whatTheyNeed: analysis.what_they_need,
      draftCreated: !!draftResult,
    };
  },
};
