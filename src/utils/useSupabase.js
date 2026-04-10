import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_MODEL_PROVIDER,
  SYNTHETIC_COMMANDER_ID,
  getCommanderDisplayName,
  getCommanderLane,
  normalizeModelProvider,
} from './commanderPolicy';
import { getTaskGraphShape } from './missionLifecycle';
import { buildDefaultRoutingPolicy, mapRoutingPolicyFromDb } from './routingPolicy';

function createRealtimeChannelName(prefix, userId) {
  const uniqueSuffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${userId}-${uniqueSuffix}`;
}

async function ensureModelBankEntry(user, modelKey, provider = DEFAULT_MODEL_PROVIDER) {
  if (!user?.id || !modelKey) return null;

  const row = {
    user_id: user.id,
    model_key: modelKey,
    label: modelKey,
    provider: normalizeModelProvider(provider),
  };

  const { data, error } = await supabase
    .from('model_bank')
    .upsert(row, { onConflict: 'user_id,model_key' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function ensureCommanderAgent(user) {
  if (!user?.id) return null;

  const commanderName = getCommanderDisplayName(user);
  const commanderLane = getCommanderLane();

  const { data: existingCommander, error: existingError } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', user.id)
    .eq('role', 'commander')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existingCommander) return existingCommander;

  await ensureModelBankEntry(user, commanderLane.model, commanderLane.provider);

  const row = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: commanderName,
    model: commanderLane.model,
    status: 'idle',
    role: 'commander',
    color: '#00D9C8',
    can_spawn: true,
    spawn_pattern: 'fan-out',
  };

  const { data, error } = await supabase
    .from('agents')
    .insert([row])
    .select()
    .single();

  if (error) throw error;
  return data;
}

function buildSyntheticCommander(user) {
  const commanderName = getCommanderDisplayName(user);
  const commanderLane = getCommanderLane();

  return {
    id: SYNTHETIC_COMMANDER_ID,
    userId: user?.id || null,
    name: commanderName,
    model: commanderLane.model,
    status: 'idle',
    role: 'commander',
    roleDescription: 'Fallback command agent while the persistent commander record is unavailable.',
    color: '#00D9C8',
    temperature: 0.4,
    responseLength: 'medium',
    systemPrompt: '',
    parentId: null,
    canSpawn: true,
    spawnPattern: 'fan-out',
    taskCompletion: 0,
    latencyMs: 0,
    totalTokens: 0,
    totalCost: 0,
    successRate: 100,
    taskCount: 0,
    uptimeMs: 0,
    lastHeartbeat: null,
    restartCount: 0,
    errorMessage: null,
    errorStack: null,
    lastRestart: null,
    tokenBurn: [],
    tokenHistory24h: [],
    latencyHistory24h: [],
    skills: [],
    isEphemeral: false,
    subagents: [],
    createdAt: null,
    updatedAt: null,
    isSyntheticCommander: true,
  };
}

/**
 * Hook to fetch agents from Supabase with realtime subscription.
 * Scoped to the current authenticated user.
 */
export function useAgents() {
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const commanderBootstrapAttempted = useRef(false);

  const fetchAgents = useCallback(async () => {
    if (!user) {
      setAgents([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const rows = data || [];
      const hasCommander = rows.some((agent) => agent.role === 'commander');

      if (!hasCommander && !commanderBootstrapAttempted.current) {
        commanderBootstrapAttempted.current = true;
        try {
          await ensureCommanderAgent(user);
          return fetchAgents();
        } catch (bootstrapError) {
          console.error('[useAgents] Commander bootstrap failed, using fallback commander:', bootstrapError);
        }
      }

      const mappedAgents = rows.map(mapAgentFromDb);
      setAgents(hasCommander ? mappedAgents : [buildSyntheticCommander(user), ...mappedAgents]);
    } catch (err) {
      console.error('[useAgents] Fetch error:', err);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    fetchAgents();
    
    // Realtime subscription scoped to user_id
    const channel = supabase
      .channel(createRealtimeChannelName('agents-user', user.id))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'agents',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchAgents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAgents]);

  const addOptimistic = useCallback((agentData) => {
    if (!user) return;
    
    const tempAgent = {
      ...agentData,
      id: `temp-${Date.now()}`,
      user_id: user.id,
      status: agentData.status || 'idle',
      taskCompletion: 0,
      latencyMs: 0,
      totalTokens: 0,
      totalCost: 0,
      successRate: 100,
      taskCount: 0,
      tokenBurn: [],
      tokenHistory24h: [],
      latencyHistory24h: [],
      skills: [],
      subagents: [],
      _optimistic: true,
    };
    setAgents(prev => [...prev, tempAgent]);
  }, [user]);

  const hasCommander = agents.some(a => a.role === 'commander');

  return { agents, loading, hasCommander, addOptimistic, refetch: fetchAgents };
}

/**
 * Hook to fetch tasks from Supabase with user scoping.
 */
export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setTasks((data || []).map(mapTaskFromDb));
    } catch (err) {
      console.error('[useTasks] Fetch error:', err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    fetchTasks();
    
    const channel = supabase
      .channel(createRealtimeChannelName('tasks-user', user.id))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tasks',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchTasks]);

  return { tasks, loading, refetch: fetchTasks };
}

/**
 * Hook to fetch activity log with user scoping.
 */
export function useActivityLog(agentId = null) {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    if (!user) {
      setLogs([]);
      setLoading(false);
      return;
    }
    
    try {
      let query = supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', user.id)
        .order('timestamp', { ascending: true });
      
      if (agentId) query = query.eq('agent_id', agentId);

      const { data, error } = await query;
      if (error) throw error;

      setLogs((data || []).map(mapLogRow));
    } catch (err) {
      console.error('[useActivityLog] Fetch error:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [user, agentId]);

  useEffect(() => {
    if (!user) return;
    
    fetchLogs();
    
    const channel = supabase
      .channel(createRealtimeChannelName('logs-user', user.id))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'activity_log',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchLogs]);

  return { logs, loading, refetch: fetchLogs };
}

export function usePendingReviews() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReviews = useCallback(async () => {
    if (!user) {
      setReviews([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('pending_reviews')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['awaiting_approval', 'needs_intervention'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      setReviews((data || []).map((row) => ({
        id: row.id,
        agentId: row.agent_id,
        agentName: row.agent_name,
        urgency: row.urgency,
        title: row.title,
        outputType: row.output_type,
        status: row.status,
        summary: row.summary,
        createdAt: row.created_at,
        waitingMs: row.waiting_since
          ? Date.now() - new Date(row.waiting_since).getTime()
          : 0,
      })));
    } catch (err) {
      console.error('[usePendingReviews] Fetch error:', err);
      setReviews([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchReviews();

    const channel = supabase
      .channel(createRealtimeChannelName('pending-reviews-user', user.id))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_reviews', filter: `user_id=eq.${user.id}` },
        () => fetchReviews()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchReviews]);

  return { reviews, loading, refetch: fetchReviews };
}

export function useSchedules() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSchedules = useCallback(async () => {
    if (!user) {
      setSchedules([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('scheduled_jobs')
        .select('*')
        .eq('user_id', user.id)
        .order('next_run_at', { ascending: true });

      if (error) throw error;

      setSchedules((data || []).map(mapScheduledJobFromDb));
    } catch (err) {
      console.error('[useSchedules] Fetch error:', err);
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchSchedules();

    const channel = supabase
      .channel(createRealtimeChannelName('scheduled-jobs-user', user.id))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scheduled_jobs', filter: `user_id=eq.${user.id}` },
        () => fetchSchedules()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSchedules]);

  return { schedules, loading, refetch: fetchSchedules };
}

export function useConnectedSystems() {
  const { user } = useAuth();
  const [connectedSystems, setConnectedSystems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchConnectedSystems = useCallback(async () => {
    if (!user) {
      setConnectedSystems([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('connected_systems')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setConnectedSystems((data || []).map(mapConnectedSystemFromDb));
    } catch (error) {
      console.error('[useConnectedSystems] Fetch error:', error);
      setConnectedSystems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    fetchConnectedSystems();

    const channel = supabase
      .channel(createRealtimeChannelName('connected-systems-user', user.id))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'connected_systems', filter: `user_id=eq.${user.id}` },
        () => fetchConnectedSystems()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchConnectedSystems]);

  const upsertSystem = useCallback(async (system) => {
    if (!user) throw new Error('Not authenticated');

    const row = mapConnectedSystemToDb(user.id, system);
    const { data, error } = await supabase
      .from('connected_systems')
      .upsert(row, { onConflict: 'user_id,integration_key' })
      .select()
      .single();

    if (error) throw error;
    return mapConnectedSystemFromDb(data);
  }, [user]);

  const removeSystem = useCallback(async (systemId) => {
    if (!user || !systemId) return;
    const { error } = await supabase
      .from('connected_systems')
      .delete()
      .eq('user_id', user.id)
      .eq('id', systemId);

    if (error) throw error;
  }, [user]);

  const refreshSystem = useCallback(async (systemId, patch = {}) => {
    if (!user || !systemId) return;
    const row = {
      status: patch.status || 'connected',
      last_verified_at: patch.lastVerifiedAt || new Date().toISOString(),
      metadata: patch.metadata,
    };

    const { error } = await supabase
      .from('connected_systems')
      .update(row)
      .eq('user_id', user.id)
      .eq('id', systemId);

    if (error) throw error;
  }, [user]);

  return {
    connectedSystems,
    loading,
    refetch: fetchConnectedSystems,
    upsertSystem,
    removeSystem,
    refreshSystem,
  };
}

export function useRoutingPolicies() {
  const { user } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPolicies = useCallback(async () => {
    if (!user) {
      setPolicies([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('routing_policies')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setPolicies((data || []).map(mapRoutingPolicyFromDb));
    } catch (error) {
      console.error('[useRoutingPolicies] Fetch error:', error);
      setPolicies([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    fetchPolicies();
    return undefined;
  }, [user, fetchPolicies]);

  const upsertPolicy = useCallback(async (policy) => {
    if (!user) throw new Error('Not authenticated');

    const row = {
      user_id: user.id,
      name: policy.name?.trim() || 'Adaptive Commander Default',
      description: policy.description?.trim() || '',
      is_default: policy.isDefault ?? false,
      task_domain: policy.taskDomain || 'general',
      intent_type: policy.intentType || 'general',
      risk_level: policy.riskLevel || 'medium',
      budget_class: policy.budgetClass || 'balanced',
      latency_class: policy.latencyClass || 'balanced',
      preferred_provider: normalizeModelProvider(policy.preferredProvider),
      preferred_model: policy.preferredModel || null,
      preferred_agent_role: policy.preferredAgentRole || 'commander',
      fallback_order: policy.fallbackOrder || [],
      approval_rule: policy.approvalRule || 'risk_weighted',
      context_policy: policy.contextPolicy || 'minimal',
      parallelization_policy: policy.parallelizationPolicy || 'adaptive',
      evidence_required: policy.evidenceRequired ?? false,
      active: policy.active ?? true,
    };

    const query = supabase.from('routing_policies');
    const { data, error } = policy.id
      ? await query.update(row).eq('id', policy.id).eq('user_id', user.id).select('*').single()
      : await query.insert(row).select('*').single();

    if (error) throw error;
    await fetchPolicies();
    return mapRoutingPolicyFromDb(data);
  }, [fetchPolicies, user]);

  const ensureDefaultPolicy = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');
    const existing = policies.find((policy) => policy.isDefault);
    if (existing) return existing;

    const { data, error } = await supabase
      .from('routing_policies')
      .insert(buildDefaultRoutingPolicy(user.id))
      .select('*')
      .single();

    if (error) throw error;
    await fetchPolicies();
    return mapRoutingPolicyFromDb(data);
  }, [fetchPolicies, policies, user]);

  return { policies, loading, refetch: fetchPolicies, upsertPolicy, ensureDefaultPolicy };
}

export function useKnowledgeNamespaces() {
  const { user } = useAuth();
  const [namespaces, setNamespaces] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNamespaces = useCallback(async () => {
    if (!user) {
      setNamespaces([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('knowledge_namespaces')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setNamespaces((data || []).map(mapKnowledgeNamespaceFromDb));
    } catch (error) {
      console.error('[useKnowledgeNamespaces] Fetch error:', error);
      setNamespaces([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    fetchNamespaces();
    return undefined;
  }, [user, fetchNamespaces]);

  return { namespaces, loading, refetch: fetchNamespaces };
}

export function useSharedDirectives() {
  const { user } = useAuth();
  const [directives, setDirectives] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDirectives = useCallback(async () => {
    if (!user) {
      setDirectives([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('shared_directives')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setDirectives((data || []).map(mapSharedDirectiveFromDb));
    } catch (error) {
      console.error('[useSharedDirectives] Fetch error:', error);
      setDirectives([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    fetchDirectives();
    return undefined;
  }, [user, fetchDirectives]);

  return { directives, loading, refetch: fetchDirectives };
}

export function useSystemRecommendations() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRecommendations = useCallback(async () => {
    if (!user) {
      setRecommendations([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('system_recommendations')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: false })
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setRecommendations((data || []).map(mapSystemRecommendationFromDb));
    } catch (error) {
      console.error('[useSystemRecommendations] Fetch error:', error);
      setRecommendations([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    fetchRecommendations();
    return undefined;
  }, [user, fetchRecommendations]);

  return { recommendations, loading, refetch: fetchRecommendations };
}

/**
 * Hook for cost data.
 */
export function useCostData() {
  const { user } = useAuth();
  const [data, setData] = useState({ total: 0, burnRate: 0, models: [] });

  useEffect(() => {
    let cancelled = false;

    async function fetchCostData() {
      if (!user) {
        setData({ total: 0, burnRate: 0, models: [] });
        return;
      }

      try {
        const [{ data: agentsData, error: agentsError }, { data: tasksData, error: tasksError }] = await Promise.all([
          supabase.from('agents').select('id, model').eq('user_id', user.id),
          supabase.from('tasks').select('agent_id, cost_usd, created_at').eq('user_id', user.id),
        ]);

        if (agentsError) throw agentsError;
        if (tasksError) throw tasksError;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const agentModelById = new Map((agentsData || []).map((agent) => [agent.id, agent.model]));
        const todaysTasks = (tasksData || []).filter((task) => new Date(task.created_at) >= today);
        const total = todaysTasks.reduce((sum, task) => sum + Number(task.cost_usd || 0), 0);
        const byModel = new Map();

        todaysTasks.forEach((task) => {
          const model = agentModelById.get(task.agent_id) || 'Unassigned';
          byModel.set(model, (byModel.get(model) || 0) + Number(task.cost_usd || 0));
        });

        const models = Array.from(byModel.entries())
          .map(([name, cost]) => ({ name, cost }))
          .sort((a, b) => b.cost - a.cost)
          .map((entry) => ({
            ...entry,
            percentage: total > 0 ? Math.round((entry.cost / total) * 100) : 0,
          }));

        if (!cancelled) {
          setData({
            total,
            burnRate: total / Math.max(new Date().getHours() + 1, 1),
            models,
          });
        }
      } catch (error) {
        console.error('[useCostData] Fetch error:', error);
        if (!cancelled) setData({ total: 0, burnRate: 0, models: [] });
      }
    }

    fetchCostData();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { data };
}

/**
 * Hook for health metrics.
 */
export function useHealthMetrics() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [errorsByAgent, setErrorsByAgent] = useState({ counts: {}, messages: {} });

  useEffect(() => {
    let cancelled = false;

    async function fetchHealthMetrics() {
      if (!user) {
        setData([]);
        setErrorsByAgent({ counts: {}, messages: {} });
        return;
      }

      try {
        const [{ data: agentsData, error: agentsErr }, { data: logsData, error: logsErr }] = await Promise.all([
          supabase
            .from('agents')
            .select('id, status, success_rate, latency_ms')
            .eq('user_id', user.id),
          supabase
            .from('activity_log')
            .select('agent_id, message')
            .eq('user_id', user.id)
            .eq('type', 'ERR'),
        ]);

        if (agentsErr) throw agentsErr;
        if (logsErr) throw logsErr;

        const rows = agentsData || [];
        const totalAgents = rows.length || 1;
        const healthyAgents = rows.filter((row) => row.status !== 'error').length;
        const avgSuccess = rows.reduce((sum, row) => sum + Number(row.success_rate || 0), 0) / totalAgents;
        const avgLatency = rows.reduce((sum, row) => sum + Number(row.latency_ms || 0), 0) / totalAgents;

        // Count error logs per agent + capture latest message
        const errMap = {};
        const errMsgMap = {};
        (logsData || []).forEach(log => {
          if (log.agent_id) {
            errMap[log.agent_id] = (errMap[log.agent_id] || 0) + 1;
            errMsgMap[log.agent_id] = log.message; // last one wins (ordered by timestamp)
          }
        });

        if (!cancelled) {
          setErrorsByAgent({ counts: errMap, messages: errMsgMap });
          setData([
            { label: 'Availability', value: Math.round((healthyAgents / totalAgents) * 100), color: '#00D9C8', history24h: [] },
            { label: 'Success', value: Math.round(avgSuccess || 0), color: '#60a5fa', history24h: [] },
            { label: 'Latency', value: Math.max(0, 100 - Math.min(100, Math.round(avgLatency / 10))), color: '#fbbf24', history24h: [] },
          ]);
        }
      } catch (error) {
        console.error('[useHealthMetrics] Fetch error:', error);
        if (!cancelled) { setData([]); setErrorsByAgent({ counts: {}, messages: {} }); }
      }
    }

    fetchHealthMetrics();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { data, errorsByAgent };
}

export function useModelBank() {
  const { user } = useAuth();
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchModels = useCallback(async () => {
    if (!user) {
      setModels([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('model_bank')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setModels((data || []).map(mapModelFromDb));
    } catch (error) {
      console.error('[useModelBank] Fetch error:', error);
      setModels([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  return { models, loading, refetch: fetchModels };
}

export function useSkillBank() {
  const { user } = useAuth();
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSkills = useCallback(async () => {
    if (!user) {
      setSkills([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('skill_bank')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setSkills((data || []).map(mapSkillFromDb));
    } catch (error) {
      console.error('[useSkillBank] Fetch error:', error);
      setSkills([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  return { skills, loading, refetch: fetchSkills };
}

export function useTaskOutcomes() {
  const { user } = useAuth();
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchOutcomes = useCallback(async () => {
    if (!user) {
      setOutcomes([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('task_outcomes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOutcomes((data || []).map((row) => ({
        id: row.id,
        taskId: row.task_id,
        rootMissionId: row.root_mission_id,
        agentId: row.agent_id,
        outcomeStatus: row.outcome_status || 'completed',
        score: Number(row.score || 0),
        trust: row.trust || 'medium',
        doctrineFeedback: row.doctrine_feedback || '',
        model: row.model || '',
        provider: normalizeModelProvider(row.provider),
        domain: row.domain || 'general',
        intentType: row.intent_type || 'general',
        budgetClass: row.budget_class || 'balanced',
        riskLevel: row.risk_level || 'medium',
        approvalLevel: row.approval_level || 'risk_weighted',
        executionStrategy: row.execution_strategy || 'sequential',
        costUsd: Number(row.cost_usd || 0),
        durationMs: Number(row.duration_ms || 0),
        contextPackIds: Array.isArray(row.context_pack_ids) ? row.context_pack_ids : [],
        requiredCapabilities: Array.isArray(row.required_capabilities) ? row.required_capabilities : [],
        metadata: row.metadata || {},
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })));
    } catch (error) {
      console.error('[useTaskOutcomes] Fetch error:', error);
      setOutcomes([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    fetchOutcomes();
    const channel = supabase
      .channel(createRealtimeChannelName('task-outcomes-user', user.id))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_outcomes',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchOutcomes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchOutcomes]);

  return { outcomes, loading, refetch: fetchOutcomes };
}

/**
 * Insert a new agent into Supabase.
 */
export async function createAgent(agentData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const row = {
    ...mapAgentToDb(agentData),
    user_id: user.id,
    id: crypto.randomUUID(),
  };
  const { data, error } = await supabase.from('agents').insert([row]).select().single();
  if (error) throw error;
  return mapAgentFromDb(data);
}

/**
 * Create a temp (ephemeral) agent tied to the Commander.
 */
export async function createTempAgent({ objective, role, model, commanderId }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const slug = objective.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const row = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: `temp-${slug}`,
    model,
    provider: normalizeModelProvider(model?.includes('local') ? 'Ollama' : DEFAULT_MODEL_PROVIDER),
    status: 'idle',
    role: role || 'researcher',
    parent_id: commanderId,
    can_spawn: false,
    spawn_pattern: 'sequential',
    is_ephemeral: true,
    system_prompt: `You are a temporary specialist. Objective: ${objective}`,
    color: '#6b7280',
  };
  const { data, error } = await supabase.from('agents').insert([row]).select().single();
  if (error) throw error;
  await supabase.from('activity_log').insert([{
    user_id: user.id,
    agent_id: data.id,
    type: 'SYS',
    message: `[specialist-spawned] ${data.name} (${row.role}) created from Intelligence for "${objective}" on ${model}.`,
  }]);
  return mapAgentFromDb(data);
}

export async function createPersistentSpecialist({ name, objective, role, model, commanderId, skills = [] }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const trimmedName = String(name || '').trim() || `${role || 'specialist'}-lane`;
  const row = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: trimmedName,
    model,
    provider: normalizeModelProvider(model?.includes('local') ? 'Ollama' : DEFAULT_MODEL_PROVIDER),
    status: 'idle',
    role: role || 'researcher',
    parent_id: commanderId,
    can_spawn: false,
    spawn_pattern: 'persistent',
    is_ephemeral: false,
    system_prompt: `You are a persistent ${role || 'specialist'} lane. Objective: ${objective || trimmedName}`,
    role_description: objective?.trim() || `Persistent ${role || 'specialist'} lane for Commander.`,
    color: '#60a5fa',
    skills,
  };

  const { data, error } = await supabase.from('agents').insert([row]).select().single();
  if (error) throw error;
  await supabase.from('activity_log').insert([{
    user_id: user.id,
    agent_id: data.id,
    type: 'SYS',
    message: `[specialist-persistent] ${data.name} (${row.role}) promoted as a persistent lane on ${model}.`,
  }]);
  return mapAgentFromDb(data);
}

export async function promoteAgentToPersistent(agentId, patch = {}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: current, error: fetchError } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', user.id)
    .eq('id', agentId)
    .single();

  if (fetchError) throw fetchError;

  const { data, error } = await supabase
    .from('agents')
    .update({
      is_ephemeral: false,
      spawn_pattern: 'persistent',
      status: patch.status || current.status || 'idle',
      role_description: patch.roleDescription || current.role_description || `Persistent ${current.role || 'specialist'} lane for Commander.`,
      skills: Array.isArray(patch.skills) ? patch.skills : current.skills,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)
    .eq('id', agentId)
    .select()
    .single();

  if (error) throw error;
  await supabase.from('activity_log').insert([{
    user_id: user.id,
    agent_id: data.id,
    type: 'SYS',
    message: `[specialist-persistent] ${data.name} (${data.role}) promoted from ephemeral to persistent coverage.`,
  }]);
  return mapAgentFromDb(data);
}

/**
 * Delete all ephemeral agents whose tasks are in a terminal state.
 */
export async function cleanupTempAgents() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: idleAgents, error: fetchError } = await supabase
    .from('agents')
    .select('id,name,role,model')
    .eq('user_id', user.id)
    .eq('is_ephemeral', true)
    .in('status', ['idle', 'error']);

  if (fetchError) throw fetchError;
  if (!idleAgents?.length) return 0;

  await supabase.from('activity_log').insert(
    idleAgents.map((agent) => ({
      user_id: user.id,
      agent_id: agent.id,
      type: 'SYS',
      message: `[specialist-retired] ${agent.name} (${agent.role || 'specialist'}) retired from Intelligence cleanup on ${agent.model || 'adaptive lane'}.`,
    }))
  );

  const { data, error } = await supabase
    .from('agents')
    .delete()
    .eq('user_id', user.id)
    .eq('is_ephemeral', true)
    .in('status', ['idle', 'error'])
    .select();

  if (error) throw error;
  return (data || []).length;
}

export async function createModelBankEntry(modelData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const row = {
    user_id: user.id,
    model_key: modelData.modelKey?.trim() || modelData.label?.trim(),
    label: modelData.label?.trim() || modelData.modelKey?.trim(),
    provider: normalizeModelProvider(modelData.provider),
    cost_per_1k: Number(modelData.costPer1k ?? 0),
  };

  if (!row.model_key || !row.label) throw new Error('Model name is required');

  const { data, error } = await supabase
    .from('model_bank')
    .upsert(row, { onConflict: 'user_id,model_key' })
    .select()
    .single();

  if (error) throw error;
  return mapModelFromDb(data);
}

export async function createSkillBankEntry(skillData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const row = {
    user_id: user.id,
    name: skillData.name?.trim(),
    description: skillData.description?.trim() || '',
    icon: skillData.icon || inferSkillIcon(skillData.source, skillData.reference),
    source: skillData.source || 'custom',
    reference: skillData.reference?.trim() || null,
    enabled: skillData.enabled ?? true,
  };

  if (!row.name) throw new Error('Skill name is required');

  const { data, error } = await supabase
    .from('skill_bank')
    .upsert(row, { onConflict: 'user_id,name' })
    .select()
    .single();

  if (error) throw error;
  return mapSkillFromDb(data);
}

export async function updateAgentSkills(agentId, skills) {
  const { data, error } = await supabase
    .from('agents')
    .update({ skills })
    .eq('id', agentId)
    .select()
    .single();

  if (error) throw error;
  return mapAgentFromDb(data);
}

// ── Mappers ────────────────────────────────────────────────────

function mapAgentFromDb(row) {
  return {
    id:               row.id,
    userId:           row.user_id,
    name:             row.name,
    model:            row.model,
    provider:         normalizeModelProvider(row.provider),
    status:           row.status,
    role:             row.role,
    roleDescription:  row.role_description || '',
    color:            row.color,
    temperature:      parseFloat(row.temperature) || 0.7,
    responseLength:   row.response_length,
    systemPrompt:     row.system_prompt || '',
    parentId:         row.parent_id,
    canSpawn:         row.can_spawn,
    spawnPattern:     row.spawn_pattern,
    taskCompletion:   row.task_completion || 0,
    latencyMs:        row.latency_ms || 0,
    totalTokens:      row.total_tokens || 0,
    totalCost:        parseFloat(row.total_cost) || 0,
    successRate:      row.success_rate || 0,
    taskCount:        row.task_count || 0,
    uptimeMs:         Number(row.uptime_ms) || 0,
    lastHeartbeat:    row.last_heartbeat,
    restartCount:     row.restart_count || 0,
    errorMessage:     row.error_message,
    errorStack:       row.error_stack,
    lastRestart:      row.last_restart,
    tokenBurn:        row.token_burn || [],
    tokenHistory24h:  row.token_history_24h || [],
    latencyHistory24h: row.latency_history_24h || [],
    skills:           row.skills || [],
    isEphemeral:      row.is_ephemeral ?? false,
    subagents:        [],
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
}

function mapAgentToDb(agent) {
  return {
    name:             agent.name,
    model:            agent.model,
    provider:         normalizeModelProvider(agent.provider || DEFAULT_MODEL_PROVIDER),
    status:           agent.status || 'idle',
    role:             agent.role || 'researcher',
    role_description: agent.roleDescription || null,
    color:            agent.color || '#60a5fa',
    temperature:      agent.temperature ?? 0.7,
    response_length:   agent.responseLength || 'medium',
    system_prompt:     agent.systemPrompt || null,
    parent_id:         agent.parentId || null,
    can_spawn:         agent.canSpawn ?? false,
    spawn_pattern:     agent.spawnPattern || 'sequential',
    task_completion:   agent.taskCompletion ?? 0,
    latency_ms:        agent.latencyMs ?? 0,
    total_tokens:      agent.totalTokens ?? 0,
    total_cost:        agent.totalCost ?? 0,
    success_rate:      agent.successRate ?? 100,
    task_count:        agent.taskCount ?? 0,
    skills:           agent.skills || [],
    token_burn:        agent.tokenBurn || [],
    is_ephemeral:      agent.isEphemeral ?? false,
  };
}

function mapTaskFromDb(row) {
  const taskGraph = getTaskGraphShape(row);
  return {
    id:         row.id,
    userId:     row.user_id,
    name:       row.name,
    status:     row.status,
    workflowStatus: taskGraph.workflowStatus,
    nodeType: taskGraph.nodeType,
    rootMissionId: taskGraph.rootMissionId,
    parentId:   row.parent_id,
    dependsOn: taskGraph.dependsOn,
    agentId:    row.agent_id,
    agentName:  row.agent_name,
    routingPolicyId: row.routing_policy_id,
    routingReason: row.routing_reason || '',
    domain: row.domain || 'general',
    intentType: row.intent_type || 'general',
    budgetClass: row.budget_class || 'balanced',
    riskLevel: row.risk_level || 'medium',
    contextPackIds: Array.isArray(row.context_pack_ids) ? row.context_pack_ids : [],
    requiredCapabilities: Array.isArray(row.required_capabilities) ? row.required_capabilities : [],
    approvalLevel: row.approval_level || 'risk_weighted',
    agentRole: row.agent_role || 'executor',
    executionStrategy: row.execution_strategy || 'sequential',
    branchLabel: row.branch_label || '',
    providerOverride: row.provider_override || null,
    modelOverride: row.model_override || null,
    durationMs: row.duration_ms || 0,
    costUsd:    parseFloat(row.cost_usd) || 0,
  };
}

function mapLogRow(row) {
  return {
    id:          row.id,
    userId:      row.user_id,
    timestamp:   row.timestamp,
    type:        row.type,
    message:     row.message,
    agentId:     row.agent_id,
    parentLogId: row.parent_log_id,
    tokens:      row.tokens || 0,
    durationMs:  row.duration_ms || 0,
  };
}

function mapModelFromDb(row) {
  return {
    id: row.id,
    modelKey: row.model_key,
    label: row.label,
    provider: normalizeModelProvider(row.provider),
    costPer1k: Number(row.cost_per_1k || 0),
    createdAt: row.created_at,
  };
}

function mapScheduledJobFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id,
    agentName: row.agent_name,
    name: row.name,
    scheduleLabel: row.schedule_label,
    status: row.status,
    approvalRequired: row.approval_required ?? false,
    nextRunAt: row.next_run_at,
    lastRunAt: row.last_run_at,
    lastRunStatus: row.last_run_status || 'never',
    estimatedDurationMs: row.estimated_duration_ms || 0,
    estimatedCostUsd: parseFloat(row.estimated_cost_usd) || 0,
    lastError: row.last_error || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSkillFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    icon: row.icon || 'Zap',
    source: row.source || 'custom',
    reference: row.reference,
    enabled: row.enabled ?? true,
    createdAt: row.created_at,
  };
}

function mapConnectedSystemFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    integrationKey: row.integration_key,
    displayName: row.display_name,
    category: row.category || 'System',
    status: row.status || 'connected',
    identifier: row.identifier || '',
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    domain: row.domain || 'general',
    trustLevel: row.trust_level || 'standard',
    riskLevel: row.risk_level || 'medium',
    permissionScope: Array.isArray(row.permission_scope) ? row.permission_scope : [],
    capabilityDetails: row.metadata?.capabilityDetails || {},
    metadata: row.metadata || {},
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConnectedSystemToDb(userId, system) {
  return {
    user_id: userId,
    integration_key: system.integrationKey,
    display_name: system.displayName,
    category: system.category || 'System',
    status: system.status || 'connected',
    identifier: system.identifier || '',
    capabilities: system.capabilities || [],
    domain: system.domain || 'general',
    trust_level: system.trustLevel || 'standard',
    risk_level: system.riskLevel || 'medium',
    permission_scope: system.permissionScope || [],
    metadata: {
      ...(system.metadata || {}),
      capabilityDetails: system.capabilityDetails || system.metadata?.capabilityDetails || {},
    },
    last_verified_at: system.lastVerifiedAt || new Date().toISOString(),
  };
}

function mapKnowledgeNamespaceFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    vectors: row.vectors || 0,
    sizeLabel: row.size_label || '0 MB',
    lastSyncAt: row.last_sync_at,
    status: row.status || 'idle',
    agents: Array.isArray(row.agents) ? row.agents : [],
    description: row.description || '',
    updatedAt: row.updated_at,
  };
}

function mapSharedDirectiveFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    scope: row.scope || 'all',
    appliedTo: Array.isArray(row.applied_to) ? row.applied_to : [],
    content: row.content || '',
    priority: row.priority || 'normal',
    icon: row.icon || 'ShieldCheck',
    updatedAt: row.updated_at,
  };
}

function mapSystemRecommendationFromDb(row) {
  return {
    id: row.id,
    type: row.rec_type || 'optimization',
    title: row.title,
    description: row.description || '',
    impact: row.impact || 'medium',
    savings: row.savings_label || '',
    updatedAt: row.updated_at,
  };
}

function inferSkillIcon(source, reference) {
  if (source === 'github') return 'Monitor';
  if (source === 'local') return 'FolderOpen';
  if (reference?.includes('http')) return 'Globe';
  return 'Zap';
}
