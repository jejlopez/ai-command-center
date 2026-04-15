// LeadResearch — displays lead.research_packet JSONB sections with re-research trigger.

import { useState } from "react";
import { RefreshCcw } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const SECTIONS = [
  { key: "company_overview",       label: "Company Overview" },
  { key: "what_they_do",           label: "What They Do" },
  { key: "ecommerce_signals",      label: "Ecommerce Signals" },
  { key: "estimated_volume",       label: "Estimated Volume" },
  { key: "revenue_clues",          label: "Revenue Clues" },
  { key: "tech_stack",             label: "Tech Stack" },
  { key: "linkedin_info",          label: "LinkedIn Info" },
  { key: "pain_points",            label: "Pain Points" },
  { key: "buying_triggers",        label: "Buying Triggers" },
  { key: "qualification_notes",    label: "Qualification Notes" },
  { key: "recommended_angle",      label: "Recommended Angle" },
];

export function LeadResearch({ lead, onRefresh }) {
  const [loading, setLoading] = useState(false);
  const packet = lead?.research_packet || null;

  const doResearch = async () => {
    setLoading(true);
    try {
      await jarvis.runSkill("lead_research", {
        leadId: lead.id,
        company: lead.org_name || lead.title,
        contactName: lead.contact_name,
        contactEmail: lead.contact_email,
      });
      onRefresh?.();
    } catch {}
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="label">Research Packet</span>
        <button
          onClick={doResearch}
          disabled={loading}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-medium bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/15 hover:bg-jarvis-purple/20 disabled:opacity-40 transition-all"
        >
          <RefreshCcw size={10} className={loading ? "animate-spin" : ""} />
          {loading ? "Researching…" : packet ? "Re-research" : "Research"}
        </button>
      </div>

      {!packet ? (
        <div className="text-[11px] text-jarvis-muted text-center py-8">
          No research yet. Click Research to analyze this lead.
        </div>
      ) : (
        SECTIONS.map(({ key, label }) => {
          const value = packet[key];
          if (!value) return null;
          return (
            <div key={key} className="surface p-2.5">
              <div className="text-[9px] text-jarvis-primary font-medium uppercase tracking-wider mb-1">
                {label}
              </div>
              <div className="text-[10px] text-jarvis-body leading-relaxed whitespace-pre-wrap">
                {typeof value === "object" ? JSON.stringify(value, null, 2) : String(value)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
