// EmailInbox — shows recent emails linked to deals. Reads from communications table.

import { useEffect, useState } from "react";
import { Mail, Search, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const fmtDate = (s) => s
  ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  : "";

function EmailRow({ email, deals = [] }) {
  const [expanded, setExpanded] = useState(false);
  const deal = email.deal_id ? deals.find(d => d.id === email.deal_id) : null;
  const preview = (email.body ?? "").slice(0, 80);

  return (
    <div className="border-b border-jarvis-border/50 last:border-0">
      <button
        className="w-full text-left py-2 hover:bg-jarvis-ghost/20 rounded px-1 -mx-1 transition"
        onClick={() => setExpanded(v => !v)}
      >
        <div className="flex items-start gap-2">
          <Mail size={11} className="text-blue-400 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-jarvis-ink truncate flex-1">
                {email.subject || "(no subject)"}
              </span>
              {deal && (
                <span className="chip bg-jarvis-primary/10 text-jarvis-primary text-[9px] shrink-0">
                  {deal.company ?? deal.company_name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-jarvis-muted truncate">
                {email.contact_name || email.from_address || "Unknown"}
              </span>
              <span className="text-[9px] text-jarvis-ghost ml-auto shrink-0">{fmtDate(email.occurred_at)}</span>
            </div>
            {!expanded && preview && (
              <div className="text-[10px] text-jarvis-ghost truncate mt-0.5">{preview}</div>
            )}
          </div>
          {expanded ? <ChevronUp size={10} className="text-jarvis-ghost shrink-0" /> : <ChevronDown size={10} className="text-jarvis-ghost shrink-0" />}
        </div>
      </button>
      {expanded && (
        <div className="pb-2 px-1 space-y-2">
          <p className="text-[11px] text-jarvis-body leading-relaxed whitespace-pre-wrap">{email.body}</p>
          <div className="flex gap-2">
            {deal && (
              <button
                className="btn-ghost text-[10px] flex items-center gap-1"
                onClick={() => {/* open deal room */}}
              >
                <ExternalLink size={9} /> Open Deal
              </button>
            )}
            <button className="btn-ghost text-[10px]">Draft Reply</button>
          </div>
        </div>
      )}
    </div>
  );
}

export function EmailInbox({ deals = [] }) {
  const [emails, setEmails] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!supabase) { setLoading(false); return; }
      const { data } = await supabase
        .from("communications")
        .select("*")
        .eq("type", "email")
        .order("occurred_at", { ascending: false })
        .limit(20);
      setEmails(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = query.trim()
    ? emails.filter(e =>
        (e.subject ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (e.body ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (e.contact_name ?? "").toLowerCase().includes(query.toLowerCase())
      )
    : emails;

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Mail size={13} className="text-blue-400" />
        <span className="label flex-1">Email Inbox</span>
        {emails.length > 0 && (
          <span className="text-[10px] text-jarvis-ghost">{emails.length} emails</span>
        )}
      </div>

      {emails.length > 0 && (
        <div className="flex items-center gap-2 bg-jarvis-surface border border-jarvis-border rounded-lg px-2 py-1">
          <Search size={10} className="text-jarvis-ghost" />
          <input
            className="flex-1 text-xs bg-transparent text-jarvis-ink placeholder-jarvis-ghost outline-none"
            placeholder="Search emails…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      )}

      {loading && <div className="text-xs text-jarvis-ghost animate-pulse">Loading emails…</div>}

      {!loading && emails.length === 0 && (
        <div className="text-xs text-jarvis-ghost py-2">
          Emails will sync automatically 3x/day from Gmail.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div>
          {filtered.map(email => (
            <EmailRow key={email.id} email={email} deals={deals} />
          ))}
        </div>
      )}

      {!loading && query && filtered.length === 0 && (
        <div className="text-xs text-jarvis-ghost">No emails match "{query}"</div>
      )}
    </div>
  );
}
