// SalesDashboard — 3-column layout: Pipeline | Proposals+Email | Calendar+Actions.
// All existing functionality preserved, reorganized for visibility.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { stagger, fadeIn } from "../../lib/motion.js";
import { PipelineBoard } from "../sales/PipelineBoard.jsx";
import { DealRoomPanel } from "../sales/DealRoomPanel.jsx";
import { DealComparison } from "./DealComparison.jsx";
import { DealRoom } from "./DealRoom.jsx";
import { EmailInbox } from "./EmailInbox.jsx";
import { ProposalList } from "./ProposalList.jsx";
import { Calendar, Clock } from "lucide-react";

// ---- Right column sub-components (inline, small) ----

function CalendarToday({ calendarEvents = [] }) {
  if (calendarEvents.length === 0) {
    return (
      <div className="text-[10px] text-jarvis-ghost py-2">No events today.</div>
    );
  }

  const dotColors = [
    "bg-blue-400", "bg-jarvis-warning", "bg-jarvis-success",
    "bg-jarvis-purple", "bg-cyan-400",
  ];

  return (
    <div className="flex flex-col gap-2">
      {calendarEvents.map((ev, i) => {
        const time = ev.start_h != null
          ? `${ev.start_h}:${String(ev.start_m ?? 0).padStart(2, "0")}`
          : ev.start_time || "";
        return (
          <div key={i} className="flex items-start gap-2">
            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${dotColors[i % dotColors.length]}`} />
            <div>
              <div className="text-[11px] text-jarvis-ink leading-snug">
                {time && <span className="text-jarvis-muted font-mono text-[10px] mr-1">{time}</span>}
                {ev.title || ev.summary}
              </div>
              {ev.location && <div className="text-[9px] text-jarvis-muted/70">{ev.location}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FollowUpsColumn({ followUps = [], deals = [], onOpenDeal }) {
  const now = new Date();
  const due = followUps.filter(f => f.due_date && new Date(f.due_date) <= new Date(now.toDateString() + " 23:59:59"));
  const overdue = due.filter(f => new Date(f.due_date) < new Date(now.toDateString()));
  const today = due.filter(f => !overdue.includes(f));

  if (due.length === 0) {
    return <div className="text-[10px] text-jarvis-ghost py-2">No follow-ups due. Clear.</div>;
  }

  function FollowUpRow({ f, isOverdue }) {
    const linkedDeal = f.deal_id ? deals.find(d => d.id === f.deal_id) : null;
    return (
      <div
        className={`rounded-md px-2 py-1.5 border cursor-pointer transition hover:bg-jarvis-surface-hover ${
          isOverdue
            ? "border-jarvis-danger/20 bg-jarvis-danger/[0.03]"
            : "border-jarvis-warning/20 bg-jarvis-warning/[0.03]"
        }`}
        onClick={() => linkedDeal && onOpenDeal?.(linkedDeal)}
      >
        <div className="text-[10px] text-jarvis-ink">{f.contact_name || f.subject || "Follow-up"}</div>
        <div className={`text-[9px] ${isOverdue ? "text-jarvis-danger" : "text-jarvis-warning"}`}>
          {isOverdue ? `${Math.floor((now - new Date(f.due_date)) / 86_400_000)} days overdue` : "Due today"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {overdue.map(f => <FollowUpRow key={f.id} f={f} isOverdue />)}
      {today.map(f => <FollowUpRow key={f.id} f={f} isOverdue={false} />)}
    </div>
  );
}

function LeadsCompact({ leads = [] }) {
  if (!leads || leads.length === 0) return null;

  const hot = leads.filter(l => l.fit_score === "hot");
  const warm = leads.filter(l => l.fit_score === "warm");
  const cold = leads.filter(l => l.fit_score === "cold" || !l.fit_score);

  const dotColor = (fit) => fit === "hot" ? "bg-jarvis-success" : fit === "warm" ? "bg-jarvis-warning" : "bg-jarvis-muted/30";

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[12px] font-display font-semibold text-jarvis-ink">Leads</span>
        <span className="text-[9px] text-jarvis-muted">
          <span className="text-jarvis-success">{hot.length}</span> ·{" "}
          <span className="text-jarvis-warning">{warm.length}</span> ·{" "}
          <span>{cold.length}</span>
        </span>
      </div>
      {[...hot, ...warm, ...cold].slice(0, 5).map(l => (
        <div key={l.id} className="flex items-center gap-1.5 py-1 cursor-pointer hover:bg-jarvis-ghost/20 rounded px-1 -mx-1 transition">
          <div className={`w-[5px] h-[5px] rounded-full shrink-0 ${dotColor(l.fit_score)}`} />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] text-jarvis-ink truncate">{l.title || l.org_name}</div>
            <div className="text-[9px] text-jarvis-muted truncate">
              {l.source || "New inbound"}
              {l.research && <span className="text-jarvis-primary ml-1">· Researched</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- Main SalesDashboard ----

export function SalesDashboard({ ops, onRefresh }) {
  const { deals = [], followUps = [], proposals = [], comms = [], docs = [], intelligence, crm } = ops;
  const [crmDealOpen, setCrmDealOpen] = useState(null);
  const [openDeal, setOpenDeal] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);

  const hasCRM = crm?.connected && (crm.deals?.length > 0 || Object.keys(crm.pipeline || {}).length > 0);
  const allDeals = hasCRM ? crm.deals : deals;
  const calendarEvents = ops.calendarEvents || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 3-column grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_280px] overflow-hidden">

        {/* COLUMN 1: Pipeline */}
        <div className="border-r border-jarvis-border/50 p-4 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-display font-semibold text-jarvis-ink">Pipeline</span>
            <button
              onClick={() => setCompareOpen(true)}
              className="text-[10px] text-jarvis-muted hover:text-jarvis-ink transition"
              title="Compare deals"
            >
              Compare
            </button>
          </div>

          {hasCRM ? (
            <PipelineBoard pipeline={crm.pipeline} onOpenDeal={setCrmDealOpen} />
          ) : (
            <div className="text-xs text-jarvis-muted text-center py-8">Connect Pipedrive to see pipeline.</div>
          )}
        </div>

        {/* COLUMN 2: Proposals + Emails */}
        <div className="border-r border-jarvis-border/50 p-4 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {/* Proposals */}
          <div className="mb-5">
            <ProposalList proposals={proposals} onRefresh={onRefresh} />
          </div>

          {/* Emails */}
          <EmailInbox deals={allDeals} />
        </div>

        {/* COLUMN 3: Calendar + Follow-ups + Leads */}
        <div className="p-4 overflow-y-auto bg-jarvis-surface/30" style={{ scrollbarWidth: "thin" }}>
          {/* Calendar */}
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Calendar size={12} className="text-jarvis-muted" />
              <span className="text-[12px] font-display font-semibold text-jarvis-ink">Today</span>
            </div>
            <CalendarToday calendarEvents={calendarEvents} />
          </div>

          {/* Follow-ups */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Clock size={12} className="text-jarvis-muted" />
                <span className="text-[12px] font-display font-semibold text-jarvis-ink">Follow-ups</span>
              </div>
              {followUps.filter(f => f.due_date && new Date(f.due_date) <= new Date()).length > 0 && (
                <span className="text-[9px] bg-jarvis-danger/10 text-jarvis-danger px-1.5 py-0.5 rounded">
                  {followUps.filter(f => f.due_date && new Date(f.due_date) <= new Date()).length} due
                </span>
              )}
            </div>
            <FollowUpsColumn followUps={followUps} deals={allDeals} onOpenDeal={hasCRM ? setCrmDealOpen : setOpenDeal} />
          </div>

          {/* Leads */}
          {crm?.leads?.length > 0 && (
            <LeadsCompact leads={crm.leads} />
          )}
        </div>
      </div>

      {/* Deal Comparison Modal */}
      {compareOpen && <DealComparison deals={allDeals} onClose={() => setCompareOpen(false)} />}

      {/* Deal Room — Supabase fallback */}
      {openDeal && <DealRoom dealId={openDeal.id} deal={openDeal} onClose={() => setOpenDeal(null)} />}

      {/* Deal Room Panel — CRM slide-out */}
      <AnimatePresence>
        {crmDealOpen && <DealRoomPanel deal={crmDealOpen} onClose={() => setCrmDealOpen(null)} />}
      </AnimatePresence>
    </div>
  );
}
