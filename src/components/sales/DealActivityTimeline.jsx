// DealActivityTimeline — chronological feed merging activities, communications,
// tracking_events, and email_style for a deal. Email entries are clickable.

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase.js";
import {
  Mail, Phone, StickyNote, Calendar, ArrowRightLeft,
  Sparkles, Eye, MousePointerClick, Loader2, RefreshCw,
  Send, FileText, ChevronDown, ChevronRight,
} from "lucide-react";

// ── Icon + color per event type ────────────────────────────────────────────

const TYPE_CONFIG = {
  // activities.type values
  email:          { icon: Mail,              color: "text-blue-400",    bg: "bg-blue-900/25",  border: "border-blue-800/30",  label: "Email" },
  call:           { icon: Phone,             color: "text-green-400",   bg: "bg-green-900/25", border: "border-green-800/30", label: "Call" },
  meeting:        { icon: Calendar,          color: "text-purple-400",  bg: "bg-purple-900/25",border: "border-purple-800/30",label: "Meeting" },
  note:           { icon: StickyNote,        color: "text-amber-400",   bg: "bg-amber-900/25", border: "border-amber-800/30", label: "Note" },
  jarvis_action:  { icon: Sparkles,          color: "text-jarvis-primary", bg: "bg-jarvis-primary/10", border: "border-jarvis-primary/20", label: "Jarvis" },
  stage_change:   { icon: ArrowRightLeft,    color: "text-jarvis-primary", bg: "bg-jarvis-primary/10", border: "border-jarvis-primary/20", label: "Stage" },
  proposal:       { icon: FileText,          color: "text-jarvis-purple",  bg: "bg-purple-900/25",border: "border-purple-800/30",label: "Proposal" },
  // tracking_events.event_type values
  email_open:     { icon: Eye,              color: "text-cyan-400",    bg: "bg-cyan-900/25",  border: "border-cyan-800/30",  label: "Opened" },
  link_click:     { icon: MousePointerClick, color: "text-cyan-400",    bg: "bg-cyan-900/25",  border: "border-cyan-800/30",  label: "Click" },
  proposal_view:  { icon: Eye,              color: "text-purple-400",  bg: "bg-purple-900/25",border: "border-purple-800/30",label: "Proposal View" },
  // email_style (AI draft edits)
  style_learned:  { icon: Sparkles,          color: "text-amber-400",   bg: "bg-amber-900/25", border: "border-amber-800/30", label: "Style Learned" },
  // fallback
  unknown:        { icon: StickyNote,        color: "text-jarvis-muted",bg: "bg-white/5",      border: "border-white/10",     label: "Activity" },
};

function getConfig(type) {
  return TYPE_CONFIG[type] || TYPE_CONFIG.unknown;
}

// ── Date formatting ────────────────────────────────────────────────────────

function formatTimestamp(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHrs < 24) return `${diffHrs}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateHeader(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  if (isToday) return "Today";
  if (isYesterday) return "Yesterday";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// ── Main component ─────────────────────────────────────────────────────────

export function DealActivityTimeline({ dealId, onEmailClick }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  const refresh = async () => {
    if (!supabase || !dealId) { setLoading(false); return; }
    setLoading(true);

    const [activitiesRes, commsRes, trackingRes, styleRes] = await Promise.all([
      supabase
        .from("activities")
        .select("*")
        .eq("deal_id", dealId)
        .order("occurred_at", { ascending: false })
        .limit(100),
      supabase
        .from("communications")
        .select("*")
        .eq("deal_id", dealId)
        .order("occurred_at", { ascending: false })
        .limit(100),
      supabase
        .from("tracking_events")
        .select("*")
        .eq("deal_id", dealId)
        .order("occurred_at", { ascending: false })
        .limit(50),
      supabase
        .from("email_style")
        .select("*")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

    // Normalize into a common shape
    const normalized = [];

    for (const a of activitiesRes.data ?? []) {
      normalized.push({
        id: a.id,
        kind: "activity",
        type: a.type,
        subject: a.subject,
        body: a.body,
        source: a.source,
        metadata: a.metadata,
        ts: a.occurred_at,
        messageId: a.metadata?.message_id || null,
      });
    }

    for (const c of commsRes.data ?? []) {
      normalized.push({
        id: c.id,
        kind: "communication",
        type: c.type,
        subject: c.subject,
        body: c.body,
        source: null,
        metadata: null,
        ts: c.occurred_at,
        messageId: null,
      });
    }

    for (const t of trackingRes.data ?? []) {
      normalized.push({
        id: t.id,
        kind: "tracking",
        type: t.event_type,
        subject: t.event_type === "email_open"
          ? "Email opened"
          : t.event_type === "link_click"
          ? `Link clicked${t.metadata?.url ? `: ${t.metadata.url}` : ""}`
          : t.event_type === "proposal_view"
          ? "Proposal viewed"
          : t.event_type,
        body: null,
        source: t.source,
        metadata: t.metadata,
        ts: t.occurred_at,
        messageId: t.metadata?.message_id || null,
      });
    }

    for (const s of styleRes.data ?? []) {
      normalized.push({
        id: s.id,
        kind: "style",
        type: "style_learned",
        subject: `Email style learned (${s.context || "reply"})`,
        body: null,
        source: "jarvis",
        metadata: { context: s.context },
        ts: s.created_at,
        messageId: null,
      });
    }

    // Deduplicate: if an activity and communication share the same subject + close timestamp, keep the activity
    const deduped = [];
    const commKeys = new Set();

    for (const ev of normalized) {
      if (ev.kind === "communication") {
        commKeys.add(`${ev.type}:${ev.subject}:${new Date(ev.ts).toISOString().slice(0, 16)}`);
      }
    }

    for (const ev of normalized) {
      if (ev.kind === "activity") {
        const key = `${ev.type}:${ev.subject}:${new Date(ev.ts).toISOString().slice(0, 16)}`;
        if (commKeys.has(key)) {
          commKeys.delete(key); // keep the activity, skip the matching comm
        }
      }
      deduped.push(ev);
    }

    // Remove duped comms
    const finalEvents = deduped.filter(ev => {
      if (ev.kind === "communication") {
        const key = `${ev.type}:${ev.subject}:${new Date(ev.ts).toISOString().slice(0, 16)}`;
        // If we already deleted this key from commKeys above, it was a dupe — skip it
        return commKeys.has(key) || !normalized.some(
          a => a.kind === "activity" && a.type === ev.type && a.subject === ev.subject &&
          Math.abs(new Date(a.ts) - new Date(ev.ts)) < 60000
        );
      }
      return true;
    });

    // Sort chronologically (newest first)
    finalEvents.sort((a, b) => new Date(b.ts) - new Date(a.ts));

    setEvents(finalEvents);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [dealId]);

  // Group by date
  const grouped = [];
  let currentDate = null;
  for (const ev of events) {
    const dateStr = formatDateHeader(ev.ts);
    if (dateStr !== currentDate) {
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
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="label">Activity Timeline</span>
        <button
          onClick={refresh}
          className="p-1 rounded hover:bg-white/5 transition text-jarvis-muted hover:text-jarvis-ink"
        >
          <RefreshCw size={10} />
        </button>
      </div>

      {events.length === 0 ? (
        <div className="text-[11px] text-jarvis-muted text-center py-6">
          No activity yet. Emails, calls, and notes will appear here.
        </div>
      ) : (
        <div className="relative">
          {/* Vertical timeline line */}
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
            const isEmail = ev.type === "email" && ev.kind !== "style";
            const isClickable = isEmail && ev.messageId && onEmailClick;
            const isExpanded = expandedId === ev.id;

            return (
              <div key={item.key} className="relative flex gap-3 group">
                {/* Icon node */}
                <div className="relative z-10 w-[27px] shrink-0 flex justify-center pt-2.5">
                  <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
                    <Icon size={10} className={cfg.color} />
                  </div>
                </div>

                {/* Content */}
                <div
                  className={`flex-1 min-w-0 py-2 pr-1 ${
                    isClickable ? "cursor-pointer" : ""
                  }`}
                  onClick={() => {
                    if (isClickable) {
                      onEmailClick({
                        message_id: ev.messageId,
                        from_addr: ev.metadata?.from || ev.source || "",
                        subject: ev.subject,
                        snippet: (ev.body || "").slice(0, 120),
                        category: "fyi",
                        thread_id: ev.metadata?.thread_id || null,
                        created_at: ev.ts,
                      });
                    } else if (ev.body) {
                      setExpandedId(isExpanded ? null : ev.id);
                    }
                  }}
                >
                  {/* Top row: type chip + timestamp */}
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${cfg.color} ${cfg.bg} border ${cfg.border}`}>
                      {cfg.label}
                    </span>
                    {ev.source === "jarvis" && (
                      <span className="text-[7px] px-1.5 py-0.5 rounded-full bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/20 font-medium">
                        AI
                      </span>
                    )}
                    <span className="text-[8px] text-jarvis-muted tabular-nums ml-auto shrink-0">
                      {formatTimestamp(ev.ts)}
                    </span>
                  </div>

                  {/* Subject */}
                  <div className={`text-[10px] font-medium truncate ${
                    isClickable
                      ? "text-blue-400 group-hover:text-blue-300 transition"
                      : "text-jarvis-ink"
                  }`}>
                    {ev.subject || "(no subject)"}
                    {isClickable && (
                      <Mail size={9} className="inline ml-1.5 opacity-0 group-hover:opacity-100 transition" />
                    )}
                  </div>

                  {/* Preview / expanded body */}
                  {ev.body && !isExpanded && !isClickable && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <ChevronRight size={8} className="text-jarvis-muted shrink-0" />
                      <span className="text-[9px] text-jarvis-muted truncate">
                        {ev.body.slice(0, 80)}
                      </span>
                    </div>
                  )}
                  {ev.body && isExpanded && (
                    <div className="mt-1.5 text-[9px] text-jarvis-body leading-relaxed whitespace-pre-wrap rounded-lg bg-white/[0.02] border border-jarvis-border/30 p-2">
                      {ev.body}
                    </div>
                  )}

                  {/* Tracking metadata */}
                  {ev.kind === "tracking" && ev.metadata?.url && (
                    <div className="text-[8px] text-jarvis-muted mt-0.5 truncate">
                      {ev.metadata.url}
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
