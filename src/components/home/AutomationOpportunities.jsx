import { Zap } from "lucide-react";

const HARDCODED = [
  { task: "Grocery shopping", hours: 1.5, freq: "weekly", service: "Instacart / delivery" },
  { task: "House cleaning", hours: 2.0, freq: "weekly", service: "Cleaning service" },
  { task: "Lawn mowing", hours: 1.0, freq: "weekly", service: "Landscaping service" },
  { task: "Bill payments", hours: 0.5, freq: "monthly", service: "Auto-pay setup" },
  { task: "Car washing", hours: 0.5, freq: "weekly", service: "Auto car wash subscription" },
];

function hoursPerMonth(hours, freq) {
  return freq === "weekly" ? hours * 4.33 : hours;
}

export function AutomationOpportunities({ nodes = [] }) {
  // Pull tasks from memory nodes
  const memoryTasks = nodes
    .filter((n) => n.kind === "task" && n.label)
    .slice(0, 3)
    .map((n) => ({
      task: n.label,
      hours: 0.5,
      freq: "weekly",
      service: "Delegate or automate",
    }));

  const opportunities = [...HARDCODED, ...memoryTasks];
  const totalMonthly = opportunities.reduce((sum, o) => sum + hoursPerMonth(o.hours, o.freq), 0);

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={14} className="text-jarvis-purple" />
        <div className="label">Automation Opportunities</div>
        <span className="ml-auto chip bg-jarvis-purple/10 border border-jarvis-purple/20 text-jarvis-purple text-[10px]">
          ~{totalMonthly.toFixed(0)} hrs/mo recoverable
        </span>
      </div>
      <div className="space-y-2">
        {opportunities.map((o, i) => {
          const mo = hoursPerMonth(o.hours, o.freq);
          return (
            <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-xl bg-jarvis-surface/30 border border-jarvis-border">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-jarvis-ink">{o.task}</div>
                <div className="text-[10px] text-jarvis-muted mt-0.5">→ {o.service}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-semibold text-jarvis-purple">{mo.toFixed(1)} hrs/mo</div>
                <div className="text-[10px] text-jarvis-muted">{o.hours}h × {o.freq}</div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-jarvis-muted mt-3 italic">
        "The most dangerous kind of waste is the waste we do not recognize." — Shigeo Shingo
      </p>
    </div>
  );
}
