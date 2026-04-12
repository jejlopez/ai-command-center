import { useMemo } from "react";
import { useToday, useJarvisBrief, useCostToday } from "../hooks/useJarvis.js";
import { useTodaySupa } from "../hooks/useTodaySupa.js";
import { MorningBriefHero } from "../components/today/MorningBriefHero.jsx";
import { TopFiveFocus } from "../components/today/TopFiveFocus.jsx";
import { NextBestActions } from "../components/today/NextBestActions.jsx";
import { TimeBlocks } from "../components/today/TimeBlocks.jsx";
import { WaitingOn } from "../components/today/WaitingOn.jsx";
import { WasteDetector } from "../components/today/WasteDetector.jsx";
import { EndOfDayReview } from "../components/today/EndOfDayReview.jsx";
import { supabase } from "../lib/supabase.js";

export default function Today() {
  const { items, loading: calLoading, refresh: calRefresh } = useToday();
  const { brief, regenerateBrief, loading: briefLoading } = useJarvisBrief();
  const { cost } = useCostToday();
  const supa = useTodaySupa();

  const meetingCount = (items ?? []).filter((i) => i.kind !== "focus").length;
  const pipelineValue = supa.deals.reduce((s, d) => s + (d.value_usd ?? 0), 0);
  const tradingPnl = supa.positions.reduce((s, p) => s + (p.pnl_usd ?? 0), 0) + (supa.tradeJournal?.pnl_usd ?? 0);
  const followUpsDue = supa.followUps.filter((f) => f.status === "pending" && f.due_date <= new Date().toISOString().slice(0, 10)).length;
  const budgetRemaining = cost ? (cost.budgetUsd ?? 20) - (cost.spentUsd ?? 0) : null;

  const calendarGaps = useMemo(() => {
    if (!items || items.length < 2) return items?.length === 0 ? 8 : 0;
    let gaps = 0;
    const sorted = [...items].sort((a, b) => new Date(a.start) - new Date(b.start));
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapMs = new Date(sorted[i + 1].start) - new Date(sorted[i].end);
      if (gapMs >= 3600000) gaps += Math.floor(gapMs / 3600000);
    }
    return gaps;
  }, [items]);

  const showEod = new Date().getHours() >= 17;

  const handleFollowUpDone = async (dealId) => {
    if (!supabase) return;
    await supabase.from("deals").update({ last_touch: new Date().toISOString() }).eq("id", dealId);
    supa.refresh();
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        <MorningBriefHero
          brief={brief}
          meetingCount={meetingCount}
          pipelineValue={pipelineValue}
          tradingPnl={tradingPnl}
          followUpsDue={followUpsDue}
          budgetRemaining={budgetRemaining}
          onRegenerate={regenerateBrief}
          regenerating={briefLoading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopFiveFocus deals={supa.deals} positions={supa.positions} followUps={supa.followUps} />
          <NextBestActions
            deals={supa.deals}
            positions={supa.positions}
            habits={supa.habits}
            calendarGaps={calendarGaps}
            onFollowUpDone={handleFollowUpDone}
          />
        </div>

        <TimeBlocks items={items} onRefresh={calRefresh} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WaitingOn followUps={supa.followUps} onRefresh={supa.refresh} />
          <WasteDetector
            deals={supa.deals}
            positions={supa.positions}
            expenses={supa.expenses}
            habits={supa.habits}
            calendarItems={items}
          />
        </div>

        {showEod && <EndOfDayReview tradeJournal={supa.tradeJournal} onSaved={supa.refresh} />}
      </div>
    </div>
  );
}
