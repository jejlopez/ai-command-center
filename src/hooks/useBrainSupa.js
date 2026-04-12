import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase.js";

const EMPTY = { decisions: [], models: [], readings: [], mistakes: [], loading: true, error: null };

export function useBrainSupa() {
  const [data, setData] = useState(EMPTY);
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setData({ ...EMPTY, loading: false, error: "Supabase not configured" });
      return;
    }
    try {
      const [
        { data: decisions, error: e1 },
        { data: models, error: e2 },
        { data: readings, error: e3 },
        { data: mistakes, error: e4 },
      ] = await Promise.all([
        supabase.from("decision_journal").select("*").order("decided_at", { ascending: false }),
        supabase.from("mental_models").select("*").order("times_used", { ascending: false }),
        supabase.from("reading_log").select("*").order("created_at", { ascending: false }),
        supabase.from("mistake_journal").select("*").order("occurred_at", { ascending: false }),
      ]);
      const err = e1 || e2 || e3 || e4;
      if (err) throw err;
      setData({
        decisions: decisions ?? [],
        models: models ?? [],
        readings: readings ?? [],
        mistakes: mistakes ?? [],
        loading: false,
        error: null,
      });
    } catch (e) {
      setData({ ...EMPTY, loading: false, error: e?.message ?? "Unknown error" });
    }
  }, []);

  useEffect(() => {
    refresh();
    if (supabase) {
      const channel = supabase
        .channel("brain-supa")
        .on("postgres_changes", { event: "*", schema: "public", table: "decision_journal" }, () => refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "mental_models" }, () => refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "reading_log" }, () => refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "mistake_journal" }, () => refresh())
        .subscribe();
      channelRef.current = channel;
    }
    return () => {
      if (channelRef.current) {
        supabase?.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [refresh]);

  const addDecision = useCallback(async (row) => {
    if (!supabase) return;
    await supabase.from("decision_journal").insert(row);
    await refresh();
  }, [refresh]);

  const reviewDecision = useCallback(async (id, outcome, lesson) => {
    if (!supabase) return;
    await supabase.from("decision_journal").update({ outcome, lesson, reviewed_at: new Date().toISOString() }).eq("id", id);
    await refresh();
  }, [refresh]);

  const addModel = useCallback(async (row) => {
    if (!supabase) return;
    await supabase.from("mental_models").insert(row);
    await refresh();
  }, [refresh]);

  const bumpModel = useCallback(async (id) => {
    if (!supabase) return;
    const { data: row } = await supabase.from("mental_models").select("times_used").eq("id", id).single();
    await supabase.from("mental_models").update({ times_used: (row?.times_used ?? 0) + 1 }).eq("id", id);
    await refresh();
  }, [refresh]);

  const addReading = useCallback(async (row) => {
    if (!supabase) return;
    await supabase.from("reading_log").insert(row);
    await refresh();
  }, [refresh]);

  const addMistake = useCallback(async (row) => {
    if (!supabase) return;
    await supabase.from("mistake_journal").insert(row);
    await refresh();
  }, [refresh]);

  const togglePrevented = useCallback(async (id, current) => {
    if (!supabase) return;
    await supabase.from("mistake_journal").update({ prevented_next: !current }).eq("id", id);
    await refresh();
  }, [refresh]);

  return {
    ...data,
    refresh,
    addDecision,
    reviewDecision,
    addModel,
    bumpModel,
    addReading,
    addMistake,
    togglePrevented,
  };
}
