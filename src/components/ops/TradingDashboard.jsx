import { motion } from "framer-motion";
import { stagger } from "../../lib/motion.js";
import { PositionManager } from "./PositionManager.jsx";
import { WatchlistPanel } from "./WatchlistPanel.jsx";
import { TradeEntry } from "./TradeEntry.jsx";

// Today's P&L summary header
function TradingHeader({ positions = [], tradeJournal = [] }) {
  const openPositions = positions.filter(p => p.status === "open" || !p.status);
  const pnl = openPositions.reduce((s, p) => {
    if (p.current_price == null || p.entry_price == null) return s;
    const diff = (p.current_price - p.entry_price) * (p.size || 1) * (p.side === "short" ? -1 : 1);
    return s + diff;
  }, 0);

  const isPos = pnl >= 0;

  return (
    <div className={`glass p-4 border ${isPos ? "border-jarvis-success/20" : "border-jarvis-danger/20"}`}>
      <div className="flex items-center gap-6">
        <div>
          <div className="label">Unrealized P&amp;L</div>
          <div className={`text-3xl font-bold tabular-nums mt-1 ${isPos ? "text-jarvis-success" : "text-jarvis-danger"}`}>
            {isPos ? "+" : ""}{pnl >= 0 ? "" : "-"}${Math.abs(pnl).toFixed(2)}
          </div>
        </div>
        <div className="border-l border-jarvis-border pl-6">
          <div className="label">Open Positions</div>
          <div className="text-2xl font-bold text-jarvis-ink mt-1">{openPositions.length}</div>
        </div>
        <div className="border-l border-jarvis-border pl-6">
          <div className="label">Market Status</div>
          <MarketStatus />
        </div>
      </div>
    </div>
  );
}

function MarketStatus() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const totalMins = h * 60 + m;
  const open  = 9 * 60 + 30;
  const close = 16 * 60;
  const isOpen = totalMins >= open && totalMins < close;
  const isPremarket = totalMins >= 4 * 60 && totalMins < open;
  const isAfter = totalMins >= close && totalMins < 20 * 60;

  if (isOpen)      return <span className="chip bg-jarvis-success/15 text-jarvis-success mt-1">Open</span>;
  if (isPremarket) return <span className="chip bg-jarvis-warning/15 text-jarvis-warning mt-1">Pre-market</span>;
  if (isAfter)     return <span className="chip bg-jarvis-warning/15 text-jarvis-warning mt-1">After-hours</span>;
  return <span className="chip bg-jarvis-ghost text-jarvis-muted mt-1">Closed</span>;
}

// Trade journal — today's entries
function TodayJournal({ entries = [] }) {
  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="label">Today's Journal</div>
      {entries.length === 0 ? (
        <p className="text-xs text-jarvis-ghost py-2">No journal entries today.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.slice(0, 4).map((e, i) => (
            <div key={e.id ?? i} className="py-1.5 border-b border-jarvis-border/50 last:border-0">
              <div className="text-xs font-medium text-jarvis-ink">{e.title || e.ticker}</div>
              {e.notes && <div className="text-[11px] text-jarvis-body mt-0.5 line-clamp-2">{e.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TradingDashboard({ ops, onRefresh }) {
  const { positions = [], watchlist = [], tradeJournal = [] } = ops;

  return (
    <motion.div
      className="flex flex-col gap-4 p-4 overflow-y-auto h-full"
      variants={stagger.container}
      initial="hidden"
      animate="show"
    >
      {/* P&L Header */}
      <motion.div variants={stagger.item}>
        <TradingHeader positions={positions} tradeJournal={tradeJournal} />
      </motion.div>

      {/* Positions — full width */}
      <motion.div variants={stagger.item}>
        <PositionManager positions={positions} />
      </motion.div>

      {/* Watchlist + Trade Entry */}
      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <WatchlistPanel watchlist={watchlist} onRefresh={onRefresh} />
        <TradeEntry onRefresh={onRefresh} />
      </motion.div>

      {/* Journal */}
      <motion.div variants={stagger.item}>
        <TodayJournal entries={tradeJournal} />
      </motion.div>
    </motion.div>
  );
}
