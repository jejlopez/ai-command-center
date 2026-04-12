import { Phone, TrendingUp, Clock, Heart, Check, BellOff } from "lucide-react";

const ICON_MAP = { Phone, TrendingUp, Clock, Heart };

function ActionCard({ icon: Icon, iconColor, text, age, onDone, onSnooze }) {
  const isOverdue = age && age > 2;
  return (
    <div className={`rounded-xl border bg-white/[0.02] p-3 flex items-start gap-3 ${isOverdue ? "border-jarvis-amber/40 shadow-glow-amber" : "border-jarvis-border"}`}>
      <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${iconColor}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-jarvis-ink">{text}</div>
        {age != null && <div className="text-[10px] text-jarvis-muted mt-0.5">{age}d ago</div>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onDone && (
          <button onClick={onDone} className="p-1.5 rounded-lg hover:bg-jarvis-green/10 text-jarvis-muted hover:text-jarvis-green transition" title="Done">
            <Check size={12} />
          </button>
        )}
        {onSnooze && (
          <button onClick={onSnooze} className="p-1.5 rounded-lg hover:bg-jarvis-amber/10 text-jarvis-muted hover:text-jarvis-amber transition" title="Snooze">
            <BellOff size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

export function NextBestActions({ precomputed, deals = [], positions = [], habits = [], calendarGaps = 0, onFollowUpDone, onFollowUpSnooze, onRecompute }) {
  // Use precomputed data if available (from today_intelligence)
  if (precomputed && precomputed.length > 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Next Best Move</div>
        <div className="space-y-2">
          {precomputed.map((a) => {
            const Icon = ICON_MAP[a.icon] ?? Clock;
            return (
              <div key={a.id}>
                <ActionCard
                  icon={Icon}
                  iconColor={a.iconColor ?? "bg-cyan-500/15 text-jarvis-cyan"}
                  text={a.text}
                  age={a.age ?? null}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const actions = [];

  for (const d of deals) {
    const age = daysSince(d.last_touch);
    if (age != null && age >= 3) {
      actions.push({ id: `deal-${d.id}`, icon: Phone, iconColor: "bg-blue-500/15 text-jarvis-blue", text: `Follow up with ${d.company}`, age, dealId: d.id });
    }
  }

  for (const p of positions) {
    if (!p.stop_loss) {
      actions.push({ id: `pos-${p.id}`, icon: TrendingUp, iconColor: "bg-purple-500/15 text-jarvis-purple", text: `Set stop-loss for ${p.ticker}`, age: null });
    }
  }

  if (calendarGaps > 0) {
    actions.push({ id: "cal-gap", icon: Clock, iconColor: "bg-cyan-500/15 text-jarvis-cyan", text: `${calendarGaps} open hour${calendarGaps > 1 ? "s" : ""} — block for deep work`, age: null });
  }

  const today = new Date().toISOString().slice(0, 10);
  for (const h of habits) {
    if (h.last_done !== today) {
      actions.push({ id: `habit-${h.id}`, icon: Heart, iconColor: "bg-green-500/15 text-jarvis-green", text: `Log: ${h.name}`, age: null });
    }
  }

  const top4 = actions.slice(0, 4);

  if (top4.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Next Best Move</div>
        <p className="text-sm text-jarvis-muted">Actions will appear as you add deals, positions, and habits.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Next Best Move</div>
      <div className="space-y-2">
        {top4.map((a) => (
          <div key={a.id}>
            <ActionCard
              icon={a.icon}
              iconColor={a.iconColor}
              text={a.text}
              age={a.age}
              onDone={a.dealId ? () => onFollowUpDone?.(a.dealId) : undefined}
              onSnooze={a.dealId ? () => onFollowUpSnooze?.(a.dealId) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
