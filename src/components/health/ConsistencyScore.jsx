import { useEffect, useState } from "react";
import { Award } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

function ago30() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function ConsistencyScore() {
  const [pct, setPct] = useState(null);
  const [trend, setTrend] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      try {
        const { data: habits } = await supabase.from("habits").select("id").eq("active", true);
        if (!habits?.length) { setLoading(false); return; }

        const { data: logs } = await supabase
          .from("health_log")
          .select("date,habits_done")
          .gte("date", ago30())
          .order("date");

        if (!logs?.length) { setLoading(false); return; }

        const total = habits.length * logs.length;
        const done = logs.reduce((sum, r) => sum + (r.habits_done ?? 0), 0);
        const rate = total > 0 ? Math.round((done / total) * 100) : 0;
        setPct(rate);

        // simple trend: compare first half vs second half
        const half = Math.floor(logs.length / 2);
        if (half > 0) {
          const first = logs.slice(0, half).reduce((a, r) => a + (r.habits_done ?? 0), 0) / half;
          const last = logs.slice(half).reduce((a, r) => a + (r.habits_done ?? 0), 0) / (logs.length - half);
          setTrend(last >= first ? "up" : "down");
        }
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, []);

  const barColor = !pct ? "bg-jarvis-muted" : pct >= 70 ? "bg-jarvis-green" : pct >= 50 ? "bg-jarvis-amber" : "bg-jarvis-red";

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="label">Consistency Score</div>
        <Award size={14} className="text-jarvis-purple" />
      </div>
      {loading ? (
        <p className="text-sm text-jarvis-muted">Calculating…</p>
      ) : pct === null ? (
        <p className="text-sm text-jarvis-muted">Add habits and log 7+ days to see consistency.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="font-display text-4xl tabular-nums text-jarvis-purple">{pct}%</span>
            {trend && (
              <span className={trend === "up" ? "text-jarvis-green text-sm" : "text-jarvis-amber text-sm"}>
                {trend === "up" ? "↑" : "↓"}
              </span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden mb-3">
            <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-jarvis-muted italic">
            "Consistency beats intensity — {pct}% daily &gt; 100% twice a week."
          </p>
        </>
      )}
    </div>
  );
}
