import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

function ago14() {
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d.toISOString().slice(0, 10);
}

function scoreColor(s) {
  if (s > 60) return "text-jarvis-red";
  if (s > 30) return "text-jarvis-amber";
  return "text-jarvis-green";
}

function borderColor(s) {
  if (s > 60) return "border-jarvis-red/20";
  if (s > 30) return "border-jarvis-amber/20";
  return "border-jarvis-green/20";
}

function trend(arr) {
  if (arr.length < 2) return 0;
  const half = Math.floor(arr.length / 2);
  const first = arr.slice(0, half).reduce((a, b) => a + b, 0) / half;
  const last = arr.slice(half).reduce((a, b) => a + b, 0) / (arr.length - half);
  return last - first;
}

export function BurnoutRiskScore() {
  const [score, setScore] = useState(null);
  const [factors, setFactors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from("health_log")
          .select("date,sleep_hours,energy,workout,hours_worked")
          .gte("date", ago14())
          .order("date");
        if (!data?.length) { setLoading(false); return; }

        const sleepTrend = trend(data.map(r => r.sleep_hours ?? 7));
        const energyTrend = trend(data.map(r => r.energy ?? 5));
        const hoursTrend = trend(data.map(r => r.hours_worked ?? 8));
        const workoutRate = data.filter(r => r.workout).length / data.length;

        let s = 0;
        const f = [];
        if (sleepTrend < -0.2) { s += 25; f.push("Sleep declining"); }
        if (energyTrend < -0.3) { s += 25; f.push("Energy trending down"); }
        if (hoursTrend > 0.5) { s += 25; f.push("Hours worked increasing"); }
        if (workoutRate < 0.3) { s += 25; f.push("Low exercise frequency"); }

        setScore(Math.min(100, s));
        setFactors(f);
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, []);

  return (
    <div className={`glass p-5 border ${score !== null ? borderColor(score) : ""}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="label">Burnout Risk</div>
        <AlertTriangle size={14} className="text-jarvis-purple" />
      </div>
      {loading ? (
        <p className="text-sm text-jarvis-muted">Calculating…</p>
      ) : score === null ? (
        <p className="text-sm text-jarvis-muted">Log 7+ days to see burnout risk.</p>
      ) : (
        <>
          <div className="flex items-baseline gap-2 mb-3">
            <span className={`font-display text-4xl tabular-nums ${scoreColor(score)}`}>{score}</span>
            <span className="text-jarvis-muted">/100</span>
          </div>
          {factors.length === 0 ? (
            <p className="text-xs text-jarvis-green">All indicators healthy.</p>
          ) : (
            <div className="space-y-1">
              {factors.map((f, i) => (
                <p key={i} className="text-xs text-jarvis-amber">• {f}</p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
