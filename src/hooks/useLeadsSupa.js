// Leads hook — CRUD, realtime, scoring integration.

import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { leadScore } from "../lib/leadScore.js";

const EMPTY = { leads: [], loading: true, error: null };

export function useLeadsSupa() {
  const [data, setData] = useState(EMPTY);
  const channelRef = useRef(null);
  const refreshRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setData({ leads: [], loading: false, error: "Supabase not configured" });
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setData(d => ({ ...d, loading: false, error: "Not logged in" }));
      return;
    }
    try {
      const { data: leads, error } = await supabase
        .from("leads")
        .select("*, contacts(*)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Compute scores client-side
      const scored = (leads || []).map(lead => {
        const { score, whale, quality, breakdown } = leadScore(lead);
        return { ...lead, lead_score: score, whale_score: whale, quality, _breakdown: breakdown };
      });

      // Sort by NBA priority (hot whales first, stale weak last)
      scored.sort((a, b) => {
        const aPri = (a.attention === "hot" ? 0 : a.attention === "warm" ? 1 : 2);
        const bPri = (b.attention === "hot" ? 0 : b.attention === "warm" ? 1 : 2);
        if (aPri !== bPri) return aPri - bPri;
        return (b.lead_score || 0) - (a.lead_score || 0);
      });

      setData({ leads: scored, loading: false, error: null });
    } catch (e) {
      setData(d => ({ ...d, loading: false, error: e.message }));
    }
  }, []);

  // Keep ref in sync so realtime callback always calls latest refresh
  refreshRef.current = refresh;

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime — unique channel name per hook instance to avoid collisions
  useEffect(() => {
    if (!supabase) return;
    const id = Math.random().toString(36).slice(2, 8);
    const channel = supabase
      .channel(`leads_${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => {
        refreshRef.current?.();
      })
      .subscribe();
    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, []);

  const createLead = useCallback(async (fields) => {
    if (!supabase) return null;
    const { data: lead, error } = await supabase.from("leads").insert(fields).select().single();
    if (error) throw error;
    refresh();
    return lead;
  }, [refresh]);

  const updateLead = useCallback(async (id, fields) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("leads")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    refresh();
  }, [refresh]);

  const deleteLead = useCallback(async (id) => {
    if (!supabase) return;
    await supabase.from("leads").delete().eq("id", id);
    refresh();
  }, [refresh]);

  return { ...data, refresh, createLead, updateLead, deleteLead };
}
