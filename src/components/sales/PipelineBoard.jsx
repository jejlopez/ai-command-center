// Pipeline Kanban — deals flow through stages left to right.
// JARVIS signals layered on: overdue, replied, PandaDoc viewed.

import { motion } from "framer-motion";
import { stagger } from "../../lib/motion.js";

const STAGE_ORDER = [
  { key: "Proposal", label: "Proposal", color: "jarvis-primary" },
  { key: "Follow up on proposal", label: "Follow-up", color: "jarvis-warning" },
  { key: "Negotiations Started", label: "Negotiations", color: "jarvis-purple" },
  { key: "Demo Scheduled/Site Visit", label: "Demo/Visit", color: "jarvis-success" },
  { key: "Signing Contract", label: "Signing", color: "jarvis-success" },
];

function DealCard({ deal, onClick }) {
  const isOverdue = deal.next_activity && deal.next_activity < new Date().toISOString().slice(0, 10);
  const hasValue = deal.value > 0;

  return (
    <button
      onClick={() => onClick?.(deal)}
      className={`w-full text-left p-2.5 rounded-lg border transition-all hover:bg-white/[0.02] ${
        isOverdue
          ? "border-jarvis-danger/10 bg-jarvis-danger/[0.015]"
          : "border-jarvis-border bg-jarvis-surface"
      }`}
    >
      <div className="flex justify-between items-start gap-2">
        <span className="text-[10px] text-jarvis-ink font-medium truncate">{deal.title}</span>
        {hasValue && (
          <span className="text-[9px] text-jarvis-muted tabular-nums shrink-0">
            ${(deal.value / 1000).toFixed(0)}K
          </span>
        )}
      </div>
      {deal.org_name && (
        <div className="text-[8px] text-jarvis-muted truncate mt-0.5">{deal.org_name}</div>
      )}
      <div className="flex items-center gap-2 mt-1.5">
        {isOverdue && (
          <span className="text-[7px] text-jarvis-danger uppercase tracking-wider">overdue</span>
        )}
        {deal.pandadoc_viewed ? (
          <span className="text-[7px] text-jarvis-success">viewed ✓</span>
        ) : null}
        {deal.engagement === "hot" && (
          <span className="text-[7px] text-jarvis-warning">hot</span>
        )}
      </div>
    </button>
  );
}

function StageColumn({ stage, deals, onOpenDeal }) {
  const totalValue = deals.reduce((sum, d) => sum + (d.value || 0), 0);

  return (
    <div className="flex-1 min-w-[160px] flex flex-col gap-1.5">
      <div className="flex justify-between items-baseline pb-2 border-b border-jarvis-border">
        <span className="text-[8px] text-jarvis-muted uppercase tracking-[0.12em]">
          {stage.label} ({deals.length})
        </span>
        {totalValue > 0 && (
          <span className="text-[8px] text-jarvis-muted tabular-nums">
            ${(totalValue / 1000).toFixed(0)}K
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1 overflow-y-auto max-h-[400px]" style={{ scrollbarWidth: "thin" }}>
        {deals.map((d) => (
          <DealCard key={d.id} deal={d} onClick={onOpenDeal} />
        ))}
        {deals.length === 0 && (
          <div className="text-[9px] text-jarvis-muted/40 text-center py-4">No deals</div>
        )}
      </div>
    </div>
  );
}

export function PipelineBoard({ pipeline, onOpenDeal }) {
  if (!pipeline || Object.keys(pipeline).length === 0) {
    return (
      <div className="surface p-6 text-center">
        <div className="text-[12px] text-jarvis-muted">No pipeline data. Connect Pipedrive or sync.</div>
      </div>
    );
  }

  // Normalize stage keys — Pipedrive sometimes adds trailing spaces
  const normalized = {};
  for (const [key, deals] of Object.entries(pipeline)) {
    const trimmed = key.trim();
    normalized[trimmed] = [...(normalized[trimmed] || []), ...(deals || [])];
  }

  return (
    <motion.div
      variants={stagger.container}
      initial="hidden"
      animate="show"
      className="flex gap-3 overflow-x-auto pb-2"
      style={{ scrollbarWidth: "thin" }}
    >
      {STAGE_ORDER.map((stage) => {
        const deals = normalized[stage.key] ?? [];
        return (
          <motion.div key={stage.key} variants={stagger.item} className="flex-1 min-w-[160px]">
            <StageColumn stage={stage} deals={deals} onOpenDeal={onOpenDeal} />
          </motion.div>
        );
      })}
    </motion.div>
  );
}
