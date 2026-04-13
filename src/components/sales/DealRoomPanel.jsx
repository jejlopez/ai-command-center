// Deal Room — slide-out panel showing everything about a deal.
// Tabs: Proposal, Emails, Notes, Research, Activity

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Send, FileText, Mail, StickyNote, Search, Activity, RefreshCcw } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

function Tab({ label, icon: Icon, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
        active
          ? "bg-jarvis-primary/10 text-jarvis-primary"
          : "text-jarvis-muted hover:text-jarvis-ink"
      }`}
    >
      <Icon size={11} />
      {label}
    </button>
  );
}

function ProposalTab({ deal }) {
  const pricing = deal.pricing_model ? (typeof deal.pricing_model === "string" ? JSON.parse(deal.pricing_model) : deal.pricing_model) : null;

  return (
    <div className="space-y-3">
      {pricing ? (
        <div className="space-y-2">
          <div className="label">Monthly Breakdown</div>
          {pricing.storage && (
            <div className="flex justify-between text-[11px]">
              <span className="text-jarvis-muted">Storage ({pricing.storage.pallets} pallets × ${pricing.storage.rate})</span>
              <span className="text-jarvis-ink">${pricing.storage.monthly?.toFixed(2)}</span>
            </div>
          )}
          {pricing.receiving && (
            <div className="flex justify-between text-[11px]">
              <span className="text-jarvis-muted">Receiving ({pricing.receiving.pallets} × ${pricing.receiving.rate})</span>
              <span className="text-jarvis-ink">${pricing.receiving.monthly?.toFixed(2)}</span>
            </div>
          )}
          {pricing.orders && pricing.orders.count > 0 && (
            <div className="flex justify-between text-[11px]">
              <span className="text-jarvis-muted">Orders ({pricing.orders.count} × ${pricing.orders.rate})</span>
              <span className="text-jarvis-ink">${pricing.orders.monthly?.toFixed(2)}</span>
            </div>
          )}
          {pricing.picks && pricing.picks.count > 0 && (
            <div className="flex justify-between text-[11px]">
              <span className="text-jarvis-muted">Picks ({pricing.picks.count} × ${pricing.picks.rate})</span>
              <span className="text-jarvis-ink">${pricing.picks.monthly?.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-[11px] pt-2 border-t border-jarvis-border">
            <span className="text-jarvis-ink font-medium">Monthly Total</span>
            <span className="text-jarvis-primary font-medium">${pricing.monthlyTotal?.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-jarvis-muted">Annual Estimate</span>
            <span className="text-jarvis-ink">${pricing.annualTotal?.toFixed(2)}</span>
          </div>
        </div>
      ) : (
        <div className="text-[11px] text-jarvis-muted">No pricing data yet. Generate a proposal to calculate.</div>
      )}

      {deal.proposals?.length > 0 && (
        <div className="space-y-1">
          <div className="label">Proposals</div>
          {deal.proposals.map((p) => (
            <div key={p.id} className="surface p-2.5 text-[10px]">
              <div className="flex justify-between">
                <span className="text-jarvis-ink">{p.title}</span>
                <span className={`uppercase tracking-wider ${
                  p.status === "sent" ? "text-jarvis-success" :
                  p.status === "approved" ? "text-jarvis-primary" :
                  "text-jarvis-warning"
                }`}>{p.status}</span>
              </div>
              {p.amount_usd > 0 && <div className="text-jarvis-muted mt-1">${p.amount_usd.toLocaleString()}/yr</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmailsTab({ deal }) {
  const drafts = deal.drafts ?? [];
  const [emails, setEmails] = useState(deal.emails ?? []);
  const [loadingEmails, setLoadingEmails] = useState(false);

  // Fetch real Gmail history for this contact
  useEffect(() => {
    if (!deal.contact_email) return;
    setLoadingEmails(true);
    jarvis.emailForContact(deal.contact_email)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) setEmails(data);
      })
      .catch(() => {})
      .finally(() => setLoadingEmails(false));
  }, [deal.contact_email]);

  return (
    <div className="space-y-2">
      {drafts.length > 0 && (
        <>
          <div className="label">Drafts</div>
          {drafts.map((d) => (
            <div key={d.id} className="surface p-2.5 text-[10px] space-y-1">
              <div className="flex justify-between">
                <span className="text-jarvis-ink truncate">{d.subject}</span>
                <span className={`uppercase tracking-wider text-[8px] ${
                  d.status === "sent" ? "text-jarvis-success" : "text-jarvis-warning"
                }`}>{d.status}</span>
              </div>
              <div className="text-jarvis-muted truncate">To: {d.to_addr}</div>
            </div>
          ))}
        </>
      )}
      {loadingEmails && <div className="text-[10px] text-jarvis-muted animate-pulse">Loading email history...</div>}
      {emails.length > 0 && (
        <>
          <div className="label">Email History</div>
          {emails.map((e, i) => (
            <div key={e.id || i} className="surface p-2.5 text-[10px]">
              <div className="text-jarvis-ink truncate">{e.subject}</div>
              <div className="text-jarvis-muted mt-0.5">
                {e.from || e.from_addr ? `From: ${(e.from || e.from_addr).slice(0, 45)}` : ""}
              </div>
              {e.snippet && <div className="text-jarvis-muted/60 text-[9px] mt-1 truncate">{e.snippet.slice(0, 80)}</div>}
              <div className="text-[8px] text-jarvis-muted/40 mt-1">{e.date?.slice(0, 22) || e.created_at?.slice(0, 10)}</div>
            </div>
          ))}
        </>
      )}
      {!loadingEmails && emails.length === 0 && drafts.length === 0 && (
        <div className="text-[11px] text-jarvis-muted">No email activity for this deal.</div>
      )}
    </div>
  );
}

function NotesTab({ deal }) {
  return (
    <div className="space-y-2">
      {deal.notes_summary ? (
        <div className="text-[11px] text-jarvis-body leading-relaxed whitespace-pre-wrap">{deal.notes_summary}</div>
      ) : (
        <div className="text-[11px] text-jarvis-muted">No notes.</div>
      )}
    </div>
  );
}

export function DealRoomPanel({ deal: initialDeal, onClose }) {
  const [tab, setTab] = useState("proposal");
  const [deal, setDeal] = useState(initialDeal);
  const [generating, setGenerating] = useState(false);

  // Fetch full deal data with related emails/proposals
  useEffect(() => {
    if (initialDeal?.id) {
      jarvis.crmDeal(initialDeal.id).then(setDeal).catch(() => {});
    }
  }, [initialDeal?.id]);

  const generateProposal = async () => {
    setGenerating(true);
    try {
      await jarvis.runSkill("proposal_generator", {
        dealId: deal.id,
        clientName: deal.org_name || deal.title,
        contactEmail: deal.contact_email,
      });
      // Refresh deal data
      const updated = await jarvis.crmDeal(deal.id);
      setDeal(updated);
      setTab("proposal");
    } catch (err) {
      console.error("Proposal generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const draftEmail = async () => {
    try {
      await jarvis.runSkill("email_drafter", {
        categories: "urgent,action_needed",
        maxDrafts: 1,
        tone: "professional",
      });
    } catch {}
  };

  if (!deal) return null;

  const opModel = deal.operating_model ? (typeof deal.operating_model === "string" ? JSON.parse(deal.operating_model) : deal.operating_model) : null;

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="fixed right-0 top-0 bottom-0 w-[420px] bg-jarvis-bg border-l border-jarvis-border z-40 flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-jarvis-border">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[14px] text-jarvis-ink font-semibold truncate">{deal.title || deal.org_name}</h2>
          <button onClick={onClose} className="text-jarvis-muted hover:text-jarvis-ink">
            <X size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-jarvis-muted">{deal.org_name}</span>
          {deal.value > 0 && <span className="text-jarvis-primary">${(deal.value / 1000).toFixed(0)}K/yr</span>}
          <span className={`px-2 py-0.5 rounded-full text-[8px] uppercase tracking-wider ${
            deal.stage?.includes("Sign") ? "bg-jarvis-success/10 text-jarvis-success" :
            deal.stage?.includes("Negot") ? "bg-jarvis-purple/10 text-jarvis-purple" :
            deal.stage?.includes("Demo") ? "bg-jarvis-primary/10 text-jarvis-primary" :
            "bg-jarvis-warning/10 text-jarvis-warning"
          }`}>{deal.stage?.slice(0, 15)}</span>
        </div>

        {/* Contact */}
        {deal.contact_name && (
          <div className="mt-2 text-[10px]">
            <span className="text-jarvis-muted">Contact: </span>
            <span className="text-jarvis-ink">{deal.contact_name}</span>
            {deal.contact_email && <span className="text-jarvis-primary ml-2">{deal.contact_email}</span>}
          </div>
        )}

        {/* Signals */}
        <div className="flex gap-2 mt-2">
          {deal.pandadoc_viewed ? (
            <span className="text-[8px] text-jarvis-success bg-jarvis-success/8 px-2 py-0.5 rounded-full">PandaDoc viewed</span>
          ) : null}
          {deal.last_email_from_them && (
            <span className="text-[8px] text-jarvis-primary bg-jarvis-primary/8 px-2 py-0.5 rounded-full">replied</span>
          )}
          {deal.engagement && (
            <span className={`text-[8px] px-2 py-0.5 rounded-full ${
              deal.engagement === "hot" ? "text-jarvis-danger bg-jarvis-danger/8" :
              deal.engagement === "cold" ? "text-jarvis-muted bg-white/5" :
              "text-jarvis-warning bg-jarvis-warning/8"
            }`}>{deal.engagement}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-jarvis-border">
        <Tab label="Proposal" icon={FileText} active={tab === "proposal"} onClick={() => setTab("proposal")} />
        <Tab label="Emails" icon={Mail} active={tab === "emails"} onClick={() => setTab("emails")} />
        <Tab label="Notes" icon={StickyNote} active={tab === "notes"} onClick={() => setTab("notes")} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === "proposal" && <ProposalTab deal={deal} />}
        {tab === "emails" && <EmailsTab deal={deal} />}
        {tab === "notes" && <NotesTab deal={deal} />}
      </div>

      {/* Actions */}
      <div className="p-3 border-t border-jarvis-border flex gap-2">
        <button
          onClick={draftEmail}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/15 transition-all hover:bg-jarvis-primary/15"
        >
          <Mail size={11} /> Draft Email
        </button>
        <button
          onClick={generateProposal}
          disabled={generating}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-medium bg-jarvis-purple/10 text-jarvis-purple border border-jarvis-purple/15 transition-all hover:bg-jarvis-purple/15 disabled:opacity-40"
        >
          {generating ? <RefreshCcw size={11} className="animate-spin" /> : <FileText size={11} />}
          {generating ? "Generating..." : "Generate Proposal"}
        </button>
      </div>
    </motion.div>
  );
}
