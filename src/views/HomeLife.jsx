import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCcw, HouseHeart } from "lucide-react";
import { motion } from "framer-motion";
import { stagger } from "../lib/motion.js";
import { jarvis } from "../lib/jarvis.js";
import { useHomeSupa } from "../hooks/useHomeSupa.js";
import { HomeHero } from "../components/home/HomeHero.jsx";
import { TaskQueue } from "../components/home/TaskQueue.jsx";
import { RecurringExpenses } from "../components/home/RecurringExpenses.jsx";
import { MaintenanceCalendar } from "../components/home/MaintenanceCalendar.jsx";
import { QuickAdd } from "../components/home/QuickAdd.jsx";
import { SimplificationScore } from "../components/home/SimplificationScore.jsx";
import { DecisionBacklog } from "../components/home/DecisionBacklog.jsx";
import { HomeSystemsStatus } from "../components/home/HomeSystemsStatus.jsx";
import { SubscriptionAudit } from "../components/home/SubscriptionAudit.jsx";
import { VendorManager } from "../components/home/VendorManager.jsx";
import { HomeAssetTracker } from "../components/home/HomeAssetTracker.jsx";
import { AnnualHomeBudget } from "../components/home/AnnualHomeBudget.jsx";
import { AutomationOpportunities } from "../components/home/AutomationOpportunities.jsx";
import { TimeSavingsCalculator } from "../components/home/TimeSavingsCalculator.jsx";
import { MaintenanceCompound } from "../components/home/MaintenanceCompound.jsx";

function useHomeTasks() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [tasks, events] = await Promise.all([
        jarvis.memoryList("task").catch(() => []),
        jarvis.memoryList("event").catch(() => []),
      ]);
      setNodes([
        ...(Array.isArray(tasks) ? tasks : []),
        ...(Array.isArray(events) ? events : []),
      ]);
    } catch {
      setNodes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  return { nodes, loading, refresh };
}

export default function HomeLife() {
  const { nodes, loading: tasksLoading, refresh: refreshTasks } = useHomeTasks();
  const {
    expenses, vendors, decisions, assets,
    overdueCount: overdueExpenses,
    loading: expensesLoading,
    refresh: refreshExpenses,
    addExpense, addVendor, deleteVendor,
    addDecision, resolveDecision, addAsset,
    isDueThisWeek,
  } = useHomeSupa();

  const loading = tasksLoading && expensesLoading;

  const refresh = useCallback(async () => {
    await Promise.all([refreshTasks(), refreshExpenses()]);
  }, [refreshTasks, refreshExpenses]);

  const homeTasks = nodes.filter((n) => {
    const l = (n.label ?? "").toLowerCase();
    return n.kind === "task" && (l.includes("home") || l.includes("household"));
  });

  const overdueTaskCount = homeTasks.filter((n) => {
    if (!n.created_at) return false;
    return (Date.now() - new Date(n.created_at).getTime()) / 86_400_000 > 7;
  }).length;

  const dueThisWeekCount = expenses.filter((e) => isDueThisWeek(e.next_due)).length;

  const maintenanceItems = nodes
    .filter((n) => {
      const l = (n.label ?? "").toLowerCase();
      return n.kind === "event" || l.includes("maintenance") || l.includes("service");
    })
    .filter((n) => n.body?.trim())
    .sort((a, b) => (a.body ?? "").localeCompare(b.body ?? ""));

  const nextMaintenance = maintenanceItems.length > 0
    ? (() => {
        const item = maintenanceItems[0];
        const d = new Date(item.body.trim() + "T00:00:00");
        return `${item.label} — ${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
      })()
    : null;

  return (
    <div className="h-full w-full flex flex-col min-h-0" style={{ "--page-accent": "#F59E0B" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-jarvis-purple/10 border border-jarvis-purple/20 grid place-items-center">
            <HouseHeart size={16} className="text-jarvis-purple" />
          </div>
          <div>
            <div className="label text-jarvis-purple">Home Life</div>
            <div className="text-[12px] text-jarvis-body">Tasks, expenses, and maintenance</div>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-surface/40 text-jarvis-body border border-jarvis-border hover:text-jarvis-ink hover:bg-white/5 transition disabled:opacity-40"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
          Refresh
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-20">
        <motion.div
          className="space-y-6 p-6 max-w-6xl mx-auto"
          variants={stagger.container}
          initial="hidden"
          animate="show"
        >
          {/* Hero */}
          <motion.div variants={stagger.item}>
            <HomeHero
              taskCount={overdueTaskCount}
              overdueExpenses={overdueExpenses}
              dueThisWeek={dueThisWeekCount}
              nextMaintenance={nextMaintenance}
            />
          </motion.div>

          {/* Row 1: Score + Decisions + Systems */}
          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <SimplificationScore
              vendors={vendors}
              decisions={decisions}
              expenses={expenses}
              nodes={nodes}
            />
            <DecisionBacklog
              decisions={decisions}
              loading={expensesLoading}
              onAdd={addDecision}
              onDecide={(id) => resolveDecision(id, "decided")}
              onDefer={(id) => resolveDecision(id, "deferred")}
            />
            <HomeSystemsStatus assets={assets} loading={expensesLoading} />
          </motion.div>

          {/* Row 2: Task Queue + Subscription Audit */}
          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TaskQueue nodes={nodes} loading={tasksLoading} refresh={refreshTasks} />
            <SubscriptionAudit expenses={expenses} loading={expensesLoading} />
          </motion.div>

          {/* Row 3: Vendor Manager + Asset Tracker */}
          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <VendorManager
              vendors={vendors}
              loading={expensesLoading}
              onAdd={addVendor}
              onDelete={deleteVendor}
            />
            <HomeAssetTracker assets={assets} loading={expensesLoading} onAdd={addAsset} />
          </motion.div>

          {/* Row 4: Recurring Expenses + Annual Budget */}
          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecurringExpenses expenses={expenses} loading={expensesLoading} />
            <AnnualHomeBudget expenses={expenses} loading={expensesLoading} />
          </motion.div>

          {/* Row 5: Automation Opportunities + Time Savings */}
          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AutomationOpportunities nodes={nodes} />
            <TimeSavingsCalculator />
          </motion.div>

          {/* Full-width: Maintenance Compound */}
          <motion.div variants={stagger.item}>
            <MaintenanceCompound nodes={nodes} />
          </motion.div>

          {/* Full-width: Maintenance Calendar */}
          <motion.div variants={stagger.item}>
            <MaintenanceCalendar nodes={nodes} loading={tasksLoading} refresh={refreshTasks} />
          </motion.div>
        </motion.div>
      </div>

      {/* Sticky bottom bar */}
      <QuickAdd addExpense={addExpense} onSaved={refresh} />
    </div>
  );
}
