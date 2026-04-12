import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

function ago30() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

function linearRegression(arr) {
  const n = arr.length;
  if (n < 2) return { slope: 0, last: arr[0] ?? 5 };
  const xs = arr.map((_, i) => i);
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = arr.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((sum, x, i) => sum + (x - meanX) * (arr[i] - meanY), 0);
  const den = xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0);
  return { slope: den ? num / den : 0, last: arr[n - 1] };
}

export function TrajectoryView() {
  const [points, setPoints] = useState([]);
  const [reg, setReg] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      try {
        const { data } = await supabase
          .from("health_log")
          .select("date,energy")
          .gte("date", ago30())
          .order("date");
        if (!data?.length) { setLoading(false); return; }
        const vals = data.map(r => r.energy ?? 5);
        setPoints(vals);
        setReg(linearRegression(vals));
      } catch { /* empty */ }
      setLoading(false);
    })();
  }, []);

  const projected = reg ? Math.max(1, Math.min(10, Math.round((reg.last + reg.slope * 30) * 10) / 10)) : null;
  const improving = reg && reg.slope > 0;
  const w = points.length;
  const min = Math.min(...points, 1);
  const max = Math.max(...points, 10);
  const range = max - min || 1;
  const svgH = 40;

  const sparkPath = points.length > 1
    ? points.map((v, i) => {
        const x = (i / (w - 1)) * 100;
        const y = svgH - ((v - min) / range) * svgH;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      }).join(" ")
    : null;

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="label">Energy Trajectory</div>
        {reg && (improving
          ? <TrendingUp size={14} className="text-jarvis-green" />
          : <TrendingDown size={14} className="text-jarvis-red" />
        )}
      </div>
      {loading ? (
        <p className="text-sm text-jarvis-muted">Loading…</p>
      ) : points.length < 3 ? (
        <p className="text-sm text-jarvis-muted">Log 3+ days to see your energy trajectory.</p>
      ) : (
        <>
          <svg viewBox={`0 0 100 ${svgH}`} className="w-full mb-3" preserveAspectRatio="none" style={{ height: 48 }}>
            {sparkPath && (
              <path d={sparkPath} fill="none"
                stroke={improving ? "var(--color-jarvis-green, #22c55e)" : "var(--color-jarvis-red, #ef4444)"}
                strokeWidth="2" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {projected !== null && (
            <p className="text-sm text-jarvis-ink">
              Projected in 30 days:{" "}
              <span className={improving ? "text-jarvis-green font-semibold" : "text-jarvis-red font-semibold"}>
                {projected}/10
              </span>
            </p>
          )}
          <p className="text-xs text-jarvis-muted mt-1">{points.length} days tracked</p>
        </>
      )}
    </div>
  );
}
