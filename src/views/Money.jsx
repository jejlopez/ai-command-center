import { useEffect, useState } from "react";
import { Wallet, Loader2, RefreshCcw, Receipt } from "lucide-react";
import { useCostSummary } from "../hooks/useJarvis.js";
import { jarvis } from "../lib/jarvis.js";
import CostChart from "../components/money/CostChart.jsx";
import TopModels from "../components/money/TopModels.jsx";
import BudgetEditor from "../components/money/BudgetEditor.jsx";

function toneForFraction(frac) {
  if (frac >= 0.9) return { text: "text-jarvis-red",   bar: "bg-jarvis-red/80",   ring: "border-jarvis-red/30"   };
  if (frac >= 0.5) return { text: "text-jarvis-amber", bar: "bg-jarvis-amber/80", ring: "border-jarvis-amber/30" };
  return                { text: "text-jarvis-green", bar: "bg-jarvis-green/80", ring: "border-jarvis-green/30" };
}

function TodayHero({ today }) {
  const spent  = Number(today?.spentUsd)  || 0;
  const budget = Number(today?.budgetUsd) || 0;
  const frac = budget > 0 ? Math.min(1, spent / budget) : 0;
  const pct = Math.round(frac * 100);
  const tone = toneForFraction(frac);

  return (
    <div className={`glass p-6 border ${tone.ring}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="label text-jarvis-cyan">Today</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-4xl font-semibold tabular-nums ${tone.text}`}>
              ${spent.toFixed(2)}
            </span>
            <span className="text-[13px] text-jarvis-body">
              of ${budget.toFixed(2)} budget
            </span>
          </div>
          <div className="mt-1 text-[11px] text-jarvis-muted tabular-nums">
            {budget > 0 ? `${pct}% used` : "No budget set"}
          </div>
        </div>
        <Wallet size={22} className={tone.text} />
      </div>

      <div className="mt-4 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full ${tone.bar} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function RecentEventsTable({ events }) {
  if (!events || events.length === 0) {
    return (
      <div className="glass p-5 text-[12px] text-jarvis-muted italic">
        No spending today. Run a skill to see activity.
      </div>
    );
  }

  const fmtTs = (iso) => {
    try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
    catch { return iso; }
  };

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-3">
        <Receipt size={13} className="text-jarvis-blue" />
        <div className="label text-jarvis-blue">Recent cost events</div>
        <span className="ml-auto text-[10px] text-jarvis-muted">{events.length}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.14em] text-jarvis-muted">
              <th className="text-left py-1.5 pr-3 font-semibold">Time</th>
              <th className="text-left py-1.5 pr-3 font-semibold">Model</th>
              <th className="text-right py-1.5 pr-3 font-semibold">Tokens</th>
              <th className="text-right py-1.5 font-semibold">Cost</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-jarvis-border/50">
                <td className="py-1.5 pr-3 text-jarvis-body tabular-nums">{fmtTs(e.ts)}</td>
                <td className="py-1.5 pr-3 text-jarvis-ink font-mono truncate">{e.model}</td>
                <td className="py-1.5 pr-3 text-right text-jarvis-body tabular-nums">
                  {(Number(e.tokensIn) || 0) + (Number(e.tokensOut) || 0)}
                </td>
                <td className="py-1.5 text-right text-jarvis-cyan tabular-nums">
                  ${Number(e.costUsd ?? 0).toFixed(4)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Money() {
  const { summary, loading, error, refresh } = useCostSummary(60000);
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const loadEvents = async () => {
    setEventsLoading(true);
    try {
      const rows = await jarvis.costEvents({ limit: 10 });
      setEvents(Array.isArray(rows) ? rows : []);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
    const t = setInterval(loadEvents, 60000);
    return () => clearInterval(t);
  }, []);

  const handleRefreshAll = async () => {
    await Promise.all([refresh(), loadEvents()]);
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-jarvis-cyan/10 border border-jarvis-cyan/20 grid place-items-center">
            <Wallet size={16} className="text-jarvis-cyan" />
          </div>
          <div>
            <div className="label text-jarvis-cyan">Money</div>
            <div className="text-[12px] text-jarvis-body">Spend, budget, and cost events</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRefreshAll}
          disabled={loading || eventsLoading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-panel/40 text-jarvis-body border border-jarvis-border hover:text-jarvis-ink hover:bg-white/5 transition disabled:opacity-40"
        >
          {(loading || eventsLoading) ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
          Refresh
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">
          {error && !summary && (
            <div className="rounded-2xl border border-jarvis-amber/30 bg-jarvis-amber/5 p-4 text-[12px] text-jarvis-amber">
              Cost endpoint unreachable. The API worker may not have landed <code>/cost/summary</code> yet.
            </div>
          )}

          <TodayHero today={summary?.today ?? { spentUsd: 0, budgetUsd: 0 }} />

          <div className="glass p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="label text-jarvis-cyan">Last 7 days</div>
              {loading && !summary && <Loader2 size={12} className="animate-spin text-jarvis-muted" />}
            </div>
            <CostChart points={summary?.last7Days ?? []} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TopModels topModels={summary?.topModels ?? []} />
            <BudgetEditor onSaved={() => refresh()} />
          </div>

          <RecentEventsTable events={events} />
        </div>
      </div>
    </div>
  );
}
