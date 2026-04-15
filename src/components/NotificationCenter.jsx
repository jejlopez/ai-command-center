// NotificationCenter.jsx — persistent notification drawer with bell icon
import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, X, Zap, Calendar, Mail, TrendingDown, Clock, Check } from "lucide-react";
import { supabase } from "../lib/supabase.js";

const fmtAgo = (s) => {
  if (!s) return "";
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const TYPE_ICON = {
  morning_action: Zap,
  meeting_prep:   Calendar,
  email_urgent:   Mail,
  email_cleanup:  Mail,
  email_triage:   Mail,
  pipeline_gap:   TrendingDown,
  default:        Clock,
};

const TYPE_COLOR = {
  morning_action: "text-jarvis-primary",
  meeting_prep:   "text-jarvis-purple",
  email_urgent:   "text-blue-400",
  email_cleanup:  "text-blue-400",
  email_triage:   "text-blue-400",
  pipeline_gap:   "text-jarvis-warning",
  default:        "text-jarvis-muted",
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function NotificationCenter() {
  const [open, setOpen]           = useState(false);
  const [items, setItems]         = useState([]);
  const [readIds, setReadIds]     = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem("jarvis_notif_read") || "[]")); }
    catch { return new Set(); }
  });
  const channelRef = useRef(null);
  const drawerRef  = useRef(null);

  const load = useCallback(async () => {
    if (!supabase) return;
    const since = new Date(Date.now() - DAY_MS).toISOString();
    const { data } = await supabase
      .from("jarvis_suggestions")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setItems(data);
  }, []);

  useEffect(() => {
    load();
    if (!supabase) return;
    const ch = supabase
      .channel("notif-center")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "jarvis_suggestions" }, load)
      .subscribe();
    channelRef.current = ch;
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [load]);

  // Close drawer on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markRead = (id) => {
    setReadIds(prev => {
      const next = new Set(prev);
      next.add(id);
      localStorage.setItem("jarvis_notif_read", JSON.stringify([...next]));
      return next;
    });
  };

  const markAllRead = () => {
    const allIds = items.map(i => i.id);
    setReadIds(prev => {
      const next = new Set([...prev, ...allIds]);
      localStorage.setItem("jarvis_notif_read", JSON.stringify([...next]));
      return next;
    });
  };

  const dismiss = (id) => {
    markRead(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const unread = items.filter(i => !readIds.has(i.id)).length;

  return (
    <div className="relative" ref={drawerRef}>
      {/* Bell button */}
      <button
        onClick={() => { setOpen(o => !o); if (!open) items.forEach(i => {}); }}
        className="relative p-2 rounded-xl text-jarvis-muted hover:text-jarvis-ink hover:bg-jarvis-ghost transition"
        title="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-jarvis-primary text-white text-[9px] font-bold grid place-items-center tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Drawer */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-[480px] glass border border-jarvis-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-jarvis-border shrink-0">
            <div className="flex items-center gap-2">
              <Bell size={13} className="text-jarvis-primary" />
              <span className="text-xs font-semibold text-jarvis-ink">Notifications</span>
              {unread > 0 && (
                <span className="text-[9px] bg-jarvis-primary/15 text-jarvis-primary px-1.5 py-0.5 rounded-full font-semibold">{unread} new</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-jarvis-muted hover:text-jarvis-ink transition flex items-center gap-1">
                  <Check size={10} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded-lg text-jarvis-muted hover:text-jarvis-ink transition">
                <X size={12} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="overflow-y-auto flex-1">
            {items.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-jarvis-muted">No notifications in the last 24 hours</div>
            )}
            {items.map((item) => {
              const Icon  = TYPE_ICON[item.type] ?? TYPE_ICON.default;
              const color = TYPE_COLOR[item.type] ?? TYPE_COLOR.default;
              const isUnread = !readIds.has(item.id);
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-jarvis-border/50 last:border-0 transition ${isUnread ? "bg-jarvis-primary/[0.03]" : ""}`}
                  onClick={() => markRead(item.id)}
                >
                  <Icon size={14} className={`${color} shrink-0 mt-0.5`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-jarvis-body leading-snug">{item.suggestion}</div>
                    <div className="text-[10px] text-jarvis-muted mt-1">{fmtAgo(item.created_at)}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); dismiss(item.id); }}
                    className="shrink-0 p-1 rounded-lg text-jarvis-muted hover:text-jarvis-ink transition opacity-0 group-hover:opacity-100"
                    title="Dismiss"
                  >
                    <X size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
