import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function useTodaySupa() {
  const [data, setData] = useState({
    intelligence: null,
    loading: true,
    error: null,
  });
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setData({ intelligence: null, loading: false, error: "Supabase not configured" });
      return;
    }
    try {
      const { data: row, error } = await supabase
        .from("today_intelligence")
        .select("*")
        .eq("date", todayIso())
        .maybeSingle();

      if (error) throw error;

      setData({ intelligence: row, loading: false, error: null });
    } catch (e) {
      setData({ intelligence: null, loading: false, error: e.message });
    }
  }, []);

  useEffect(() => {
    refresh();

    if (supabase) {
      const channel = supabase
        .channel("today-intel")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "today_intelligence" },
          () => refresh()
        )
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
