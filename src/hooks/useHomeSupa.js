import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

const HOME_CATEGORIES = ["household", "home", "maintenance", "utilities", "utility"];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isOverdue(nextDue) {
  if (!nextDue) return false;
  return nextDue < todayIso();
}

function isDueThisWeek(nextDue) {
  if (!nextDue) return false;
  const today = new Date();
  const due = new Date(nextDue);
  const weekOut = new Date(today);
  weekOut.setDate(weekOut.getDate() + 7);
  return due >= today && due <= weekOut;
}

export function useHomeSupa() {
  const [expenses, setExpenses]         = useState([]);
  const [vendors, setVendors]           = useState([]);
  const [decisions, setDecisions]       = useState([]);
  const [assets, setAssets]             = useState([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setExpenses([]); setVendors([]); setDecisions([]); setAssets([]);
      setOverdueCount(0); setLoading(false);
      setError("Supabase not configured");
      return;
    }
    setLoading(true);
    try {
      const [expRes, vendRes, decRes, assetRes] = await Promise.all([
        supabase.from("expenses").select("*").eq("active", true).order("next_due", { ascending: true }),
        supabase.from("vendors").select("*").order("name", { ascending: true }),
        supabase.from("home_decisions").select("*").eq("status", "pending").order("created_at", { ascending: true }),
        supabase.from("home_assets").select("*").order("replacement_date", { ascending: true }),
      ]);

      if (expRes.error) throw expRes.error;

      const all = expRes.data ?? [];
      const householdRows = all.filter((r) =>
        HOME_CATEGORIES.includes((r.category ?? "").toLowerCase())
      );
      const display = householdRows.length > 0 ? householdRows : all;
      setExpenses(display);
      setOverdueCount(display.filter((r) => isOverdue(r.next_due)).length);

      setVendors(vendRes.data ?? []);
      setDecisions(decRes.data ?? []);
      setAssets(assetRes.data ?? []);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addExpense = useCallback(async (fields) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { error: err } = await supabase.from("expenses").insert({
      ...fields,
      user_id: user.id,
      category: fields.category ?? "household",
      active: true,
    });
    if (err) throw err;
    await refresh();
  }, [refresh]);

  const addVendor = useCallback(async (fields) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { error: err } = await supabase.from("vendors").insert({ ...fields, user_id: user.id });
    if (err) throw err;
    await refresh();
  }, [refresh]);

  const deleteVendor = useCallback(async (id) => {
    if (!supabase) return;
    const { error: err } = await supabase.from("vendors").delete().eq("id", id);
    if (err) throw err;
    await refresh();
  }, [refresh]);

  const addDecision = useCallback(async (fields) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { error: err } = await supabase.from("home_decisions").insert({ ...fields, user_id: user.id });
    if (err) throw err;
    await refresh();
  }, [refresh]);

  const resolveDecision = useCallback(async (id, status) => {
    if (!supabase) return;
    const { error: err } = await supabase.from("home_decisions").update({ status, decided_at: new Date().toISOString() }).eq("id", id);
    if (err) throw err;
    await refresh();
  }, [refresh]);

  const addAsset = useCallback(async (fields) => {
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const { error: err } = await supabase.from("home_assets").insert({ ...fields, user_id: user.id });
    if (err) throw err;
    await refresh();
  }, [refresh]);

  return {
    expenses, vendors, decisions, assets,
    overdueCount, loading, error, refresh,
    addExpense, addVendor, deleteVendor,
    addDecision, resolveDecision, addAsset,
    isOverdue, isDueThisWeek,
  };
}
