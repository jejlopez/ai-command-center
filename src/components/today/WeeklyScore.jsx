import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function computeScore({ followUpsDone = 0, dealsProgressed = 0, positiveTrades = 0, habitsDone = 0, decisionsMade = 0 }) {
  return (
    followUpsDone * 10 +
    dealsProgressed * 20 +
    positiveTrades * 5 +
    habitsDone * 3 +
    decisionsMade * 8
  );
}

export function WeeklyScore({ thisWeek = {}, lastWeek = {} }) {
  const current = computeScore(thisWeek);
  const previous = computeScore(lastWeek);
  const delta = previous > 0 ? ((current - previous) / previous) * 100 : 0;
  const trend = delta > 1 ? "up" : delta < -1 ? "down" : "flat";

  const colorClass = trend === "up" ? "text-jarvis-green" : trend === "down" ? "text-jarvis-red" : "text-jarvis-amber";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div className="glass p-5">
      <div className="label mb-3">Weekly Score</div>
      <div className="flex items-end gap-3">
        <div className={`text-4xl font-black tabular-nums ${colorClass}`}>{current}</div>
        <div className="pb-1 flex flex-col gap-0.5">
          <div className={`flex items-center gap-1 text-sm font-semibold ${colorClass}`}>
            <TrendIcon size={14} />
            {delta !== 0 ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%` : "Flat"}
          </div>
          <div className="text-xs text-jarvis-muted">Last week: {previous} pts</div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
        {[
          ["Follow-ups", thisWeek.followUpsDone ?? 0, "×10"],
          ["Deals moved", thisWeek.dealsProgressed ?? 0, "×20"],
          ["Green trades", thisWeek.positiveTrades ?? 0, "×5"],
          ["Decisions", thisWeek.decisionsMade ?? 0, "×8"],
          ["Habits", thisWeek.habitsDone ?? 0, "×3"],
        ].map(([label, val, mult]) => (
          <div key={label} className="flex items-center justify-between text-xs">
            <span className="text-jarvis-muted">{label}</span>
            <span className="text-jarvis-body tabular-nums">{val} <span className="text-jarvis-ghost">{mult}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
