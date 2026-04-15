// EmailInbox — reads from jarvisd email_triage table (15-min Gmail sync).
// Shows IN/OUT direction, auto-links to deals by contact email.

import { useEffect, useState } from "react";
import { Mail, ChevronDown, ChevronUp } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const USER_DOMAINS = ["3plcenter.com", "eddisammy@gmail.com"];

function isOutbound(fromAddr) {
  if (!fromAddr) return false;
  const lower = fromAddr.toLowerCase();
  return USER_DOMAINS.some(d => lower.includes(d));
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
  if (diffH < 1) return `${Math.floor(diffH * 60)}m ago`;
  if (diffH < 24) return `${Math.floor(diffH)}h ago`;
  if (diffH < 48) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

function EmailRow({ email, deal }) {
  const [expanded, setExpanded] = useState(false);
  const out = isOutbound(email.from_addr);

  return (
    <div className="border-b border-jarvis-border/30 last:border-0">
      <button
        className="w-full text-left py-2 px-1 hover:bg-jarvis-ghost/20 rounded transition"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-1.5">
          <span className={`text-[8px] font-semibold px-1 py-0.5 rounded mt-0.5 shrink-0 ${
            out
              ? "bg-jarvis-primary/15 text-jarvis-primary"
              : "bg-jarvis-success/15 text-jarvis-success"
          }`}>
            {out ? "OUT" : "IN"}
          </span>
          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-jarvis-ink truncate flex-1">{email.subject || "(no subject)"}</span>
              <span className="text-[9px] text-jarvis-ghost shrink-0 ml-2">{fmtDate(email.created_at)}</span>
            </div>
            <div className="text-[10px] text-jarvis-muted truncate">{email.from_addr} — {email.snippet}</div>
            {deal && (
              <div className="text-[9px] text-jarvis-primary mt-0.5">→ {deal.title || deal.org_name} · ${(deal.value / 1000).toFixed(0)}K</div>
            )}
            {!deal && !out && email.category !== "newsletter" && email.category !== "junk" && (
              <div className="text-[9px] text-jarvis-warning mt-0.5">→ New Lead (unmatched)</div>
            )}
          </div>
          {expanded ? <ChevronUp size={10} className="text-jarvis-ghost shrink-0 mt-1" /> : <ChevronDown size={10} className="text-jarvis-ghost shrink-0 mt-1" />}
        </div>
      </button>
      {expanded && (
        <div className="pb-2 px-1">
          <div className="flex gap-1 mb-1">
            <span className={`text-[8px] px-1.5 py-0.5 rounded ${
              email.category === "urgent" ? "bg-jarvis-danger/10 text-jarvis-danger"
              : email.category === "action_needed" ? "bg-jarvis-warning/10 text-jarvis-warning"
              : "bg-white/5 text-jarvis-muted"
            }`}>
              {email.category}
            </span>
            {email.confidence > 0 && (
              <span className="text-[8px] text-jarvis-ghost">{Math.round(email.confidence * 100)}% conf</span>
            )}
          </div>
          <p className="text-[10px] text-jarvis-body leading-relaxed">{email.snippet}</p>
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
    // Refresh every 5 minutes
    const interval = setInterval(load, 300_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Mail size={12} className="text-jarvis-primary" />
          <span className="text-[13px] font-semibold text-jarvis-ink">Emails</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-jarvis-success" />
          <span className="text-[10px] text-jarvis-muted">Live · 15m sync</span>
        </div>
      </div>

      {loading && <div className="text-[10px] text-jarvis-ghost animate-pulse">Loading emails…</div>}

      {!loading && emails.length === 0 && (
        <div className="text-[10px] text-jarvis-ghost">No emails synced yet. Connect Gmail in Settings.</div>
      )}

      {!loading && emails.length > 0 && (
        <div>
          {emails.map(e => (
            <EmailRow key={e.id} email={e} deal={linkToDeal(e, deals)} />
          ))}
        </div>
      )}
    </div>
  );
}
