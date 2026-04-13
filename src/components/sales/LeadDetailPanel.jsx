// Lead Detail Panel — slide-out showing everything about a lead.
// Research, emails, contact info, fit score, actions.

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Search, Mail, Phone, Globe, RefreshCcw, Send, ExternalLink, User, Building, MapPin, ShoppingBag, Shield } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

function InfoRow({ icon: Icon, label, value, color }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1">
      <Icon size={11} className={color || "text-jarvis-muted"} style={{ marginTop: 2 }} />
      <div>
        <div className="text-[8px] text-jarvis-muted uppercase tracking-wider">{label}</div>
        <div className="text-[11px] text-jarvis-ink">{value}</div>
      </div>
    </div>
  );
}

function ResearchSection({ research }) {
  if (!research) return (
    <div className="text-[11px] text-jarvis-muted text-center py-6">
      No research yet. Click "Research" to analyze this lead.
    </div>
  );

  // Parse research text into sections
  const sections = research.split(/\d+\.\s+/g).filter(Boolean);

  return (
    <div className="space-y-2">
      {sections.map((section, i) => {
        const [title, ...body] = section.split(":");
        return (
          <div key={i} className="surface p-2.5">
            <div className="text-[9px] text-jarvis-primary font-medium uppercase tracking-wider mb-1">
              {title?.trim()}
            </div>
            <div className="text-[10px] text-jarvis-body leading-relaxed">
              {body.join(":").trim()}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function LeadDetailPanel({ lead, onClose, onRefresh }) {
  const [researching, setResearching] = useState(false);
  const [draftingEmail, setDraftingEmail] = useState(false);
  const [emailDrafted, setEmailDrafted] = useState(lead?.email_drafted);
  const [research, setResearch] = useState(lead?.research);
  const [tab, setTab] = useState("overview");

  // Search Gmail for this lead's email history
  const [emails, setEmails] = useState([]);
  const [loadingEmails, setLoadingEmails] = useState(false);

  useEffect(() => {
    if (!lead?.contact_email) return;
    setLoadingEmails(true);
    jarvis.emailForContact(lead.contact_email)
      .then(data => setEmails(Array.isArray(data) ? data : []))
      .catch(() => setEmails([]))
      .finally(() => setLoadingEmails(false));
  }, [lead?.contact_email]);

  const doResearch = async () => {
    setResearching(true);
    try {
      const result = await jarvis.runSkill("lead_research", {
        leadId: lead.id,
        company: lead.org_name || lead.title,
        contactName: lead.contact_name,
        contactEmail: lead.contact_email,
        draftEmail: false,
      });
      if (result?.output?.research) {
        setResearch(result.output.research);
      }
      onRefresh?.();
    } catch {} finally {
      setResearching(false);
    }
  };

  const draftEmail = async () => {
    setDraftingEmail(true);
    try {
      const result = await jarvis.runSkill("lead_research", {
        leadId: lead.id,
        company: lead.org_name || lead.title,
        contactName: lead.contact_name,
        contactEmail: lead.contact_email,
        draftEmail: true,
      });
      if (result?.output?.emailDraft) {
        setEmailDrafted(true);
      }
      onRefresh?.();
    } catch {} finally {
      setDraftingEmail(false);
    }
  };

  if (!lead) return null;

  const fitColors = {
    hot: { bg: "bg-jarvis-success/10", text: "text-jarvis-success", label: "Hot — fits your 3PL" },
    warm: { bg: "bg-jarvis-warning/10", text: "text-jarvis-warning", label: "Warm — needs discovery" },
    cold: { bg: "bg-jarvis-danger/10", text: "text-jarvis-danger", label: "Cold — may not fit" },
    unknown: { bg: "bg-white/5", text: "text-jarvis-muted", label: "Not scored yet" },
  };

  const fit = fitColors[lead.fit_score] || fitColors.unknown;
  const daysSinceCreated = lead.created_at
    ? Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000)
    : null;

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 bottom-0 w-[440px] bg-jarvis-bg border-l border-jarvis-border z-40 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-jarvis-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] text-jarvis-ink font-semibold truncate">{lead.title || lead.org_name || lead.contact_name}</h2>
          <button onClick={onClose} className="text-jarvis-muted hover:text-jarvis-ink">
            <X size={16} />
          </button>
        </div>

        {/* Fit score badge */}
        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-medium ${fit.bg} ${fit.text}`}>
          <Shield size={10} />
          {fit.label}
        </div>

        {/* Quick stats */}
        <div className="flex gap-3 mt-3 text-[10px]">
          {daysSinceCreated !== null && (
            <div>
              <span className="text-jarvis-muted">Age: </span>
              <span className="text-jarvis-ink">{daysSinceCreated}d</span>
            </div>
          )}
          {lead.source && (
            <div>
              <span className="text-jarvis-muted">Source: </span>
              <span className="text-jarvis-ink">{lead.source}</span>
            </div>
          )}
          <div>
            <span className="text-jarvis-muted">Status: </span>
            <span className="text-jarvis-ink">{lead.status || "active"}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-jarvis-border">
        {["overview", "research", "emails"].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
              tab === t ? "bg-jarvis-primary/10 text-jarvis-primary" : "text-jarvis-muted hover:text-jarvis-ink"
            }`}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">

        {tab === "overview" && (
          <>
            {/* Contact info */}
            <div className="surface p-3 space-y-1">
              <div className="label mb-2">Contact</div>
              <InfoRow icon={User} label="Name" value={lead.contact_name} />
              <InfoRow icon={Mail} label="Email" value={lead.contact_email} color="text-jarvis-primary" />
              <InfoRow icon={Phone} label="Phone" value={lead.contact_phone} />
              <InfoRow icon={Building} label="Company" value={lead.org_name} />
            </div>

            {/* Pipeline status */}
            <div className="surface p-3">
              <div className="label mb-2">Pipeline Status</div>
              <div className="flex flex-col gap-2 text-[10px]">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${research ? "bg-jarvis-success" : "bg-jarvis-muted/30"}`} />
                  <span className={research ? "text-jarvis-ink" : "text-jarvis-muted"}>Researched</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${emailDrafted ? "bg-jarvis-success" : "bg-jarvis-muted/30"}`} />
                  <span className={emailDrafted ? "text-jarvis-ink" : "text-jarvis-muted"}>Email drafted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${lead.email_sent ? "bg-jarvis-success" : "bg-jarvis-muted/30"}`} />
                  <span className={lead.email_sent ? "text-jarvis-ink" : "text-jarvis-muted"}>Email sent</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${lead.call_booked ? "bg-jarvis-success" : "bg-jarvis-muted/30"}`} />
                  <span className={lead.call_booked ? "text-jarvis-ink" : "text-jarvis-muted"}>Discovery call booked</span>
                </div>
              </div>
            </div>

            {/* Research preview */}
            {research && (
              <div className="surface p-3">
                <div className="label mb-2">Research Summary</div>
                <div className="text-[10px] text-jarvis-body leading-relaxed line-clamp-4">
                  {research.slice(0, 300)}...
                </div>
                <button
                  onClick={() => setTab("research")}
                  className="text-[9px] text-jarvis-primary mt-2 hover:underline"
                >
                  View full research →
                </button>
              </div>
            )}
          </>
        )}

        {tab === "research" && (
          <ResearchSection research={research} />
        )}

        {tab === "emails" && (
          <div className="space-y-2">
            {loadingEmails && <div className="text-[10px] text-jarvis-muted animate-pulse">Loading emails...</div>}
            {!loadingEmails && emails.length === 0 && (
              <div className="text-[11px] text-jarvis-muted text-center py-6">
                No email history found for this lead.
              </div>
            )}
            {emails.map((e, i) => (
              <div key={e.id || i} className="surface p-2.5">
                <div className="text-[10px] text-jarvis-ink truncate">{e.subject}</div>
                <div className="text-[9px] text-jarvis-muted mt-0.5">
                  {e.from || e.from_addr ? `From: ${(e.from || e.from_addr).slice(0, 45)}` : ""}
                </div>
                {e.snippet && <div className="text-[9px] text-jarvis-muted/50 mt-1 truncate">{e.snippet.slice(0, 80)}</div>}
                <div className="text-[8px] text-jarvis-muted/40 mt-1">{e.date?.slice(0, 22) || e.created_at?.slice(0, 10)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-jarvis-border flex gap-2">
        <button
          onClick={doResearch}
          disabled={researching}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/15 transition-all hover:bg-jarvis-purple/15 disabled:opacity-40"
        >
          {researching ? <RefreshCcw size={11} className="animate-spin" /> : <Search size={11} />}
          {researching ? "Researching..." : research ? "Re-research" : "Research"}
        </button>
        <button
          onClick={draftEmail}
          disabled={draftingEmail || !lead.contact_email}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/15 transition-all hover:bg-jarvis-primary/15 disabled:opacity-40"
        >
          {draftingEmail ? <RefreshCcw size={11} className="animate-spin" /> : <Mail size={11} />}
          {draftingEmail ? "Drafting..." : emailDrafted ? "Re-draft Email" : "Draft Email"}
        </button>
      </div>
    </motion.div>
  );
}
