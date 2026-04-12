import { Trophy, Target } from "lucide-react";

function WinBar({ wins, losses }) {
  const total = wins + losses;
  if (total === 0) return null;
  const pct = Math.round((wins / total) * 100);
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full bg-jarvis-green" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-jarvis-muted tabular-nums">{pct}%</span>
    </div>
  );
}

function PnlChip({ label, pnl }) {
  const color = pnl >= 0 ? "text-jarvis-green" : "text-jarvis-red";
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
      <span className="text-xs text-jarvis-muted">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>{pnl >= 0 ? "+" : ""}${Math.abs(pnl).toLocaleString()}</span>
    </div>
  );
}

export function TradingScorecard({ scorecard }) {
  if (!scorecard || Object.keys(scorecard).length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Trading Scorecard</div>
        <p className="text-sm text-jarvis-muted">Log your first trade to see your scorecard.</p>
      </div>
    );
  }

  const today = scorecard.today ?? {};
  const week = scorecard.week ?? {};

  return (
    <div className="glass p-5">
      <div className="label mb-3">Trading Scorecard</div>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between"><span className="text-xs text-jarvis-muted">Today</span><span className="text-xs text-jarvis-body">{today.wins ?? 0}W {today.losses ?? 0}L</span></div>
          <PnlChip label="P&L" pnl={today.pnl ?? 0} />
          <WinBar wins={today.wins ?? 0} losses={today.losses ?? 0} />
        </div>
        <div>
          <div className="flex items-center justify-between"><span className="text-xs text-jarvis-muted">This Week</span><span className="text-xs text-jarvis-body">{week.wins ?? 0}W {week.losses ?? 0}L</span></div>
          <PnlChip label="P&L" pnl={week.pnl ?? 0} />
          <WinBar wins={week.wins ?? 0} losses={week.losses ?? 0} />
        </div>
        {(scorecard.best_trade || scorecard.worst_trade) && (
          <div className="flex items-center gap-2 pt-2 border-t border-jarvis-border">
            {scorecard.best_trade && <span className="chip text-[10px]"><Trophy size={10} className="text-jarvis-green inline mr-1" />{scorecard.best_trade.ticker} +${Math.abs(scorecard.best_trade.pnl).toLocaleString()}</span>}
            {scorecard.worst_trade && <span className="chip text-[10px]"><Target size={10} className="text-jarvis-red inline mr-1" />{scorecard.worst_trade.ticker} -${Math.abs(scorecard.worst_trade.pnl).toLocaleString()}</span>}
          </div>
        )}
      </div>
    </div>
  );
}
