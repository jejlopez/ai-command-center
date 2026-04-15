import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";

export function useApprovalsSupa({ leadId, dealId, statusFilter } = {}) {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef(null);
  const refreshRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    let query = supabase.from("approvals").select("*").order("created_at", { ascending: false }).limit(100);
    if (leadId) query = query.eq("lead_id", leadId);
    if (dealId) query = query.eq("deal_id", dealId);
    if (statusFilter) query = query.eq("status", statusFilter);

    const { data, error } = await query;
    if (!error) setApprovals(data || []);
    setLoading(false);
  }, [leadId, dealId, statusFilter]);

  refreshRef.current = refresh;

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime — unique channel name per hook instance to avoid collisions
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
    if (!supabase) return;
    const approval = approvals.find(a => a.id === id);

    await supabase.from("approvals").update({
      status,
      final_content: finalContent,
      user_edits: userEdits,
      user_comment: userComment,
      decided_at: new Date().toISOString(),
    }).eq("id", id);

    // Log to audit_log
    if (approval) {
      await supabase.from("audit_log").insert({
        actor: "user",
        action: "approval_decided",
        entity_type: approval.type,
        entity_id: id,
        before_state: { status: "pending", draft: approval.draft_content },
        after_state: { status, final: finalContent },
        reason: userComment,
      });

      // Create learning_event if edits were made
      if (userEdits && Object.keys(userEdits).length > 0) {
        await supabase.from("learning_events").insert({
          approval_id: id,
          lead_id: approval.lead_id,
          deal_id: approval.deal_id,
          event_type: status === "approved" ? "draft_edited" : "draft_rejected",
          ai_draft: approval.draft_content,
          final_version: finalContent,
          diff_summary: userEdits,
        });
      }
    }
    refresh();
  }, [refresh, approvals]);

  return { approvals, pending, loading, refresh, createApproval, decideApproval };
}
