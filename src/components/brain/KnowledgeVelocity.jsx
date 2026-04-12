import { TrendingUp, TrendingDown } from "lucide-react";

function weeksAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d;
}

export default function KnowledgeVelocity({ nodes = [] }) {
  // Count nodes created per week for last 4 weeks
  const now = new Date();
  const weeks = [0, 1, 2, 3].map((i) => {
    const start = weeksAgo(i + 1);
    const end = weeksAgo(i);
    const count = nodes.filter((n) => {
      const d = new Date(n.createdAt ?? n.created_at ?? 0);
      return d >= start && d < end;
    }).length;
    return { label: i === 0 ? "This week" : `${i + 1}w ago`, count };
  }).reverse();

  const thisWeek = weeks[3]?.count ?? 0;
  const lastWeek = weeks[2]?.count ?? 0;
  const delta = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : null;
  const up = delta !== null ? delta >= 0 : true;
  const maxCount = Math.max(...weeks.map((w) => w.count), 1);

  return (
    <div className="surface p-4 flex items-center gap-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-jarvis-purple/10 border border-jarvis-purple/20 grid place-items-center shrink-0">
          {up ? <TrendingUp size={16} className="text-jarvis-success" /> : <TrendingDown size={16} className="text-jarvis-danger" />}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-jarvis-muted">Knowledge Velocity</div>
          <div className="text-sm font-semibold text-jarvis-ink">
            {thisWeek} learned this week
            {delta !== null && (
              <span className={`ml-2 text-[11px] font-normal ${up ? "text-jarvis-success" : "text-jarvis-danger"}`}>
                {up ? "↑" : "↓"}{Math.abs(delta)}% vs last week
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Mini bar chart */}
      <div className="flex items-end gap-1.5 h-8 ml-auto">
        {weeks.map((w) => (
          <div key={w.label} className="flex flex-col items-center gap-0.5" title={`${w.label}: ${w.count}`}>
            <div
              className="w-6 rounded-t bg-jarvis-purple/50 transition-all"
              style={{ height: `${Math.max(2, (w.count / maxCount) * 28)}px` }}
            />
          </div>
        ))}
      </div>
      <div className="text-[10px] text-jarvis-muted hidden sm:block">
        {weeks.map((w) => w.count).join(" · ")} (4-week)
      </div>
    </div>
  );
}
