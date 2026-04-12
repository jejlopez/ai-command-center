import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function useTodaySupa() {
  const [data, setData] = useState({
    deals: [],
    followUps: [],
    positions: [],
    habits: [],
    expenses: [],
    tradeJournal: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!supabase) {
      setData((d) => ({ ...d, loading: false, error: "Supabase not configured" }));
      return;
    }
    try {
      const today = todayIso();
      const [dealsRes, fuRes, posRes, habitsRes, expRes, tjRes] = await Promise.all([
        supabase.from("deals").select("*").not("stage", "in", '("closed_won","closed_lost")').order("value_usd", { ascending: false }),
        supabase.from("follow_ups").select("*, deals(company), contacts(name)").in("status", ["pending", "waiting"]).order("due_date"),
        supabase.from("positions").select("*").eq("status", "open").order("pnl_usd", { ascending: false }),
        supabase.from("habits").select("*").eq("active", true).order("name"),
        supabase.from("expenses").select("*").eq("active", true).lte("next_due", new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)).order("next_due"),
        supabase.from("trade_journal").select("*").eq("date", today).maybeSingle(),
      ]);

      setData({
        deals: dealsRes.data ?? [],
        followUps: fuRes.data ?? [],
        positions: posRes.data ?? [],
        habits: habitsRes.data ?? [],
        expenses: expRes.data ?? [],
        tradeJournal: tjRes.data,
        loading: false,
        error: null,
      });
    } catch (e) {
      setData((d) => ({ ...d, loading: false, error: e.message }));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { ...data, refresh };
}
