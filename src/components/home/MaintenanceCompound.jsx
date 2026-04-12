import { ShieldCheck } from "lucide-react";

const COMPOUND_ITEMS = [
  { task: "Change HVAC filter", cost: 20,    prevents: "Compressor failure",    savingsAverted: 2000, interval: "Every 3 months" },
  { task: "Clean gutters",      cost: 150,   prevents: "Foundation water damage", savingsAverted: 8000, interval: "2× per year" },
  { task: "Inspect roof",       cost: 200,   prevents: "Major roof repair",     savingsAverted: 10000, interval: "Annual" },
  { task: "Flush water heater", cost: 0,     prevents: "Premature failure",     savingsAverted: 1200, interval: "Annual" },
  { task: "Test smoke alarms",  cost: 5,     prevents: "Fire risk",             savingsAverted: 50000, interval: "Bi-annual" },
  { task: "Seal windows/doors", cost: 30,    prevents: "Heat loss + moisture",  savingsAverted: 600,  interval: "Annual" },
];

export function MaintenanceCompound({ nodes = [] }) {
  // Merge any maintenance nodes from memory
  const memoryItems = nodes
    .filter(n => {
      const l = (n.label ?? "").toLowerCase();
      return l.includes("maintenance") || l.includes("filter") || l.includes("inspect");
    })
    .slice(0, 3)
    .map(n => ({
      task: n.label,
      cost: 0,
      prevents: "Potential issue",
      savingsAverted: 500,
      interval: "As needed",
    }));

  const items = [...COMPOUND_ITEMS, ...memoryItems];
  const totalSavings = items.reduce((s, i) => s + i.savingsAverted, 0);
  const totalCost = items.reduce((s, i) => s + i.cost, 0);

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={14} className="text-green-400" />
        <div className="label">Maintenance Compounds</div>
        <span className="ml-auto chip bg-green-500/10 border border-green-500/20 text-green-400 text-[10px]">
          ~${totalSavings.toLocaleString()} protected
        </span>
      </div>
      <div className="text-[11px] text-jarvis-muted mb-4">
        Annual maintenance cost: <span className="text-jarvis-ink font-semibold">${totalCost}/yr</span> · ROI: {((totalSavings / Math.max(totalCost, 1)) * 100).toFixed(0)}×
      </div>

      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-3 px-3 py-2 rounded-xl border border-green-500/10 bg-green-500/5 hover:border-green-500/20 transition">
            <div className="flex-1 min-w-0">
              <div className="text-sm text-jarvis-ink">{item.task}</div>
              <div className="text-[10px] text-jarvis-muted mt-0.5">Prevents: {item.prevents} · {item.interval}</div>
            </div>
            <div className="text-right shrink-0">
              {item.cost > 0 && <div className="text-[11px] text-jarvis-muted">${item.cost}</div>}
              <div className="text-xs font-semibold text-green-400">saves ${item.savingsAverted.toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-jarvis-muted mt-3 italic border-t border-jarvis-border pt-2">
        Preventive maintenance is the highest-ROI investment in your home.
      </p>
    </div>
  );
}
