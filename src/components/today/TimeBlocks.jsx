import { useState } from "react";
import { CalendarClock, Target, MapPin, AlertTriangle, X, Loader2 } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return "--:--"; }
}

function currentTimePercent() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = 6 * 60;
  const end = 22 * 60;
  return Math.max(0, Math.min(100, ((mins - start) / (end - start)) * 100));
}

export function TimeBlocks({ items, onRefresh }) {
  const [deleting, setDeleting] = useState(null);
  const pct = currentTimePercent();

  const handleDelete = async (id) => {
    setDeleting(id);
    try { await jarvis.deleteFocusBlock(id); onRefresh?.(); }
    catch { /* silent */ }
    finally { setDeleting(null); }
  };

  if (!items || items.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Schedule</div>
        <p className="text-sm text-jarvis-muted">No events today. Connect Apple Calendar in Settings, or add focus blocks.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Schedule</div>
      <div className="relative h-1.5 rounded-full bg-white/5 mb-4">
        <div className="absolute top-0 left-0 h-full rounded-full bg-jarvis-primary/30" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-jarvis-primary animate-pulse" style={{ left: `${pct}%` }} />
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const isFocus = item.kind === "focus";
          const hasConflict = Array.isArray(item.conflictsWith) && item.conflictsWith.length > 0;
          return (
            <div key={item.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition ${hasConflict ? "border-jarvis-red/40 bg-jarvis-red/5" : "border-jarvis-border bg-white/[0.02]"}`}>
              <div className="w-16 shrink-0 text-right">
                <div className="text-[12px] font-semibold text-jarvis-ink tabular-nums">{fmtTime(item.start)}</div>
                <div className="text-[10px] text-jarvis-muted tabular-nums">{fmtTime(item.end)}</div>
              </div>
              <div className="w-px h-8 bg-jarvis-border" />
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {isFocus ? <Target size={12} className="text-jarvis-primary shrink-0" /> : <CalendarClock size={12} className="text-jarvis-body shrink-0" />}
                <span className="text-sm text-jarvis-ink truncate">{item.title}</span>
                {item.location && <span className="text-[10px] text-jarvis-muted flex items-center gap-0.5"><MapPin size={9} />{item.location}</span>}
                {hasConflict && <AlertTriangle size={11} className="text-jarvis-red shrink-0" />}
              </div>
              {isFocus && (
                <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id} className="p-1 rounded-lg text-jarvis-muted hover:text-jarvis-red transition">
                  {deleting === item.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
