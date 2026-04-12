import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

function roleBadge(type) {
  switch (type) {
    case "deal": return <span className="chip text-[10px] bg-blue-500/15 text-jarvis-blue">Sales</span>;
    case "position": return <span className="chip text-[10px] bg-purple-500/15 text-jarvis-purple">Trading</span>;
    case "followup": return <span className="chip text-[10px] bg-cyan-500/15 text-jarvis-cyan">Action</span>;
    default: return null;
  }
}

function scoreItem(item) {
  if (item.type === "deal") return (item.value_usd ?? 0) * ((item.probability ?? 50) / 100);
  if (item.type === "position") return Math.abs(item.pnl_usd ?? 0);
  if (item.type === "followup") return item.priority === "urgent" ? 100000 : item.priority === "high" ? 50000 : 1000;
  return 0;
}

export function TopFiveFocus({ deals, positions, followUps }) {
  const [expanded, setExpanded] = useState(null);

  const items = [
    ...deals.slice(0, 5).map((d) => ({ type: "deal", id: d.id, label: `${d.company} — ${d.stage}`, value: `$${(d.value_usd ?? 0).toLocaleString()}`, notes: d.notes, value_usd: d.value_usd, probability: d.probability })),
    ...positions.slice(0, 3).map((p) => ({ type: "position", id: p.id, label: `${p.ticker} ${p.side}`, value: `${p.pnl_usd >= 0 ? "+" : ""}$${(p.pnl_usd ?? 0).toLocaleString()}`, notes: p.notes, pnl_usd: p.pnl_usd })),
    ...followUps.filter((f) => f.priority === "urgent" || f.priority === "high").slice(0, 3).map((f) => ({ type: "followup", id: f.id, label: f.action, value: f.priority, notes: f.notes, priority: f.priority })),
  ]
    .sort((a, b) => scoreItem(b) - scoreItem(a))
    .slice(0, 5);

  if (items.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Today's Focus</div>
        <p className="text-sm text-jarvis-muted">Add your first deal or position to see priorities here.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Today's Focus</div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.id} className="rounded-xl border border-jarvis-border bg-white/[0.02] overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
            >
              <span className="text-jarvis-cyan font-semibold text-sm w-5 text-center">{i + 1}</span>
              <span className="text-sm text-jarvis-ink truncate flex-1">{item.label}</span>
              {roleBadge(item.type)}
              <span className="text-xs text-jarvis-body font-semibold tabular-nums">{item.value}</span>
              {expanded === item.id ? <ChevronUp size={12} className="text-jarvis-muted" /> : <ChevronDown size={12} className="text-jarvis-muted" />}
            </button>
            {expanded === item.id && item.notes && (
              <div className="px-3 pb-3 text-xs text-jarvis-body">{item.notes}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
