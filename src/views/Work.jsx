import { useState, useEffect, lazy, Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import { jarvis } from "../lib/jarvis.js";
import { useOpsSupa } from "../hooks/useOpsSupa.js";
import { useCRM } from "../hooks/useCRM.js";
import { useLeadsSupa } from "../hooks/useLeadsSupa.js";
import { ModeBar } from "../components/ops/ModeBar.jsx";
import { QuickAddOps } from "../components/ops/QuickAddOps.jsx";
import { StatsBar } from "../components/sales/StatsBar.jsx";
import { SalesCommandBriefing } from "../components/sales/SalesCommandBriefing.jsx";

// Lazy-load tab content — only one mode/tab visible at a time
const SalesDashboard  = lazy(() => import("../components/ops/SalesDashboard.jsx").then(m => ({ default: m.SalesDashboard })));
const LeadsTab        = lazy(() => import("../components/sales/LeadsTab.jsx").then(m => ({ default: m.LeadsTab })));
const PlaybookTab     = lazy(() => import("../components/sales/PlaybookTab.jsx").then(m => ({ default: m.PlaybookTab })));
const EmailInboxPanel = lazy(() => import("../components/sales/EmailInboxPanel.jsx").then(m => ({ default: m.EmailInboxPanel })));
const EmailDetailModal= lazy(() => import("../components/sales/EmailDetailModal.jsx").then(m => ({ default: m.EmailDetailModal })));
const TradingDashboard= lazy(() => import("../components/ops/TradingDashboard.jsx").then(m => ({ default: m.TradingDashboard })));
const BuildDashboard  = lazy(() => import("../components/ops/BuildDashboard.jsx").then(m => ({ default: m.BuildDashboard })));
const ApprovalQueue   = lazy(() => import("../components/sales/ApprovalQueue.jsx").then(m => ({ default: m.ApprovalQueue })));
const CommandCenter   = lazy(() => import("../components/sales/CommandCenter.jsx").then(m => ({ default: m.CommandCenter })));

export default function Work() {
  const [mode, setMode] = useState("sales");
  const [salesTab, setSalesTab] = useState("today");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [inboxCount, setInboxCount] = useState(0);
  const crm = useCRM();
  const { leads: supaLeads } = useLeadsSupa();

  // Fetch unread inbox count
  useEffect(() => {
    jarvis.emailTriageStats?.()
      .then(stats => {
        const count = (stats?.urgent || 0) + (stats?.action_needed || 0) + (stats?.fyi || 0) + (stats?.personal || 0) + (stats?.billing || 0);
        setInboxCount(count);
      })
      .catch(() => {});
  }, []);

  const {
    deals, followUps, proposals, comms, docs,
    positions, watchlist, tradeJournal,
    projects, ships, tasks,
    calendarEvents, intelligence,
    loading, refresh,
    salesCtx, tradingCtx, buildCtx, badges,
  } = useOpsSupa();

  // Prefer jarvisd deals (synced every 30min with full pipeline).
  // Fall back to Supabase if jarvisd has nothing.
  const mergedDeals = crm.deals?.length > 0 ? crm.deals : deals;

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

      {/* Sales sub-header: tabs only (stats hidden on Today's Focus — KPI bar replaces them) */}
      {mode === "sales" && (
        <StatsBar
          deals={salesTab === "today" ? [] : mergedDeals}
          proposals={salesTab === "today" ? [] : proposals}
          followUps={salesTab === "today" ? [] : followUps}
          leads={salesTab === "today" ? [] : supaLeads}
          activeTab={salesTab}
          onTabChange={setSalesTab}
          inboxCount={inboxCount}
          hideStats={salesTab === "today"}
        />
      )}

      {/* Main content */}
      <div className={`flex-1 ${salesTab === "today" ? "overflow-y-auto" : "overflow-hidden"}`}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-xs text-jarvis-muted animate-pulse">Loading…</div>
          </div>
        ) : (
          <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="text-xs text-jarvis-muted animate-pulse">Loading…</div></div>}>
            {mode === "sales" && salesTab === "today" && (
              <CommandCenter ops={ops} crm={crm} onSwitchTab={setSalesTab} />
            )}
            {mode === "sales" && salesTab === "leads" && (
              <LeadsTab crm={crm} />
            )}
            {mode === "sales" && salesTab === "deals" && (
              <SalesDashboard ops={ops} onRefresh={refresh} />
            )}
            {mode === "sales" && salesTab === "inbox" && (
              <EmailInboxPanel onSelectEmail={setSelectedEmail} />
            )}
            {mode === "sales" && salesTab === "approvals" && (
              <div className="h-full overflow-y-auto p-4">
                <ApprovalQueue />
              </div>
            )}
            {mode === "sales" && salesTab === "playbook" && (
              <PlaybookTab deals={mergedDeals} />
            )}
            {mode === "trading" && (
              <TradingDashboard ops={ops} onRefresh={refresh} />
            )}
            {mode === "build" && (
              <BuildDashboard ops={ops} onRefresh={refresh} />
            )}
          </Suspense>
        )}
      </div>

      {/* Quick add bar */}
      <QuickAddOps mode={mode} onRefresh={refresh} />

      {/* Email detail modal */}
      {selectedEmail && (
        <Suspense fallback={null}>
          <AnimatePresence>
            <EmailDetailModal
              triageEmail={selectedEmail}
              onClose={() => setSelectedEmail(null)}
            />
          </AnimatePresence>
        </Suspense>
      )}
    </div>
  );
}
