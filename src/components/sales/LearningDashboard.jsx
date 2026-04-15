// LearningDashboard — what Jarvis is learning from your behavior.

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { Brain, TrendingUp, Target, BarChart3, Clock } from "lucide-react";

function StatCard({ icon: Icon, label, value, sub, color }) {
  return (
    <div className="surface p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className={color || "text-jarvis-muted"} />
        <span className="text-[8px] text-jarvis-ghost uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-lg font-bold font-display tabular-nums ${color || "text-jarvis-ink"}`}>{value}</div>
      {sub && <div className="text-[9px] text-jarvis-muted mt-0.5">{sub}</div>}
    </div>
  );
}

function PatternCard({ title, items, emptyText }) {
  return (
    <div className="surface p-3">
      <div className="text-[9px] text-jarvis-ghost uppercase tracking-wider mb-2">{title}</div>
      {items.length === 0 ? (
        <div className="text-[10px] text-jarvis-ghost">{emptyText}</div>
      ) : (
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-[11px] text-jarvis-ink">{item.label}</span>
              <span className={`text-[11px] font-semibold tabular-nums ${item.color || "text-jarvis-muted"}`}>{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function LearningDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      const [
        { data: events },
        { data: reviews },
        { data: deals },
      ] = await Promise.all([
        supabase.from("learning_events").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("win_loss_reviews").select("*").order("created_at", { ascending: false }).limit(50),
        supabase.from("deals").select("*").order("updated_at", { ascending: false }).limit(100),
      ]);

      // Compute metrics
      const allEvents = events || [];
      const allReviews = reviews || [];
      const allDeals = deals || [];

      // Edit patterns
      const edits = allEvents.filter(e => e.event_type === "draft_edited");
      const rejections = allEvents.filter(e => e.event_type === "draft_rejected");
      const editPatterns = {};
      edits.forEach(e => {
        const diff = e.diff_summary || {};
        Object.keys(diff).forEach(k => {
          if (diff[k]) editPatterns[k] = (editPatterns[k] || 0) + 1;
        });
      });

      // Win/loss by competitor
      const lostReviews = allReviews.filter(r => r.outcome === "lost" && r.lost_to);
      const competitorLosses = {};
      lostReviews.forEach(r => {
        competitorLosses[r.lost_to] = (competitorLosses[r.lost_to] || 0) + 1;
      });

      // Win rate
      const won = allDeals.filter(d => (d.stage || "").toLowerCase().includes("won")).length;
      const lost = allDeals.filter(d => (d.stage || "").toLowerCase().includes("lost")).length;
      const closed = won + lost;
      const winRate = closed > 0 ? Math.round((won / closed) * 100) : null;

      // Avg deal cycle
      const closedDeals = allDeals.filter(d => {
        const s = (d.stage || "").toLowerCase();
        return s.includes("won") || s.includes("lost");
      });
      const cycles = closedDeals.map(d => {
        const start = new Date(d.add_time || d.created_at);
        const end = new Date(d.updated_at);
        return Math.floor((end - start) / 86_400_000);
      }).filter(c => c > 0 && c < 365);
      const avgCycle = cycles.length > 0 ? Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length) : null;

      // Win reasons
      const wonReviews = allReviews.filter(r => r.outcome === "won" && r.primary_reason);
      const winReasons = {};
      wonReviews.forEach(r => {
        winReasons[r.primary_reason] = (winReasons[r.primary_reason] || 0) + 1;
      });

      setData({
        totalEdits: edits.length,
        totalRejections: rejections.length,
        editPatterns: Object.entries(editPatterns)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([k, v]) => ({ label: k.replace(/_/g, " "), value: `${v}x`, color: "text-jarvis-warning" })),
        competitorLosses: Object.entries(competitorLosses)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([k, v]) => ({ label: k, value: `${v} losses`, color: "text-jarvis-danger" })),
        winReasons: Object.entries(winReasons)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([k, v]) => ({ label: k, value: `${v} wins`, color: "text-jarvis-success" })),
        winRate,
        avgCycle,
        won,
        lost,
        totalReviews: allReviews.length,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-[10px] text-jarvis-muted animate-pulse p-4">Loading learning data…</div>;
  if (!data) return <div className="text-[10px] text-jarvis-ghost p-4">No learning data yet. Start closing deals and reviewing drafts.</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Brain size={14} className="text-jarvis-purple" />
        <div>
          <div className="text-xs font-bold text-jarvis-ink">Learning Dashboard</div>
          <div className="text-[9px] text-jarvis-muted">What Jarvis is learning from your behavior</div>
        </div>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={TrendingUp} label="Win Rate" value={data.winRate != null ? `${data.winRate}%` : "—"} sub={`${data.won}W / ${data.lost}L`} color="text-jarvis-success" />
        <StatCard icon={Clock} label="Avg Cycle" value={data.avgCycle != null ? `${data.avgCycle}d` : "—"} sub="days to close" color="text-blue-400" />
        <StatCard icon={BarChart3} label="Drafts Edited" value={data.totalEdits} sub={`${data.totalRejections} rejected`} color="text-jarvis-warning" />
        <StatCard icon={Target} label="Post-Mortems" value={data.totalReviews} sub="deals reviewed" color="text-jarvis-purple" />
      </div>

      {/* Pattern cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <PatternCard title="What You Edit Most" items={data.editPatterns} emptyText="No edit patterns yet. Review Jarvis drafts to build data." />
        <PatternCard title="Why You Win" items={data.winReasons} emptyText="No win data yet. Complete post-mortems on won deals." />
        <PatternCard title="Who You Lose To" items={data.competitorLosses} emptyText="No loss data yet. Complete post-mortems on lost deals." />
      </div>
    </div>
  );
}
