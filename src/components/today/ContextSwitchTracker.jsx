import { Shuffle, Lightbulb } from "lucide-react";

const RAMP_MINUTES = 12; // average ramp-up cost per switch

function getSuggestion(blocks = []) {
  if (blocks.length < 2) return null;
  const counts = {};
  for (const b of blocks) {
    counts[b.role] = (counts[b.role] ?? 0) + 1;
  }
  const topRole = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!topRole) return null;
  return `Try batching your ${topRole.charAt(0).toUpperCase() + topRole.slice(1)} blocks together.`;
}

export function ContextSwitchTracker({ timeBlocks = [] }) {
  // Count actual context switches (consecutive role changes)
  let switches = 0;
  for (let i = 1; i < timeBlocks.length; i++) {
    if (timeBlocks[i].role !== timeBlocks[i - 1].role) switches++;
  }

  const lostMinutes = switches * RAMP_MINUTES;
  const suggestion = getSuggestion(timeBlocks);

  if (timeBlocks.length === 0) {
    return (
      <div className="glass p-4 flex items-center gap-3">
        <Shuffle size={16} className="text-jarvis-muted shrink-0" />
        <span className="text-sm text-jarvis-muted">Log time blocks to track context switching.</span>
      </div>
    );
  }

  return (
    <div className="glass p-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <Shuffle size={16} className={switches > 4 ? "text-jarvis-red" : "text-jarvis-amber"} />
        <span className="text-sm text-jarvis-body">
          <span className="font-semibold text-jarvis-ink">{switches} switch{switches !== 1 ? "es" : ""}</span>
          {" today · "}
          avg {RAMP_MINUTES}min ramp-up
          {" · "}
          <span className="text-jarvis-red font-semibold">~{lostMinutes}min lost</span>
        </span>
      </div>
      {suggestion && (
        <div className="flex items-center gap-1.5 text-xs text-jarvis-muted">
          <Lightbulb size={12} />
          <span>{suggestion}</span>
        </div>
      )}
    </div>
  );
}
