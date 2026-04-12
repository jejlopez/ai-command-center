import { Gauge } from "lucide-react";

function scoreColor(score) {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

function scoreLabel(score) {
  if (score >= 80) return "Simple";
  if (score >= 60) return "Manageable";
  if (score >= 40) return "Complex";
  return "Overwhelmed";
}

export function SimplificationScore({ vendors = [], decisions = [], expenses = [], nodes = [] }) {
  const activeSubscriptions = expenses.length;
  const activeVendors = vendors.length;
  const pendingDecisions = decisions.filter(d => d.status === "pending").length;
  const recurringTasks = nodes.filter(n => n.kind === "task").length;

  const totalCount = activeSubscriptions + activeVendors + pendingDecisions + recurringTasks;
  const score = Math.max(0, Math.min(100, 100 - totalCount * 5));

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-3">
        <Gauge size={14} className="text-jarvis-purple" />
        <div className="label">Simplification Score</div>
      </div>

      <div className="text-center py-2">
        <div className={`text-4xl font-bold tabular-nums ${scoreColor(score)}`}>{score}</div>
        <div className="text-[11px] text-jarvis-muted mt-0.5">{scoreLabel(score)} · out of 100</div>
      </div>

      <div className="mt-3 space-y-1 text-[11px]">
        {[
          { label: "Subscriptions", count: activeSubscriptions },
          { label: "Vendors", count: activeVendors },
          { label: "Pending decisions", count: pendingDecisions },
          { label: "Recurring tasks", count: recurringTasks },
        ].map(({ label, count }) => (
          <div key={label} className="flex justify-between text-jarvis-muted">
            <span>{label}</span>
            <span className="text-jarvis-ink font-medium tabular-nums">{count}</span>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-jarvis-muted mt-3 italic border-t border-jarvis-border pt-2">
        "The chains of habit are too light to be felt until they are too heavy to be broken." — Buffett
      </p>
    </div>
  );
}
