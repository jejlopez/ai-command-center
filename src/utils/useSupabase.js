import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { 
  agents as mockAgents, 
  tasks as mockTasks, 
  activityLog as mockActivityLog,
  costData as mockCostData,
  healthMetrics as mockHealthMetrics
} from './mockData';

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
  const [usingMock, setUsingMock] = useState(false);

  const fetchAgents = useCallback(async () => {
    if (!user) {
      console.log('[useAgents] No user session yet, waiting...');
      return;
    }
    
    console.log('[useAgents] Fetching agents for user:', user.id);
    try {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[useAgents] Fetch error:', error.message);
        throw error;
      }

      if (data && data.length > 0) {
        console.log(`[useAgents] Successfully fetched ${data.length} real agents.`);
        setAgents(data.map(mapAgentFromDb));
        setUsingMock(false);
      } else {
        console.log('[useAgents] No real agents found for this user. Attempting to seed...');
        // No agents for this user - check if we should seed a Commander
        await seedCommander(user.id);
        
        // Re-fetch after potential seed
        const { data: seeded } = await supabase
          .from('agents')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true });
          
        if (seeded && seeded.length > 0) {
          console.log('[useAgents] Seeding successful. Switching to live data.');
          setAgents(seeded.map(mapAgentFromDb));
          setUsingMock(false);
        } else {
          console.warn('[useAgents] Seeding returned no data. Falling back to mock.');
          setAgents(mockAgents.map(a => ({ ...a, user_id: user.id })));
          setUsingMock(true);
        }
      }
    } catch (err) {
      console.error('[useAgents] Critical reach failure:', err);
      setAgents(mockAgents);
      setUsingMock(true);
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

  return { agents, loading, usingMock, hasCommander, addOptimistic, refetch: fetchAgents };
}

/**
 * Hook to fetch tasks from Supabase with user scoping.
 */
export function useTasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
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
    if (!user) return;
    
    try {
      let query = supabase
        .from('activity_log')
        .select('*')
        // Note: activity_log should also have user_id for true isolation
        .order('timestamp', { ascending: true });
      
      // If activity_log has user_id column:
      // query = query.eq('user_id', user.id);
      
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
  }, [user, agentId]);

  useEffect(() => {
    if (!user) return;
    
    fetchLogs();
    
    const channel = supabase
      .channel(createRealtimeChannelName('logs-user', user.id))
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'activity_log' 
        // filter: `user_id=eq.${user.id}`
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
  const [data] = useState(mockCostData);
  return { data };
}

/**
 * Hook for health metrics.
 */
export function useHealthMetrics() {
  const [data] = useState(mockHealthMetrics);
  return { data };
}

/**
 * Auto-seed a default Commander for a specific user if they don't have one.
 */
async function seedCommander(userId) {
  try {
    // Check if the user already has any agents at all
    const { count } = await supabase
      .from('agents')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);
      
    if (count > 0) return; // User already has a fleet, don't seed

    const defaultCommander = {
      user_id: userId,
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
    
    // Attempt to insert Atlas. The database's new UNIQUE constraint will prevent duplicates.
    const { error } = await supabase.from('agents').insert([mapAgentToDb(defaultCommander)]);
    
    if (error && error.code !== '23505') { // Ignore unique_violation error (it means Atlas is already there)
      throw error;
    }
  } catch (err) {
    console.warn('[Nexus] Failed to seed Commander:', err.message);
  }
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
