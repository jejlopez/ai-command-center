import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export function useTodaySupa() {
  const [data, setData] = useState({
    intelligence: null,
    decisions: [],
    timeBlocksActual: [],
    compoundImprovements: [],
    notToDo: [],
    loading: true,
    error: null,
  });
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setData((d) => ({ ...d, loading: false, error: "Supabase not configured" }));
      return;
    }
    try {
      const today = todayIso();
      const weekAgo = sevenDaysAgo();

      const [intelRes, decisionsRes, timeRes, compoundRes, ntdRes] = await Promise.all([
        supabase.from("today_intelligence").select("*").eq("date", today).maybeSingle(),
        supabase.from("decisions").select("*").eq("status", "pending").order("cost_per_day", { ascending: false }),
        supabase.from("time_blocks_actual").select("*").eq("date", today).order("created_at"),
        supabase.from("compound_tracker").select("*").gte("date", weekAgo).order("date", { ascending: false }),
        supabase.from("not_to_do").select("*").eq("active", true).order("added_at", { ascending: false }),
      ]);

      if (intelRes.error) throw intelRes.error;

      setData({
        intelligence: intelRes.data,
        decisions: decisionsRes.data ?? [],
        timeBlocksActual: timeRes.data ?? [],
        compoundImprovements: compoundRes.data ?? [],
        notToDo: ntdRes.data ?? [],
        loading: false,
        error: null,
      });
    } catch (e) {
      setData((d) => ({ ...d, loading: false, error: e.message }));
    }
  }, []);

  useEffect(() => {
    refresh();

    if (supabase) {
      const channel = supabase
        .channel("today-intel")
        .on("postgres_changes", { event: "*", schema: "public", table: "today_intelligence" }, () => refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "decisions" }, () => refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "compound_tracker" }, () => refresh())
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

  const recompute = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      await fetch(`${supabaseUrl}/functions/v1/today-compute?mode=manual`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      await refresh();
    } catch (e) {
      console.error("[useTodaySupa] recompute failed:", e);
    }
  }, [refresh]);

  return { ...data, refresh, recompute };
}
