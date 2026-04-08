import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';

function createRealtimeChannelName(prefix, userId) {
  const uniqueSuffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${userId}-${uniqueSuffix}`;
}

/**
 * Hook to fetch agents from Supabase with realtime subscription.
 * Scoped to the current authenticated user.
 */
export function useAgents() {
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

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

      setAgents((data || []).map(mapAgentFromDb));
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

  useEffect(() => {
    let cancelled = false;

    async function fetchHealthMetrics() {
      if (!user) {
        setData([]);
        return;
      }

      try {
        const { data: agentsData, error } = await supabase
          .from('agents')
          .select('status, success_rate, latency_ms')
          .eq('user_id', user.id);

        if (error) throw error;

        const rows = agentsData || [];
        const totalAgents = rows.length || 1;
        const healthyAgents = rows.filter((row) => row.status !== 'error').length;
        const avgSuccess = rows.reduce((sum, row) => sum + Number(row.success_rate || 0), 0) / totalAgents;
        const avgLatency = rows.reduce((sum, row) => sum + Number(row.latency_ms || 0), 0) / totalAgents;

        if (!cancelled) {
          setData([
            { label: 'Availability', value: Math.round((healthyAgents / totalAgents) * 100), color: '#00D9C8', history24h: [] },
            { label: 'Success', value: Math.round(avgSuccess || 0), color: '#60a5fa', history24h: [] },
            { label: 'Latency', value: Math.max(0, 100 - Math.min(100, Math.round(avgLatency / 10))), color: '#fbbf24', history24h: [] },
          ]);
        }
      } catch (error) {
        console.error('[useHealthMetrics] Fetch error:', error);
        if (!cancelled) setData([]);
      }
    }

    fetchHealthMetrics();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { data };
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

export async function createModelBankEntry(modelData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const row = {
    user_id: user.id,
    model_key: modelData.modelKey?.trim() || modelData.label?.trim(),
    label: modelData.label?.trim() || modelData.modelKey?.trim(),
    provider: modelData.provider?.trim() || 'Custom',
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
    subagents:        [], 
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  };
}

function mapAgentToDb(agent) {
  return {
    name:             agent.name,
    model:            agent.model,
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
  };
}

function mapTaskFromDb(row) {
  return {
    id:         row.id,
    userId:     row.user_id,
    name:       row.name,
    status:     row.status,
    parentId:   row.parent_id,
    agentId:    row.agent_id,
    agentName:  row.agent_name,
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
    provider: row.provider || 'Custom',
    costPer1k: Number(row.cost_per_1k || 0),
    createdAt: row.created_at,
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

function inferSkillIcon(source, reference) {
  if (source === 'github') return 'Monitor';
  if (source === 'local') return 'FolderOpen';
  if (reference?.includes('http')) return 'Globe';
  return 'Zap';
}
