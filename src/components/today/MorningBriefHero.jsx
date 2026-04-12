import { RefreshCw, Loader2 } from "lucide-react";

function fmtDate() {
  return new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function StatChip({ label, value, color = "text-jarvis-cyan" }) {
  return (
    <span className="chip">
      <span className="text-jarvis-muted">{label}</span>{" "}
      <span className={`font-semibold ${color}`}>{value}</span>
    </span>
  );
}

export function MorningBriefHero({
  brief,
  meetingCount,
  pipelineValue,
  tradingPnl,
  followUpsDue,
  budgetRemaining,
  onRegenerate,
  regenerating,
}) {
  const pnlColor = tradingPnl > 0 ? "text-jarvis-green" : tradingPnl < 0 ? "text-jarvis-red" : "text-jarvis-body";
  const fmtUsd = (n) => n == null ? "--" : `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="glass p-6 border border-jarvis-cyan/20 shadow-glow-cyan animate-fadeIn">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-jarvis-ink">{fmtDate()}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <StatChip label="Meetings" value={meetingCount ?? 0} />
            <StatChip label="Pipeline" value={fmtUsd(pipelineValue)} color="text-jarvis-blue" />
            <StatChip label="P&L" value={`${tradingPnl >= 0 ? "+" : ""}${fmtUsd(tradingPnl)}`} color={pnlColor} />
            <StatChip label="Follow-ups" value={followUpsDue ?? 0} color={followUpsDue > 0 ? "text-jarvis-amber" : "text-jarvis-green"} />
            <StatChip label="Budget" value={fmtUsd(budgetRemaining)} />
          </div>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="shrink-0 px-3 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-jarvis-body hover:text-jarvis-ink flex items-center gap-1.5 transition"
        >
          {regenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Brief
        </button>
      </div>
      {brief?.narrative && (
        <p className="text-sm text-jarvis-body mt-4 leading-relaxed">{brief.narrative}</p>
      )}
      {!brief?.narrative && (
        <p className="text-sm text-jarvis-muted mt-4 italic">No brief generated yet — click Brief to generate.</p>
      )}
    </div>
  );
}
