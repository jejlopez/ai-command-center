// TodaysFocus — daily command center for sales. Every data point has a recommendation.
// Layout: Morning Brief → KPI Bar → Priority Queue (left) + Pipeline/Hot/Insights (right)

import { useState, useEffect } from "react";
import { jarvis } from "../../lib/jarvis.js";
import {
  TrendingUp, TrendingDown, AlertTriangle, Flame, Clock, Target,
  Phone, Mail, FileText, Calendar, ChevronRight, Sparkles, Shield,
  DollarSign, Users, BarChart3, Eye, Zap, X, ArrowRight,
} from "lucide-react";

function fmtUsd(n) {
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(d) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color = "text-jarvis-ink", trend }) {
  return (
    <div className="surface p-3 flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={11} className="text-jarvis-muted" />
        <span className="text-[8px] text-jarvis-muted uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className={`text-[16px] font-bold tabular-nums ${color}`}>{value}</div>
      <div className="flex items-center gap-1 mt-0.5">
        {trend && (
          <span className={`text-[8px] font-medium ${trend > 0 ? "text-jarvis-success" : trend < 0 ? "text-jarvis-danger" : "text-jarvis-muted"}`}>
            {trend > 0 ? "+" : ""}{trend}%
          </span>
        )}
        {sub && <span className="text-[8px] text-jarvis-muted">{sub}</span>}
      </div>
    </div>
  );
}

// ── Priority Action Card ─────────────────────────────────────────────────────

function ActionCard({ action, rank, onDismiss, onOpenDeal }) {
  const urgencyColor = action.urgency >= 8 ? "border-l-red-500" :
    action.urgency >= 5 ? "border-l-amber-500" : "border-l-jarvis-primary";

  return (
    <div className={`surface border-l-[3px] ${urgencyColor} p-3 group`}>
      <div className="flex items-start gap-2.5">
        <div className="w-5 h-5 rounded-full bg-jarvis-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <span className="text-[9px] font-bold text-jarvis-primary tabular-nums">{rank}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => onOpenDeal?.(action.deal)} className="text-[11px] font-semibold text-jarvis-ink hover:text-jarvis-primary transition truncate">
              {action.company}
            </button>
            {action.tags?.map(tag => (
              <span key={tag} className={`text-[7px] px-1.5 py-0.5 rounded-full font-medium ${
                tag === "churn" ? "text-red-400 bg-red-900/20" :
                tag === "whale" ? "text-purple-400 bg-purple-900/20" :
                tag === "hot" ? "text-amber-400 bg-amber-900/20" :
                tag === "objection" ? "text-blue-400 bg-blue-900/20" :
                "text-jarvis-muted bg-white/5"
              }`}>
                {tag}
              </span>
            ))}
          </div>
          <div className="text-[10px] text-jarvis-body leading-relaxed mb-1.5">{action.action}</div>
          <div className="text-[9px] text-jarvis-primary/70 mb-2">
            <Sparkles size={9} className="inline mr-1" />
            {action.reasoning}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-jarvis-success tabular-nums">{fmtUsd(action.value)}</span>
            <span className="text-[8px] text-jarvis-muted">{action.stage}</span>
            <div className="flex gap-1 ml-auto opacity-0 group-hover:opacity-100 transition">
              {action.buttons?.map(btn => (
                <button key={btn.label} className="text-[8px] px-2 py-0.5 rounded bg-white/5 text-jarvis-body hover:text-jarvis-ink hover:bg-white/10 transition">
                  {btn.label}
                </button>
              ))}
              <button onClick={() => onDismiss?.(action.id)} className="text-[8px] px-1.5 py-0.5 rounded text-jarvis-muted hover:text-jarvis-danger hover:bg-red-900/20 transition">
                <X size={8} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pipeline Stage Bar ───────────────────────────────────────────────────────

function StageBar({ name, value, count, maxValue, health }) {
  const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
  const barColor = health === "good" ? "bg-jarvis-success" : health === "warn" ? "bg-jarvis-warning" : "bg-jarvis-danger";
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-jarvis-ink font-medium">{name}</span>
        <span className="text-[9px] text-jarvis-muted tabular-nums">{count} deals · {fmtUsd(value)}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-white/10">
        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

// ── Hot Deal Card ────────────────────────────────────────────────────────────

function HotDealCard({ deal }) {
  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-jarvis-border/20 last:border-b-0">
      <Flame size={10} className="text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-jarvis-ink font-medium truncate">{deal.company}</div>
        <div className="text-[8px] text-jarvis-muted">{deal.signal}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[10px] text-jarvis-success font-semibold tabular-nums">{fmtUsd(deal.value)}</div>
        <span className={`text-[7px] px-1.5 py-0.5 rounded-full ${
          deal.status === "hot" ? "bg-amber-900/20 text-amber-400" : "bg-green-900/20 text-green-400"
        }`}>{deal.status}</span>
      </div>
    </div>
  );
}

// ── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({ insight }) {
  const iconMap = { pattern: Eye, opportunity: Zap, coaching: Sparkles };
  const colorMap = { pattern: "text-blue-400", opportunity: "text-jarvis-success", coaching: "text-purple-400" };
  const Icon = iconMap[insight.type] || Sparkles;
  return (
    <div className="surface p-2.5 mb-2">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={10} className={colorMap[insight.type] || "text-jarvis-primary"} />
        <span className="text-[8px] text-jarvis-muted uppercase tracking-wider font-semibold">{insight.type}</span>
      </div>
      <div className="text-[10px] text-jarvis-body leading-relaxed">{insight.text}</div>
      {insight.data && <div className="text-[8px] text-jarvis-muted mt-1">Source: {insight.data}</div>}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export function TodaysFocus({ ops, crm, onOpenDeal }) {
  const deals = ops?.deals || crm?.deals || [];
  const [brief, setBrief] = useState(null);
  const [dismissed, setDismissed] = useState(new Set());

  // Filter to New pipeline active deals (no lead stages)
  const LEAD_STAGES = ["new lead", "new leads", "pipedrive leads", "gather info"];
  const activeDeals = deals.filter(d =>
    (d.pipeline || "").trim() === "New pipeline" &&
    d.status === "open" &&
    !LEAD_STAGES.some(ls => (d.stage || "").toLowerCase().includes(ls))
  );

  // Load morning brief
  useEffect(() => {
    jarvis.brief?.().then(b => setBrief(b)).catch(() => {});
  }, []);

  // ── KPI calculations ──
  const totalValue = activeDeals.reduce((s, d) => s + (d.value || 0), 0);
  const closingStages = ["negotiations started", "signing"];
  const closingThisMonth = activeDeals
    .filter(d => closingStages.some(s => (d.stage || "").toLowerCase().includes(s)))
    .reduce((s, d) => s + (d.value || 0), 0);
  const hotDeals = activeDeals.filter(d => {
    const lastAct = d.last_activity || d.updated_at;
    if (!lastAct) return false;
    const hrs = (Date.now() - new Date(lastAct).getTime()) / 3600000;
    return hrs < 48;
  });
  const coldDeals = activeDeals.filter(d => {
    const lastAct = d.last_activity || d.updated_at;
    if (!lastAct) return true;
    const days = (Date.now() - new Date(lastAct).getTime()) / 86400000;
    return days > 14;
  });
  const atRiskValue = coldDeals.reduce((s, d) => s + (d.value || 0), 0);
  const overdue = activeDeals.filter(d => (d.days_in_stage || 0) > 14);

  // ── Priority action queue ──
  const actions = activeDeals
    .map(d => {
      const daysSinceActivity = d.last_activity ? Math.floor((Date.now() - new Date(d.last_activity).getTime()) / 86400000) : 999;
      const daysInStage = d.days_in_stage || 0;
      const value = d.value || 0;
      const urgency = Math.min(10, Math.round(
        (value > 100000 ? 3 : value > 50000 ? 2 : 1) +
        (daysSinceActivity > 14 ? 3 : daysSinceActivity > 7 ? 2 : 0) +
        (daysInStage > 21 ? 2 : daysInStage > 14 ? 1 : 0) +
        ((d.engagement === "hot") ? 2 : 0)
      ));

      const tags = [];
      if (daysSinceActivity > 14) tags.push("churn");
      if (value > 200000) tags.push("whale");
      if (daysSinceActivity < 3 && (d.total_activities || 0) > 10) tags.push("hot");

      let action = "";
      let reasoning = "";
      const stage = (d.stage || "").toLowerCase();

      if (daysSinceActivity > 14) {
        action = `Re-engage ${d.contact_name || "contact"} — ${daysSinceActivity} days since last touch`;
        reasoning = `${fmtUsd(value)} at risk. Cold for ${daysSinceActivity} days in ${d.stage}.`;
      } else if (stage.includes("proposal") && daysInStage > 7) {
        action = `Follow up on proposal sent to ${d.contact_name || "contact"}`;
        reasoning = `Proposal pending ${daysInStage} days. Push for decision or address concerns.`;
      } else if (stage.includes("negotiat")) {
        action = `Advance negotiations with ${d.contact_name || "contact"} — close this month`;
        reasoning = `In negotiations for ${daysInStage} days. ${fmtUsd(value)} deal — push to close.`;
      } else if (stage.includes("demo") || stage.includes("site")) {
        action = `Schedule next step after demo with ${d.contact_name || "contact"}`;
        reasoning = `Post-demo. Convert interest to proposal within this week.`;
      } else if (daysSinceActivity < 3) {
        action = `Strike while hot — ${d.contact_name || "contact"} engaged recently`;
        reasoning = `Active in last ${daysSinceActivity || 1} days. Momentum is high.`;
      } else {
        action = `Check in with ${d.contact_name || "contact"} on ${d.org_name || d.title}`;
        reasoning = `Routine touch point. Keep deal moving forward.`;
      }

      const buttons = [];
      if (d.contact_email) buttons.push({ label: "Draft Email" });
      if (d.contact_phone) buttons.push({ label: "Call" });
      if (stage.includes("proposal")) buttons.push({ label: "Review Proposal" });
      if (stage.includes("demo") || stage.includes("negotiat")) buttons.push({ label: "Prep Brief" });

      return {
        id: d.id,
        deal: d,
        company: d.org_name || d.title || "Unknown",
        value,
        stage: d.stage,
        urgency,
        action,
        reasoning,
        tags,
        buttons,
        daysSinceActivity,
      };
    })
    .filter(a => !dismissed.has(a.id))
    .sort((a, b) => {
      if (b.urgency !== a.urgency) return b.urgency - a.urgency;
      return b.value - a.value;
    })
    .slice(0, 8);

  // ── Pipeline health by stage ──
  const stageOrder = ["Demo Scheduled/Site Visit", "Send Custom Proposal", "Proposal", "Follow up on proposal", "Review Proposal & Get Feedback", "Negotiations Started"];
  const stageGroups = {};
  for (const d of activeDeals) {
    const stage = (d.stage || "Other").trim();
    if (!stageGroups[stage]) stageGroups[stage] = { value: 0, count: 0 };
    stageGroups[stage].value += d.value || 0;
    stageGroups[stage].count++;
  }
  const maxStageValue = Math.max(1, ...Object.values(stageGroups).map(s => s.value));
  const orderedStages = stageOrder.filter(s => stageGroups[s]).map(s => ({
    name: s,
    value: stageGroups[s].value,
    count: stageGroups[s].count,
    health: stageGroups[s].count > 0 && stageGroups[s].value === 0 ? "warn" :
      stageGroups[s].count > 5 ? "good" : "warn",
  }));

  // ── Hot deals (engaged last 48h) ──
  const hotDealCards = hotDeals
    .sort((a, b) => (b.value || 0) - (a.value || 0))
    .slice(0, 5)
    .map(d => ({
      company: d.org_name || d.title,
      value: d.value || 0,
      signal: `Active ${d.last_activity ? fmtDate(d.last_activity) : "recently"} · ${d.total_activities || 0} interactions`,
      status: d.engagement || "active",
    }));

  // ── Insights ──
  const insights = [];
  if (coldDeals.length > 3) {
    insights.push({
      type: "pattern",
      text: `${coldDeals.length} deals have gone cold (14+ days silent). ${fmtUsd(atRiskValue)} at risk. Consider batch re-engagement.`,
      data: "deal activity tracking",
    });
  }
  if (hotDeals.length > 0) {
    insights.push({
      type: "opportunity",
      text: `${hotDeals.length} deals showing engagement in the last 48 hours. Total value: ${fmtUsd(hotDeals.reduce((s, d) => s + (d.value || 0), 0))}. Strike now.`,
      data: "engagement signals",
    });
  }
  insights.push({
    type: "coaching",
    text: activeDeals.length > 40
      ? "Pipeline is wide. Focus on advancing top 10 deals by value rather than spreading thin across 46."
      : `${activeDeals.length} active deals — manageable. Prioritize by stage advancement this week.`,
    data: "pipeline analysis",
  });

  const handleDismiss = (id) => {
    setDismissed(prev => new Set([...prev, id]));
  };

  // Brief text
  const briefText = brief?.todayBriefing ||
    `Pipeline at ${fmtUsd(totalValue)} across ${activeDeals.length} active deals. ${hotDeals.length} showing engagement in the last 48 hours. ${coldDeals.length} deals need attention — ${fmtUsd(atRiskValue)} at risk from inactivity. Focus today: advance your top negotiations and re-engage cold high-value prospects.`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Morning Brief ─────────────────────────────────────────── */}
      <div className="shrink-0 px-5 py-4 border-b border-jarvis-border bg-gradient-to-r from-jarvis-primary/[0.03] to-transparent">
        <div className="flex items-start gap-2.5">
          <Sparkles size={14} className="text-jarvis-primary shrink-0 mt-0.5" />
          <div>
            <div className="text-[8px] text-jarvis-primary uppercase tracking-wider font-semibold mb-1">Morning Brief</div>
            <p className="text-[11px] text-jarvis-body leading-relaxed max-w-3xl">{briefText}</p>
          </div>
        </div>
      </div>

      {/* ── KPI Bar ───────────────────────────────────────────────── */}
      <div className="shrink-0 flex gap-2 px-5 py-3 border-b border-jarvis-border/50 overflow-x-auto">
        <KpiCard icon={DollarSign} label="Pipeline" value={fmtUsd(totalValue)} sub="total value" color="text-jarvis-success" />
        <KpiCard icon={Users} label="Active" value={activeDeals.length} sub="open deals" />
        <KpiCard icon={Flame} label="Hot" value={hotDeals.length} sub="last 48h" color="text-amber-400" />
        <KpiCard icon={AlertTriangle} label="At Risk" value={fmtUsd(atRiskValue)} sub={`${coldDeals.length} cold`} color="text-jarvis-danger" />
        <KpiCard icon={Clock} label="Overdue" value={overdue.length} sub="stuck >14d" color={overdue.length > 5 ? "text-jarvis-danger" : "text-jarvis-warning"} />
        <KpiCard icon={Target} label="Closing" value={fmtUsd(closingThisMonth)} sub="this month" color="text-jarvis-primary" />
      </div>

      {/* ── Main content: Action Queue (left) + Sidebar (right) ──── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Priority Action Queue */}
        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: "thin" }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap size={12} className="text-jarvis-primary" />
              <span className="text-[11px] font-semibold text-jarvis-ink">Priority Actions</span>
              <span className="text-[9px] text-jarvis-muted">{actions.length} items</span>
            </div>
          </div>
          <div className="space-y-2">
            {actions.map((a, i) => (
              <ActionCard
                key={a.id}
                action={a}
                rank={i + 1}
                onDismiss={handleDismiss}
                onOpenDeal={onOpenDeal}
              />
            ))}
            {actions.length === 0 && (
              <div className="text-[11px] text-jarvis-muted text-center py-8">All caught up. No priority actions right now.</div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-[280px] shrink-0 border-l border-jarvis-border/50 overflow-y-auto px-4 py-4 bg-jarvis-surface/20" style={{ scrollbarWidth: "thin" }}>
          {/* Pipeline Health */}
          <div className="mb-5">
            <div className="flex items-center gap-1.5 mb-2.5">
              <BarChart3 size={11} className="text-jarvis-muted" />
              <span className="text-[9px] text-jarvis-muted uppercase tracking-wider font-semibold">Pipeline Health</span>
            </div>
            {orderedStages.length > 0 ? orderedStages.map(s => (
              <StageBar key={s.name} name={s.name} value={s.value} count={s.count} maxValue={maxStageValue} health={s.health} />
            )) : (
              <div className="text-[9px] text-jarvis-muted">No stage data</div>
            )}
          </div>

          {/* Hot Deals */}
          <div className="mb-5">
            <div className="flex items-center gap-1.5 mb-2.5">
              <Flame size={11} className="text-amber-400" />
              <span className="text-[9px] text-jarvis-muted uppercase tracking-wider font-semibold">Hot Deals</span>
            </div>
            {hotDealCards.length > 0 ? hotDealCards.map((d, i) => (
              <HotDealCard key={i} deal={d} />
            )) : (
              <div className="text-[9px] text-jarvis-muted">No hot signals in last 48h</div>
            )}
          </div>

          {/* Jarvis Insights */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sparkles size={11} className="text-jarvis-primary" />
              <span className="text-[9px] text-jarvis-muted uppercase tracking-wider font-semibold">Jarvis Insights</span>
            </div>
            {insights.map((ins, i) => (
              <InsightCard key={i} insight={ins} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
