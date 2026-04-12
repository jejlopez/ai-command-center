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

export default function Today() {
  const { items, refresh: calRefresh } = useToday();
  const { brief, regenerateBrief, loading: briefLoading } = useJarvisBrief();
  const { cost } = useCostToday();
  const { intelligence, recompute } = useTodaySupa();

  const hero = intelligence?.hero_stats ?? {};
  const budgetRemaining = cost ? (cost.budgetUsd ?? 20) - (cost.spentUsd ?? 0) : hero.budget_remaining;
  const meetingCount = (items ?? []).filter((i) => i.kind !== "focus").length;
  const showEod = new Date().getHours() >= 17;

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopFiveFocus precomputed={intelligence?.top_five} />
          <NextBestActions precomputed={intelligence?.next_actions} onRecompute={recompute} />
        </div>

        <TimeBlocks items={items} onRefresh={calRefresh} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WaitingOn precomputed={intelligence?.waiting_on} onRecompute={recompute} />
          <WasteDetector precomputed={intelligence?.waste_alerts} />
        </div>

        {showEod && <EndOfDayReview onSaved={recompute} />}
      </div>

      <NotificationToast />
    </div>
  );
}
