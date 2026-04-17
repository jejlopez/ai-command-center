// DealActivityTimeline — chronological feed from jarvisd /crm/deals/:id/timeline.
// Shows activities, notes, emails, drafts, research. Email entries are clickable.

import { useState, useEffect } from "react";
import { jarvis } from "../../lib/jarvis.js";
import {
  Mail, Phone, StickyNote, Calendar, ArrowRightLeft,
  Sparkles, Eye, Loader2, RefreshCw,
  Send, FileText, ChevronRight, Search,
} from "lucide-react";

const TYPE_CONFIG = {
  call:           { icon: Phone,          color: "text-green-400",      bg: "bg-green-900/25",  border: "border-green-800/30",  label: "Call" },
  meeting:        { icon: Calendar,       color: "text-purple-400",     bg: "bg-purple-900/25", border: "border-purple-800/30", label: "Meeting" },
  email:          { icon: Mail,           color: "text-blue-400",       bg: "bg-blue-900/25",   border: "border-blue-800/30",   label: "Email" },
  email_received: { icon: Mail,           color: "text-blue-400",       bg: "bg-blue-900/25",   border: "border-blue-800/30",   label: "Received" },
  email_sent:     { icon: Send,           color: "text-jarvis-primary", bg: "bg-jarvis-primary/10", border: "border-jarvis-primary/20", label: "Sent" },
  email_draft:    { icon: FileText,       color: "text-amber-400",      bg: "bg-amber-900/25",  border: "border-amber-800/30",  label: "Draft" },
  note:           { icon: StickyNote,     color: "text-amber-400",      bg: "bg-amber-900/25",  border: "border-amber-800/30",  label: "Note" },
  task:           { icon: Calendar,       color: "text-purple-400",     bg: "bg-purple-900/25", border: "border-purple-800/30", label: "Task" },
  research:       { icon: Search,         color: "text-jarvis-primary", bg: "bg-jarvis-primary/10", border: "border-jarvis-primary/20", label: "Research" },
  stage_change:   { icon: ArrowRightLeft, color: "text-jarvis-primary", bg: "bg-jarvis-primary/10", border: "border-jarvis-primary/20", label: "Stage" },
  activity:       { icon: Sparkles,       color: "text-jarvis-muted",   bg: "bg-white/5",       border: "border-white/10",      label: "Activity" },
};

function getConfig(type) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.activity;
}

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) {
    const diffHrs = Math.floor(diffMs / 3600000);
    if (diffHrs < 1) return `${Math.floor(diffMs / 60000)}m ago`;
    return `${diffHrs}h ago`;
  }
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateHeader(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function DealActivityTimeline({ dealId, onEmailClick }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const refresh = async () => {
    if (!dealId) { setLoading(false); return; }
    setLoading(true);

    try {
      const data = await jarvis.crmDealTimeline(dealId);
      setEvents(data?.timeline || []);
    } catch {
      setEvents([]);
    }

    setLoading(false);
  };

  useEffect(() => { refresh(); }, [dealId]);

  // Group by date
  const grouped = [];
  let currentDate = null;
  for (const ev of events) {
    const dateStr = formatDateHeader(ev.ts);
    if (dateStr && dateStr !== currentDate) {
      currentDate = dateStr;
      grouped.push({ type: "header", label: dateStr, key: `h-${dateStr}` });
    }
    grouped.push({ type: "event", event: ev, key: ev.id });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={16} className="animate-spin text-jarvis-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-3">
        <span className="label">Activity Timeline</span>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-jarvis-muted tabular-nums">{events.length} events</span>
          <button
            onClick={refresh}
            className="p-1 rounded hover:bg-white/5 transition text-jarvis-muted hover:text-jarvis-ink"
          >
            <RefreshCw size={10} />
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="text-[11px] text-jarvis-muted text-center py-6">
          No activity yet. Emails, calls, and notes will appear here.
        </div>
      ) : (
        <div className="relative">
          <div className="absolute left-[13px] top-0 bottom-0 w-px bg-jarvis-border/50" />

          {grouped.map((item) => {
            if (item.type === "header") {
              return (
                <div key={item.key} className="relative flex items-center gap-3 py-2">
                  <div className="relative z-10 w-[27px] flex justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-jarvis-border" />
                  </div>
                  <span className="text-[8px] text-jarvis-muted uppercase tracking-[0.15em] font-semibold">
                    {item.label}
                  </span>
                </div>
              );
            }

            const ev = item.event;
            const cfg = getConfig(ev.type);
            const Icon = cfg.icon;
            const isEmail = (ev.type === "email_received" || ev.type === "email") && ev.messageId && onEmailClick;
            const isExpanded = expandedId === ev.id;
            const hasBody = ev.body && ev.body.length > 0;

            return (
              <div key={item.key} className="relative flex gap-3 group">
                <div className="relative z-10 w-[27px] shrink-0 flex justify-center pt-2.5">
                  <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
                    <Icon size={10} className={cfg.color} />
                  </div>
                </div>

                <div
                  className={`flex-1 min-w-0 py-2 pr-1 ${isEmail ? "cursor-pointer" : hasBody ? "cursor-pointer" : ""}`}
                  onClick={() => {
                    if (isEmail) {
                      onEmailClick({
                        message_id: ev.messageId,
                        thread_id: ev.threadId,
                        from_addr: ev.from || "",
                        subject: ev.subject,
                        snippet: (ev.body || "").slice(0, 120),
                        category: ev.category || "fyi",
                        created_at: ev.ts,
                      });
                    } else if (hasBody) {
                      setExpandedId(isExpanded ? null : ev.id);
                    }
                  }}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
                      {cfg.label}
                    </span>
                    {ev.source === "jarvis" && (
                      <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/20 font-medium">
                        AI
                      </span>
                    )}
                    {ev.done === 1 && (
                      <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-green-900/20 text-green-400 border border-green-800/30 font-medium">
                        Done
                      </span>
                    )}
                    <span className="text-[8px] text-jarvis-muted tabular-nums ml-auto shrink-0">
                      {formatTimestamp(ev.ts)}
                    </span>
                  </div>

                  <div className={`text-[10px] font-medium truncate ${
                    isEmail ? "text-blue-400 group-hover:text-blue-300 transition" : "text-jarvis-ink"
                  }`}>
                    {ev.from && <span className="text-jarvis-muted font-normal">{ev.from.split("<")[0].trim().slice(0, 25)} — </span>}
                    {ev.subject || "(no subject)"}
                    {isEmail && <Mail size={9} className="inline ml-1.5 opacity-0 group-hover:opacity-100 transition" />}
                  </div>

                  {hasBody && !isExpanded && !isEmail && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <ChevronRight size={8} className="text-jarvis-muted shrink-0" />
                      <span className="text-[9px] text-jarvis-muted truncate">{ev.body.replace(/<[^>]*>/g, "").slice(0, 80)}</span>
                    </div>
                  )}

                  {hasBody && isExpanded && (
                    <div className="mt-1.5 text-[9px] text-jarvis-body leading-relaxed whitespace-pre-wrap rounded-lg bg-white/[0.02] border border-jarvis-border/30 p-2 max-h-[200px] overflow-y-auto">
                      {ev.body.replace(/<[^>]*>/g, "")}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
