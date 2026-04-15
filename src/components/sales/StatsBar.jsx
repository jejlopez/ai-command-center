// StatsBar — top metrics strip for the Sales tab.

import { motion } from "framer-motion";
import { fadeIn } from "../../lib/motion.js";

function Stat({ label, value, color, isLast }) {
  return (
    <div className="flex items-center gap-7">
      <div className="flex flex-col">
        <span className="text-[8px] text-jarvis-muted uppercase tracking-[0.15em] mb-0.5">{label}</span>
        <span className={`text-lg font-display font-semibold tabular-nums leading-none ${color || "text-jarvis-ink"}`}>{value}</span>
      </div>
      {!isLast && <div className="w-px h-6 bg-jarvis-border/50" />}
    </div>
  );
}

export function StatsBar({ deals = [], proposals = [], followUps = [], leads = [], activeTab, onTabChange }) {
  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0);
  const overdue = followUps.filter(f => f.due_date && new Date(f.due_date) < new Date()).length;
  const proposalsOut = proposals.filter(p => p.status === "sent" || p.status === "review_needed").length;

  // Estimate close this month: deals in signing/negotiation
  const closingStages = ["Signing Contract", "Negotiations Started"];
  const closingValue = deals
    .filter(d => closingStages.some(s => (d.stage_name || d.stage || "").trim().startsWith(s)))
    .reduce((s, d) => s + (d.value || 0), 0);

  const fmt = (v) => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`;

  return (
    <motion.div
      variants={fadeIn}
      initial="hidden"
      animate="show"
      className="flex items-center justify-between px-5 py-3 border-b border-jarvis-border bg-jarvis-surface/50"
    >
      <div className="flex items-center gap-0">
        <Stat label="Leads" value={leads.length} color="text-blue-400" />
        <Stat label="Pipeline" value={fmt(totalValue)} />
        <Stat label="Deals" value={deals.length} />
        <Stat label="Overdue" value={overdue} color={overdue > 0 ? "text-jarvis-danger" : undefined} />
        <Stat label="Proposals" value={proposalsOut} color="text-jarvis-primary" />
        <Stat label="Closing" value={fmt(closingValue)} color="text-jarvis-success" isLast />
      </div>

      <div className="flex gap-1.5 items-center">
        <button
          onClick={() => onTabChange("leads")}
          className={`text-[11px] px-3.5 py-1.5 rounded-lg transition font-medium ${
            activeTab === "leads"
              ? "bg-jarvis-primary/15 text-jarvis-primary"
              : "text-jarvis-muted hover:text-jarvis-ink"
          }`}
        >
          Leads
        </button>
        <button
          onClick={() => onTabChange("deals")}
          className={`text-[11px] px-3.5 py-1.5 rounded-lg transition font-medium ${
            activeTab === "deals"
              ? "bg-jarvis-primary/15 text-jarvis-primary"
              : "text-jarvis-muted hover:text-jarvis-ink"
          }`}
        >
          Deals
        </button>
        <button
          onClick={() => onTabChange("playbook")}
          className={`text-[11px] px-3.5 py-1.5 rounded-lg transition font-medium ${
            activeTab === "playbook"
              ? "bg-jarvis-warning/15 text-jarvis-warning"
              : "text-jarvis-muted hover:text-jarvis-ink"
          }`}
        >
          Playbook
        </button>
      </div>
    </motion.div>
  );
}
