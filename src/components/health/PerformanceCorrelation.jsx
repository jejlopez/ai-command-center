import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

function ago30() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

export function PerformanceCorrelation() {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      try {
        const [{ data: logs }, { data: snaps }] = await Promise.all([
          supabase.from("health_log").select("date,sleep_hours,workout").gte("date", ago30()),
          supabase.from("daily_snapshot").select("date,trading_pnl,deals_touched").gte("date", ago30()),
        ]);
        if (!logs?.length || !snaps?.length) { setLoading(false); return; }

        const snapMap = Object.fromEntries((snaps || []).map(s => [s.date, s]));
        const good = [], base = [], workoutDays = [], nonWorkout = [];

        (logs || []).forEach(l => {
          const s = snapMap[l.date];
          if (!s) return;
          if ((l.sleep_hours ?? 0) >= 7) good.push(s.trading_pnl ?? 0);
          else base.push(s.trading_pnl ?? 0);
          if (l.workout) workoutDays.push(s.deals_touched ?? 0);
          else nonWorkout.push(s.deals_touched ?? 0);
        });

        const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const res = [];

        if (good.length >= 3 && base.length >= 3) {
          const lift = avg(base) !== 0 ? Math.round(((avg(good) - avg(base)) / Math.abs(avg(base))) * 100) : null;
          if (lift !== null) res.push(`7+ hours sleep → trading P&L ${lift > 0 ? "+" : ""}${lift}% vs less sleep`);
        }
        if (workoutDays.length >= 3 && nonWorkout.length >= 3) {
          const diff = (avg(workoutDays) - avg(nonWorkout)).toFixed(1);
          res.push(`Workout days → ${diff > 0 ? "+" : ""}${diff} avg deals touched`);
        }

        setInsights(res.slice(0, 3));
      } catch {
        setInsights([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="label">Performance Correlation</div>
        <TrendingUp size={14} className="text-jarvis-purple" />
      </div>
      {loading ? (
        <p className="text-sm text-jarvis-muted">Analyzing…</p>
      ) : !insights || insights.length === 0 ? (
        <p className="text-sm text-jarvis-muted">Log 7+ days to see performance patterns.</p>
      ) : (
        <div className="space-y-2">
          {insights.map((ins, i) => (
            <div key={i} className="px-3 py-2.5 rounded-xl border border-jarvis-purple/20 bg-jarvis-purple/5">
              <p className="text-sm text-jarvis-ink">{ins}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
