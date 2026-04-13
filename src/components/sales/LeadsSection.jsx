// Leads section — auto-researched, scored, with draft email status.

import { motion } from "framer-motion";
import { stagger } from "../../lib/motion.js";
import { Search, Mail, Phone, ExternalLink, RefreshCcw } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";
import { useState } from "react";

function LeadRow({ lead, onResearch }) {
  const [researching, setResearching] = useState(false);

  const doResearch = async () => {
    setResearching(true);
    try {
      await jarvis.runSkill("lead_research", {
        leadId: lead.id,
        company: lead.org_name || lead.title,
        contactName: lead.contact_name,
        contactEmail: lead.contact_email,
      });
      onResearch?.();
    } catch {} finally {
      setResearching(false);
    }
  };

  const fitColors = {
    hot: "bg-jarvis-success/10 text-jarvis-success",
    warm: "bg-jarvis-warning/10 text-jarvis-warning",
    cold: "bg-jarvis-danger/10 text-jarvis-danger",
    unknown: "bg-white/5 text-jarvis-muted",
  };

  return (
    <motion.div variants={stagger.item} className="surface p-3 surface-hover">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-jarvis-ink font-medium truncate">{lead.title || lead.org_name}</span>
            <span className={`text-[7px] uppercase tracking-wider px-1.5 py-0.5 rounded-full ${fitColors[lead.fit_score] || fitColors.unknown}`}>
              {lead.fit_score || "?"}
            </span>
          </div>
          {lead.contact_name && (
            <div className="text-[9px] text-jarvis-muted mt-0.5">{lead.contact_name}</div>
          )}
          {lead.source && (
            <div className="text-[8px] text-jarvis-muted/50 mt-0.5">{lead.source}</div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {lead.email_drafted ? (
            <span className="text-[7px] text-jarvis-primary bg-jarvis-primary/8 px-1.5 py-0.5 rounded-full">email drafted</span>
          ) : null}
          {lead.call_booked ? (
            <span className="text-[7px] text-jarvis-success bg-jarvis-success/8 px-1.5 py-0.5 rounded-full">call booked</span>
          ) : null}
          {lead.research ? (
            <span className="text-[7px] text-jarvis-purple bg-jarvis-purple/8 px-1.5 py-0.5 rounded-full">researched</span>
          ) : (
            <button
              onClick={doResearch}
              disabled={researching}
              className="text-[8px] text-jarvis-primary hover:text-jarvis-ink flex items-center gap-1 disabled:opacity-40"
            >
              {researching ? <RefreshCcw size={9} className="animate-spin" /> : <Search size={9} />}
              Research
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function LeadsSection({ leads, onRefresh }) {
  if (!leads || leads.length === 0) {
    return (
      <div className="surface p-4 text-center">
        <div className="text-[11px] text-jarvis-muted">No active leads. They'll appear here when they come in.</div>
      </div>
    );
  }

  const hot = leads.filter(l => l.fit_score === "hot");
  const warm = leads.filter(l => l.fit_score === "warm");
  const cold = leads.filter(l => l.fit_score === "cold" || l.fit_score === "unknown" || !l.fit_score);

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="label">Leads ({leads.length})</div>
        <div className="flex gap-2 text-[8px]">
          <span className="text-jarvis-success">{hot.length} hot</span>
          <span className="text-jarvis-warning">{warm.length} warm</span>
          <span className="text-jarvis-muted">{cold.length} cold</span>
        </div>
      </div>
      {[...hot, ...warm, ...cold].map((lead) => (
        <LeadRow key={lead.id} lead={lead} onResearch={onRefresh} />
      ))}
    </motion.div>
  );
}
