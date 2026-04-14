import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function useMoneySupa() {
  const [data, setData] = useState({ intelligence: null, toolRoi: [], timeBlocks: [], loading: true, error: null });
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setData({ intelligence: null, toolRoi: [], timeBlocks: [], loading: false, error: "Supabase not configured" });
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setData((d) => ({ ...d, loading: false, error: "Not logged in" }));
      return;
    }
    try {
      const [{ data: row, error }, { data: toolRoi }, { data: timeBlocks }] = await Promise.all([
        supabase.from("money_intelligence").select("*").eq("date", todayIso()).maybeSingle(),
        supabase.from("tool_roi").select("*").order("monthly_cost", { ascending: false }),
        supabase.from("time_blocks_actual").select("*").gte("date", new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)),
      ]);
      if (error) throw error;
      setData({ intelligence: row, toolRoi: toolRoi ?? [], timeBlocks: timeBlocks ?? [], loading: false, error: null });
    } catch (e) {
      setData({ intelligence: null, toolRoi: [], timeBlocks: [], loading: false, error: e.message });
    }
  }, []);

  useEffect(() => {
    refresh();
    if (supabase) {
      const channel = supabase
        .channel("money-intel")
        .on("postgres_changes", { event: "*", schema: "public", table: "money_intelligence" }, () => refresh())
        .on("postgres_changes", { event: "*", schema: "public", table: "tool_roi" }, () => refresh())
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
        headers: { "Authorization": `Bearer ${anonKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      await refresh();
    } catch (e) {
      console.error("[useMoneySupa] recompute failed:", e);
    }
  }, [refresh]);

  return { ...data, refresh, recompute, toolRoi: data.toolRoi, timeBlocks: data.timeBlocks };
}
