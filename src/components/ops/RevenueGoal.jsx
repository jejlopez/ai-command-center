// RevenueGoal — monthly target vs actual, with trend projection.

import { useEffect, useState } from "react";
import { Target, Edit2, Check, X } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const fmtK = (n) => n >= 1000 ? `$${(n / 1000).toFixed(0)}k` : `$${n.toLocaleString()}`;

function thisMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    daysPassed: now.getDate(),
    daysTotal: end.getDate(),
  };
}

export function RevenueGoal({ deals = [] }) {
  const [target, setTarget] = useState(() => parseFloat(localStorage.getItem("revenue-target") || "100000"));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(target));
  const [closedThisMonth, setClosedThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { start, end } = thisMonth();
      // First try Supabase
      if (supabase) {
        const { data } = await supabase
          .from("deals")
          .select("value, value_usd")
          .eq("stage", "closed_won")
          .gte("close_date", start)
          .lte("close_date", end);
        if (data) {
          const total = data.reduce((s, d) => s + (Number(d.value_usd ?? d.value) || 0), 0);
          setClosedThisMonth(total);
          setLoading(false);
          return;
        }
      }
      // Fallback: compute from passed-in deals prop
      const { start: s, end: e } = thisMonth();
      const total = deals
        .filter(d => d.stage === "closed_won" && d.close_date >= s && d.close_date <= e)
        .reduce((sum, d) => sum + (Number(d.value_usd ?? d.value) || 0), 0);
      setClosedThisMonth(total);
      setLoading(false);
    }
    load();
  }, [deals]);

  function saveTarget() {
    const n = parseFloat(draft);
    if (!isNaN(n) && n > 0) {
      setTarget(n);
      localStorage.setItem("revenue-target", String(n));
    }
    setEditing(false);
  }

  const { daysPassed, daysTotal } = thisMonth();
  const pct = target > 0 ? Math.min(100, (closedThisMonth / target) * 100) : 0;
  const gap = Math.max(0, target - closedThisMonth);
  const onTrack = closedThisMonth / target >= daysPassed / daysTotal - 0.05;

  // Projected by month end
  const pace = daysPassed > 0 ? (closedThisMonth / daysPassed) * daysTotal : 0;
  const projectedPct = target > 0 ? Math.min(150, (pace / target) * 100) : 0;

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Target size={13} className="text-jarvis-success" />
        <span className="label flex-1">Revenue Goal</span>
        {!editing ? (
          <button
            className="text-jarvis-ghost hover:text-jarvis-muted transition"
            onClick={() => { setDraft(String(target)); setEditing(true); }}
            title="Edit target"
          >
            <Edit2 size={10} />
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <input
              className="w-20 text-xs bg-jarvis-surface border border-jarvis-border rounded px-1 py-0.5 text-jarvis-ink outline-none"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") saveTarget(); if (e.key === "Escape") setEditing(false); }}
              autoFocus
            />
            <button onClick={saveTarget} className="text-jarvis-success hover:opacity-80"><Check size={10} /></button>
            <button onClick={() => setEditing(false)} className="text-jarvis-danger hover:opacity-80"><X size={10} /></button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-xs text-jarvis-ghost animate-pulse">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col">
              <span className="text-[9px] text-jarvis-ghost uppercase tracking-wide">Target</span>
              <span className="text-sm font-semibold text-jarvis-ink tabular-nums">{fmtK(target)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-jarvis-ghost uppercase tracking-wide">Closed</span>
              <span className="text-sm font-semibold text-jarvis-success tabular-nums">{fmtK(closedThisMonth)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-jarvis-ghost uppercase tracking-wide">Gap</span>
              <span className={`text-sm font-semibold tabular-nums ${gap > 0 ? "text-jarvis-warning" : "text-jarvis-success"}`}>
                {gap > 0 ? fmtK(gap) : "Done!"}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-jarvis-muted">{pct.toFixed(0)}% of target</span>
              <span className={`chip text-[9px] ${onTrack ? "bg-jarvis-success/10 text-jarvis-success" : "bg-jarvis-warning/10 text-jarvis-warning"}`}>
                {onTrack ? "On track" : "Behind"}
              </span>
            </div>
            <div className="w-full h-1.5 bg-jarvis-ghost/30 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? "bg-jarvis-success" : pct >= 60 ? "bg-jarvis-primary" : "bg-jarvis-warning"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          {/* Trend line */}
          <div className="text-[10px] text-jarvis-muted">
            At current pace, you'll hit {fmtK(Math.round(pace))} by month-end ({projectedPct.toFixed(0)}% of target).
          </div>
        </>
      )}
    </div>
  );
}
