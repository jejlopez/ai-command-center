// Aggregates data from all Supabase sources for the display panel
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase.js";
import { jarvis } from "../lib/jarvis.js";

export function useJarvisData() {
  const [data, setData] = useState({});

  const refresh = useCallback(async () => {
    if (!supabase) return;

    try {
      const [
        deals,
        followUps,
        positions,
        watchlist,
        habits,
        expenses,
        proposals,
        decisions,
        mistakes,
        mentalModels,
      ] = await Promise.all([
        supabase.from("deals").select("*").not("stage", "in", '("closed_won","closed_lost")').order("value_usd", { ascending: false }),
        supabase.from("follow_ups").select("*, deals(company), contacts(name)").in("status", ["pending", "waiting"]).order("due_date"),
        supabase.from("positions").select("*").eq("status", "open").order("pnl_usd", { ascending: false }),
        supabase.from("watchlist").select("*").order("added_at", { ascending: false }),
        supabase.from("habits").select("*").eq("active", true),
        supabase.from("expenses").select("*").eq("active", true),
        supabase.from("proposals").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("decisions").select("*").eq("status", "pending").order("cost_per_day", { ascending: false }),
        supabase.from("mistake_journal").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("mental_models").select("*").order("times_used", { ascending: false }),
      ]);

      // Get intelligence tables
      const today = new Date().toISOString().slice(0, 10);
      const [todayIntel, moneyIntel] = await Promise.all([
        supabase.from("today_intelligence").select("*").eq("date", today).maybeSingle(),
        supabase.from("money_intelligence").select("*").eq("date", today).maybeSingle(),
      ]);

      // Calendar from jarvisd
      let calendar = [];
      try {
        const t = await jarvis.getToday();
        calendar = t?.items ?? [];
      } catch {
        // calendar unavailable — skip silently
      }

      setData({
        deals: deals.data ?? [],
        followUps: followUps.data ?? [],
        positions: positions.data ?? [],
        watchlist: watchlist.data ?? [],
        habits: habits.data ?? [],
        expenses: expenses.data ?? [],
        proposals: proposals.data ?? [],
        decisions: decisions.data ?? [],
        mistakes: mistakes.data ?? [],
        mentalModels: mentalModels.data ?? [],
        calendar,
        // From intelligence tables
        topFive: todayIntel.data?.top_five ?? [],
        wasteAlerts: todayIntel.data?.waste_alerts ?? [],
        velocity: moneyIntel.data?.velocity ?? {},
        leaks: moneyIntel.data?.leaks ?? [],
        scorecard: moneyIntel.data?.scorecard ?? {},
        nodeCount: 0,
      });
    } catch (e) {
      console.error("[useJarvisData] fetch failed:", e);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime: refresh on any key table change
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("jarvis-display-data")
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "positions" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "follow_ups" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "today_intelligence" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "money_intelligence" }, refresh)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [refresh]);

  return { data, refresh };
}
