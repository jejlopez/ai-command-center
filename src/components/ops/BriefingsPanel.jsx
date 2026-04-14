// BriefingsPanel — surfaces JARVIS skill output (jarvis_suggestions) as persistent cards.
// Groups by type: morning brief, meeting prep, email triage, pipeline alerts.

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Zap, Calendar, Mail, TrendingDown, Clock } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const fmtAgo = (s) => {
  if (!s) return "";
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const SECTIONS = [
  {
    key: "morning_action",
    label: "Morning Brief",
    icon: Zap,
    color: "text-jarvis-primary",
    bg: "bg-jarvis-primary/10",
  },
  {
    key: "meeting_prep",
    label: "Meeting Prep",
    icon: Calendar,
    color: "text-jarvis-purple",
    bg: "bg-jarvis-purple/10",
  },
  {
    key: ["email_urgent", "email_cleanup", "email_triage"],
    label: "Email Triage",
    icon: Mail,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    key: "pipeline_gap",
    label: "Pipeline Alert",
    icon: TrendingDown,
    color: "text-jarvis-warning",
    bg: "bg-jarvis-warning/10",
  },
];

function SuggestionRow({ item, color }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border-b border-jarvis-border/50 last:border-0">
      <button
        className="w-full flex items-start gap-2 py-2 text-left hover:bg-jarvis-ghost/20 rounded px-1 -mx-1 transition"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="text-xs text-jarvis-ink leading-snug truncate">{item.title}</div>
          {item.created_at && (
            <div className="flex items-center gap-1 mt-0.5">
              <Clock size={9} className="text-jarvis-ghost" />
              <span className="text-[9px] text-jarvis-ghost">{fmtAgo(item.created_at)}</span>
            </div>
          )}
        </div>
        {expanded ? (
          <ChevronUp size={11} className={`${color} shrink-0 mt-0.5`} />
        ) : (
          <ChevronDown size={11} className="text-jarvis-ghost shrink-0 mt-0.5" />
        )}
      </button>
      {expanded && item.body && (
        <div className="pb-2 px-1">
          <p className="text-[11px] text-jarvis-body leading-relaxed whitespace-pre-wrap">{item.body}</p>
          {item.metadata?.deal && (
            <div className="mt-2 flex gap-2">
              <span className="chip bg-jarvis-primary/10 text-jarvis-primary text-[9px]">{item.metadata.deal}</span>
              {item.metadata.urgency && (
                <span className={`chip text-[9px] ${item.metadata.urgency === "high" ? "bg-jarvis-danger/10 text-jarvis-danger" : "bg-jarvis-warning/10 text-jarvis-warning"}`}>
                  {item.metadata.urgency}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BriefingSection({ section, suggestions }) {
  const [collapsed, setCollapsed] = useState(false);
  const Icon = section.icon;

  const types = Array.isArray(section.key) ? section.key : [section.key];
  const items = suggestions.filter(s => types.includes(s.type));
  if (items.length === 0) return null;

  return (
    <div className="border-b border-jarvis-border/50 last:border-0 pb-3 last:pb-0">
      <button
        className="w-full flex items-center gap-2 mb-2 hover:opacity-80 transition"
        onClick={() => setCollapsed(v => !v)}
      >
        <div className={`p-1 rounded ${section.bg}`}>
          <Icon size={11} className={section.color} />
        </div>
        <span className={`label flex-1 text-left ${section.color}`}>{section.label}</span>
        <span className="text-[9px] text-jarvis-ghost">{items.length}</span>
        {collapsed ? <ChevronDown size={10} className="text-jarvis-ghost" /> : <ChevronUp size={10} className="text-jarvis-ghost" />}
      </button>
      {!collapsed && (
        <div>
          {items.slice(0, 5).map(item => (
            <SuggestionRow key={item.id} item={item} color={section.color} />
          ))}
        </div>
      )}
    </div>
  );
}

export function BriefingsPanel() {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!supabase) { setLoading(false); return; }
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("jarvis_suggestions")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(50);
      setSuggestions(data ?? []);
      setLoading(false);
    }
    load();

    if (!supabase) return;
    const ch = supabase
      .channel("briefings-panel")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "jarvis_suggestions" }, load)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, []);

  const hasSuggestions = suggestions.length > 0;

  return (
    <div className="glass p-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap size={13} className="text-jarvis-primary" />
        <span className="label">JARVIS Briefings</span>
        {hasSuggestions && (
          <span className="chip bg-jarvis-primary/10 text-jarvis-primary text-[9px] ml-auto">
            {suggestions.length} today
          </span>
        )}
      </div>

      {loading && (
        <div className="text-xs text-jarvis-ghost animate-pulse">Loading briefings…</div>
      )}

      {!loading && !hasSuggestions && (
        <div className="text-xs text-jarvis-ghost py-2">
          JARVIS briefs will appear here at 7am, 12pm, and 5pm.
        </div>
      )}

      {!loading && hasSuggestions && (
        <div className="flex flex-col gap-3">
          {SECTIONS.map(section => (
            <BriefingSection key={Array.isArray(section.key) ? section.key[0] : section.key} section={section} suggestions={suggestions} />
          ))}
        </div>
      )}
    </div>
  );
}
