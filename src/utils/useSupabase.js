import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  agents as mockAgents, 
  tasks as mockTasks, 
  activityLog as mockActivityLog,
  costData as mockCostData,
  healthMetrics as mockHealthMetrics
} from './mockData';

/**
 * Hook to fetch agents from Supabase with realtime subscription.
 */
export function useAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  const fetchAgents = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setAgents(data.map(mapAgentFromDb));
        setUsingMock(false);
      } else if (data && data.length === 0) {
        await seedCommander();
        const { data: seeded } = await supabase
          .from('agents')
          .select('*')
          .order('created_at', { ascending: true });
        if (seeded && seeded.length > 0) {
          setAgents(seeded.map(mapAgentFromDb));
          setUsingMock(false);
        } else {
          setAgents(mockAgents);
          setUsingMock(true);
        }
      }
    } catch {
      setAgents(mockAgents);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
    const channel = supabase
      .channel('agents-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agents' }, () => {
        fetchAgents();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAgents]);

  const addOptimistic = useCallback((agentData) => {
    const tempAgent = {
      ...agentData,
      id: `temp-${Date.now()}`,
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
  }, []);

  const hasCommander = agents.some(a => a.role === 'commander');

  return { agents, loading, usingMock, hasCommander, addOptimistic, refetch: fetchAgents };
}

/**
 * Hook to fetch tasks from Supabase with realtime subscription.
 */
export function useTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        setTasks(data.map(mapTaskFromDb));
      } else {
        setTasks(mockTasks);
      }
    } catch {
      setTasks(mockTasks);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    const channel = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchTasks]);

  return { tasks, loading, refetch: fetchTasks };
}

/**
 * Hook to fetch activity log.
 */
export function useActivityLog(agentId = null) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      let query = supabase
        .from('activity_log')
        .select('*')
        .order('timestamp', { ascending: true });
      
      if (agentId) query = query.eq('agent_id', agentId);

      const { data, error } = await query;
      if (error) throw error;

      if (data && data.length > 0) {
        setLogs(data.map(mapLogRow));
      } else {
        setLogs(mockActivityLog);
      }
    } catch {
      setLogs(mockActivityLog);
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    fetchLogs();
    const channel = supabase
      .channel('logs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLogs]);

  return { logs, loading, refetch: fetchLogs };
}

/**
 * Hook for cost data.
 */
export function useCostData() {
  const [data, setData] = useState(mockCostData);
  return { data };
}

/**
 * Hook for health metrics.
 */
export function useHealthMetrics() {
  const [data, setData] = useState(mockHealthMetrics);
  return { data };
}

/**
 * Auto-seed a default Commander when the database is empty.
 */
async function seedCommander() {
  const defaultCommander = {
    name: 'Atlas',
    model: 'claude-opus-4-6',
    role: 'commander',
    roleDescription: 'Primary orchestrator — delegates tasks, synthesizes results, and reports to the user',
    color: '#00D9C8',
    temperature: 0.1,
    responseLength: 'medium',
    systemPrompt: 'You are Atlas, the Commander agent. Delegate tasks to sub-agents, synthesize results, and report to the user. Prioritize accuracy over speed.',
    canSpawn: true,
    spawnPattern: 'fan-out',
  };
  try {
    await createAgent(defaultCommander);
  } catch (err) {
    console.warn('[Nexus] Failed to seed Commander:', err.message);
  }
}

/**
 * Insert a new agent into Supabase.
 */
export async function createAgent(agentData) {
  const row = mapAgentToDb(agentData);
  const { data, error } = await supabase.from('agents').insert([row]).select().single();
  if (error) throw error;
  return mapAgentFromDb(data);
}

// ── Mappers ────────────────────────────────────────────────────

function mapAgentFromDb(row) {
  return {
    id:               row.id,
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
    subagents:        [], // Client-side hydration
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
    timestamp:   row.timestamp,
    type:        row.type,
    message:     row.message,
    agentId:     row.agent_id,
    parentLogId: row.parent_log_id,
    tokens:      row.tokens || 0,
    durationMs:  row.duration_ms || 0,
  };
}
