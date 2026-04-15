// SalesCommandBriefing — Tony Stark morning brief.
// Collapsible strip showing today's priority stack, ranked by urgency.

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useLeadsSupa } from "../../hooks/useLeadsSupa.js";
import { useApprovalsSupa } from "../../hooks/useApprovalsSupa.js";

const STORAGE_KEY = "jarvis_briefing_expanded";

function getInitialExpanded() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === null ? true : v === "true";
  } catch {
    return true;
  }
}

const BORDER_COLORS = {
  red:    "border-l-red-500",
  yellow: "border-l-yellow-400",
  green:  "border-l-green-500",
  purple: "border-l-purple-500",
  blue:   "border-l-blue-400",
  gray:   "border-l-zinc-500",
};

const BG_COLORS = {
  red:    "bg-red-500/5",
  yellow: "bg-yellow-400/5",
  green:  "bg-green-500/5",
  purple: "bg-purple-500/5",
  blue:   "bg-blue-400/5",
  gray:   "bg-zinc-500/5",
};

function PriorityRow({ color = "gray", children }) {
  return (
    <div
      className={`
        border-l-[3px] ${BORDER_COLORS[color]} ${BG_COLORS[color]}
        px-3 py-2 rounded-r-md text-[11px] text-jarvis-ink leading-snug
      `}
    >
      {children}
    </div>
  );
}

function StatPill({ label, value, accent }) {
  const accents = {
    default: "text-jarvis-ink",
    danger:  "text-red-400",
    warning: "text-yellow-400",
    success: "text-green-400",
    purple:  "text-purple-400",
  };
  return (
    <div className="flex flex-col items-center min-w-[56px]">
      <span className={`text-[15px] font-light ${accents[accent] || accents.default}`}>{value}</span>
      <span className="text-[8px] uppercase tracking-widest text-jarvis-muted">{label}</span>
    </div>
  );
}

export function SalesCommandBriefing({ deals = [], followUps = [], calendarEvents = [] }) {
  const [expanded, setExpanded] = useState(getInitialExpanded);
  const { leads = [] } = useLeadsSupa();
  const { approvals = [] } = useApprovalsSupa({ statusFilter: "pending" });

  // Normalize: useApprovalsSupa returns { approvals } not { pending }
  const pending = approvals;

  const today = new Date().toISOString().slice(0, 10);

  const {
    hotCalls,
    atRiskFollowUps,
    discoveryCalls,
    pendingCount,
    newResearching,
    staleLeads,
    pipelineValue,
    hotLeadsCount,
    dealsAtRisk,
    followUpsOverdue,
  } = useMemo(() => {
    // 1. Hot leads — call_now NBA
    const hotCalls = leads.filter(
      (l) => l.nba === "call_now" || l.next_best_action === "call_now"
    );

    // 2. At-risk deals or last touched > 4 days ago with a proposal
    const now = Date.now();
    const FOUR_DAYS = 4 * 24 * 60 * 60 * 1000;
    const atRiskFollowUps = deals.filter((d) => {
      const isAtRisk = d.attention === "at_risk";
      const isStale = d.last_touch
        ? now - new Date(d.last_touch).getTime() > FOUR_DAYS
        : false;
      const hasProposal = !!d.proposal_sent_at || d.stage === "proposal";
      return isAtRisk || (isStale && hasProposal);
    });

    // 3. Discovery calls today
    const todayEventTitles = calendarEvents
      .filter((e) => (e.date || e.start || "").slice(0, 10) === today)
      .map((e) => (e.title || e.summary || "").toLowerCase());

    const discoveryCalls = leads
      .filter((l) => l.status === "discovery_set")
      .map((l) => {
        const company = (l.company || "").toLowerCase();
        const matchedEvent = calendarEvents.find(
          (e) =>
            (e.date || e.start || "").slice(0, 10) === today &&
            (e.title || e.summary || "").toLowerCase().includes(company)
        );
        return matchedEvent ? { lead: l, event: matchedEvent } : null;
      })
      .filter(Boolean);

    // 4. Pending approvals
    const pendingCount = pending.length;

    // 5. New leads being researched
    const newResearching = leads.filter(
      (l) => l.status === "researching" || l.status === "new"
    );

    // 6. Stale leads
    const STALE_DAYS = 14 * 24 * 60 * 60 * 1000;
    const staleLeads = leads.filter(
      (l) =>
        l.last_touch
          ? now - new Date(l.last_touch).getTime() > STALE_DAYS
          : false
    );

    // Stats
    const pipelineValue = deals.reduce(
      (sum, d) => sum + (Number(d.value) || Number(d.amount) || 0),
      0
    );
    const hotLeadsCount = hotCalls.length;
    const dealsAtRisk = atRiskFollowUps.length;
    const followUpsOverdue = followUps.filter(
      (f) => f.due_date && new Date(f.due_date) < new Date()
    ).length;

    return {
      hotCalls,
      atRiskFollowUps,
      discoveryCalls,
      pendingCount,
      newResearching,
      staleLeads,
      pipelineValue,
      hotLeadsCount,
      dealsAtRisk,
      followUpsOverdue,
    };
  }, [leads, deals, calendarEvents, followUps, pending, today]);

  const totalItems =
    hotCalls.length +
    atRiskFollowUps.length +
    discoveryCalls.length +
    (pendingCount > 0 ? 1 : 0) +
    (newResearching.length > 0 ? 1 : 0) +
    (staleLeads.length > 0 ? 1 : 0);

  function toggle() {
    setExpanded((v) => {
      const next = !v;
      try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      return next;
    });
  }

  const fmtCurrency = (v) =>
    v >= 1_000_000
      ? `$${(v / 1_000_000).toFixed(1)}M`
      : v >= 1000
      ? `$${(v / 1000).toFixed(0)}K`
      : `$${v}`;

  return (
    <div className="surface rounded-xl overflow-hidden border border-white/[0.06]">
      {/* Header bar */}
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-medium text-jarvis-ink tracking-wide">
            Good morning. Here's your stack.
          </span>
          {!expanded && (
            <div className="flex items-center gap-2 ml-1">
              {hotCalls.length > 0 && (
                <span className="text-[10px] text-red-400 font-medium">
                  {hotCalls.length} hot
                </span>
              )}
              {dealsAtRisk > 0 && (
                <span className="text-[10px] text-yellow-400 font-medium">
                  {dealsAtRisk} at risk
                </span>
              )}
              {pendingCount > 0 && (
                <span className="text-[10px] text-purple-400 font-medium">
                  {pendingCount} pending
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {totalItems > 0 && expanded && (
            <span className="text-[9px] uppercase tracking-widest text-jarvis-muted">
              {totalItems} item{totalItems !== 1 ? "s" : ""}
            </span>
          )}
          {expanded ? (
            <ChevronUp size={14} className="text-jarvis-muted" />
          ) : (
            <ChevronDown size={14} className="text-jarvis-muted" />
          )}
        </div>
      </button>

      {/* Expanded body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="briefing-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-1.5">
              {/* 1. Hot calls */}
              {hotCalls.map((lead) => (
                <PriorityRow key={lead.id} color="red">
                  🔥 Call <strong>{lead.company || lead.name}</strong> NOW
                  {lead.nba_reason || lead.reason
                    ? ` — ${lead.nba_reason || lead.reason}`
                    : ""}
                </PriorityRow>
              ))}

              {/* 2. At-risk follow-ups */}
              {atRiskFollowUps.map((deal) => {
                const reason =
                  deal.attention === "at_risk"
                    ? "deal at risk"
                    : "not touched in 4+ days";
                return (
                  <PriorityRow key={deal.id} color="yellow">
                    Send follow-up to <strong>{deal.company || deal.name}</strong> — {reason}
                  </PriorityRow>
                );
              })}

              {/* 3. Discovery calls today */}
              {discoveryCalls.map(({ lead, event }) => {
                const time = event.start
                  ? new Date(event.start).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : event.time || "";
                return (
                  <PriorityRow key={lead.id} color="green">
                    Prep for <strong>{lead.company || lead.name}</strong> discovery call
                    {time ? ` — ${time}` : ""}
                  </PriorityRow>
                );
              })}

              {/* 4. Pending approvals */}
              {pendingCount > 0 && (
                <PriorityRow color="purple">
                  <strong>{pendingCount}</strong> draft{pendingCount !== 1 ? "s" : ""} waiting for your review
                </PriorityRow>
              )}

              {/* 5. New leads researching */}
              {newResearching.length > 0 && (
                <PriorityRow color="blue">
                  <strong>{newResearching.length}</strong> new lead{newResearching.length !== 1 ? "s" : ""} imported — research queued
                </PriorityRow>
              )}

              {/* 6. Stale leads */}
              {staleLeads.length > 0 && (
                <PriorityRow color="gray">
                  <strong>{staleLeads.length}</strong> lead{staleLeads.length !== 1 ? "s" : ""} going stale — breakup emails drafted
                </PriorityRow>
              )}

              {totalItems === 0 && (
                <p className="text-[11px] text-jarvis-muted py-1">
                  Clear board. No urgent actions right now.
                </p>
              )}

              {/* Summary stats */}
              <div className="pt-3 mt-1 border-t border-white/[0.06] flex items-center justify-around">
                <StatPill label="pipeline" value={fmtCurrency(pipelineValue)} accent="default" />
                <StatPill label="hot leads" value={hotLeadsCount} accent="danger" />
                <StatPill label="at risk" value={dealsAtRisk} accent="warning" />
                <StatPill label="approvals" value={pendingCount} accent="purple" />
                <StatPill label="overdue" value={followUpsOverdue} accent="warning" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
