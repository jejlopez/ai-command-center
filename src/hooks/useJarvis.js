import { useCallback, useEffect, useState } from "react";
import { jarvis } from "../lib/jarvis.js";
import { useJarvisSocket } from "./useJarvisSocket.js";

export function useJarvisBrief() {
  const [brief, setBrief] = useState(null);
  const [rail, setRail]   = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [b, r] = await Promise.all([jarvis.brief(), jarvis.rail()]);
      setBrief(b);
      setRail(r);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshRuns = useCallback(async () => {
    try {
      const runs = await jarvis.recentRuns(5);
      setRecentRuns(Array.isArray(runs) ? runs : []);
    } catch {
      // skill registry may not be up yet — stay silent
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { refreshRuns(); }, [refreshRuns]);

  // WebSocket-driven: refresh brief on brief.generated, runs on skill events
  useJarvisSocket("brief.generated", refresh);
  useJarvisSocket("skill.completed", refreshRuns);
  useJarvisSocket("skill.started", refreshRuns);
  useJarvisSocket("approval.new", refresh);

  const decide = useCallback(async (id, decision, reason) => {
    await jarvis.decideApproval(id, decision, reason);
    await refresh();
  }, [refresh]);

  const regenerateBrief = useCallback(async () => {
    setLoading(true);
    await jarvis.generateBrief();
    await refresh();
  }, [refresh]);

  return { brief, rail, recentRuns, error, loading, refresh, decide, regenerateBrief };
}

export function useSkills() {
  const [skills, setSkills] = useState([]);
  const [runs, setRuns] = useState([]);
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [s, r, w] = await Promise.all([
        jarvis.listSkills().catch(() => []),
        jarvis.recentRuns(20).catch(() => []),
        jarvis.listWorkflows().catch(() => []),
      ]);
      setSkills(Array.isArray(s) ? s : []);
      setRuns(Array.isArray(r) ? r : []);
      setWorkflows(Array.isArray(w) ? w : []);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const run = useCallback(async (name, inputs = {}) => {
    const result = await jarvis.runSkill(name, inputs);
    // Refresh recent runs (global) after a run completes.
    try {
      const r = await jarvis.recentRuns(20);
      setRuns(Array.isArray(r) ? r : []);
    } catch {}
    return result;
  }, []);

  return { skills, runs, workflows, loading, error, refresh, run };
}

export function useOnboarding() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await jarvis.getOnboarding();
      setStatus(s);
    } catch {
      // If the endpoint is unreachable, assume not complete so the wizard renders
      // once the daemon comes up — but don't crash the shell if daemon is down.
      setStatus({ complete: true, steps: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const complete = useCallback(async () => {
    await jarvis.completeOnboarding();
    await refresh();
  }, [refresh]);

  return { status, loading, refresh, complete };
}

export function useToday(intervalMs = 60000) {
  const [today, setToday] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const t = await jarvis.getToday();
      setToday(t);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refresh();
    };
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => { cancelled = true; clearInterval(timer); };
  }, [refresh, intervalMs]);

  return { today, loading, error, refresh };
}

export function useMemory() {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await jarvis.memoryList();
      setNodes(Array.isArray(list) ? list : []);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const remember = useCallback(async (input) => {
    const node = await jarvis.memoryRemember(input);
    await refresh();
    return node;
  }, [refresh]);

  const forget = useCallback(async (id) => {
    await jarvis.memoryForget(id);
    await refresh();
  }, [refresh]);

  const search = useCallback(async (q) => {
    if (!q || !q.trim()) return null;
    const res = await jarvis.memoryRecall(q, { enhanced: true });
    return {
      nodes: Array.isArray(res?.nodes) ? res.nodes : [],
      hits: Array.isArray(res?.hits) ? res.hits : [],
      embedStatus: res?.embedStatus ?? null,
    };
  }, []);

  return { nodes, loading, error, refresh, remember, forget, search };
}

export function useCostSummary(intervalMs = 60000) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const s = await jarvis.costSummary();
      setSummary(s ?? null);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      await refresh();
    };
    tick();
    const timer = setInterval(tick, intervalMs);
    return () => { cancelled = true; clearInterval(timer); };
  }, [refresh, intervalMs]);

  return { summary, loading, error, refresh };
}

export function useMemoryFiltered(kind, filter) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rawNodes, setRawNodes] = useState([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await jarvis.memoryList(kind);
      setRawNodes(Array.isArray(list) ? list : []);
    } catch {
      setRawNodes([]);
    } finally {
      setLoading(false);
    }
  }, [kind]);

  useEffect(() => { refresh(); }, [refresh]);

  // Debounce filter changes (client-side only, no refetch).
  useEffect(() => {
    const q = (filter ?? "").trim().toLowerCase();
    const timer = setTimeout(() => {
      if (!q) {
        setNodes(rawNodes);
        return;
      }
      setNodes(
        rawNodes.filter((n) => {
          const label = (n.label ?? "").toLowerCase();
          const body  = (n.body  ?? "").toLowerCase();
          return label.includes(q) || body.includes(q);
        })
      );
    }, 150);
    return () => clearTimeout(timer);
  }, [filter, rawNodes]);

  return { nodes, loading, refresh };
}

export function useCostToday(intervalMs = 30000) {
  const [cost, setCost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const tick = async () => {
      try {
        const c = await jarvis.costToday();
        if (!cancelled) setCost(c ?? null);
      } catch {
        if (!cancelled) setCost((prev) => prev); // keep last known; do not throw
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    tick();
    timer = setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [intervalMs]);

  return { cost, loading };
}

