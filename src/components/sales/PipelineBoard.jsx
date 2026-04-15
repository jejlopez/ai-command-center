// Pipeline — deals grouped by stage, vertical list. Each deal shows age + score.

import { motion, AnimatePresence } from "framer-motion";
import { stagger } from "../../lib/motion.js";
import { dealAge, ageColor, dealScore, scoreColor } from "../../lib/dealScore.js";

const STAGE_ORDER = [
  { key: "Proposal",                  label: "Proposal",    color: "text-blue-400",        dot: "bg-blue-400"   },
  { key: "Follow up on proposal",     label: "Follow-up",   color: "text-jarvis-warning",  dot: "bg-jarvis-warning" },
  { key: "Negotiations Started",      label: "Negotiation", color: "text-yellow-400",      dot: "bg-yellow-400" },
  { key: "Demo Scheduled/Site Visit", label: "Demo/Visit",  color: "text-green-400",       dot: "bg-green-400"  },
  { key: "Signing Contract",          label: "Signing",     color: "text-jarvis-success",  dot: "bg-jarvis-success" },
];

const COLOR_MAP = {
  success: "text-jarvis-success bg-jarvis-success/10",
  warning: "text-jarvis-warning bg-jarvis-warning/10",
  danger:  "text-jarvis-danger bg-jarvis-danger/10",
  ghost:   "text-jarvis-muted bg-white/5",
};

function Badge({ label, value, colorKey }) {
  return (
    <div className={`text-center px-1.5 py-0.5 rounded ${COLOR_MAP[colorKey] || COLOR_MAP.ghost}`}>
      <div className="text-[8px] text-jarvis-muted/60 uppercase">{label}</div>
      <div className="text-[11px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function DealCard({ deal, onClick }) {
  const age = dealAge(deal);
  const score = dealScore(deal);
  const isOverdue = deal.next_activity && deal.next_activity < new Date().toISOString().slice(0, 10);

  // Collect signal chips
  const signals = [];
  if (deal.pandadoc_viewed) signals.push({ text: `Proposal viewed${deal.pandadoc_view_count > 1 ? ` ${deal.pandadoc_view_count}x` : ""}`, color: "text-jarvis-primary bg-jarvis-primary/10" });
  if (deal.email_replied) signals.push({ text: "Email replied", color: "text-jarvis-success bg-jarvis-success/10" });
  if (isOverdue) signals.push({ text: "Overdue", color: "text-jarvis-danger bg-jarvis-danger/10" });
  if (deal.engagement === "hot") signals.push({ text: "Hot", color: "text-jarvis-warning bg-jarvis-warning/10" });

  // Next activity signal
  if (deal.next_activity && !isOverdue) {
    const actDate = new Date(deal.next_activity);
    const today = new Date();
    if (actDate.toDateString() === today.toDateString()) {
      signals.push({ text: `Today ${actDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`, color: "text-jarvis-warning bg-jarvis-warning/10" });
    }
  }

  // Silence signal
  const lastAct = deal.last_activity_date || deal.update_time;
  if (lastAct) {
    const silent = Math.floor((Date.now() - new Date(lastAct).getTime()) / 86_400_000);
    if (silent >= 5) signals.push({ text: `No response ${silent}d`, color: "text-jarvis-danger bg-jarvis-danger/10" });
  }

  return (
    <motion.button
      variants={stagger.item}
      onClick={() => onClick?.(deal)}
      className="w-full text-left p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] hover:border-white/[0.1] transition-all duration-200"
    >
      <div className="flex justify-between items-center">
        <div className="min-w-0 flex-1">
          <div className="text-xs text-jarvis-ink font-medium truncate">{deal.title || deal.org_name}</div>
          <div className="text-[10px] text-jarvis-muted truncate">
            {deal.contact_name || deal.person_name}{deal.org_name && deal.title ? ` · ${deal.org_name}` : ""}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <span className="text-sm font-bold text-jarvis-ink tabular-nums">
            {deal.value > 0 ? `$${(deal.value / 1000).toFixed(0)}K` : "—"}
          </span>
          {age != null && <Badge label="AGE" value={`${age}d`} colorKey={ageColor(age)} />}
          <Badge label="SCORE" value={score} colorKey={scoreColor(score)} />
        </div>
      </div>
      {signals.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {signals.map((s, i) => (
            <span key={i} className={`text-[8px] px-1.5 py-0.5 rounded ${s.color}`}>{s.text}</span>
          ))}
        </div>
      )}
    </motion.button>
  );
}

function StageGroup({ stage, deals, onOpenDeal }) {
  const totalValue = deals.reduce((s, d) => s + (d.value || 0), 0);

  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${stage.dot}`} />
          <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] ${stage.color}`}>{stage.label}</span>
        </div>
        <span className="text-[10px] text-jarvis-muted/40 tabular-nums">{deals.length} · ${(totalValue / 1000).toFixed(0)}K</span>
      </div>
      <div className="flex flex-col gap-1">
        {deals.map(d => (
          <DealCard key={d.id} deal={d} onClick={onOpenDeal} />
        ))}
        {deals.length === 0 && (
          <div className="text-[9px] text-jarvis-muted/30 text-center py-3">No deals</div>
        )}
      </div>
    </div>
  );
}

export function PipelineBoard({ pipeline, onOpenDeal }) {
  if (!pipeline || Object.keys(pipeline).length === 0) {
    return (
      <div className="text-center py-8">
        <div className="text-xs text-jarvis-muted">No pipeline data. Connect Pipedrive in Settings.</div>
      </div>
    );
  }

  // Normalize stage keys (Pipedrive trailing spaces)
  const normalized = {};
  for (const [key, deals] of Object.entries(pipeline)) {
    const trimmed = key.trim();
    normalized[trimmed] = [...(normalized[trimmed] || []), ...(deals || [])];
  }

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show">
      {STAGE_ORDER.map(stage => (
        <StageGroup key={stage.key} stage={stage} deals={normalized[stage.key] ?? []} onOpenDeal={onOpenDeal} />
      ))}
    </motion.div>
  );
}
