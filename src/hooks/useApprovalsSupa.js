import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { jarvis } from "../lib/jarvis.js";

// Normalize jarvisd local approval → Supabase-like shape
function normalizeJarvisApproval(a) {
  return {
    id: a.id,
    type: a.payload?.type || "deal_value_estimate",
    status: "pending",
    draft_content: a.payload || {},
    source_agent: a.skill,
    created_at: a.requestedAt,
    lead_id: a.payload?.lead_id || null,
    deal_id: a.payload?.deal_id || null,
    user_comment: null,
    // Extra fields for display
    title: a.title,
    reason: a.reason,
    _source: "jarvisd", // track origin for routing decisions
  };
}

export function useApprovalsSupa({ leadId, dealId, statusFilter } = {}) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);
  const refreshRef = useRef(null);

  const refresh = useCallback(async () => {
    const results = [];

    // 1. Fetch from Supabase (if authenticated)
    if (supabase) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          let query = supabase.from("approvals").select("*").order("created_at", { ascending: false }).limit(100);
          if (leadId) query = query.eq("lead_id", leadId);
          if (dealId) query = query.eq("deal_id", dealId);
          if (statusFilter) query = query.eq("status", statusFilter);

          const { data } = await query;
          if (data) {
            for (const a of data) {
              results.push({ ...a, _source: "supabase" });
            }
          }
        }
      } catch {}
    }

    // 2. Fetch from jarvisd local approvals
    try {
      const jarvisApprovals = await jarvis.approvals?.() || [];
      if (Array.isArray(jarvisApprovals)) {
        for (const a of jarvisApprovals) {
          // Skip if already in Supabase (dedup by title+time)
          const isDupe = results.some(r =>
            r.draft_content?.estimated_value === a.payload?.estimated_value &&
            r.draft_content?.company === a.payload?.company
          );
          if (!isDupe) {
            const normalized = normalizeJarvisApproval(a);
            // Apply filters
            if (dealId && normalized.deal_id !== dealId) continue;
            if (leadId && normalized.lead_id !== leadId) continue;
            if (statusFilter && normalized.status !== statusFilter) continue;
            results.push(normalized);
          }
        }
      }
    } catch {}

    // 3. Sort: pending first, then by deal value (highest first), then by date
    results.sort((a, b) => {
      // Pending before decided
      if (a.status === "pending" && b.status !== "pending") return -1;
      if (a.status !== "pending" && b.status === "pending") return 1;
      // Within pending: sort by estimated value descending
      const valA = a.draft_content?.estimated_value || 0;
      const valB = b.draft_content?.estimated_value || 0;
      if (valA !== valB) return valB - valA;
      // Then by date
      return new Date(b.created_at) - new Date(a.created_at);
    });

    setApprovals(results);
    setLoading(false);
  }, [leadId, dealId, statusFilter]);

  refreshRef.current = refresh;

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime from Supabase
  useEffect(() => {
    if (!supabase) return;
    const id = Math.random().toString(36).slice(2, 8);
    const channel = supabase.channel(`approvals_${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "approvals" }, () => {
        refreshRef.current?.();
      })
      .subscribe();
    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, []);

  const pending = approvals.filter(a => a.status === "pending");

  const createApproval = useCallback(async (fields) => {
    if (!supabase) return null;
    const { data, error } = await supabase.from("approvals").insert(fields).select().single();
    if (error) throw error;
    refresh();
    return data;
  }, [refresh]);

  const decideApproval = useCallback(async (id, { status, finalContent, userEdits, userComment }) => {
    const approval = approvals.find(a => a.id === id);
    if (!approval) return;

    if (approval._source === "jarvisd") {
      // Route to jarvisd's /approvals/:id/decide
      try {
        const decision = status === "approved" ? "approve" : "deny";
        await fetch(`http://127.0.0.1:8787/approvals/${id}/decide`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, reason: userComment || "" }),
        });

        // If approved deal_value_estimate, update the deal in jarvisd SQLite
        if (status === "approved" && approval.draft_content?.deal_id) {
          const value = finalContent?.estimated_value ?? approval.draft_content?.estimated_value;
          if (value) {
            // Also try Supabase update (may fail due to RLS)
            if (supabase) {
              await supabase.from("deals").update({
                value_usd: Number(value),
                updated_at: new Date().toISOString(),
              }).eq("id", approval.draft_content.deal_id).catch(() => {});
            }
          }
        }
      } catch (err) {
        console.warn("jarvisd decide failed:", err);
      }
    } else {
      // Route to Supabase
      if (supabase) {
        await supabase.from("approvals").update({
          status,
          final_content: finalContent,
          user_edits: userEdits,
          user_comment: userComment,
          decided_at: new Date().toISOString(),
        }).eq("id", id);

        // Log to audit_log
        await supabase.from("audit_log").insert({
          actor: "user",
          action: "approval_decided",
          entity_type: approval.type,
          entity_id: id,
          before_state: { status: "pending", draft: approval.draft_content },
          after_state: { status, final: finalContent },
          reason: userComment,
        });

        // If approved deal_value_estimate, write value to deal
        if (status === "approved" && approval.type === "deal_value_estimate" && approval.deal_id) {
          const value = finalContent?.estimated_value ?? approval.draft_content?.estimated_value;
          if (value) {
            await supabase.from("deals").update({
              value_usd: Number(value),
              updated_at: new Date().toISOString(),
            }).eq("id", approval.deal_id);
          }
        }

        // Create learning_event for edits or rejections
        const hasEdits = userEdits && Object.keys(userEdits).length > 0;
        if (hasEdits || status === "rejected") {
          await supabase.from("learning_events").insert({
            approval_id: id,
            lead_id: approval.lead_id,
            deal_id: approval.deal_id,
            event_type: status === "approved" ? "draft_edited" : "draft_rejected",
            ai_draft: approval.draft_content,
            final_version: finalContent || null,
            diff_summary: hasEdits
              ? userEdits
              : { critique: userComment, context_type: approval.type },
          });
        }
      }
    }

    refresh();
  }, [refresh, approvals]);

  return { approvals, pending, loading, refresh, createApproval, decideApproval };
}
