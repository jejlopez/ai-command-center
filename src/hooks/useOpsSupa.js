import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

const EMPTY = {
  deals:        [],
  followUps:    [],
  proposals:    [],
  comms:        [],
  docs:         [],
  positions:    [],
  watchlist:    [],
  tradeJournal: [],
  projects:     [],
  ships:        [],
  tasks:        [],
  calendarEvents: [],
  intelligence: null,
  loading: true,
  error: null,
};

export function useOpsSupa() {
  const [data, setData] = useState(EMPTY);
  const channelsRef = useRef([]);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setData({ ...EMPTY, loading: false, error: "Supabase not configured" });
      return;
    }
    try {
      const today = todayIso();

      // Fetch all tables in parallel
      const [
        { data: deals },
        { data: followUps },
        { data: proposals },
        { data: comms },
        { data: docs },
        { data: positions },
        { data: watchlist },
        { data: tradeJournal },
        { data: projects },
        { data: ships },
        { data: workIntel },
      ] = await Promise.all([
        supabase.from("deals").select("*").order("updated_at", { ascending: false }).limit(50),
        supabase.from("follow_ups").select("*").order("due_date", { ascending: true }).limit(20),
        supabase.from("proposals").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("communications").select("*").order("occurred_at", { ascending: false }).limit(20),
        supabase.from("documents").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("positions").select("*").order("created_at", { ascending: false }).limit(30),
        supabase.from("watchlist").select("*").order("created_at", { ascending: false }).limit(20),
        supabase.from("trade_journal").select("*").eq("date", today).order("created_at", { ascending: false }).limit(10),
        supabase.from("projects").select("*").order("updated_at", { ascending: false }).limit(20),
        supabase.from("ship_log").select("*").order("shipped_at", { ascending: false }).limit(30),
        supabase.from("work_intelligence").select("*").eq("date", today).maybeSingle(),
      ]);

      // Fetch jarvisd tasks for build mode (memory nodes kind=task)
      let tasks = [];
      try {
        const resp = await fetch("http://localhost:9999/memory?kind=task&limit=20");
        if (resp.ok) {
          const json = await resp.json();
          tasks = json.nodes ?? json ?? [];
        }
      } catch {
        // jarvisd not running — graceful
      }

      // Fetch calendar events from jarvisd
      let calendarEvents = [];
      try {
        const resp = await fetch("http://localhost:9999/today");
        if (resp.ok) {
          const json = await resp.json();
          calendarEvents = json.calendar ?? json.events ?? [];
        }
      } catch {
        // graceful
      }

      setData({
        deals:          deals        ?? [],
        followUps:      followUps    ?? [],
        proposals:      proposals    ?? [],
        comms:          comms        ?? [],
        docs:           docs         ?? [],
        positions:      positions    ?? [],
        watchlist:      watchlist    ?? [],
        tradeJournal:   tradeJournal ?? [],
        projects:       projects     ?? [],
        ships:          ships        ?? [],
        tasks,
        calendarEvents,
        intelligence:   workIntel,
        loading: false,
        error: null,
      });
    } catch (e) {
      setData(prev => ({ ...prev, loading: false, error: e.message }));
    }
  }, []);

  useEffect(() => {
    refresh();

    if (!supabase) return;

    // Subscribe to all relevant tables
    const tables = ["deals","follow_ups","proposals","communications","documents","positions","watchlist","trade_journal","projects","ship_log","work_intelligence"];
    const channels = tables.map((table, i) =>
      supabase
        .channel(`ops-${table}-${i}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => refresh())
        .subscribe()
    );
    channelsRef.current = channels;

    return () => {
      channels.forEach(ch => supabase?.removeChannel(ch));
      channelsRef.current = [];
    };
  }, [refresh]);

  // Derived context strip values
  const today = new Date().toDateString();
  const salesCtx = {
    followUpsDue: data.followUps.filter(f => f.due_date && new Date(f.due_date) <= new Date()).length,
    pipelineValue: data.deals.filter(d => d.stage !== "closed_lost").reduce((s, d) => s + (d.value || 0), 0),
  };
  const tradingCtx = {
    openPositions: data.positions.filter(p => p.status === "open" || !p.status).length,
    plToday: data.positions.reduce((s, p) => {
      if (p.current_price == null || p.entry_price == null) return s;
      return s + (p.current_price - p.entry_price) * (p.size || 1) * (p.side === "short" ? -1 : 1);
    }, 0),
  };
  const buildCtx = {
    shipsToday: data.ships.filter(s => new Date(s.shipped_at).toDateString() === today).length,
    tasksPending: data.tasks.filter(t => !t.done).length,
  };

  // Badges: items needing attention
  const badges = {
    sales:   salesCtx.followUpsDue,
    trading: tradingCtx.openPositions,
    build:   buildCtx.tasksPending,
  };

  return {
    ...data,
    refresh,
    salesCtx,
    tradingCtx,
    buildCtx,
    badges,
  };
}
