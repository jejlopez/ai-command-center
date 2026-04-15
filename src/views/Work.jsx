import { useState } from "react";
import { useOpsSupa } from "../hooks/useOpsSupa.js";
import { useCRM } from "../hooks/useCRM.js";
import { useLeadsSupa } from "../hooks/useLeadsSupa.js";
import { ModeBar } from "../components/ops/ModeBar.jsx";
import { QuickAddOps } from "../components/ops/QuickAddOps.jsx";
import { SalesDashboard } from "../components/ops/SalesDashboard.jsx";
import { LeadsTab } from "../components/sales/LeadsTab.jsx";
import { PlaybookTab } from "../components/sales/PlaybookTab.jsx";
import { StatsBar } from "../components/sales/StatsBar.jsx";
import { TradingDashboard } from "../components/ops/TradingDashboard.jsx";
import { BuildDashboard } from "../components/ops/BuildDashboard.jsx";

export default function Work() {
  const [mode, setMode] = useState("sales");
  const [salesTab, setSalesTab] = useState("deals");
  const crm = useCRM();
  const { leads: supaLeads } = useLeadsSupa();

  const {
    deals, followUps, proposals, comms, docs,
    positions, watchlist, tradeJournal,
    projects, ships, tasks,
    calendarEvents, intelligence,
    loading, refresh,
    salesCtx, tradingCtx, buildCtx, badges,
  } = useOpsSupa();

  const mergedDeals = crm.deals.length > 0 ? crm.deals : deals;

  const ops = {
    deals: mergedDeals, followUps, proposals, comms, docs,
    positions, watchlist, tradeJournal,
    projects, ships, tasks,
    calendarEvents, intelligence, crm,
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      {/* Mode bar — Work page modes */}
      <ModeBar mode={mode} setMode={setMode} badges={badges} />

      {/* Sales sub-header: StatsBar with Sales/Playbook toggle */}
      {mode === "sales" && (
        <StatsBar
          deals={mergedDeals}
          proposals={proposals}
          followUps={followUps}
          leads={supaLeads}
          activeTab={salesTab}
          onTabChange={setSalesTab}
        />
      )}

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        {loading && (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-jarvis-muted animate-pulse">Loading…</div>
          </div>
        )}

        {!loading && mode === "sales" && salesTab === "leads" && (
          <LeadsTab crm={crm} />
        )}
        {!loading && mode === "sales" && salesTab === "deals" && (
          <SalesDashboard ops={ops} onRefresh={refresh} />
        )}
        {!loading && mode === "sales" && salesTab === "playbook" && (
          <PlaybookTab deals={mergedDeals} />
        )}
        {!loading && mode === "trading" && (
          <TradingDashboard ops={ops} onRefresh={refresh} />
        )}
        {!loading && mode === "build" && (
          <BuildDashboard ops={ops} onRefresh={refresh} />
        )}
      </div>

      {/* Quick add bar */}
      <QuickAddOps mode={mode} onRefresh={refresh} />
    </div>
  );
}
