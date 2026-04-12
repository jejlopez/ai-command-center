import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

const STAGES = [
  { key: "prospect", label: "Prospect", color: "text-jarvis-muted", border: "border-jarvis-muted/30" },
  { key: "quoted", label: "Quoted", color: "text-jarvis-primary", border: "border-jarvis-primary/30" },
  { key: "negotiating", label: "Negotiating", color: "text-jarvis-amber", border: "border-jarvis-amber/30" },
  { key: "closed_won", label: "Closed Won", color: "text-jarvis-green", border: "border-jarvis-green/30" },
];

function touchBorder(lastTouchDays) {
  if (lastTouchDays >= 7) return "border-l-2 border-l-jarvis-red";
  if (lastTouchDays >= 3) return "border-l-2 border-l-jarvis-amber";
  return "border-l-2 border-l-transparent";
}

function DealCard({ deal }) {
  const [expanded, setExpanded] = useState(false);
  const { company, value_usd, contact_name, days_in_stage, last_touch_days, probability, notes, close_date } = deal;

  return (
    <div
      className={`rounded-xl bg-jarvis-surface/40 border border-jarvis-border px-3 py-2 cursor-pointer transition hover:bg-jarvis-surface/60 ${touchBorder(last_touch_days ?? 0)}`}
      onClick={() => setExpanded((v) => !v)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm text-jarvis-ink font-semibold truncate">{company}</span>
        <span className="chip shrink-0 tabular-nums">${(value_usd ?? 0).toLocaleString()}</span>
      </div>
      {contact_name && (
        <div className="text-[10px] text-jarvis-muted mt-0.5 truncate">{contact_name}</div>
      )}
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] text-jarvis-body">{days_in_stage}d in stage</span>
        {last_touch_days >= 3 && (
          <span className={`text-[10px] font-semibold ${last_touch_days >= 7 ? "text-jarvis-red" : "text-jarvis-amber"}`}>
            {last_touch_days}d no touch
          </span>
        )}
      </div>
      {expanded && (
        <div className="mt-2 pt-2 border-t border-jarvis-border space-y-1">
          <div className="text-[10px] text-jarvis-muted">Probability: <span className="text-jarvis-ink font-semibold">{probability}%</span></div>
          {close_date && <div className="text-[10px] text-jarvis-muted">Close: <span className="text-jarvis-ink">{close_date}</span></div>}
          {notes && <div className="text-[10px] text-jarvis-body leading-snug mt-1">{notes}</div>}
        </div>
      )}
      <div className="flex justify-end mt-1">
        {expanded ? <ChevronUp size={11} className="text-jarvis-muted" /> : <ChevronDown size={11} className="text-jarvis-muted" />}
      </div>
    </div>
  );
}

function StageColumn({ stage, deals }) {
  return (
    <div className="flex flex-col min-w-0">
      <div className={`flex items-center justify-between mb-2 pb-1 border-b ${stage.border}`}>
        <span className={`label ${stage.color}`}>{stage.label}</span>
        <span className="text-[10px] text-jarvis-muted tabular-nums">{deals.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 min-h-[80px] max-h-[360px] pr-0.5">
        {deals.length === 0 ? (
          <div className="border border-dashed border-jarvis-border rounded-xl h-16 flex items-center justify-center">
            <span className="text-[10px] text-jarvis-muted">No deals</span>
          </div>
        ) : (
          deals.map((deal, i) => <DealCard key={deal.id ?? i} deal={deal} />)
        )}
      </div>
    </div>
  );
}

export function DealBoard({ dealBoard }) {
  const isEmpty = !dealBoard || Object.values(dealBoard).every((arr) => !Array.isArray(arr) || arr.length === 0);

  if (!dealBoard || Object.keys(dealBoard).length === 0) {
    return (
      <div className="glass p-6 border border-jarvis-border">
        <div className="label">Deal Board</div>
        <p className="text-sm text-jarvis-muted mt-2">Add your first deal to populate the board.</p>
      </div>
    );
  }

  return (
    <div className="glass p-6 border border-jarvis-border">
      <div className="label mb-4">Deal Board</div>
      {isEmpty ? (
        <p className="text-sm text-jarvis-muted">No deals yet. Add one from the quick bar below.</p>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STAGES.map((stage) => (
            <StageColumn
              key={stage.key}
              stage={stage}
              deals={dealBoard[stage.key] ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}
