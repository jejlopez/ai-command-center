import { useEffect, useState } from "react";
import { Moon } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const TARGET = 7.5;

function ago14() {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d.toISOString().slice(0, 10);
}

function debtColor(debt) {
  if (debt > 5) return "text-jarvis-red";
  if (debt > 2) return "text-jarvis-amber";
  return "text-jarvis-green";
}

export function SleepDebtCalculator() {
  const [debt, setDebt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from("health_log")
          .select("sleep_hours")
          .gte("date", ago14());
        if (!data?.length) { setLoading(false); return; }
        const total = data.reduce((sum, r) => {
          const deficit = TARGET - (r.sleep_hours ?? TARGET);
          return sum + (deficit > 0 ? deficit : 0);
        }, 0);
        setDebt(Math.round(total * 10) / 10);
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, []);

  const recoveryNights = debt ? Math.ceil(debt / (8.5 - TARGET)) : 0;

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="label">Sleep Debt</div>
        <Moon size={14} className="text-jarvis-purple" />
      </div>
      {loading ? (
        <p className="text-sm text-jarvis-muted">Calculating…</p>
      ) : debt === null ? (
        <p className="text-sm text-jarvis-muted">Log 7+ days of sleep to calculate debt.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-2">
            <span className={`font-display text-4xl tabular-nums ${debtColor(debt)}`}>{debt}h</span>
            <span className="text-jarvis-muted text-sm">debt</span>
          </div>
          <p className="text-xs text-jarvis-muted mb-1">Target: {TARGET}h/night</p>
          {debt > 0 ? (
            <p className="text-xs text-jarvis-ink">
              Recovery: {recoveryNights} night{recoveryNights !== 1 ? "s" : ""} of 8.5h
            </p>
          ) : (
            <p className="text-xs text-jarvis-green">No sleep debt — excellent.</p>
          )}
        </>
      )}
    </div>
  );
}
