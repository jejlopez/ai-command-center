// EmailInbox — Gmail-style inbox. Reads from jarvisd email_triage (15-min sync).
// Clean sender names, bold subjects, preview snippets, timestamps.

import { useEffect, useState } from "react";
import { Mail, ChevronDown, ChevronUp } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const USER_DOMAINS = ["3plcenter.com", "eddisammy@gmail.com"];

function isOutbound(fromAddr) {
  if (!fromAddr) return false;
  const lower = fromAddr.toLowerCase();
  return USER_DOMAINS.some(d => lower.includes(d));
}

// Extract clean name from "Name <email>" or just return email username
function senderName(fromAddr) {
  if (!fromAddr) return "Unknown";
  // "John Smith" <john@example.com> → John Smith
  const nameMatch = fromAddr.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) return nameMatch[1].trim();
  // john@example.com → John
  const emailMatch = fromAddr.match(/([^@<\s]+)@/);
  if (emailMatch) {
    const name = emailMatch[1].replace(/[._-]/g, " ");
    return name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  }
  return fromAddr.slice(0, 20);
}

// Extract just the email address
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

function EmailRow({ email, deal }) {
  const [expanded, setExpanded] = useState(false);
  const out = isOutbound(email.from_addr);
  const name = out ? "You" : senderName(email.from_addr);
  const isUnread = !out && !email.read;

  return (
    <div className={`border-b border-jarvis-border/20 last:border-0 transition ${isUnread ? "bg-white/[0.02]" : ""}`}>
      <button
        className="w-full text-left py-2.5 px-3 hover:bg-jarvis-surface-hover rounded transition"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-center gap-3">
          {/* Sender avatar / direction indicator */}
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold ${
            out
              ? "bg-jarvis-primary/15 text-jarvis-primary"
              : deal
                ? "bg-jarvis-success/15 text-jarvis-success"
                : "bg-white/8 text-jarvis-muted"
          }`}>
            {out ? "→" : name.charAt(0).toUpperCase()}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: sender + timestamp */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-[12px] truncate ${isUnread ? "font-bold text-jarvis-ink" : "font-medium text-jarvis-muted"}`}>
                  {name}
                </span>
                {deal && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-jarvis-primary/10 text-jarvis-primary shrink-0">
                    {deal.title || deal.org_name}
                  </span>
                )}
                {!deal && !out && email.category !== "newsletter" && email.category !== "junk" && (
                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-jarvis-warning/10 text-jarvis-warning shrink-0">
                    New Lead
                  </span>
                )}
              </div>
              <span className={`text-[10px] shrink-0 ${isUnread ? "text-jarvis-ink font-semibold" : "text-jarvis-ghost"}`}>
                {fmtDate(email.created_at)}
              </span>
            </div>

            {/* Row 2: subject */}
            <div className={`text-[11px] truncate mt-0.5 ${isUnread ? "text-jarvis-ink" : "text-jarvis-muted"}`}>
              {email.subject || "(no subject)"}
            </div>

            {/* Row 3: preview snippet */}
            <div className="text-[10px] text-jarvis-ghost truncate mt-0.5">
              {email.snippet || ""}
            </div>
          </div>

          {/* Expand chevron */}
          <div className="shrink-0 ml-1">
            {expanded
              ? <ChevronUp size={12} className="text-jarvis-ghost" />
              : <ChevronDown size={12} className="text-jarvis-ghost" />
            }
          </div>
        </div>
      </button>

      {/* Expanded detail */}
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
            {deal && (
              <span className="text-jarvis-primary">Linked: {deal.title || deal.org_name}</span>
            )}
          </div>
          <p className="text-[11px] text-jarvis-body leading-relaxed whitespace-pre-wrap">
            {email.snippet}
          </p>
        </div>
      )}
    </div>
  );
}

export function EmailInbox({ deals = [] }) {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await jarvis.emailTriage(30);
        setEmails(Array.isArray(data) ? data : []);
      } catch {
        setEmails([]);
      } finally {
        setLoading(false);
      }
    }
    load();
    const interval = setInterval(load, 300_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Mail size={12} className="text-jarvis-primary" />
          <span className="text-[13px] font-semibold text-jarvis-ink">Inbox</span>
          {emails.length > 0 && (
            <span className="text-[9px] text-jarvis-ghost">({emails.length})</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-jarvis-success" />
          <span className="text-[10px] text-jarvis-muted">Live · 15m sync</span>
        </div>
      </div>

      {loading && <div className="text-[10px] text-jarvis-ghost animate-pulse py-4">Loading emails…</div>}

      {!loading && emails.length === 0 && (
        <div className="text-[10px] text-jarvis-ghost py-4">No emails synced yet. Connect Gmail in Settings.</div>
      )}

      {!loading && emails.length > 0 && (
        <div className="divide-y-0">
          {emails.map(e => (
            <EmailRow key={e.id} email={e} deal={linkToDeal(e, deals)} />
          ))}
        </div>
      )}
    </div>
  );
}
