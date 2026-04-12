import { Target } from "lucide-react";

function formatDollar(n) {
  if (!n) return null;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n}`;
}

export function TopThreeNeedleMovers({ deals = [], positions = [], followUps = [] }) {
  const items = [];

  const bigDeal = [...deals].sort((a, b) => (b.value_usd ?? 0) * ((b.probability ?? 50) / 100) - (a.value_usd ?? 0) * ((a.probability ?? 50) / 100))[0];
  if (bigDeal) {
    items.push({
      action: `Close ${bigDeal.company ?? "top deal"}`,
      impact: formatDollar(bigDeal.value_usd),
      sub: bigDeal.stage ?? "pipeline",
    });
  }

  const bigPosition = [...positions].sort((a, b) => Math.abs(b.pnl_usd ?? 0) - Math.abs(a.pnl_usd ?? 0))[0];
  if (bigPosition) {
    const pnl = bigPosition.pnl_usd ?? 0;
    items.push({
      action: `Manage ${bigPosition.ticker ?? "top position"}`,
      impact: `${pnl >= 0 ? "+" : ""}${formatDollar(Math.abs(pnl))} P&L`,
      sub: bigPosition.side ?? "position",
    });
  }

  const overdue = followUps.filter((f) => f.due_date && new Date(f.due_date) < new Date())
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0];
  if (overdue) {
    items.push({
      action: overdue.action ?? "Follow up",
      impact: "overdue",
      sub: overdue.contact ?? "contact",
    });
  }

  if (items.length === 0) {
    return (
      <div className="glass p-5 border-l-2 border-jarvis-primary/40">
        <div className="label mb-3">Top 3 Needle Movers</div>
        <p className="text-sm text-jarvis-muted">Add deals, positions, or follow-ups to see your top movers.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5 border-l-2 border-jarvis-primary/40">
      <div className="flex items-center gap-2 mb-4">
        <Target size={14} className="text-jarvis-primary" />
        <div className="label">Top 3 Needle Movers</div>
      </div>
      <div className="space-y-4">
        {items.slice(0, 3).map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <span className="text-3xl font-black text-jarvis-primary/30 leading-none w-8 shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-jarvis-ink">{item.action}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-jarvis-muted">{item.sub}</span>
                {item.impact && <span className="chip text-[10px] bg-jarvis-primary/15 text-jarvis-primary">{item.impact}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
