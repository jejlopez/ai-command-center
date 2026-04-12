import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

function ago14() {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d.toISOString().slice(0, 10);
}

function fmt(n) {
  return n >= 0 ? `+$${Math.round(n).toLocaleString()}` : `-$${Math.abs(Math.round(n)).toLocaleString()}`;
}

export function HealthROI() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      try {
        const [{ data: logs }, { data: snaps }] = await Promise.all([
          supabase.from("health_log").select("date,sleep_hours,workout").gte("date", ago14()),
          supabase.from("daily_snapshot").select("date,trading_pnl").gte("date", ago14()),
        ]);
        if (!logs?.length || !snaps?.length) { setLoading(false); return; }

        const snapMap = Object.fromEntries((snaps || []).map(s => [s.date, s.trading_pnl ?? 0]));
        const goodSleep = [], baseSleep = [], workoutPnl = [], noWorkoutPnl = [];

        (logs || []).forEach(l => {
          const pnl = snapMap[l.date];
          if (pnl === undefined) return;
          if ((l.sleep_hours ?? 0) >= 7) goodSleep.push(pnl);
          else baseSleep.push(pnl);
          if (l.workout) workoutPnl.push(pnl);
          else noWorkoutPnl.push(pnl);
        });

        const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        setData({
          sleepLift: goodSleep.length >= 2 && baseSleep.length >= 2 ? avg(goodSleep) - avg(baseSleep) : null,
          workoutLift: workoutPnl.length >= 2 && noWorkoutPnl.length >= 2 ? avg(workoutPnl) - avg(noWorkoutPnl) : null,
          days: logs.length,
        });
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, []);

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="label">Health ROI</div>
        <DollarSign size={14} className="text-jarvis-purple" />
      </div>
      {loading ? (
        <p className="text-sm text-jarvis-muted">Calculating…</p>
      ) : !data || (data.sleepLift === null && data.workoutLift === null) ? (
        <p className="text-sm text-jarvis-muted">Need 14+ days of health + trading data to show ROI.</p>
      ) : (
        <div className="space-y-3">
          {data.sleepLift !== null && (
            <div className="px-3 py-2.5 rounded-xl border border-jarvis-purple/20 bg-jarvis-purple/5">
              <p className="text-xs text-jarvis-muted mb-0.5">7+ hrs sleep vs less</p>
              <p className="text-sm font-semibold text-jarvis-ink">{fmt(data.sleepLift)} avg trading P&L</p>
            </div>
          )}
          {data.workoutLift !== null && (
            <div className="px-3 py-2.5 rounded-xl border border-jarvis-purple/20 bg-jarvis-purple/5">
              <p className="text-xs text-jarvis-muted mb-0.5">Workout days vs rest days</p>
              <p className="text-sm font-semibold text-jarvis-ink">{fmt(data.workoutLift)} avg trading P&L</p>
            </div>
          )}
          <p className="text-[10px] text-jarvis-muted">Based on {data.days} days</p>
        </div>
      )}
    </div>
  );
}
