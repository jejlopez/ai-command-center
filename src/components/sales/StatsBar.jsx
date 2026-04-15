// StatsBar — top metrics strip for the Sales tab.

import { motion } from "framer-motion";
import { fadeIn } from "../../lib/motion.js";

function Stat({ label, value, color }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] text-jarvis-muted uppercase tracking-wider">{label}</span>
      <span className={`text-xl font-bold tabular-nums ${color || "text-jarvis-ink"}`}>{value}</span>
    </div>
  );
}

export function StatsBar({ deals = [], proposals = [], followUps = [], activeTab, onTabChange }) {
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
      <div className="flex gap-7">
        <Stat label="Pipeline" value={fmt(totalValue)} />
        <Stat label="Deals" value={deals.length} />
        <Stat label="Overdue" value={overdue} color={overdue > 0 ? "text-jarvis-danger" : undefined} />
        <Stat label="Proposals" value={proposalsOut} color="text-jarvis-primary" />
        <Stat label="Closing" value={fmt(closingValue)} color="text-jarvis-success" />
      </div>

      <div className="flex gap-1.5 items-center">
        <button
          onClick={() => onTabChange("sales")}
          className={`text-[11px] px-3.5 py-1.5 rounded-lg transition font-medium ${
            activeTab === "sales"
              ? "bg-jarvis-primary/15 text-jarvis-primary"
              : "text-jarvis-muted hover:text-jarvis-ink"
          }`}
        >
          Sales
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
