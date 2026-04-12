import { DollarSign } from "lucide-react";

const HOURLY_RATE = 500; // default assumed hourly opportunity cost

function durationHours(item) {
  if (!item.start || !item.end) return 0.5;
  return Math.max(0.25, (new Date(item.end) - new Date(item.start)) / 3600000);
}

function formatTime(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function OpportunityCostDisplay({ items = [], topDeal = null }) {
  const meetings = (items ?? []).filter((i) => i.kind !== "focus");

  if (meetings.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Opportunity Cost</div>
        <p className="text-sm text-jarvis-muted">No meetings today — time is yours.</p>
      </div>
    );
  }

  const totalHours = meetings.reduce((s, m) => s + durationHours(m), 0);
  const totalCost = Math.round(totalHours * HOURLY_RATE);
  const dealContext = topDeal ? `could be closing ${topDeal.company ?? "top deal"}` : null;

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="label">Opportunity Cost</div>
        <div className="flex items-center gap-1 text-jarvis-red text-sm font-semibold">
          <DollarSign size={13} />
          <span>${totalCost.toLocaleString()} today</span>
        </div>
      </div>

      <div className="space-y-2">
        {meetings.map((m, i) => {
          const hrs = durationHours(m);
          const cost = Math.round(hrs * HOURLY_RATE);
          return (
            <div key={m.id ?? i} className="flex items-center justify-between px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-jarvis-ink truncate">{m.title ?? m.summary ?? "Meeting"}</div>
                {dealContext && <div className="text-[11px] text-jarvis-muted mt-0.5">{dealContext}</div>}
              </div>
              <div className="flex items-center gap-2 ml-2 shrink-0">
                <span className="text-xs text-jarvis-muted">{formatTime(m.start)}</span>
                <span className="chip text-[10px] bg-jarvis-red/15 text-jarvis-red">${cost}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 pt-3 border-t border-jarvis-border text-xs text-jarvis-muted">
        {totalHours.toFixed(1)}h in meetings today = <span className="text-jarvis-red font-semibold">${totalCost.toLocaleString()} opportunity cost</span>
      </div>
    </div>
  );
}
