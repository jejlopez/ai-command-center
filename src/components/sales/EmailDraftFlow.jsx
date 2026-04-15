// EmailDraftFlow — creates an email approval from NBA action.

import { useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { jarvis } from "../../lib/jarvis.js";
import { Loader2, Mail, Check } from "lucide-react";

export function EmailDraftFlow({ leadId, dealId, contact, context, onCreated, onClose }) {
  const [status, setStatus] = useState("idle"); // idle, drafting, created, error
  const [error, setError] = useState(null);

  const createDraft = async () => {
    setStatus("drafting");
    try {
      // Try Jarvis skill first
      let draft;
      try {
        const result = await jarvis.runSkill("email_draft", {
          leadId, dealId,
          contactName: contact?.name,
          contactEmail: contact?.email,
          context: context || "follow-up",
        });
        draft = result?.draft || result;
      } catch {
        // Fallback template if skill not available
        draft = {
          subject: `Following up — ${contact?.company || "your fulfillment needs"}`,
          body: `Hi ${contact?.name || "there"},\n\nI wanted to follow up on our conversation about your fulfillment needs. We handle over 2M orders per month and I think we could be a great fit.\n\nWould you have 15 minutes this week to chat?\n\nBest regards`,
          to: contact?.email || "",
        };
      }

      // Create approval record
      if (!supabase) throw new Error("Supabase not configured");
      const { data, error: err } = await supabase.from("approvals").insert({
        lead_id: leadId || null,
        deal_id: dealId || null,
        type: "email",
        status: "pending",
        draft_content: draft,
        source_agent: "jarvis_email_draft",
      }).select().single();

      if (err) throw err;

      // Log activity
      await supabase.from("activities").insert({
        lead_id: leadId || null,
        deal_id: dealId || null,
        contact_id: contact?.id || null,
        type: "jarvis_action",
        subject: "Email draft created",
        body: `Draft: "${draft.subject}" — waiting for approval`,
        source: "jarvis",
      });

      setStatus("created");
      onCreated?.(data);
    } catch (e) {
      setError(e.message);
      setStatus("error");
    }
  };

  if (status === "idle") {
    return (
      <div className="surface p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Mail size={12} className="text-jarvis-primary" />
          <span className="text-[11px] text-jarvis-ink font-medium">Draft Email</span>
        </div>
        <div className="text-[10px] text-jarvis-muted">
          Jarvis will draft a personalized email based on research and history. You'll review before it sends.
        </div>
        <div className="flex gap-2">
          <button onClick={createDraft} className="text-[10px] px-3 py-1.5 rounded-lg bg-jarvis-primary/15 text-jarvis-primary font-semibold">
            ✨ Generate Draft
          </button>
          {onClose && (
            <button onClick={onClose} className="text-[10px] px-3 py-1.5 rounded-lg bg-white/5 text-jarvis-muted">
              Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === "drafting") {
    return (
      <div className="surface p-3 flex items-center gap-2">
        <Loader2 size={12} className="animate-spin text-jarvis-primary" />
        <span className="text-[11px] text-jarvis-muted">Jarvis is drafting…</span>
      </div>
    );
  }

  if (status === "created") {
    return (
      <div className="surface p-3 flex items-center gap-2">
        <Check size={12} className="text-jarvis-success" />
        <span className="text-[11px] text-jarvis-success font-medium">Draft created — check Approvals tab to review</span>
      </div>
    );
  }

  return (
    <div className="surface p-3">
      <div className="text-[11px] text-jarvis-danger">Error: {error}</div>
      <button onClick={() => setStatus("idle")} className="text-[10px] text-jarvis-muted mt-1">Try again</button>
    </div>
  );
}
