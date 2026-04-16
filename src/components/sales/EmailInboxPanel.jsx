// EmailInboxPanel — email triage list from jarvisd, opens detail modal on click.

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Mail, AlertTriangle, Clock, Eye, Trash2, RefreshCw, Loader2 } from "lucide-react";
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
  const [emails, setEmails] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jarvis.emailTriage(100);
      setEmails(Array.isArray(data) ? data : []);
    } catch {
      setEmails([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = filter === "all"
    ? emails.filter(e => e.category !== "junk" && e.category !== "newsletter")
    : emails.filter(e => e.category === filter);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-jarvis-border">
        <div className="flex items-center gap-2">
          <Mail size={14} className="text-jarvis-primary" />
          <span className="text-[11px] font-semibold text-jarvis-ink">Inbox</span>
          <span className="text-[9px] text-jarvis-muted tabular-nums">{filtered.length}</span>
        </div>
        <button
          onClick={refresh}
          className="p-1.5 rounded hover:bg-white/5 transition text-jarvis-muted hover:text-jarvis-ink"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filter bar */}
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

      {/* Email list */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={16} className="animate-spin text-jarvis-muted" />
          </div>
        ) : filtered.length === 0 ? (
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
                  {/* Category indicator */}
                  <div className="mt-0.5 shrink-0">
                    {email.category === "urgent" ? (
                      <AlertTriangle size={12} className="text-red-400" />
                    ) : email.category === "action_needed" ? (
                      <Clock size={12} className="text-amber-400" />
                    ) : (
                      <Mail size={12} className="text-jarvis-muted group-hover:text-jarvis-body" />
                    )}
                  </div>

                  {/* Content */}
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

                  {/* Category chip */}
                  <span className={`shrink-0 text-[8px] px-2 py-0.5 rounded-full border font-medium ${cat.color}`}>
                    {cat.label}
                  </span>
                </div>
              </motion.button>
            );
          })
        )}
      </div>
    </div>
  );
}
