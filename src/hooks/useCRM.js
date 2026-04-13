// CRM hook — fetches pipeline, deals, leads, and command briefing from JARVIS daemon.

import { useCallback, useEffect, useState } from "react";
import { jarvis } from "../lib/jarvis.js";
import { useJarvisSocket } from "./useJarvisSocket.js";

export function useCRM() {
  const [pipeline, setPipeline] = useState({});
  const [deals, setDeals] = useState([]);
  const [leads, setLeads] = useState([]);
  const [command, setCommand] = useState(null);
  const [stats, setStats] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [st, p, d, l, cmd] = await Promise.all([
        jarvis.crmStatus().catch(() => ({ connected: false })),
        jarvis.crmPipeline().catch(() => ({})),
        jarvis.crmDeals().catch(() => []),
        jarvis.crmLeads().catch(() => []),
        jarvis.crmCommand().catch(() => null),
      ]);
      setStatus(st);
      setPipeline(p ?? {});
      setDeals(Array.isArray(d) ? d : []);
      setLeads(Array.isArray(l) ? l : []);
      setCommand(cmd);
      setStats(st?.stats ?? null);
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-refresh on skill completions
  useJarvisSocket("skill.completed", (msg) => {
    if (["email_triage", "lead_research", "proposal_generator"].includes(msg.payload?.skill)) {
      refresh();
    }
  });

  const sync = useCallback(async () => {
    setLoading(true);
    try {
      await jarvis.crmSync();
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  const getDeal = useCallback(async (id) => {
    return jarvis.crmDeal(id);
  }, []);

  return {
    pipeline,
    deals,
    leads,
    command,
    stats,
    status,
    loading,
    error,
    refresh,
    sync,
    getDeal,
    connected: status?.connected ?? false,
  };
}
