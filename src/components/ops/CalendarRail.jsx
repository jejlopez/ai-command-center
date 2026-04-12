import { useEffect, useState, useRef } from "react";
import { Clock } from "lucide-react";

const HOUR_START = 6;
const HOUR_END   = 21;
const HOURS      = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const SLOT_H     = 48; // px per hour

function fmtHour(h) {
  if (h === 0 || h === 24) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function timeToFrac(h, m = 0) {
  return (h - HOUR_START + m / 60) / (HOUR_END - HOUR_START);
}

function nowFrac() {
  const now = new Date();
  return timeToFrac(now.getHours(), now.getMinutes());
}

// Sample event shape: { id, title, start_h, start_m, end_h, end_m, kind }
// kind: followup | trading | focus | event
const KIND_STYLE = {
  followup: "bg-blue-500/20 border-blue-500/50 text-blue-300",
  trading:  "bg-jarvis-purple/20 border-jarvis-purple/50 text-jarvis-purple",
  focus:    "bg-cyan-500/20 border-cyan-500/50 text-cyan-300",
  event:    "bg-jarvis-primary/15 border-jarvis-primary/40 text-jarvis-primary",
};

export function CalendarRail({ followUps = [], calendarEvents = [] }) {
  const [frac, setFrac] = useState(nowFrac());
  const scrollRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setFrac(nowFrac()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Scroll current time into view on mount
  useEffect(() => {
    if (scrollRef.current) {
      const total = SLOT_H * (HOUR_END - HOUR_START);
      const top = Math.max(0, frac * total - 80);
      scrollRef.current.scrollTop = top;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  // Build events list
  const events = [];

  // Trading session block
  events.push({ id: "trading-session", title: "Market Open", start_h: 9, start_m: 30, end_h: 16, end_m: 0, kind: "trading" });

  // Follow-ups due today
  followUps.slice(0, 5).forEach((f, i) => {
    events.push({ id: `fu-${i}`, title: f.contact_name || f.subject || "Follow-up", start_h: 9, start_m: i * 30, end_h: 9, end_m: i * 30 + 20, kind: "followup" });
  });

  // External calendar events
  calendarEvents.forEach((e, i) => {
    events.push({ id: `cal-${i}`, title: e.title || e.summary, start_h: e.start_h ?? 10, start_m: e.start_m ?? 0, end_h: e.end_h ?? 11, end_m: e.end_m ?? 0, kind: "event" });
  });

  const totalH = SLOT_H * (HOUR_END - HOUR_START);
  const nowPx  = frac * totalH;
  const nowInRange = frac >= 0 && frac <= 1;

  return (
    <div className="w-[220px] shrink-0 flex flex-col border-l border-jarvis-border bg-jarvis-surface/50 h-full">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-jarvis-border shrink-0">
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="text-jarvis-muted" />
          <span className="label">{dateLabel}</span>
        </div>
      </div>

      {/* Scrollable timeline */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative" style={{ scrollbarWidth: "none" }}>
        <div className="relative" style={{ height: totalH }}>
          {/* Hour lines */}
          {HOURS.map((h) => {
            const top = (h - HOUR_START) * SLOT_H;
            return (
              <div key={h} className="absolute left-0 right-0" style={{ top }}>
                <div className="flex items-center gap-1.5 px-2">
                  <span className="text-[9px] text-jarvis-ghost w-8 shrink-0 select-none">{fmtHour(h)}</span>
                  <div className="flex-1 border-t border-jarvis-border/50" />
                </div>
              </div>
            );
          })}

          {/* Events */}
          {events.map((ev) => {
            const startFrac = timeToFrac(ev.start_h, ev.start_m ?? 0);
            const endFrac   = timeToFrac(ev.end_h,   ev.end_m   ?? 0);
            const top    = startFrac * totalH;
            const height = Math.max(18, (endFrac - startFrac) * totalH);
            const style  = KIND_STYLE[ev.kind] ?? KIND_STYLE.event;
            if (startFrac < 0 || startFrac > 1) return null;
            return (
              <div
                key={ev.id}
                className={`absolute left-8 right-2 rounded px-1.5 py-0.5 border text-[9px] leading-tight font-medium overflow-hidden ${style}`}
                style={{ top: top + 2, height: height - 4 }}
                title={ev.title}
              >
                <span className="truncate block">{ev.title}</span>
              </div>
            );
          })}

          {/* Current time indicator */}
          {nowInRange && (
            <div className="absolute left-0 right-0 z-10 flex items-center" style={{ top: nowPx }}>
              <div className="w-2 h-2 rounded-full bg-jarvis-primary ml-1 pulse-primary shrink-0" />
              <div className="flex-1 border-t border-jarvis-primary/50" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
