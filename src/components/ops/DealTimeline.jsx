// DealTimeline.jsx — visual event history for a deal
import { useMemo } from "react";
import { FileText, MessageSquare, Clock, DollarSign, User, TrendingUp } from "lucide-react";

const TYPE_META = {
  created:   { color: "bg-jarvis-primary",  Icon: DollarSign    },
  proposal:  { color: "bg-jarvis-purple",   Icon: FileText      },
  comm:      { color: "bg-blue-400",         Icon: MessageSquare },
  followup:  { color: "bg-jarvis-warning",  Icon: Clock         },
  doc:       { color: "bg-jarvis-muted",    Icon: FileText      },
  contact:   { color: "bg-jarvis-success",  Icon: User          },
  stage:     { color: "bg-jarvis-success",  Icon: TrendingUp    },
};

const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
};

function buildEvents(deal, comms, proposals, followUps, docs) {
  const events = [];

  // Deal created
  if (deal?.created_at) {
    events.push({ type: "created", date: deal.created_at, text: `Deal created — ${deal.company}` });
  }

  // Stage changes — if deal has a stage, note the current one
  if (deal?.stage) {
    events.push({ type: "stage", date: deal.updated_at || deal.created_at, text: `Stage: ${deal.stage}` });
  }

  proposals.forEach(p => {
    events.push({ type: "proposal", date: p.created_at, text: `Proposal "${p.name}" v${p.version} — ${p.status}` });
  });

  comms.forEach(c => {
    const subject = c.subject || c.body?.slice(0, 60) || "";
    events.push({ type: "comm", date: c.occurred_at, text: `${c.type}: ${subject}` });
  });

  followUps.forEach(f => {
    events.push({ type: "followup", date: f.created_at, text: `Follow-up: ${f.action} — ${f.status}` });
    if (f.status === "completed" && f.completed_at) {
      events.push({ type: "followup", date: f.completed_at, text: `Completed: ${f.action}` });
    }
  });

  docs.forEach(d => {
    events.push({ type: "doc", date: d.created_at, text: `Document: ${d.name} (${d.type || d.status})` });
  });

  return events.filter(e => e.date).sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function DealTimeline({ deal, comms = [], proposals = [], followUps = [], docs = [] }) {
  const events = useMemo(
    () => buildEvents(deal, comms, proposals, followUps, docs),
    [deal, comms, proposals, followUps, docs]
  );

  if (events.length === 0) {
    return <div className="text-sm text-jarvis-muted py-4 text-center">No activity recorded yet.</div>;
  }

  return (
    <div className="relative pl-5">
      {events.map((e, i) => {
        const meta = TYPE_META[e.type] ?? TYPE_META.comm;
        const Icon = meta.Icon;
        return (
          <div key={i} className="relative pb-5">
            {/* Connecting line */}
            {i < events.length - 1 && (
              <div className="absolute left-[3px] top-4 w-px bottom-0 bg-jarvis-border" />
            )}
            {/* Dot */}
            <div className={`absolute left-0 top-1.5 w-2 h-2 rounded-full ${meta.color} ring-2 ring-jarvis-bg`} />
            {/* Content */}
            <div className="ml-5 flex items-start gap-2">
              <Icon size={11} className="text-jarvis-muted shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] text-jarvis-muted tabular-nums">{fmtDate(e.date)}</div>
                <div className="text-xs text-jarvis-body leading-snug">{e.text}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
