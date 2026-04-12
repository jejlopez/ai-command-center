import { useState } from "react";
import { useOpsSupa } from "../hooks/useOpsSupa.js";
import { ModeBar } from "../components/ops/ModeBar.jsx";
import { CalendarRail } from "../components/ops/CalendarRail.jsx";
import { ContextStrip } from "../components/ops/ContextStrip.jsx";
import { QuickAddOps } from "../components/ops/QuickAddOps.jsx";
import { SalesDashboard } from "../components/ops/SalesDashboard.jsx";
import { TradingDashboard } from "../components/ops/TradingDashboard.jsx";
import { BuildDashboard } from "../components/ops/BuildDashboard.jsx";

export default function Work() {
  const [mode, setMode] = useState("sales");

  const {
    deals, followUps, proposals, comms, docs,
    positions, watchlist, tradeJournal,
    projects, ships, tasks,
    calendarEvents, intelligence,
    loading, refresh,
    salesCtx, tradingCtx, buildCtx, badges,
  } = useOpsSupa();

  const ops = {
    deals, followUps, proposals, comms, docs,
    positions, watchlist, tradeJournal,
    projects, ships, tasks,
    intelligence,
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Mode bar */}
      <ModeBar mode={mode} setMode={setMode} badges={badges} />

      {/* Main area: [main panel] + [calendar rail] */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {loading && (
            <div className="flex items-center justify-center flex-1">
              <div className="text-xs text-jarvis-muted animate-pulse">Loading operations hub…</div>
            </div>
          )}

          {!loading && mode === "sales" && (
            <SalesDashboard ops={ops} onRefresh={refresh} />
          )}
          {!loading && mode === "trading" && (
            <TradingDashboard ops={ops} onRefresh={refresh} />
          )}
          {!loading && mode === "build" && (
            <BuildDashboard ops={ops} onRefresh={refresh} />
          )}

          {/* Quick add bar */}
          <QuickAddOps mode={mode} onRefresh={refresh} />

          {/* Context strip */}
          <ContextStrip
            mode={mode}
            sales={salesCtx}
            trading={tradingCtx}
            build={buildCtx}
          />
        </div>

        {/* Calendar rail — always visible */}
        <CalendarRail
          followUps={followUps}
          calendarEvents={calendarEvents}
        />
      </div>
    </div>
  );
}
