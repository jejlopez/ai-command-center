// EmailDetailModal — full thread view with auto AI draft, send/edit/deny actions.
// Hybrid: list from jarvisd SQLite, full body on-demand from Gmail API.

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { supabase } from "../../lib/supabase.js";
import { jarvis } from "../../lib/jarvis.js";
import {
  X, Mail, User, Clock, Link2, Building, Send, Pencil,
  Loader2, Sparkles, Check, AlertTriangle, ThumbsDown,
} from "lucide-react";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch { return dateStr; }
}

function parseSender(from) {
  if (!from) return { name: "Unknown", email: "" };
  const match = from.match(/^"?([^"<]+)"?\s*<?([^>]*)>?$/);
  if (match) return { name: match[1].trim(), email: match[2].trim() };
  return { name: from, email: from };
}

// ── Single thread message bubble ─────────────────────────────────────────────

function isHtml(str) {
  return /<\/?[a-z][\s\S]*>/i.test(str || "");
}

function EmailBody({ body }) {
  if (!body) return <span className="text-jarvis-muted">(empty)</span>;

  if (isHtml(body)) {
    // Inject a base style tag into the existing HTML rather than wrapping it
    const resetCss = `<style>img{max-width:100%!important;height:auto!important;}table{max-width:100%!important;}</style>`;
    // Insert our reset right after <head> or at the start if no head tag
    let patched = body;
    if (/<head[^>]*>/i.test(patched)) {
      patched = patched.replace(/<head[^>]*>/i, (m) => m + resetCss);
    } else {
      patched = resetCss + patched;
    }

    return (
      <iframe
        srcDoc={patched}
        sandbox="allow-same-origin"
        scrolling="yes"
        referrerPolicy="no-referrer"
        className="w-full rounded"
        style={{ width: '100%', minHeight: '300px', border: 'none', backgroundColor: 'white', colorScheme: 'light' }}
        onLoad={(e) => {
          try {
            const doc = e.target.contentDocument;
            if (doc) {
              const h = doc.documentElement.scrollHeight;
              e.target.style.height = Math.min(h + 16, 600) + "px";
            }
          } catch {}
        }}
      />
    );
  }

  return (
    <div className="text-[10px] text-jarvis-body whitespace-pre-wrap leading-relaxed">
      {body}
    </div>
  );
}

function ThreadMessage({ msg, isLast }) {
  const sender = parseSender(msg.from);
  return (
    <div className={`${isLast ? "" : "border-b border-jarvis-border/30 pb-3 mb-3"}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-5 h-5 rounded-full bg-jarvis-primary/15 flex items-center justify-center shrink-0">
          <User size={10} className="text-jarvis-primary" />
        </div>
        <span className="text-[10px] font-medium text-jarvis-ink">{sender.name}</span>
        {sender.email && <span className="text-[9px] text-jarvis-muted">&lt;{sender.email}&gt;</span>}
        <span className="text-[8px] text-jarvis-muted ml-auto tabular-nums">{formatDate(msg.date)}</span>
      </div>
      <div className="pl-7">
        <EmailBody body={msg.body || msg.snippet} />
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function EmailDetailModal({ triageEmail, onClose }) {
  // Thread state
  const [threadMessages, setThreadMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(true);
  const [threadError, setThreadError] = useState(null);

  // Linked deal/lead
  const [linkedDeal, setLinkedDeal] = useState(null);
  const [linkedLead, setLinkedLead] = useState(null);

  // Auto-draft state
  const [replyBody, setReplyBody] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [draftingReply, setDraftingReply] = useState(true); // starts true — auto-draft on open
  const [originalDraft, setOriginalDraft] = useState("");
  const [editing, setEditing] = useState(false);

  // Send state
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sendError, setSendError] = useState(null);

  // Deny state
  const [denyMode, setDenyMode] = useState(false);
  const [denyReason, setDenyReason] = useState("");
  const [denied, setDenied] = useState(false);

  const threadEndRef = useRef(null);
  const threadId = triageEmail?.thread_id || null;
  const messageId = triageEmail?.message_id || null;

  // ── 1. Fetch full thread + mark as read ────────────────────────────────────

  useEffect(() => {
    if (!messageId) return;
    let cancelled = false;

    (async () => {
      setLoadingThread(true);
      setThreadError(null);
      try {
        let messages;
        if (threadId) {
          // Fetch full thread
          const res = await jarvis.emailThread(threadId);
          messages = res?.messages ?? [];
        }
        // Fallback to single message
        if (!messages || messages.length === 0) {
          const msg = await jarvis.emailMessage(messageId);
          messages = [msg];
        }
        if (cancelled) return;
        setThreadMessages(messages);
        const lastMsg = messages[messages.length - 1];
        setReplySubject(`Re: ${lastMsg?.subject || triageEmail.subject || ""}`);
      } catch (err) {
        if (!cancelled) setThreadError(err.message);
      }
      if (!cancelled) setLoadingThread(false);

      // Mark as read (fire-and-forget)
      try { await jarvis.emailMarkRead(messageId); } catch {}
    })();

    return () => { cancelled = true; };
  }, [messageId, threadId]);

  // ── 2. Auto-scroll to bottom of thread ─────────────────────────────────────

  useEffect(() => {
    if (threadMessages.length > 1 && threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [threadMessages]);

  // ── 3. Auto-generate AI draft when thread loads ────────────────────────────

  useEffect(() => {
    if (loadingThread || threadMessages.length === 0) return;
    let cancelled = false;

    (async () => {
      setDraftingReply(true);
      try {
        const lastMsg = threadMessages[threadMessages.length - 1];
        const dealId = linkedDeal?.id || null;
        const result = await jarvis.emailAiDraft(dealId, "reply", {
          originalSubject: lastMsg?.subject || triageEmail.subject,
          originalFrom: triageEmail.from_addr,
          originalSnippet: (lastMsg?.body || triageEmail.snippet || "").slice(0, 1000),
          threadId: threadId,
        });
        if (cancelled) return;
        const draft = result?.draft || result;
        const body = draft?.body || draft?.text || "";
        setReplyBody(body);
        setOriginalDraft(body);
        if (draft?.subject) setReplySubject(draft.subject);
      } catch {
        if (cancelled) return;
        // Fallback
        const sender = parseSender(triageEmail.from_addr);
        const fallback = `Hi ${sender.name.split(" ")[0] || "there"},\n\nThank you for your email.\n\nBest regards`;
        setReplyBody(fallback);
        setOriginalDraft("");
      }
      if (!cancelled) setDraftingReply(false);
    })();

    return () => { cancelled = true; };
  }, [loadingThread, threadMessages.length]);

  // ── 4. Look up linked deal/lead by sender email ────────────────────────────

  useEffect(() => {
    if (!supabase || !triageEmail?.from_addr) return;
    const senderEmail = parseSender(triageEmail.from_addr).email;
    if (!senderEmail) return;

    (async () => {
      const { data: contacts } = await supabase
        .from("contacts").select("id, name, company, email")
        .ilike("email", senderEmail).limit(1);

      if (!contacts?.length) return;
      const contact = contacts[0];

      const { data: leads } = await supabase
        .from("leads").select("id, company, status, deal_id")
        .eq("contact_id", contact.id).limit(1);

      if (leads?.length) {
        setLinkedLead(leads[0]);
        if (leads[0].deal_id) {
          const { data: deal } = await supabase
            .from("deals").select("id, company, stage, value_usd")
            .eq("id", leads[0].deal_id).single();
          if (deal) setLinkedDeal(deal);
          return;
        }
      }

      const { data: deals } = await supabase
        .from("deals").select("id, company, stage, value_usd")
        .eq("contact_id", contact.id).limit(1);
      if (deals?.length) setLinkedDeal(deals[0]);
    })();
  }, [triageEmail?.from_addr]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const senderEmail = parseSender(triageEmail?.from_addr).email;

  // Style learn helper
  const learnStyle = async () => {
    if (originalDraft && replyBody !== originalDraft) {
      try {
        await jarvis.emailStyleLearn(originalDraft, replyBody, linkedDeal?.id || null, null, "reply");
      } catch {}
    }
  };

  // Send Now — create draft + send via Gmail immediately
  const handleSendNow = async () => {
    if (!replyBody.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await learnStyle();
      await jarvis.emailSendNow(senderEmail, replySubject, replyBody, threadId);

      // Log activity
      if (supabase) {
        await supabase.from("activities").insert({
          lead_id: linkedLead?.id || null,
          deal_id: linkedDeal?.id || null,
          type: "email",
          subject: `Sent: ${replySubject}`,
          body: replyBody.slice(0, 500),
          source: "jarvis",
        });
      }
      setSent(true);
    } catch (err) {
      setSendError(err.message);
    }
    setSending(false);
  };

  // Deny — save critique to learning_events
  const handleDeny = async () => {
    if (!denyReason.trim()) return;
    setSending(true);
    try {
      if (supabase) {
        await supabase.from("learning_events").insert({
          deal_id: linkedDeal?.id || null,
          lead_id: linkedLead?.id || null,
          event_type: "draft_rejected",
          ai_draft: { subject: replySubject, body: originalDraft },
          diff_summary: {
            critique: denyReason.trim(),
            context_type: "email",
            original_from: triageEmail.from_addr,
            original_subject: triageEmail.subject,
          },
        });
      }
      setDenied(true);
    } catch {}
    setSending(false);
  };

  // Regenerate
  const regenerate = async () => {
    setDraftingReply(true);
    try {
      const lastMsg = threadMessages[threadMessages.length - 1];
      const result = await jarvis.emailAiDraft(linkedDeal?.id || null, "reply", {
        originalSubject: lastMsg?.subject || triageEmail.subject,
        originalFrom: triageEmail.from_addr,
        originalSnippet: (lastMsg?.body || triageEmail.snippet || "").slice(0, 1000),
        threadId: threadId,
      });
      const draft = result?.draft || result;
      const body = draft?.body || draft?.text || "";
      setReplyBody(body);
      setOriginalDraft(body);
      setEditing(false);
    } catch {}
    setDraftingReply(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const sender = parseSender(triageEmail?.from_addr);

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
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-start justify-between px-5 py-4 border-b border-jarvis-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <Mail size={14} className="text-jarvis-primary shrink-0" />
              <h2 className="text-[13px] font-semibold text-jarvis-ink truncate">
                {triageEmail.subject || "(no subject)"}
              </h2>
              {threadMessages.length > 1 && (
                <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/10 text-jarvis-muted font-medium tabular-nums">
                  {threadMessages.length} messages
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1.5">
                <User size={10} className="text-jarvis-muted" />
                <span className="text-jarvis-body font-medium">{sender.name}</span>
                {sender.email && <span className="text-jarvis-muted">&lt;{sender.email}&gt;</span>}
              </div>
              <div className="flex items-center gap-1">
                <Clock size={10} className="text-jarvis-muted" />
                <span className="text-jarvis-muted">{formatDate(triageEmail.created_at)}</span>
              </div>
            </div>

            {/* Linked deal/lead */}
            {(linkedDeal || linkedLead) && (
              <div className="flex items-center gap-3 mt-2">
                {linkedDeal && (
                  <div className="flex items-center gap-1.5 text-[9px] px-2 py-0.5 rounded-full bg-jarvis-primary/10 border border-jarvis-primary/20">
                    <Link2 size={9} className="text-jarvis-primary" />
                    <span className="text-jarvis-primary font-medium">{linkedDeal.company}</span>
                    {linkedDeal.stage && <span className="text-jarvis-primary/60">— {linkedDeal.stage}</span>}
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

          <button onClick={onClose} className="shrink-0 ml-3 p-1.5 rounded hover:bg-white/5 transition text-jarvis-muted hover:text-jarvis-ink">
            <X size={14} />
          </button>
        </div>

        {/* ── Thread body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loadingThread ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <Loader2 size={14} className="animate-spin text-jarvis-muted" />
              <span className="text-[11px] text-jarvis-muted">Fetching thread…</span>
            </div>
          ) : threadError ? (
            <div className="flex items-center gap-2 py-8 justify-center">
              <AlertTriangle size={14} className="text-jarvis-danger" />
              <span className="text-[11px] text-jarvis-danger">{threadError}</span>
            </div>
          ) : threadMessages.length === 0 ? (
            <div className="text-[11px] text-jarvis-muted text-center py-8">
              {triageEmail.snippet || "No content available."}
            </div>
          ) : (
            <>
              {threadMessages.map((msg, i) => (
                <ThreadMessage key={msg.id} msg={msg} isLast={i === threadMessages.length - 1} />
              ))}
              <div ref={threadEndRef} />
            </>
          )}
        </div>

        {/* ── Reply section ───────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-jarvis-border px-5 py-3">
          {sent ? (
            <div className="flex items-center gap-2">
              <Check size={14} className="text-jarvis-success" />
              <span className="text-[11px] text-jarvis-success font-medium">Sent successfully</span>
            </div>
          ) : denied ? (
            <div className="flex items-center gap-2">
              <Check size={14} className="text-jarvis-primary" />
              <span className="text-[11px] text-jarvis-primary font-medium">Got it, I'll learn from this</span>
            </div>
          ) : denyMode ? (
            /* ── Deny reason input ──────────────────────────────────── */
            <div className="space-y-2">
              <label className="text-[9px] text-jarvis-muted uppercase tracking-wider block">Why are you denying this draft?</label>
              <textarea
                autoFocus
                value={denyReason}
                onChange={(e) => setDenyReason(e.target.value)}
                placeholder="Too aggressive, wrong tone, inaccurate info…"
                rows={2}
                className="w-full bg-white/5 border border-red-800/40 rounded-lg px-2.5 py-1.5 text-[10px] text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-red-600/60 resize-none"
              />
              <div className="flex items-center justify-end gap-2">
                <button onClick={() => { setDenyMode(false); setDenyReason(""); }} className="text-[10px] text-jarvis-muted hover:text-jarvis-ink transition">
                  Back
                </button>
                <button
                  onClick={handleDeny}
                  disabled={!denyReason.trim() || sending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium bg-red-900/40 text-red-400 hover:bg-red-900/60 border border-red-800/50 transition disabled:opacity-40"
                >
                  Deny & Teach
                </button>
              </div>
            </div>
          ) : draftingReply ? (
            /* ── Loading draft ──────────────────────────────────────── */
            <div className="flex items-center gap-2 py-1">
              <Loader2 size={12} className="animate-spin text-jarvis-primary" />
              <span className="text-[10px] text-jarvis-muted">Jarvis is drafting a reply…</span>
            </div>
          ) : editing ? (
            /* ── Edit mode ──────────────────────────────────────────── */
            <div className="space-y-2">
              <div>
                <label className="text-[9px] text-jarvis-muted uppercase tracking-wider block mb-1">Subject</label>
                <input
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-jarvis-ink outline-none focus:border-jarvis-primary/40 transition"
                />
              </div>
              <div>
                <label className="text-[9px] text-jarvis-muted uppercase tracking-wider block mb-1">Reply</label>
                <textarea
                  autoFocus
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  rows={6}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] text-jarvis-ink outline-none resize-none focus:border-jarvis-primary/40 transition leading-relaxed"
                />
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => setEditing(false)} className="text-[10px] text-jarvis-muted hover:text-jarvis-ink transition">
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={regenerate} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 text-jarvis-muted text-[9px] hover:text-jarvis-ink hover:bg-white/8 transition">
                    <Sparkles size={10} /> Regenerate
                  </button>
                  <button
                    onClick={handleSendNow}
                    disabled={sending || !replyBody.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jarvis-primary/15 text-jarvis-primary text-[10px] font-semibold hover:bg-jarvis-primary/25 transition disabled:opacity-40"
                  >
                    {sending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                    {sending ? "Sending…" : "Send Now"}
                  </button>
                </div>
              </div>
              {sendError && <div className="text-[10px] text-jarvis-danger">{sendError}</div>}
            </div>
          ) : (
            /* ── Draft preview + action buttons ─────────────────────── */
            <div className="space-y-2">
              {/* Draft preview */}
              <div className="rounded-lg bg-white/[0.03] border border-jarvis-border/50 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles size={10} className="text-jarvis-primary" />
                  <span className="text-[9px] text-jarvis-primary uppercase tracking-wider font-semibold">AI Draft Reply</span>
                </div>
                <div className="text-[10px] text-jarvis-body whitespace-pre-wrap leading-relaxed max-h-[120px] overflow-y-auto">
                  {replyBody || "(no draft)"}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSendNow}
                  disabled={sending || !replyBody.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-900/40 text-green-400 hover:bg-green-900/60 border border-green-800/50 text-[10px] font-medium transition disabled:opacity-40"
                >
                  {sending ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                  Send Now
                </button>

                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jarvis-primary/15 text-jarvis-primary text-[10px] font-medium hover:bg-jarvis-primary/25 transition"
                >
                  <Pencil size={11} />
                  Edit & Send
                </button>

                <button
                  onClick={() => setDenyMode(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-800/40 text-[10px] font-medium transition"
                >
                  <ThumbsDown size={11} />
                  Deny
                </button>

                <button
                  onClick={regenerate}
                  disabled={draftingReply}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 text-jarvis-muted text-[9px] hover:text-jarvis-ink hover:bg-white/8 transition ml-auto disabled:opacity-40"
                >
                  <Sparkles size={10} />
                  Regenerate
                </button>
              </div>
              {sendError && <div className="text-[10px] text-jarvis-danger">{sendError}</div>}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
