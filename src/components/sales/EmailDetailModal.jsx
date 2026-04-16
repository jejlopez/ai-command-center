// EmailDetailModal — full email view with AI reply compose + approval send.
// Fetches the full body on-demand from Gmail via jarvisd.

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "../../lib/supabase.js";
import { jarvis } from "../../lib/jarvis.js";
import {
  X, Mail, User, Clock, Link2, Building, Send,
  Loader2, Sparkles, Check, AlertTriangle, ChevronDown,
} from "lucide-react";

const CATEGORY_STYLE = {
  urgent:        { label: "Urgent",   color: "text-red-400 bg-red-900/30 border-red-800/40" },
  action_needed: { label: "Action",   color: "text-amber-400 bg-amber-900/30 border-amber-800/40" },
  fyi:           { label: "FYI",      color: "text-blue-400 bg-blue-900/30 border-blue-800/40" },
  personal:      { label: "Personal", color: "text-purple-400 bg-purple-900/30 border-purple-800/40" },
  billing:       { label: "Billing",  color: "text-green-400 bg-green-900/30 border-green-800/40" },
  newsletter:    { label: "News",     color: "text-jarvis-muted bg-white/5 border-white/10" },
  junk:          { label: "Junk",     color: "text-jarvis-muted bg-white/5 border-white/10" },
};

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function parseSender(from) {
  if (!from) return { name: "Unknown", email: "" };
  const match = from.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: from, email: from };
}

export function EmailDetailModal({ triageEmail, onClose }) {
  // Full message state
  const [fullMsg, setFullMsg] = useState(null);
  const [loadingMsg, setLoadingMsg] = useState(true);
  const [msgError, setMsgError] = useState(null);

  // Linked deal/lead state
  const [linkedDeal, setLinkedDeal] = useState(null);
  const [linkedLead, setLinkedLead] = useState(null);

  // Reply compose state
  const [showReply, setShowReply] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [draftingReply, setDraftingReply] = useState(false);
  const [originalDraft, setOriginalDraft] = useState("");

  // Send state
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(null);

  // Fetch the full email body from Gmail on mount
  useEffect(() => {
    if (!triageEmail?.message_id) return;
    let cancelled = false;

    (async () => {
      setLoadingMsg(true);
      setMsgError(null);
      try {
        const msg = await jarvis.emailMessage(triageEmail.message_id);
        if (cancelled) return;
        setFullMsg(msg);
        setReplySubject(`Re: ${msg.subject || triageEmail.subject || ""}`);
      } catch (err) {
        if (!cancelled) setMsgError(err.message);
      }
      if (!cancelled) setLoadingMsg(false);
    })();

    return () => { cancelled = true; };
  }, [triageEmail?.message_id]);

  // Look up linked deal/lead by sender email
  useEffect(() => {
    if (!supabase || !triageEmail?.from_addr) return;
    const senderEmail = parseSender(triageEmail.from_addr).email;
    if (!senderEmail) return;

    (async () => {
      // Check contacts → leads → deals
      const { data: contacts } = await supabase
        .from("contacts")
        .select("id, name, company, email")
        .ilike("email", senderEmail)
        .limit(1);

      if (contacts?.length) {
        const contact = contacts[0];
        // Find leads linked to this contact
        const { data: leads } = await supabase
          .from("leads")
          .select("id, company, status, deal_id")
          .eq("contact_id", contact.id)
          .limit(1);

        if (leads?.length) {
          setLinkedLead(leads[0]);
          if (leads[0].deal_id) {
            const { data: deal } = await supabase
              .from("deals")
              .select("id, company, stage, value_usd")
              .eq("id", leads[0].deal_id)
              .single();
            if (deal) setLinkedDeal(deal);
          }
        }

        // Also check deals linked to this contact via contact_id
        if (!linkedDeal) {
          const { data: deals } = await supabase
            .from("deals")
            .select("id, company, stage, value_usd")
            .eq("contact_id", contact.id)
            .limit(1);
          if (deals?.length) setLinkedDeal(deals[0]);
        }
      }
    })();
  }, [triageEmail?.from_addr]);

  // Generate AI reply draft
  const generateReply = async () => {
    setDraftingReply(true);
    try {
      const dealId = linkedDeal?.id || null;
      const result = await jarvis.emailAiDraft(dealId, "reply", {
        originalSubject: fullMsg?.subject || triageEmail.subject,
        originalFrom: triageEmail.from_addr,
        originalSnippet: (fullMsg?.body || triageEmail.snippet || "").slice(0, 1000),
        threadId: fullMsg?.threadId || triageEmail.thread_id,
      });
      const draft = result?.draft || result;
      const body = draft?.body || draft?.text || "";
      setReplyBody(body);
      setOriginalDraft(body);
      if (draft?.subject) setReplySubject(draft.subject);
    } catch {
      // Fallback template
      const sender = parseSender(triageEmail.from_addr);
      setReplyBody(
        `Hi ${sender.name.split(" ")[0] || "there"},\n\nThank you for your email. \n\nBest regards`
      );
      setOriginalDraft("");
    }
    setDraftingReply(false);
    setShowReply(true);
  };

  // Send for approval (creates approval record, does NOT send directly)
  const sendForApproval = async () => {
    setSending(true);
    setSendError(null);
    try {
      if (!supabase) throw new Error("Supabase not configured");

      const sender = parseSender(triageEmail.from_addr);
      const draftContent = {
        to: sender.email,
        subject: replySubject,
        body: replyBody,
        threadId: fullMsg?.threadId || triageEmail.thread_id,
        inReplyTo: fullMsg?.id || triageEmail.message_id,
      };

      // If user edited the AI draft, log it for style learning
      if (originalDraft && replyBody !== originalDraft) {
        try {
          await jarvis.emailStyleLearn(
            originalDraft,
            replyBody,
            linkedDeal?.id || null,
            null,
            "reply"
          );
        } catch {
          // Non-critical — don't block send
        }
      }

      // Create approval record
      const { error: err } = await supabase.from("approvals").insert({
        lead_id: linkedLead?.id || null,
        deal_id: linkedDeal?.id || null,
        type: "email",
        status: "pending",
        draft_content: draftContent,
        source_agent: "jarvis_inbox_reply",
      });
      if (err) throw err;

      // Log activity
      await supabase.from("activities").insert({
        lead_id: linkedLead?.id || null,
        deal_id: linkedDeal?.id || null,
        type: "jarvis_action",
        subject: "Email reply drafted",
        body: `Reply to "${triageEmail.subject}" — waiting for approval`,
        source: "jarvis",
      });

      setSent(true);
    } catch (err) {
      setSendError(err.message);
    }
    setSending(false);
  };

  const sender = parseSender(triageEmail?.from_addr);
  const cat = CATEGORY_STYLE[triageEmail?.category] || CATEGORY_STYLE.fyi;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.97 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-2xl bg-jarvis-bg border border-jarvis-border rounded-xl shadow-2xl flex flex-col max-h-[90vh]"
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-jarvis-border">
          <div className="flex-1 min-w-0">
            {/* Subject */}
            <div className="flex items-center gap-2 mb-2">
              <Mail size={14} className="text-jarvis-primary shrink-0" />
              <h2 className="text-[13px] font-semibold text-jarvis-ink truncate">
                {fullMsg?.subject || triageEmail.subject || "(no subject)"}
              </h2>
              <span className={`shrink-0 text-[8px] px-2 py-0.5 rounded-full border font-medium ${cat.color}`}>
                {cat.label}
              </span>
            </div>

            {/* Sender + timestamp */}
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1.5">
                <User size={10} className="text-jarvis-muted" />
                <span className="text-jarvis-body font-medium">{sender.name}</span>
                {sender.email && (
                  <span className="text-jarvis-muted">&lt;{sender.email}&gt;</span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Clock size={10} className="text-jarvis-muted" />
                <span className="text-jarvis-muted">
                  {formatDate(fullMsg?.date || triageEmail.created_at)}
                </span>
              </div>
            </div>

            {/* Linked deal/lead */}
            {(linkedDeal || linkedLead) && (
              <div className="flex items-center gap-3 mt-2">
                {linkedDeal && (
                  <div className="flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded-full bg-jarvis-primary/10 border border-jarvis-primary/20">
                    <Link2 size={9} className="text-jarvis-primary" />
                    <span className="text-jarvis-primary font-medium">{linkedDeal.company}</span>
                    {linkedDeal.stage && (
                      <span className="text-jarvis-primary/60">— {linkedDeal.stage}</span>
                    )}
                    {linkedDeal.value_usd > 0 && (
                      <span className="text-jarvis-primary/60">
                        ${linkedDeal.value_usd >= 1000 ? `${(linkedDeal.value_usd / 1000).toFixed(0)}K` : linkedDeal.value_usd}
                      </span>
                    )}
                  </div>
                )}
                {linkedLead && !linkedDeal && (
                  <div className="flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded-full bg-blue-900/20 border border-blue-800/30">
                    <Building size={9} className="text-blue-400" />
                    <span className="text-blue-400 font-medium">{linkedLead.company}</span>
                    <span className="text-blue-400/60">— {linkedLead.status}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="shrink-0 ml-3 p-1.5 rounded hover:bg-white/5 transition text-jarvis-muted hover:text-jarvis-ink"
          >
            <X size={14} />
          </button>
        </div>

        {/* ── Body ──────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadingMsg ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <Loader2 size={14} className="animate-spin text-jarvis-muted" />
              <span className="text-[11px] text-jarvis-muted">Fetching email…</span>
            </div>
          ) : msgError ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <AlertTriangle size={14} className="text-jarvis-danger" />
              <span className="text-[11px] text-jarvis-danger">{msgError}</span>
            </div>
          ) : (
            <div className="text-[11px] text-jarvis-body whitespace-pre-wrap leading-relaxed">
              {fullMsg?.body || triageEmail.snippet || "No content available."}
            </div>
          )}
        </div>

        {/* ── Reply compose ─────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-jarvis-border px-5 py-3">
          {sent ? (
            <div className="flex items-center gap-2">
              <Check size={14} className="text-jarvis-success" />
              <span className="text-[11px] text-jarvis-success font-medium">
                Reply sent for approval — check Approvals to review and send
              </span>
            </div>
          ) : !showReply ? (
            <div className="flex items-center gap-2">
              <button
                onClick={generateReply}
                disabled={draftingReply || loadingMsg}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jarvis-primary/15 text-jarvis-primary text-[10px] font-semibold hover:bg-jarvis-primary/25 transition disabled:opacity-40"
              >
                {draftingReply ? (
                  <>
                    <Loader2 size={11} className="animate-spin" />
                    Drafting reply…
                  </>
                ) : (
                  <>
                    <Sparkles size={11} />
                    AI Reply
                  </>
                )}
              </button>
              <button
                onClick={() => {
                  setShowReply(true);
                  setReplyBody("");
                  setOriginalDraft("");
                }}
                disabled={loadingMsg}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-jarvis-muted text-[10px] font-medium hover:bg-white/8 hover:text-jarvis-ink transition disabled:opacity-40"
              >
                <Mail size={11} />
                Manual Reply
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Subject */}
              <div>
                <label className="text-[9px] text-jarvis-muted uppercase tracking-wider block mb-1">
                  Subject
                </label>
                <input
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-jarvis-ink outline-none focus:border-jarvis-primary/40 transition"
                />
              </div>

              {/* Body */}
              <div>
                <label className="text-[9px] text-jarvis-muted uppercase tracking-wider block mb-1">
                  Reply
                </label>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={6}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-jarvis-ink outline-none resize-none focus:border-jarvis-primary/40 transition leading-relaxed"
                  placeholder="Write your reply…"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setShowReply(false)}
                  className="text-[10px] text-jarvis-muted hover:text-jarvis-ink transition"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-2">
                  {!draftingReply && (
                    <button
                      onClick={generateReply}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-jarvis-muted text-[9px] hover:text-jarvis-ink hover:bg-white/8 transition"
                    >
                      <Sparkles size={10} />
                      Regenerate
                    </button>
                  )}

                  <button
                    onClick={sendForApproval}
                    disabled={sending || !replyBody.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jarvis-primary/15 text-jarvis-primary text-[10px] font-semibold hover:bg-jarvis-primary/25 transition disabled:opacity-40"
                  >
                    {sending ? (
                      <>
                        <Loader2 size={11} className="animate-spin" />
                        Sending…
                      </>
                    ) : (
                      <>
                        <Send size={11} />
                        Send for Approval
                      </>
                    )}
                  </button>
                </div>
              </div>

              {sendError && (
                <div className="text-[10px] text-jarvis-danger mt-1">{sendError}</div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
