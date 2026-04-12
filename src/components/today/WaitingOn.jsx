import { Clock, Bell } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

function daysSince(ts) {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

function ageColor(days) {
  if (days >= 7) return "text-jarvis-red";
  if (days >= 3) return "text-jarvis-amber";
  return "text-jarvis-green";
}

export function WaitingOn({ followUps, onRefresh }) {
  const waiting = followUps.filter((f) => f.status === "waiting");

  const nudge = async (fu) => {
    if (!supabase) return;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await supabase.from("follow_ups").insert({
      deal_id: fu.deal_id,
      contact_id: fu.contact_id,
      action: `Nudge: ${fu.action}`,
      due_date: tomorrow,
      priority: "high",
    });
    onRefresh?.();
  };

  if (waiting.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Waiting On</div>
        <div className="flex items-center gap-2 text-sm text-jarvis-green">
          <Clock size={14} />
          <span>Nothing pending — nice.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Waiting On</div>
      <div className="space-y-2">
        {waiting.map((fu) => {
          const days = daysSince(fu.created_at);
          return (
            <div key={fu.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-jarvis-ink truncate">{fu.action}</div>
                <div className="text-[10px] text-jarvis-muted mt-0.5">
                  {fu.contacts?.name ?? fu.deals?.company ?? ""}
                  {" · "}
                  <span className={ageColor(days)}>{days}d waiting</span>
                </div>
              </div>
              <button onClick={() => nudge(fu)} className="p-1.5 rounded-lg hover:bg-jarvis-amber/10 text-jarvis-muted hover:text-jarvis-amber transition" title="Nudge">
                <Bell size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
