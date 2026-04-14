// WeeklyReport — aggregates EOD recap suggestions from the last 7 days.
// Visible on Fridays by default; toggle visible on any day.

import { useEffect, useState } from "react";
import { BarChart2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const isFriday = () => new Date().getDay() === 5;

function fmtDay(iso) {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function WeeklyReport() {
  const [recaps, setRecaps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(isFriday());
  const [expanded, setExpanded] = useState(null);

  async function load() {
    if (!supabase) return;
    setLoading(true);
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("jarvis_suggestions")
      .select("*")
      .eq("type", "crm_eod_recap")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(7);
    setRecaps(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    if (visible) load();
  }, [visible]);

  // Aggregate stats from metadata
  const agg = recaps.reduce(
    (acc, r) => {
      const m = r.metadata ?? {};
      acc.dealsTouched += Number(m.deals_touched ?? 0);
      acc.dealsMoved   += Number(m.deals_moved ?? 0);
      acc.revenueClosed += Number(m.revenue_closed ?? 0);
      acc.days++;
      return acc;
    },
    { dealsTouched: 0, dealsMoved: 0, revenueClosed: 0, days: 0 }
  );

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <BarChart2 size={13} className="text-jarvis-purple" />
        <span className="label flex-1">Weekly Report</span>
        <button
          onClick={() => { setVisible(v => { if (!v) load(); return !v; }); }}
          className="text-[10px] text-jarvis-ghost hover:text-jarvis-muted transition"
        >
          {visible ? "Hide" : "Show"}
        </button>
        {visible && (
          <button
            onClick={load}
            disabled={loading}
            className="text-jarvis-ghost hover:text-jarvis-muted transition"
            title="Refresh"
          >
            <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
          </button>
        )}
      </div>

      {!visible && (
        <div className="text-xs text-jarvis-ghost">
          {isFriday() ? "It's Friday — view your weekly summary." : "Weekly report is available on Fridays."}
        </div>
      )}

      {visible && loading && (
        <div className="text-xs text-jarvis-ghost animate-pulse">Loading weekly data…</div>
      )}

      {visible && !loading && recaps.length === 0 && (
        <div className="text-xs text-jarvis-ghost py-1">
          No EOD recaps found for this week. They appear after 5pm daily.
        </div>
      )}

      {visible && !loading && recaps.length > 0 && (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col">
              <span className="text-[9px] text-jarvis-ghost uppercase tracking-wide">Deals Touched</span>
              <span className="text-sm font-semibold text-jarvis-ink tabular-nums">{agg.dealsTouched}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-jarvis-ghost uppercase tracking-wide">Moved Stage</span>
              <span className="text-sm font-semibold text-jarvis-primary tabular-nums">{agg.dealsMoved}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] text-jarvis-ghost uppercase tracking-wide">Revenue Closed</span>
              <span className="text-sm font-semibold text-jarvis-success tabular-nums">
                {agg.revenueClosed > 0 ? `$${(agg.revenueClosed / 1000).toFixed(0)}k` : "—"}
              </span>
            </div>
          </div>

          {/* Per-day recaps */}
          <div className="space-y-1">
            {recaps.map((r, i) => (
              <div key={r.id} className="border-b border-jarvis-border/50 last:border-0">
                <button
                  className="w-full flex items-center gap-2 py-1.5 text-left hover:bg-jarvis-ghost/20 rounded px-1 -mx-1 transition"
                  onClick={() => setExpanded(expanded === i ? null : i)}
                >
                  <span className="text-[10px] text-jarvis-muted flex-1">{fmtDay(r.created_at)}</span>
                  <span className="text-[10px] text-jarvis-body truncate max-w-[60%]">{r.title}</span>
                  {expanded === i ? <ChevronUp size={9} className="text-jarvis-ghost" /> : <ChevronDown size={9} className="text-jarvis-ghost" />}
                </button>
                {expanded === i && r.body && (
                  <div className="pb-2 px-1">
                    <p className="text-[11px] text-jarvis-body leading-relaxed whitespace-pre-wrap">{r.body}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
