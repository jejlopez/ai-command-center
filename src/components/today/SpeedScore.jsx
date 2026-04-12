import { Zap } from "lucide-react";

function ring(pct) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return { circ, dash };
}

export function SpeedScore({ followUpsCompleted = 0, decisionsMade = 0, tasksDone = 0, avgCleared = 0 }) {
  const cleared = followUpsCompleted + decisionsMade + tasksDone;
  const avg = avgCleared || 1;
  const pctValue = Math.min(100, Math.round((cleared / avg) * 100));
  const { circ, dash } = ring(pctValue);

  let color = "text-jarvis-red";
  let stroke = "#ef4444";
  if (cleared >= avg) { color = "text-jarvis-green"; stroke = "#22c55e"; }
  else if (cleared >= avg * 0.7) { color = "text-jarvis-amber"; stroke = "#f59e0b"; }

  return (
    <div className="glass p-5 flex items-center gap-4">
      <svg width={52} height={52} className="shrink-0">
        <circle cx={26} cy={26} r={20} fill="none" stroke="var(--jarvis-border)" strokeWidth={4} />
        <circle
          cx={26} cy={26} r={20} fill="none"
          stroke={stroke} strokeWidth={4}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 26 26)"
        />
      </svg>
      <div className="flex-1 min-w-0">
        <div className="label mb-0.5">Speed Score</div>
        <div className={`text-2xl font-bold tabular-nums ${color}`}>{cleared}<span className="text-base text-jarvis-muted font-normal">/{avg}</span></div>
        <div className="text-[11px] text-jarvis-muted flex items-center gap-1">
          <Zap size={11} />
          <span>cleared today · {avg} day avg</span>
        </div>
      </div>
    </div>
  );
}
