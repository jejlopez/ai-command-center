// SalesDashboard — 3-column layout: Pipeline | Proposals+Email | Calendar+Actions.
// All existing functionality preserved, reorganized for visibility.

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { jarvis } from "../../lib/jarvis.js";
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

  const hot = leads.filter(l => l.fit_score === "hot" || l.attention === "hot");
  const count = leads.length;

  return (
    <div className="surface p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] font-display font-semibold text-jarvis-ink">Leads</span>
          <span className="text-[9px] text-jarvis-ghost">({count})</span>
        </div>
        {hot.length > 0 && (
          <span className="text-[9px] text-jarvis-danger font-semibold">🔥 {hot.length} hot</span>
        )}
      </div>
      <div className="text-[10px] text-jarvis-muted mt-1">
        Full leads inbox in the <span className="text-jarvis-primary font-medium">Leads tab</span> →
      </div>
    </div>
  );
}

// ---- Main SalesDashboard ----

export function SalesDashboard({ ops, onRefresh }) {
  const { deals = [], followUps = [], proposals = [], comms = [], docs = [], intelligence, crm } = ops;
  const [crmDealOpen, setCrmDealOpen] = useState(null);
  const [openDeal, setOpenDeal] = useState(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [pipelineFilter, setPipelineFilter] = useState("New pipeline");
  const [statusFilter, setStatusFilter] = useState("open");
  const [syncLabel, setSyncLabel] = useState("");

  // Poll sync status every 60s
  useEffect(() => {
    const check = () => {
      jarvis.crmSyncStatus?.().then(s => {
        setSyncLabel(s?.agoLabel || "");
      }).catch(() => {});
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, []);

  const hasCRM = crm?.connected && (crm.deals?.length > 0 || Object.keys(crm.pipeline || {}).length > 0);
  const rawDeals = deals.length > 0 ? deals : (hasCRM ? crm.deals : []);

  // Lead stages — these show in the Leads tab, not the pipeline
  const LEAD_STAGES = ["new lead", "new leads", "pipedrive leads", "gather info"];
  const isLeadStage = (stage) => LEAD_STAGES.some(ls => (stage || "").toLowerCase().includes(ls));

  // Get unique pipeline names for filter dropdown
  const pipelineNames = [...new Set(rawDeals.map(d => (d.pipeline || d.pipe || "Unknown").trim()))].sort();

  // Filter deals by pipeline, status, and exclude lead stages
  const allDeals = rawDeals.filter(d => {
    const pipe = (d.pipeline || d.pipe || "").trim();
    const status = (d.status || "open").toLowerCase();
    const stage = d.stage || "";

    // Pipeline filter
    if (pipelineFilter !== "all" && pipe !== pipelineFilter) return false;
    // Status filter
    if (statusFilter !== "all" && status !== statusFilter) return false;
    // Exclude lead stages from pipeline view (they belong in Leads tab)
    if (statusFilter === "open" && isLeadStage(stage)) return false;

    return true;
  });

  // Build pipeline from Supabase deals (grouped by stage), normalizing field names
  const supaPipeline = {};
  if (deals.length > 0) {
    for (const d of deals) {
      const stage = (d.stage || "Unknown").trim();
      // Skip closed deals from pipeline view
      if (stage === "closed_won" || stage === "closed_lost") continue;
      // Normalize Supabase field names to match what PipelineBoard/DealCard expects
      const normalized = {
        ...d,
        title: d.company || d.title,
        org_name: d.company || d.org_name,
        value: d.value_usd || d.value || 0,
        stage_name: stage,
        person_name: d.contact_name,
        add_time: d.created_at,
        update_time: d.updated_at || d.last_touch,
        last_activity_date: d.last_touch,
      };
      (supaPipeline[stage] ??= []).push(normalized);
    }
  }
  const calendarEvents = ops.calendarEvents || [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* 3-column grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr_280px] overflow-hidden">

        {/* COLUMN 1: Pipeline */}
        <div className="border-r border-jarvis-border/50 p-4 overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-display font-semibold text-jarvis-ink">Pipeline</span>
              <select
                value={pipelineFilter}
                onChange={e => setPipelineFilter(e.target.value)}
                className="text-[10px] bg-white/5 border border-jarvis-border rounded px-2 py-0.5 text-jarvis-body outline-none focus:border-jarvis-primary/40"
              >
                {pipelineNames.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
                <option value="all">All pipelines</option>
              </select>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="text-[10px] bg-white/5 border border-jarvis-border rounded px-2 py-0.5 text-jarvis-body outline-none focus:border-jarvis-primary/40"
              >
                <option value="open">Open ({allDeals.length})</option>
                <option value="won">Won</option>
                <option value="lost">Lost</option>
                <option value="all">All statuses</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              {syncLabel && (
                <span className="text-[9px] text-jarvis-muted tabular-nums">Synced {syncLabel}</span>
              )}
              <button
                onClick={() => setCompareOpen(true)}
                className="text-[10px] text-jarvis-muted hover:text-jarvis-ink transition"
                title="Compare deals"
              >
                Compare
              </button>
            </div>
          </div>

          {Object.keys(supaPipeline).length > 0 ? (
            <PipelineBoard pipeline={supaPipeline} onOpenDeal={setCrmDealOpen} />
          ) : hasCRM ? (
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
