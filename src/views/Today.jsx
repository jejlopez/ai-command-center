import { motion } from "framer-motion";
import { stagger } from "../lib/motion.js";
import { useToday, useJarvisBrief, useCostToday } from "../hooks/useJarvis.js";
import { useTodaySupa } from "../hooks/useTodaySupa.js";
import { MorningBriefHero } from "../components/today/MorningBriefHero.jsx";
import { TopFiveFocus } from "../components/today/TopFiveFocus.jsx";
import { NextBestActions } from "../components/today/NextBestActions.jsx";
import { TimeBlocks } from "../components/today/TimeBlocks.jsx";
import { WaitingOn } from "../components/today/WaitingOn.jsx";
import { WasteDetector } from "../components/today/WasteDetector.jsx";
import { EndOfDayReview } from "../components/today/EndOfDayReview.jsx";
import { NotificationToast } from "../components/today/NotificationToast.jsx";
import { DecisionQueue } from "../components/today/DecisionQueue.jsx";
import { TimeAudit } from "../components/today/TimeAudit.jsx";
import { BottleneckDetector } from "../components/today/BottleneckDetector.jsx";
import { SpeedScore } from "../components/today/SpeedScore.jsx";
import { ContextSwitchTracker } from "../components/today/ContextSwitchTracker.jsx";
import { TopThreeNeedleMovers } from "../components/today/TopThreeNeedleMovers.jsx";
import { OpportunityCostDisplay } from "../components/today/OpportunityCostDisplay.jsx";
import { CompoundTracker } from "../components/today/CompoundTracker.jsx";
import { NotToDoList } from "../components/today/NotToDoList.jsx";
import { WeeklyScore } from "../components/today/WeeklyScore.jsx";

export default function Today() {
  const { items, refresh: calRefresh } = useToday();
  const { brief, regenerateBrief, loading: briefLoading } = useJarvisBrief();
  const { cost } = useCostToday();
  const {
    intelligence,
    decisions,
    timeBlocksActual,
    compoundImprovements,
    notToDo,
    recompute,
  } = useTodaySupa();

  const hero = intelligence?.hero_stats ?? {};
  const budgetRemaining = cost ? (cost.budgetUsd ?? 20) - (cost.spentUsd ?? 0) : hero.budget_remaining;
  const meetingCount = (items ?? []).filter((i) => i.kind !== "focus").length;
  const showEod = new Date().getHours() >= 17;

  // Derived data for components
  const deals = intelligence?.deals ?? [];
  const positions = intelligence?.positions ?? [];
  const followUps = intelligence?.follow_ups ?? [];

  const speedStats = {
    followUpsCompleted: intelligence?.speed?.follow_ups_done ?? 0,
    decisionsMade: (intelligence?.speed?.decisions_made ?? 0),
    tasksDone: intelligence?.speed?.tasks_done ?? 0,
    avgCleared: intelligence?.speed?.avg_cleared_7d ?? 10,
  };

  const weeklyThis = intelligence?.weekly_score?.this_week ?? {};
  const weeklyLast = intelligence?.weekly_score?.last_week ?? {};

  const topDeal = deals.length > 0
    ? deals.sort((a, b) => (b.value_usd ?? 0) - (a.value_usd ?? 0))[0]
    : null;

  return (
    <div className="h-full w-full overflow-y-auto" style={{ "--page-accent": "#00E0D0" }}>
      <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-6 p-6 max-w-6xl mx-auto">

        {/* Hero */}
        <motion.div variants={stagger.item}>
          <MorningBriefHero
            brief={brief}
            meetingCount={meetingCount || hero.meetings}
            pipelineValue={hero.pipeline_value}
            tradingPnl={hero.trading_pnl}
            followUpsDue={hero.follow_ups_due}
            budgetRemaining={budgetRemaining}
            onRegenerate={regenerateBrief}
            regenerating={briefLoading}
          />
        </motion.div>

        {/* Top row: Needle Movers / Decision Queue / Speed + Weekly */}
        <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <TopThreeNeedleMovers deals={deals} positions={positions} followUps={followUps} />
          <DecisionQueue decisions={decisions} />
          <div className="flex flex-col gap-6">
            <SpeedScore {...speedStats} />
            <WeeklyScore thisWeek={weeklyThis} lastWeek={weeklyLast} />
          </div>
        </motion.div>

        {/* Focus + Actions */}
        <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopFiveFocus precomputed={intelligence?.top_five} />
          <NextBestActions precomputed={intelligence?.next_actions} onRecompute={recompute} />
        </motion.div>

        {/* Calendar */}
        <motion.div variants={stagger.item}>
          <TimeBlocks items={items} onRefresh={calRefresh} />
        </motion.div>

        {/* Waiting / Waste / Bottleneck */}
        <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <WaitingOn precomputed={intelligence?.waiting_on} onRecompute={recompute} />
          <WasteDetector precomputed={intelligence?.waste_alerts} />
          <BottleneckDetector followUps={followUps} decisions={decisions} deals={deals} positions={positions} />
        </motion.div>

        {/* Compound + Not-To-Do */}
        <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CompoundTracker improvements={compoundImprovements} />
          <NotToDoList notToDo={notToDo} />
        </motion.div>

        {/* Time Audit + Opportunity Cost */}
        <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TimeAudit timeBlocks={timeBlocksActual} />
          <OpportunityCostDisplay items={items} topDeal={topDeal} />
        </motion.div>

        {/* Context Switch — full width compact */}
        <motion.div variants={stagger.item}>
          <ContextSwitchTracker timeBlocks={timeBlocksActual} />
        </motion.div>

        {showEod && (
          <motion.div variants={stagger.item}>
            <EndOfDayReview onSaved={recompute} />
          </motion.div>
        )}

      </motion.div>

      <NotificationToast />
    </div>
  );
}
