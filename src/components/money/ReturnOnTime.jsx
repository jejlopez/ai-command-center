import { Clock } from "lucide-react";

const ROLES = [
  { key: "sales", label: "Sales", unit: "$/hr", color: "text-jarvis-green" },
  { key: "trading", label: "Trading", unit: "$/hr", color: "text-jarvis-cyan" },
  { key: "coding", label: "Coding", unit: "hrs invested", color: "text-jarvis-amber" },
];

export function ReturnOnTime({ data }) {
  if (!data) {
    return (
      <div className="glass p-5">
        <div className="flex items-center gap-2 mb-3"><Clock size={14} className="text-jarvis-cyan" /><span className="label">Return on Time</span></div>
        <p className="text-sm text-jarvis-muted">Log time blocks to see productivity per hour.</p>
      </div>
    );
  }

  const rows = ROLES.map((r) => {
    const hours = data[`${r.key}_hours`] ?? 0;
    const revenue = data[`${r.key}_revenue`] ?? 0;
    const rph = hours > 0 && r.key !== "coding" ? revenue / hours : null;
    return { ...r, hours, revenue, rph };
  });

  const best = rows.filter((r) => r.rph !== null).sort((a, b) => (b.rph ?? 0) - (a.rph ?? 0))[0];

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4"><Clock size={14} className="text-jarvis-cyan" /><span className="label">Return on Time</span></div>
      {best && (
        <div className="mb-4 px-3 py-2 rounded-xl bg-jarvis-green/10 border border-jarvis-green/20">
          <p className="text-xs text-jarvis-green font-semibold">Most productive: {best.label} at ${best.rph?.toFixed(0)}/hr</p>
        </div>
      )}
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-jarvis-muted">{r.label}</span>
              <span className={`text-sm font-semibold tabular-nums ${r.color}`}>
                {r.rph !== null ? `$${r.rph.toFixed(0)}/hr` : r.hours > 0 ? `${r.hours}h invested` : "—"}
              </span>
            </div>
            {r.hours > 0 && (
              <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                <div className={`h-full rounded-full ${r.color.replace("text-", "bg-")}`} style={{ width: `${Math.min((r.rph ?? r.hours / 10) / 200 * 100, 100)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
