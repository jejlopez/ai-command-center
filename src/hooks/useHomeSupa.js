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
  const [expenses, setExpenses]   = useState([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setExpenses([]);
      setOverdueCount(0);
      setLoading(false);
      setError("Supabase not configured");
      return;
    }
    setLoading(true);
    try {
      const { data: rows, error: err } = await supabase
        .from("expenses")
        .select("*")
        .eq("active", true)
        .order("next_due", { ascending: true });

      if (err) throw err;

      const all = rows ?? [];
      // Filter to household categories (if any match), else show all active
      const householdRows = all.filter((r) =>
        HOME_CATEGORIES.includes((r.category ?? "").toLowerCase())
      );
      const display = householdRows.length > 0 ? householdRows : all;

      setExpenses(display);
      setOverdueCount(display.filter((r) => isOverdue(r.next_due)).length);
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

  return {
    expenses,
    overdueCount,
    loading,
    error,
    refresh,
    addExpense,
    isOverdue,
    isDueThisWeek,
  };
}
