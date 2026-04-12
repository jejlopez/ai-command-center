import { motion } from "framer-motion";
import { stagger } from "../../lib/motion.js";
import { ProposalList } from "./ProposalList.jsx";
import { QuoteCalculator } from "./QuoteCalculator.jsx";
import { WinLossJournal } from "./WinLossJournal.jsx";
import { RevenueForecast } from "./RevenueForecast.jsx";
import { CommunicationLog } from "./CommunicationLog.jsx";
import { DocumentVault } from "./DocumentVault.jsx";

// Pipeline strip — compact horizontal funnel
function PipelineStrip({ stats }) {
  if (!stats) return null;
  const stages = [
    { key: "prospect",    label: "Prospect",    color: "text-jarvis-muted"   },
    { key: "qualified",   label: "Qualified",   color: "text-blue-400"        },
    { key: "proposal",    label: "Proposal",    color: "text-jarvis-warning"  },
    { key: "negotiation", label: "Negotiation", color: "text-jarvis-primary"  },
    { key: "closed_won",  label: "Won",         color: "text-jarvis-success"  },
  ];
  return (
    <div className="glass p-3">
      <div className="flex items-center gap-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {stages.map((s, i) => {
          const count = stats[s.key + "_count"] ?? 0;
          const val   = stats[s.key + "_value"] ?? 0;
          return (
            <div key={s.key} className="flex items-center gap-3 shrink-0">
              <div className="flex flex-col">
                <span className="label">{s.label}</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className={`text-lg font-bold tabular-nums ${s.color}`}>{count}</span>
                  <span className="text-[10px] text-jarvis-muted">${(val / 1000).toFixed(0)}k</span>
                </div>
              </div>
              {i < stages.length - 1 && (
                <div className="text-jarvis-ghost/40 text-lg shrink-0">›</div>
              )}
            </div>
          );
        })}
        {stats.total_value > 0 && (
          <div className="ml-auto shrink-0 flex flex-col items-end">
            <span className="label">Total Pipeline</span>
            <span className="text-sm font-semibold text-jarvis-ink mt-1">${(stats.total_value / 1000).toFixed(0)}k</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Follow-up queue — compact list
function FollowUpStrip({ followUps = [] }) {
  if (followUps.length === 0) {
    return (
      <div className="glass p-3">
        <div className="label mb-2">Follow-ups Due</div>
        <p className="text-xs text-jarvis-ghost">No follow-ups due. You're clear.</p>
      </div>
    );
  }
  return (
    <div className="glass p-3">
      <div className="label mb-2">Follow-ups Due</div>
      <div className="flex flex-col gap-1">
        {followUps.slice(0, 5).map((f, i) => {
          const isOverdue = f.due_date && new Date(f.due_date) < new Date();
          return (
            <div key={f.id ?? i} className="flex items-center gap-2 py-1 border-b border-jarvis-border/50 last:border-0">
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOverdue ? "bg-jarvis-danger" : "bg-blue-400"}`} />
              <span className="text-xs text-jarvis-ink flex-1 truncate">{f.contact_name || f.subject || "Follow-up"}</span>
              {f.due_date && (
                <span className={`text-[10px] shrink-0 ${isOverdue ? "text-jarvis-danger" : "text-jarvis-muted"}`}>
                  {new Date(f.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SalesDashboard({ ops, onRefresh }) {
  const { deals = [], followUps = [], proposals = [], comms = [], docs = [], intelligence } = ops;

  return (
    <motion.div
      className="flex flex-col gap-4 p-4 overflow-y-auto h-full"
      variants={stagger.container}
      initial="hidden"
      animate="show"
    >
      {/* Pipeline strip — full width */}
      <motion.div variants={stagger.item}>
        <PipelineStrip stats={intelligence?.pipeline_stats} />
      </motion.div>

      {/* Row 1: Follow-ups + Proposals */}
      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FollowUpStrip followUps={followUps} />
        <ProposalList proposals={proposals} onRefresh={onRefresh} />
      </motion.div>

      {/* Row 2: Forecast + Win/Loss */}
      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueForecast deals={deals} />
        <WinLossJournal deals={deals} />
      </motion.div>

      {/* Row 3: Comms + Docs */}
      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CommunicationLog comms={comms} onRefresh={onRefresh} />
        <DocumentVault docs={docs} onRefresh={onRefresh} />
      </motion.div>

      {/* Row 4: Quote Calculator — full width */}
      <motion.div variants={stagger.item}>
        <QuoteCalculator onRefresh={onRefresh} />
      </motion.div>
    </motion.div>
  );
}
