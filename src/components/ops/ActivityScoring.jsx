// ActivityScoring — correlates communication activity with deal wins/losses.

import { useEffect, useState } from "react";
import { BarChart2, Phone, Mail, Users, MessageSquare } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const ACTIVITY_TYPES = [
  { key: "call",    label: "Calls",    Icon: Phone,        color: "text-jarvis-primary", bar: "bg-jarvis-primary" },
  { key: "email",   label: "Emails",   Icon: Mail,         color: "text-blue-400",        bar: "bg-blue-400" },
  { key: "meeting", label: "Meetings", Icon: Users,        color: "text-jarvis-purple",   bar: "bg-jarvis-purple" },
  { key: "note",    label: "Notes",    Icon: MessageSquare, color: "text-jarvis-muted",   bar: "bg-jarvis-muted" },
];

export function ActivityScoring({ deals = [] }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function compute() {
      if (!supabase) { setLoading(false); return; }

      const [wonDeals, lostDeals, allComms] = await Promise.all([
        supabase.from("deals").select("id").eq("stage", "closed_won").limit(100),
        supabase.from("deals").select("id").eq("stage", "closed_lost").limit(100),
        supabase.from("communications").select("type, deal_id").limit(500),
      ]);

      const won  = (wonDeals.data ?? []).map(d => d.id);
      const lost = (lostDeals.data ?? []).map(d => d.id);
      const comms = allComms.data ?? [];

      if (won.length + lost.length < 5) {
        setStats({ insufficient: true, closedCount: won.length + lost.length });
        setLoading(false);
        return;
      }

      // Count activity per deal
      const activityByDeal = {};
      for (const c of comms) {
        if (!c.deal_id) continue;
        if (!activityByDeal[c.deal_id]) activityByDeal[c.deal_id] = {};
        activityByDeal[c.deal_id][c.type] = (activityByDeal[c.deal_id][c.type] ?? 0) + 1;
      }

      function avgActivities(dealIds, type) {
        if (dealIds.length === 0) return 0;
        const total = dealIds.reduce((s, id) => s + (activityByDeal[id]?.[type] ?? 0), 0);
        return total / dealIds.length;
      }

      const result = ACTIVITY_TYPES.map(t => {
        const wonAvg  = avgActivities(won, t.key);
        const lostAvg = avgActivities(lost, t.key);
        return { ...t, wonAvg: +wonAvg.toFixed(1), lostAvg: +lostAvg.toFixed(1) };
      });

      // Best activity = highest ratio won/lost (ignoring zero-loss)
      const best = result.reduce((best, t) => {
        const ratio = t.lostAvg > 0 ? t.wonAvg / t.lostAvg : t.wonAvg;
        const bestRatio = best.lostAvg > 0 ? best.wonAvg / best.lostAvg : best.wonAvg;
        return ratio > bestRatio ? t : best;
      }, result[0]);

      setStats({ activities: result, best, wonCount: won.length, lostCount: lost.length });
      setLoading(false);
    }
    compute();
  }, []);

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <BarChart2 size={13} className="text-jarvis-primary" />
        <span className="label">Activity Scoring</span>
      </div>

      {loading && <div className="text-xs text-jarvis-ghost animate-pulse">Analyzing…</div>}

      {!loading && stats?.insufficient && (
        <div className="text-xs text-jarvis-ghost py-1">
          Need at least 5 closed deals for meaningful data.{" "}
          {stats.closedCount > 0 && `(${stats.closedCount} closed so far)`}
        </div>
      )}

      {!loading && stats?.activities && (
        <>
          <div className="space-y-3">
            {stats.activities.map(t => {
              const max = Math.max(t.wonAvg, t.lostAvg, 1);
              return (
                <div key={t.key}>
                  <div className="flex items-center gap-2 mb-1">
                    <t.Icon size={10} className={t.color} />
                    <span className="text-[10px] text-jarvis-body flex-1">{t.label}</span>
                    <span className="text-[9px] text-jarvis-ghost tabular-nums">
                      Won: {t.wonAvg} · Lost: {t.lostAvg}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-jarvis-success w-6 text-right">W</span>
                      <div className="flex-1 h-1.5 bg-jarvis-ghost/20 rounded-full">
                        <div className={`h-full rounded-full ${t.bar} opacity-80`} style={{ width: `${(t.wonAvg / max) * 100}%` }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] text-jarvis-danger w-6 text-right">L</span>
                      <div className="flex-1 h-1.5 bg-jarvis-ghost/20 rounded-full">
                        <div className={`h-full rounded-full ${t.bar} opacity-30`} style={{ width: `${(t.lostAvg / max) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {stats.best && (
            <div className="bg-jarvis-primary/5 border border-jarvis-primary/20 rounded-lg px-3 py-2">
              <p className="text-[10px] text-jarvis-body">
                <span className="text-jarvis-primary font-medium">Top activity: {stats.best.label}</span>
                {" — "}{stats.best.wonAvg} per won deal vs {stats.best.lostAvg} for lost deals.
              </p>
            </div>
          )}

          <div className="text-[9px] text-jarvis-ghost">
            Based on {stats.wonCount} won + {stats.lostCount} lost deals.
          </div>
        </>
      )}
    </div>
  );
}
