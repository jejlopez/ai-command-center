// LeadDetailPanel — 520px slide-out panel, 7 tabs, badges, scores, NBA, convert-to-deal.

import { useState } from "react";
import { motion } from "framer-motion";
import { X, User, Mail, Phone, Building } from "lucide-react";

import { BadgeZone }        from "../shared/BadgeZone.jsx";
import { ScoreZone }        from "../shared/ScoreZone.jsx";
import { NBAModule }        from "../shared/NBAModule.jsx";
import { ActivityTimeline } from "../shared/ActivityTimeline.jsx";
import { LeadResearch }     from "./LeadResearch.jsx";
import { LeadQualification } from "./LeadQualification.jsx";
import { LeadSequence }     from "./LeadSequence.jsx";
import { ConvertToDeal }    from "./ConvertToDeal.jsx";

const TABS = [
  { id: "timeline",      label: "Timeline" },
  { id: "research",      label: "Research" },
  { id: "emails",        label: "Emails" },
  { id: "qualification", label: "Qualification" },
  { id: "sequence",      label: "Sequence" },
  { id: "notes",         label: "Notes" },
  { id: "approvals",     label: "Approvals" },
];

const CONVERT_STATUSES = new Set(["qualified", "discovery_set"]);

function InfoRow({ icon: Icon, label, value, color }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-0.5">
      <Icon size={11} className={color || "text-jarvis-muted"} style={{ marginTop: 2 }} />
      <div>
        <div className="text-[8px] text-jarvis-muted uppercase tracking-wider">{label}</div>
        <div className="text-[11px] text-jarvis-ink">{value}</div>
      </div>
    </div>
  );
}

export function LeadDetailPanel({ lead, onClose, onRefresh }) {
  const [tab, setTab] = useState("timeline");

  if (!lead) return null;

  const contact = lead.contacts || {};
  const daysSince = lead.created_at
    ? Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000)
    : null;

  const showConvert = CONVERT_STATUSES.has(lead.status);

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 26, stiffness: 220 }}
      className="fixed right-0 top-0 bottom-0 w-[520px] bg-jarvis-bg border-l border-jarvis-border z-50 flex flex-col overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="p-4 border-b border-jarvis-border space-y-2.5 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[14px] text-jarvis-ink font-semibold truncate">
              {lead.org_name || lead.title || contact.name || "—"}
            </h2>
            <div className="flex flex-wrap gap-3 mt-1 text-[10px]">
              {daysSince !== null && (
                <span className="text-jarvis-muted">
                  Age: <span className="text-jarvis-ink">{daysSince}d</span>
                </span>
              )}
              {lead.source && (
                <span className="text-jarvis-muted">
                  Source: <span className="text-jarvis-ink">{lead.source}</span>
                </span>
              )}
              {lead.status && (
                <span className="text-jarvis-muted">
                  Status: <span className="text-jarvis-ink">{lead.status}</span>
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-jarvis-muted hover:text-jarvis-ink shrink-0 mt-0.5">
            <X size={16} />
          </button>
        </div>

        {/* Contact strip */}
        <div className="flex flex-wrap gap-x-4 gap-y-0.5">
          <InfoRow icon={User}     label="Contact" value={contact.name || lead.contact_name} />
          <InfoRow icon={Mail}     label="Email"   value={contact.email || lead.contact_email} color="text-jarvis-primary" />
          <InfoRow icon={Phone}    label="Phone"   value={contact.phone || lead.contact_phone} />
          <InfoRow icon={Building} label="Company" value={lead.org_name} />
        </div>

        {/* Badges */}
        <BadgeZone record={lead} type="lead" />

        {/* Scores */}
        <ScoreZone
          score={lead.lead_score}
          whale={lead.whale_score}
          breakdown={lead.score_breakdown}
          labels={{ score: "Lead Score", whale: "Whale Score" }}
        />

        {/* NBA */}
        <NBAModule
          nba={lead.nba}
          contact={contact}
          onAction={onRefresh}
        />

        {/* Convert to deal */}
        {showConvert && (
          <ConvertToDeal lead={lead} onRefresh={onRefresh} />
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-0.5 px-3 py-2 border-b border-jarvis-border shrink-0 overflow-x-auto scrollbar-hide">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-all ${
              tab === t.id
                ? "bg-jarvis-primary/10 text-jarvis-primary"
                : "text-jarvis-muted hover:text-jarvis-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "timeline" && (
          <ActivityTimeline leadId={lead.id} />
        )}

        {tab === "research" && (
          <LeadResearch lead={lead} onRefresh={onRefresh} />
        )}

        {tab === "emails" && (
          <div className="text-[11px] text-jarvis-muted text-center py-8">
            Email history. Wired in Phase 3.
          </div>
        )}

        {tab === "qualification" && (
          <LeadQualification lead={lead} onRefresh={onRefresh} />
        )}

        {tab === "sequence" && (
          <LeadSequence leadId={lead.id} />
        )}

        {tab === "notes" && (
          <div className="text-[11px] text-jarvis-muted text-center py-8">
            Notes tab. Full implementation in Phase 3.
          </div>
        )}

        {tab === "approvals" && (
          <div className="text-[11px] text-jarvis-muted text-center py-8">
            Approval history. Full implementation in Phase 3.
          </div>
        )}
      </div>
    </motion.div>
  );
}
