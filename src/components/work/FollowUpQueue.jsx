import { useState } from "react";
import { Check, Clock, Circle } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

function priorityDot(fu) {
  if (fu.days_overdue > 0) return <Circle size={8} className="fill-jarvis-red text-jarvis-red shrink-0 mt-1" />;
  if (fu.due_date === new Date().toISOString().slice(0, 10)) return <Circle size={8} className="fill-jarvis-amber text-jarvis-amber shrink-0 mt-1" />;
  return <Circle size={8} className="fill-jarvis-green text-jarvis-green shrink-0 mt-1" />;
}

function ageLabel(fu) {
  if (fu.days_overdue > 0) return <span className="chip text-jarvis-red">{fu.days_overdue}d overdue</span>;
  const today = new Date().toISOString().slice(0, 10);
  if (fu.due_date === today) return <span className="chip text-jarvis-amber">Today</span>;
  if (fu.due_date) {
    const daysOut = Math.floor((new Date(fu.due_date).getTime() - Date.now()) / 86400000);
    return <span className="chip text-jarvis-green">{daysOut}d</span>;
  }
  return null;
}

function FollowUpRow({ fu, onDone, onSnooze }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-jarvis-border/50 last:border-0">
      {priorityDot(fu)}
      <div className="flex-1 min-w-0">
        <div className="text-sm text-jarvis-ink leading-snug">{fu.action}</div>
        <div className="text-[10px] text-jarvis-muted mt-0.5 truncate">
          {fu.contact && <span>{fu.contact}</span>}
          {fu.contact && fu.company && <span> · </span>}
          {fu.company && <span>{fu.company}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {ageLabel(fu)}
        <button
          type="button"
          onClick={() => onDone(fu)}
          className="p-1 rounded-lg text-jarvis-muted hover:text-jarvis-green hover:bg-jarvis-green/10 transition"
          title="Mark done"
        >
          <Check size={13} />
        </button>
        <button
          type="button"
          onClick={() => onSnooze(fu)}
          className="p-1 rounded-lg text-jarvis-muted hover:text-jarvis-cyan hover:bg-jarvis-cyan/10 transition"
          title="Snooze +1d"
        >
          <Clock size={13} />
        </button>
      </div>
    </div>
  );
}

export function FollowUpQueue({ followUpQueue }) {
  const [items, setItems] = useState(null);

  const list = items ?? (Array.isArray(followUpQueue) ? followUpQueue : []);
  const today = new Date().toISOString().slice(0, 10);
  const overdueCount = list.filter((f) => f.days_overdue > 0).length;
  const todayCount = list.filter((f) => !f.days_overdue && f.due_date === today).length;
  const weekCount = list.filter((f) => !f.days_overdue && f.due_date > today).length;

  const handleDone = async (fu) => {
    if (supabase) {
      await supabase.from("follow_ups").update({ status: "done" }).eq("id", fu.id);
      if (fu.deal_id) {
        await supabase.from("deals").update({ last_touch: new Date().toISOString() }).eq("id", fu.deal_id);
      }
    }
    setItems((prev) => (prev ?? list).filter((f) => f.id !== fu.id));
  };

  const handleSnooze = async (fu) => {
    if (!fu.due_date) return;
    const next = new Date(new Date(fu.due_date).getTime() + 86400000).toISOString().slice(0, 10);
    if (supabase) {
      await supabase.from("follow_ups").update({ due_date: next }).eq("id", fu.id);
    }
    setItems((prev) => (prev ?? list).map((f) => f.id === fu.id ? { ...f, due_date: next, days_overdue: 0 } : f));
  };

  return (
    <div className="glass p-6 border border-jarvis-border flex flex-col">
      <div className="label mb-1">Follow-Up Queue</div>
      <div className="text-[10px] text-jarvis-muted mb-3">
        Overdue: <span className="text-jarvis-red font-semibold">{overdueCount}</span>
        {" · "}Today: <span className="text-jarvis-amber font-semibold">{todayCount}</span>
        {" · "}This week: <span className="text-jarvis-green font-semibold">{weekCount}</span>
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-jarvis-muted">No follow-ups — add one from the quick bar below.</p>
      ) : (
        <div className="overflow-y-auto max-h-[400px] -mx-1 px-1">
          {list.slice(0, 10).map((fu, i) => (
            <FollowUpRow key={fu.id ?? i} fu={fu} onDone={handleDone} onSnooze={handleSnooze} />
          ))}
          {list.length > 10 && (
            <div className="text-[10px] text-jarvis-muted pt-2 text-center">{list.length - 10} more</div>
          )}
        </div>
      )}
    </div>
  );
}
