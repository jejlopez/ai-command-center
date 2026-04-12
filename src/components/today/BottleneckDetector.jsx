import { AlertOctagon, CheckCircle, ArrowRight } from "lucide-react";

function findBottleneck({ followUps = [], decisions = [], deals = [], positions = [] }) {
  const overdueFollowUps = followUps.filter((f) => {
    if (!f.due_date) return false;
    return new Date(f.due_date) < new Date();
  });

  const pendingDecisions = decisions.filter((d) => d.status === "pending");
  const totalDecisionCost = pendingDecisions.reduce((s, d) => s + (d.cost_per_day ?? 0), 0);

  const staleDays = (ts) => ts ? Math.floor((Date.now() - new Date(ts).getTime()) / 86400000) : 0;
  const staleDeals = deals.filter((d) => staleDays(d.last_touch) > 7);

  const atRiskPositions = positions.filter((p) => !p.stop_loss);

  const candidates = [
    overdueFollowUps.length > 0 && {
      severity: "red",
      text: `${overdueFollowUps.length} overdue follow-up${overdueFollowUps.length > 1 ? "s" : ""} blocking pipeline`,
      action: "Open Follow-Ups and clear the queue",
      score: overdueFollowUps.length * 30,
    },
    staleDeals.length > 0 && {
      severity: "red",
      text: `${staleDeals.length} deal${staleDeals.length > 1 ? "s" : ""} going cold (7+ days no touch)`,
      action: "Send a check-in to each stale deal today",
      score: staleDeals.length * 25,
    },
    totalDecisionCost > 0 && {
      severity: "amber",
      text: `${pendingDecisions.length} undecided items costing ~$${totalDecisionCost}/day`,
      action: "Make one decision right now — the most expensive one",
      score: totalDecisionCost,
    },
    atRiskPositions.length > 0 && {
      severity: "amber",
      text: `${atRiskPositions.length} position${atRiskPositions.length > 1 ? "s" : ""} with no stop-loss`,
      action: "Set stop-loss levels before market moves",
      score: atRiskPositions.length * 20,
    },
  ].filter(Boolean).sort((a, b) => b.score - a.score);

  return candidates[0] ?? null;
}

export function BottleneckDetector({ followUps, decisions, deals, positions }) {
  const bottleneck = findBottleneck({ followUps, decisions, deals, positions });

  if (!bottleneck) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Bottleneck Detector</div>
        <div className="flex items-center gap-2 text-sm text-jarvis-green">
          <CheckCircle size={14} />
          <span>No bottlenecks — full speed.</span>
        </div>
      </div>
    );
  }

  const colorClass = bottleneck.severity === "red" ? "text-jarvis-red" : "text-jarvis-amber";
  const borderClass = bottleneck.severity === "red" ? "border-jarvis-red/30" : "border-jarvis-amber/30";
  const bgClass = bottleneck.severity === "red" ? "bg-jarvis-red/5" : "bg-jarvis-amber/5";

  return (
    <div className="glass p-5">
      <div className="label mb-3">Bottleneck Detector</div>
      <div className={`rounded-xl border ${borderClass} ${bgClass} p-3 space-y-2`}>
        <div className="flex items-start gap-2">
          <AlertOctagon size={15} className={`${colorClass} mt-0.5 shrink-0`} />
          <span className={`text-sm font-medium ${colorClass}`}>{bottleneck.text}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-jarvis-body pl-5">
          <ArrowRight size={11} />
          <span>{bottleneck.action}</span>
        </div>
      </div>
    </div>
  );
}
