// EmailInbox — Gmail-style inbox with tabs. Reads from jarvisd email_triage.
// Polls every 60s for near-live feed. Tabs: All, Unread, Action Needed.

import { useEffect, useState, useRef } from "react";
import { Mail, ChevronDown, ChevronUp, RefreshCcw } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const USER_DOMAINS = ["3plcenter.com", "eddisammy@gmail.com"];
const POLL_MS = 60_000; // 60 seconds for near-live

function isOutbound(fromAddr) {
  if (!fromAddr) return false;
  const lower = fromAddr.toLowerCase();
  return USER_DOMAINS.some(d => lower.includes(d));
}

function senderName(fromAddr) {
  if (!fromAddr) return "Unknown";
  const nameMatch = fromAddr.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) return nameMatch[1].trim();
  const emailMatch = fromAddr.match(/([^@<\s]+)@/);
  if (emailMatch) {
    const name = emailMatch[1].replace(/[._-]/g, " ");
    return name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  return fromAddr.slice(0, 20);
}

function senderEmail(fromAddr) {
  if (!fromAddr) return "";
  const match = fromAddr.match(/<([^>]+)>/) || fromAddr.match(/([^\s<]+@[^\s>]+)/);
  return match ? match[1] : fromAddr;
}

function linkToDeal(email, deals) {
  if (!email.from_addr || !deals?.length) return null;
  const addr = email.from_addr.toLowerCase();
  return deals.find(d => {
    const ce = (d.contact_email || d.person_email || "").toLowerCase();
    return ce && addr.includes(ce);
  });
}

const fmtDate = (s) => {
  if (!s) return "";
  const d = new Date(s);
  const now = new Date();
  const diffH = (now - d) / 3_600_000;
  if (diffH < 1) return `${Math.floor(diffH * 60)}m`;
  if (diffH < 24) return `${Math.floor(diffH)}h`;
  if (diffH < 48) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

// "Unread" = not outbound AND action_taken is 0/falsy
function isUnread(email) {
  return !isOutbound(email.from_addr) && !email.action_taken;
}

function EmailRow({ email, deal }) {
  const [expanded, setExpanded] = useState(false);
  const out = isOutbound(email.from_addr);
  const name = out ? "You" : senderName(email.from_addr);
  const unread = isUnread(email);

  return (
    <div className={`border-b border-jarvis-border/20 last:border-0 transition ${unread ? "bg-white/[0.03]" : ""}`}>
      <button
        className="w-full text-left py-2.5 px-3 hover:bg-jarvis-surface-hover rounded transition"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold ${
              out
                ? "bg-jarvis-primary/15 text-jarvis-primary"
                : deal
                  ? "bg-jarvis-success/15 text-jarvis-success"
                  : "bg-white/8 text-jarvis-muted"
            }`}>
              {out ? "→" : name.charAt(0).toUpperCase()}
            </div>
            {unread && (
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-jarvis-primary border-2 border-jarvis-surface" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: sender + badges + timestamp */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[12px] truncate ${unread ? "font-bold text-jarvis-ink" : "font-medium text-jarvis-muted"}`}>
                  {name}
                </span>
                {email.category === "urgent" && (
                  <span className="text-[7px] px-1.5 py-0.5 rounded bg-jarvis-danger/12 text-jarvis-danger font-semibold shrink-0">URGENT</span>
                )}
                {email.category === "action_needed" && (
                  <span className="text-[7px] px-1.5 py-0.5 rounded bg-jarvis-warning/12 text-jarvis-warning font-semibold shrink-0">ACTION</span>
                )}
                {deal && (
                  <span className="text-[7px] px-1.5 py-0.5 rounded bg-jarvis-primary/10 text-jarvis-primary shrink-0">
                    {deal.title || deal.org_name}
                  </span>
                )}
                {!deal && !out && email.category !== "newsletter" && email.category !== "junk" && (
                  <span className="text-[7px] px-1.5 py-0.5 rounded bg-jarvis-warning/10 text-jarvis-warning shrink-0">New Lead</span>
                )}
              </div>
              <span className={`text-[10px] shrink-0 ${unread ? "text-jarvis-ink font-semibold" : "text-jarvis-ghost"}`}>
                {fmtDate(email.created_at)}
              </span>
            </div>

            {/* Row 2: subject */}
            <div className={`text-[11px] truncate mt-0.5 ${unread ? "text-jarvis-ink font-medium" : "text-jarvis-muted"}`}>
              {email.subject || "(no subject)"}
            </div>

            {/* Row 3: preview */}
            <div className="text-[10px] text-jarvis-ghost truncate mt-0.5">
              {email.snippet || ""}
            </div>
          </div>

          <div className="shrink-0 ml-1">
            {expanded ? <ChevronUp size={12} className="text-jarvis-ghost" /> : <ChevronDown size={12} className="text-jarvis-ghost" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-14 pb-3 space-y-2">
          <div className="flex items-center gap-2 text-[9px] text-jarvis-ghost">
            <span>From: {senderEmail(email.from_addr)}</span>
            {email.category && (
              <span className={`px-1.5 py-0.5 rounded ${
                email.category === "urgent" ? "bg-jarvis-danger/10 text-jarvis-danger"
                : email.category === "action_needed" ? "bg-jarvis-warning/10 text-jarvis-warning"
                : "bg-white/5 text-jarvis-muted"
              }`}>
                {email.category.replace(/_/g, " ")}
              </span>
            )}
            {deal && <span className="text-jarvis-primary">Linked: {deal.title || deal.org_name}</span>}
          </div>
          <p className="text-[11px] text-jarvis-body leading-relaxed whitespace-pre-wrap">{email.snippet}</p>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "action", label: "Action Needed" },
];

export function EmailInbox({ deals = [] }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("unread"); // default to unread
  const [lastRefresh, setLastRefresh] = useState(null);
  const intervalRef = useRef(null);

  const load = async () => {
    try {
      const data = await jarvis.emailTriage(50);
      const sorted = (Array.isArray(data) ? data : [])
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setEmails(sorted);
      setLastRefresh(new Date());
    } catch {
      // keep existing emails on error
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, POLL_MS);
    return () => clearInterval(intervalRef.current);
  }, []);

  // Filter by tab
  const filtered = tab === "unread"
    ? emails.filter(e => isUnread(e))
    : tab === "action"
      ? emails.filter(e => e.category === "action_needed" || e.category === "urgent")
      : emails;

  const unreadCount = emails.filter(e => isUnread(e)).length;
  const actionCount = emails.filter(e => e.category === "action_needed" || e.category === "urgent").length;

  return (
    <div className="flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Mail size={12} className="text-jarvis-primary" />
          <span className="text-[13px] font-semibold text-jarvis-ink">Inbox</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-jarvis-ghost hover:text-jarvis-muted transition">
            <RefreshCcw size={10} />
          </button>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-jarvis-success animate-pulse" />
            <span className="text-[9px] text-jarvis-muted">Live · 60s</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {TABS.map(t => {
          const count = t.key === "unread" ? unreadCount : t.key === "action" ? actionCount : emails.length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-[10px] px-2.5 py-1 rounded-md transition font-medium ${
                tab === t.key
                  ? "bg-jarvis-primary/15 text-jarvis-primary"
                  : "text-jarvis-muted hover:text-jarvis-ink"
              }`}
            >
              {t.label}
              {count > 0 && (
                <span className={`ml-1 ${
                  t.key === "unread" && count > 0 ? "text-jarvis-primary font-bold" :
                  t.key === "action" && count > 0 ? "text-jarvis-warning font-bold" : ""
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Email list */}
      {loading && <div className="text-[10px] text-jarvis-ghost animate-pulse py-4">Loading emails…</div>}

      {!loading && filtered.length === 0 && (
        <div className="text-[10px] text-jarvis-ghost py-4">
          {tab === "unread" ? "All caught up. No unread emails." :
           tab === "action" ? "No emails needing action." :
           "No emails synced yet. Connect Gmail in Settings."}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div>
          {filtered.map(e => (
            <EmailRow key={e.id} email={e} deal={linkToDeal(e, deals)} />
          ))}
        </div>
      )}
    </div>
  );
}
