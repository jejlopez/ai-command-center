// EmailInboxPanel — email triage list + drafts/outbound, opens detail modal on click.

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Mail, AlertTriangle, Clock, Send, RefreshCw, Loader2, FileEdit } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const CATEGORY_STYLE = {
  urgent:        { label: "Urgent",   color: "text-red-400 bg-red-900/30 border-red-800/40" },
  action_needed: { label: "Action",   color: "text-amber-400 bg-amber-900/30 border-amber-800/40" },
  fyi:           { label: "FYI",      color: "text-blue-400 bg-blue-900/30 border-blue-800/40" },
  personal:      { label: "Personal", color: "text-purple-400 bg-purple-900/30 border-purple-800/40" },
  billing:       { label: "Billing",  color: "text-green-400 bg-green-900/30 border-green-800/40" },
  newsletter:    { label: "News",     color: "text-jarvis-muted bg-white/5 border-white/10" },
  junk:          { label: "Junk",     color: "text-jarvis-muted bg-white/5 border-white/10" },
};

const DRAFT_STATUS_STYLE = {
  draft:          { label: "Draft",    color: "text-jarvis-muted bg-white/5 border-white/10" },
  review_needed:  { label: "Review",   color: "text-amber-400 bg-amber-900/30 border-amber-800/40" },
  approved:       { label: "Approved", color: "text-green-400 bg-green-900/30 border-green-800/40" },
  sent:           { label: "Sent",     color: "text-jarvis-primary bg-jarvis-primary/10 border-jarvis-primary/20" },
  rejected:       { label: "Rejected", color: "text-red-400 bg-red-900/30 border-red-800/40" },
};

const FILTERS = ["all", "urgent", "action_needed", "fyi", "personal", "billing"];

function timeSince(dateStr) {
  if (!dateStr) return "";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

export function EmailInboxPanel({ onSelectEmail }) {
  const [tab, setTab] = useState("inbox"); // inbox | drafts
  const [emails, setEmails] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const refreshInbox = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jarvis.emailTriage(100);
      setEmails(Array.isArray(data) ? data : []);
    } catch {
      setEmails([]);
    }
    setLoading(false);
  }, []);

  const refreshDrafts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jarvis.emailDrafts(50);
      setDrafts(Array.isArray(data) ? data : []);
    } catch {
      setDrafts([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "inbox") refreshInbox();
    else refreshDrafts();
  }, [tab, refreshInbox, refreshDrafts]);

  const filtered = filter === "all"
    ? emails.filter(e => e.category !== "junk" && e.category !== "newsletter")
    : emails.filter(e => e.category === filter);

  const refresh = tab === "inbox" ? refreshInbox : refreshDrafts;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-jarvis-border">
        <div className="flex items-center gap-3">
          {/* Inbox / Drafts toggle */}
          <button
            onClick={() => setTab("inbox")}
            className={`flex items-center gap-1.5 text-[11px] font-semibold transition ${
              tab === "inbox" ? "text-jarvis-ink" : "text-jarvis-muted hover:text-jarvis-ink"
            }`}
          >
            <Mail size={14} className={tab === "inbox" ? "text-jarvis-primary" : ""} />
            Inbox
            {tab === "inbox" && <span className="text-[9px] text-jarvis-muted tabular-nums">{filtered.length}</span>}
          </button>
          <div className="w-px h-4 bg-jarvis-border" />
          <button
            onClick={() => setTab("drafts")}
            className={`flex items-center gap-1.5 text-[11px] font-semibold transition ${
              tab === "drafts" ? "text-jarvis-ink" : "text-jarvis-muted hover:text-jarvis-ink"
            }`}
          >
            <Send size={13} className={tab === "drafts" ? "text-jarvis-primary" : ""} />
            Drafts & Outbound
            {tab === "drafts" && <span className="text-[9px] text-jarvis-muted tabular-nums">{drafts.length}</span>}
          </button>
        </div>
        <button
          onClick={refresh}
          className="p-1.5 rounded hover:bg-white/5 transition text-jarvis-muted hover:text-jarvis-ink"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filter bar (inbox only) */}
      {tab === "inbox" && (
        <div className="shrink-0 flex gap-1 px-4 py-2 border-b border-jarvis-border/50 overflow-x-auto">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-[9px] px-2.5 py-1 rounded-full transition font-medium capitalize whitespace-nowrap ${
                filter === f
                  ? "bg-jarvis-primary/15 text-jarvis-primary"
                  : "text-jarvis-muted hover:text-jarvis-ink hover:bg-white/5"
              }`}
            >
              {f === "action_needed" ? "Action" : f}
            </button>
          ))}
        </div>
      )}

      {/* Email / Draft list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={16} className="animate-spin text-jarvis-muted" />
          </div>
        ) : tab === "inbox" ? (
          /* ── Inbox list ─────────────────────────────────────────── */
          filtered.length === 0 ? (
            <div className="text-[11px] text-jarvis-muted text-center py-12">No emails</div>
          ) : (
            filtered.map((email) => {
              const cat = CATEGORY_STYLE[email.category] || CATEGORY_STYLE.fyi;
              return (
                <motion.button
                  key={email.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  onClick={() => onSelectEmail(email)}
                  className="w-full text-left px-4 py-3 border-b border-jarvis-border/30 hover:bg-white/[0.03] transition group cursor-pointer"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {email.category === "urgent" ? (
                        <AlertTriangle size={12} className="text-red-400" />
                      ) : email.category === "action_needed" ? (
                        <Clock size={12} className="text-amber-400" />
                      ) : (
                        <Mail size={12} className="text-jarvis-muted group-hover:text-jarvis-body" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-medium text-jarvis-ink truncate">
                          {email.from_addr}
                        </span>
                        <span className="text-[8px] text-jarvis-muted tabular-nums shrink-0">
                          {timeSince(email.created_at)}
                        </span>
                      </div>
                      <div className="text-[10px] text-jarvis-body truncate">
                        {email.subject || "(no subject)"}
                      </div>
                      {email.snippet && (
                        <div className="text-[9px] text-jarvis-muted truncate mt-0.5">
                          {email.snippet}
                        </div>
                      )}
                    </div>
                    <span className={`shrink-0 text-[8px] px-2 py-0.5 rounded-full border font-medium ${cat.color}`}>
                      {cat.label}
                    </span>
                  </div>
                </motion.button>
              );
            })
          )
        ) : (
          /* ── Drafts / Outbound list ─────────────────────────────── */
          drafts.length === 0 ? (
            <div className="text-[11px] text-jarvis-muted text-center py-12">No drafts</div>
          ) : (
            drafts.map((draft) => {
              const st = DRAFT_STATUS_STYLE[draft.status] || DRAFT_STATUS_STYLE.draft;
              return (
                <div
                  key={draft.id}
                  className="w-full text-left px-4 py-3 border-b border-jarvis-border/30 hover:bg-white/[0.03] transition"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      {draft.status === "sent" ? (
                        <Send size={12} className="text-jarvis-primary" />
                      ) : (
                        <FileEdit size={12} className="text-jarvis-muted" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-medium text-jarvis-ink truncate">
                          To: {draft.to_addr}
                        </span>
                        <span className="text-[8px] text-jarvis-muted tabular-nums shrink-0">
                          {timeSince(draft.created_at)}
                        </span>
                      </div>
                      <div className="text-[10px] text-jarvis-body truncate">
                        {draft.subject || "(no subject)"}
                      </div>
                      <div className="text-[9px] text-jarvis-muted truncate mt-0.5">
                        {(draft.body_edited || draft.body_original || "").slice(0, 120)}
                      </div>
                    </div>
                    <span className={`shrink-0 text-[8px] px-2 py-0.5 rounded-full border font-medium ${st.color}`}>
                      {st.label}
                    </span>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>
    </div>
  );
}
