import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";

const TYPE_DOTS = {
  email_sent: "bg-jarvis-purple",
  email_received: "bg-jarvis-success",
  call: "bg-orange-400",
  meeting: "bg-blue-400",
  note: "bg-jarvis-warning",
  proposal_sent: "bg-blue-400",
  proposal_viewed: "bg-jarvis-warning",
  stage_change: "bg-cyan-400",
  research_completed: "bg-jarvis-success",
  jarvis_action: "bg-jarvis-purple",
  approval_decision: "bg-jarvis-warning",
};

const TYPE_LABELS = {
  email_sent: "Email sent",
  email_received: "Email received",
  call: "Call",
  meeting: "Meeting",
  note: "Note",
  proposal_sent: "Proposal sent",
  proposal_viewed: "Proposal viewed",
  stage_change: "Stage change",
  research_completed: "Research completed",
  jarvis_action: "Jarvis action",
  approval_decision: "Approval decision",
};

function groupByDate(items) {
  const groups = {};
  for (const item of items) {
    const date = new Date(item.occurred_at || item.created_at).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
    (groups[date] ??= []).push(item);
  }
  return Object.entries(groups);
}

export function ActivityTimeline({ leadId, dealId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      let query = supabase.from("activities").select("*").order("occurred_at", { ascending: false }).limit(50);
      if (leadId) query = query.eq("lead_id", leadId);
      if (dealId) query = query.eq("deal_id", dealId);
      const { data } = await query;
      setActivities(data || []);
      setLoading(false);
    })();
  }, [leadId, dealId]);

  if (loading) return <div className="text-[10px] text-jarvis-muted animate-pulse py-4">Loading timeline…</div>;
  if (activities.length === 0) return <div className="text-[10px] text-jarvis-ghost py-4">No activity yet.</div>;

  return (
    <div className="space-y-4">
      {groupByDate(activities).map(([date, items]) => (
        <div key={date}>
          <div className="text-[8px] text-jarvis-ghost uppercase tracking-wider mb-2">{date}</div>
          <div className="flex flex-col gap-3">
            {items.map(a => (
              <div key={a.id} className="flex gap-3">
                <div className="flex flex-col items-center min-w-[20px]">
                  <div className={`w-2 h-2 rounded-full mt-1 ${TYPE_DOTS[a.type] || "bg-jarvis-ghost"}`} />
                  <div className="w-px flex-1 bg-jarvis-border/20" />
                </div>
                <div className="flex-1 pb-1">
                  <div className="text-[11px] text-jarvis-ink">
                    <span className={`font-semibold ${(TYPE_DOTS[a.type] || "").replace("bg-", "text-")}`}>
                      {TYPE_LABELS[a.type] || a.type}
                    </span>
                    {a.subject && <span className="text-jarvis-muted"> · {a.subject}</span>}
                  </div>
                  {a.body && <div className="text-[10px] text-jarvis-muted mt-0.5 line-clamp-2">{a.body}</div>}
                  <div className="text-[9px] text-jarvis-ghost mt-0.5">
                    {new Date(a.occurred_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    {a.source && a.source !== "manual" && <span> · {a.source}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
