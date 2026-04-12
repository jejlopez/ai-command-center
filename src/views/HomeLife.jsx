import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCcw, HouseHeart } from "lucide-react";
import { jarvis } from "../lib/jarvis.js";
import { useHomeSupa } from "../hooks/useHomeSupa.js";
import { HomeHero } from "../components/home/HomeHero.jsx";
import { TaskQueue } from "../components/home/TaskQueue.jsx";
import { RecurringExpenses } from "../components/home/RecurringExpenses.jsx";
import { MaintenanceCalendar } from "../components/home/MaintenanceCalendar.jsx";
import { QuickAdd } from "../components/home/QuickAdd.jsx";

function useHomeTasks() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch tasks and events from memory
      const [tasks, events] = await Promise.all([
        jarvis.memoryList("task").catch(() => []),
        jarvis.memoryList("event").catch(() => []),
      ]);
      const all = [
        ...(Array.isArray(tasks) ? tasks : []),
        ...(Array.isArray(events) ? events : []),
      ];
      setNodes(all);
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
    expenses,
    overdueCount: overdueExpenses,
    loading: expensesLoading,
    refresh: refreshExpenses,
    addExpense,
    isDueThisWeek,
  } = useHomeSupa();

  const loading = tasksLoading && expensesLoading;

  const refresh = useCallback(async () => {
    await Promise.all([refreshTasks(), refreshExpenses()]);
  }, [refreshTasks, refreshExpenses]);

  // Derive summary counts
  const homeTasks = nodes.filter((n) => {
    const l = (n.label ?? "").toLowerCase();
    return n.kind === "task" && (l.includes("home") || l.includes("household"));
  });

  const today = new Date().toISOString().slice(0, 10);
  const overdueTaskCount = homeTasks.filter((n) => {
    if (!n.created_at) return false;
    const age = (Date.now() - new Date(n.created_at).getTime()) / 86_400_000;
    return age > 7;
  }).length;

  const dueThisWeekCount = expenses.filter((e) => isDueThisWeek(e.next_due)).length;

  // Next maintenance from event nodes
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
    <div className="h-full w-full flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-jarvis-purple/10 border border-jarvis-purple/20 grid place-items-center">
            <HouseHeart size={16} className="text-jarvis-purple" />
          </div>
          <div>
            <div className="label text-jarvis-purple">Home Life</div>
            <div className="text-[12px] text-jarvis-body">
              Tasks, expenses, and maintenance
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-panel/40 text-jarvis-body border border-jarvis-border hover:text-jarvis-ink hover:bg-white/5 transition disabled:opacity-40"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCcw size={13} />}
          Refresh
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-20">
        <div className="space-y-6 p-6 max-w-6xl mx-auto">
          <HomeHero
            taskCount={overdueTaskCount}
            overdueExpenses={overdueExpenses}
            dueThisWeek={dueThisWeekCount}
            nextMaintenance={nextMaintenance}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TaskQueue
              nodes={nodes}
              loading={tasksLoading}
              refresh={refreshTasks}
            />
            <RecurringExpenses
              expenses={expenses}
              loading={expensesLoading}
            />
          </div>

          <MaintenanceCalendar
            nodes={nodes}
            loading={tasksLoading}
            refresh={refreshTasks}
          />
        </div>
      </div>

      {/* Sticky bottom bar */}
      <QuickAdd
        addExpense={addExpense}
        onSaved={refresh}
      />
    </div>
  );
}
