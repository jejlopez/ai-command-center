import { TrendingUp, TrendingDown } from "lucide-react";

const fmtUsd  = (n) => n == null ? "—" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPnl  = (n) => n == null ? "—" : `${n >= 0 ? "+" : ""}$${Math.abs(n).toFixed(2)}`;
const plClass = (n) => n == null ? "text-jarvis-muted" : n >= 0 ? "text-jarvis-success" : "text-jarvis-danger";

export function PositionManager({ positions = [] }) {
  const openPositions = positions.filter(p => p.status === "open" || !p.status);

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={13} className="text-jarvis-muted" />
          <span className="label">Open Positions</span>
        </div>
        <span className="text-[10px] text-jarvis-muted">{openPositions.length} open</span>
      </div>

      {openPositions.length === 0 && (
        <p className="text-xs text-jarvis-ghost py-2">No open positions. Add a trade below.</p>
      )}

      {openPositions.length > 0 && (
        <div className="overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-jarvis-border">
                <th className="label text-left pb-1.5">Ticker</th>
                <th className="label text-left pb-1.5">Side</th>
                <th className="label text-right pb-1.5">Entry</th>
                <th className="label text-right pb-1.5">Current</th>
                <th className="label text-right pb-1.5">P&amp;L</th>
                <th className="label text-right pb-1.5">Stop</th>
                <th className="label text-right pb-1.5">Target</th>
              </tr>
            </thead>
            <tbody>
              {openPositions.map((p) => {
                const pnl = p.current_price != null && p.entry_price != null
                  ? (p.current_price - p.entry_price) * (p.size || 1) * (p.side === "short" ? -1 : 1)
                  : null;
                const Icon = p.side === "short" ? TrendingDown : TrendingUp;
                return (
                  <tr key={p.id} className="border-b border-jarvis-border/50 last:border-0 hover:bg-white/[0.02]">
                    <td className="py-1.5 font-mono font-bold text-jarvis-ink">{p.ticker}</td>
                    <td className="py-1.5">
                      <span className={`chip ${p.side === "short" ? "bg-jarvis-danger/15 text-jarvis-danger" : "bg-jarvis-success/15 text-jarvis-success"}`}>
                        <Icon size={8} />{p.side}
                      </span>
                    </td>
                    <td className="py-1.5 text-right text-jarvis-body font-mono">{fmtUsd(p.entry_price)}</td>
                    <td className="py-1.5 text-right font-mono text-jarvis-ink">{fmtUsd(p.current_price)}</td>
                    <td className={`py-1.5 text-right font-mono font-semibold ${plClass(pnl)}`}>{fmtPnl(pnl)}</td>
                    <td className="py-1.5 text-right font-mono text-jarvis-danger/70">{fmtUsd(p.stop_loss)}</td>
                    <td className="py-1.5 text-right font-mono text-jarvis-success/70">{fmtUsd(p.take_profit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
