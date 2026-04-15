// DealComparison.jsx — side-by-side deal analysis
import { useState, useEffect, useMemo } from "react";
import { X, TrendingUp, Award } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const fmtUsd = (n) => n != null ? `$${Number(n).toLocaleString()}` : "—";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

function daysSince(d) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

function MetricRow({ label, a, b, higherIsBetter = true }) {
  const aNum = typeof a === "number" ? a : null;
  const bNum = typeof b === "number" ? b : null;
  let aWins = false, bWins = false;
  if (aNum != null && bNum != null && aNum !== bNum) {
    aWins = higherIsBetter ? aNum > bNum : aNum < bNum;
    bWins = !aWins;
  }
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 border-b border-jarvis-border/50 last:border-0">
      <div className={`text-xs text-right tabular-nums ${aWins ? "text-jarvis-success font-semibold" : "text-jarvis-body"}`}>
        {typeof a === "number" ? a.toLocaleString() : (a ?? "—")}
        {aWins && <span className="ml-1 text-[9px]">▲</span>}
      </div>
      <div className="text-[10px] text-jarvis-muted text-center px-2 min-w-[90px]">{label}</div>
      <div className={`text-xs tabular-nums ${bWins ? "text-jarvis-success font-semibold" : "text-jarvis-body"}`}>
        {typeof b === "number" ? b.toLocaleString() : (b ?? "—")}
        {bWins && <span className="ml-1 text-[9px]">▲</span>}
      </div>
    </div>
  );
}

function buildScore(metrics) {
  // Simple scoring: count how many metrics this deal "wins"
  return metrics.filter(m => m.aWins).length;
}

export function DealComparison({ deals = [], onClose }) {
  const [idA, setIdA] = useState(deals[0]?.id ?? "");
  const [idB, setIdB] = useState(deals[1]?.id ?? "");
  const [extraA, setExtraA] = useState({ comms: 0, proposals: 0, followUps: 0 });
  const [extraB, setExtraB] = useState({ comms: 0, proposals: 0, followUps: 0 });

  const dealA = deals.find(d => String(d.id) === String(idA)) ?? null;
  const dealB = deals.find(d => String(d.id) === String(idB)) ?? null;

  useEffect(() => {
    if (!supabase || !dealA?.id) return;
    Promise.all([
      supabase.from("communications").select("id", { count: "exact" }).eq("deal_id", dealA.id),
      supabase.from("proposals").select("id", { count: "exact" }).eq("deal_id", dealA.id),
      supabase.from("follow_ups").select("id", { count: "exact" }).eq("deal_id", dealA.id),
    ]).then(([c, p, f]) => setExtraA({ comms: c.count ?? 0, proposals: p.count ?? 0, followUps: f.count ?? 0 }));
  }, [dealA?.id]);

  useEffect(() => {
    if (!supabase || !dealB?.id) return;
    Promise.all([
      supabase.from("communications").select("id", { count: "exact" }).eq("deal_id", dealB.id),
      supabase.from("proposals").select("id", { count: "exact" }).eq("deal_id", dealB.id),
      supabase.from("follow_ups").select("id", { count: "exact" }).eq("deal_id", dealB.id),
    ]).then(([c, p, f]) => setExtraB({ comms: c.count ?? 0, proposals: p.count ?? 0, followUps: f.count ?? 0 }));
  }, [dealB?.id]);

  const recommendation = useMemo(() => {
    if (!dealA || !dealB) return null;
    const probA = dealA.probability ?? 0;
    const probB = dealB.probability ?? 0;
    const actA  = extraA.comms + extraA.followUps;
    const actB  = extraB.comms + extraB.followUps;
    const scoreA = (probA > probB ? 1 : 0) + (actA > actB ? 1 : 0) + ((dealA.value_usd ?? 0) > (dealB.value_usd ?? 0) ? 1 : 0);
    const scoreB = (probB > probA ? 1 : 0) + (actB > actA ? 1 : 0) + ((dealB.value_usd ?? 0) > (dealA.value_usd ?? 0) ? 1 : 0);
    if (scoreA === scoreB) return "Both deals are evenly matched — work them in parallel.";
    const winner = scoreA > scoreB ? dealA.company : dealB.company;
    const winnerScore = Math.max(scoreA, scoreB);
    return `${winner} has ${winnerScore === 3 ? "stronger across all metrics" : "an edge in more areas"} — prioritize it.`;
  }, [dealA, dealB, extraA, extraB]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
      <div className="w-full max-w-2xl glass border border-jarvis-border rounded-2xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-jarvis-primary" />
            <span className="font-semibold text-jarvis-ink text-sm">Compare Deals</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-jarvis-muted hover:text-jarvis-ink hover:bg-jarvis-ghost transition">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto max-h-[70vh]">
          {/* Deal selectors */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {[{ val: idA, setVal: setIdA, label: "Deal A" }, { val: idB, setVal: setIdB, label: "Deal B" }].map(({ val, setVal, label }) => (
              <div key={label}>
                <div className="label mb-1">{label}</div>
                <select
                  value={val}
                  onChange={e => setVal(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink outline-none focus:border-jarvis-primary/40"
                >
                  <option value="">Select a deal…</option>
                  {deals.map(d => (
                    <option key={d.id} value={d.id}>{d.company}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {dealA && dealB && (
            <>
              {/* Column headers */}
              <div className="grid grid-cols-[1fr_auto_1fr] gap-3 mb-2">
                <div className="text-xs font-semibold text-jarvis-ink text-right truncate">{dealA.company}</div>
                <div className="min-w-[90px]" />
                <div className="text-xs font-semibold text-jarvis-ink truncate">{dealB.company}</div>
              </div>

              {/* Metrics */}
              <div className="rounded-xl border border-jarvis-border bg-jarvis-surface p-3 mb-4">
                <MetricRow label="Value"         a={dealA.value_usd ?? 0}     b={dealB.value_usd ?? 0}     higherIsBetter />
                <MetricRow label="Probability %"  a={dealA.probability ?? 0}   b={dealB.probability ?? 0}   higherIsBetter />
                <MetricRow label="Days in pipeline" a={daysSince(dealA.created_at)} b={daysSince(dealB.created_at)} higherIsBetter={false} />
                <MetricRow label="Communications" a={extraA.comms}             b={extraB.comms}             higherIsBetter />
                <MetricRow label="Proposals"      a={extraA.proposals}         b={extraB.proposals}         higherIsBetter />
                <MetricRow label="Follow-ups"     a={extraA.followUps}         b={extraB.followUps}         higherIsBetter />
                <MetricRow label="Stage"          a={dealA.stage ?? "—"}       b={dealB.stage ?? "—"}       higherIsBetter />
                <MetricRow label="Close date"     a={fmtDate(dealA.close_date)} b={fmtDate(dealB.close_date)} higherIsBetter />
              </div>

              {/* Recommendation */}
              {recommendation && (
                <div className="flex items-start gap-3 rounded-xl bg-jarvis-primary/10 border border-jarvis-primary/20 px-4 py-3">
                  <Award size={14} className="text-jarvis-primary shrink-0 mt-0.5" />
                  <p className="text-xs text-jarvis-body leading-snug">{recommendation}</p>
                </div>
              )}
            </>
          )}

          {(!dealA || !dealB) && (
            <div className="text-center text-xs text-jarvis-muted py-8">Select two deals above to compare them.</div>
          )}
        </div>
      </div>
    </div>
  );
}
