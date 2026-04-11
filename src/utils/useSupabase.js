import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useWorkspaces } from '../context/WorkspaceContext';

function createRealtimeChannelName(prefix, userId) {
  const uniqueSuffix = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${userId}-${uniqueSuffix}`;
}

const PROVIDER_KEY_FIELD = {
  anthropic: 'anthropic_api_key',
  openai: 'openai_api_key',
  google: 'google_api_key',
};

const ACTIVE_WORKSPACE_STORAGE_KEY = 'jarvis_active_workspace';

const PROVIDER_DEFAULT_MODEL = {
  anthropic: 'Claude Opus 4.6',
  openai: 'GPT-5.4',
  google: 'Gemini 3.1',
};

function getStoredWorkspaceId() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(ACTIVE_WORKSPACE_STORAGE_KEY);
  } catch {
    return null;
  }
}

function sanitizePersistedAgentId(agentId) {
  if (!agentId || agentId === 'synthetic-commander') return null;
  return agentId;
}

function normalizeProviderKey(value = '') {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'custom';
  if (normalized.includes('anthropic') || normalized.includes('claude')) return 'anthropic';
  if (normalized.includes('openai') || normalized.includes('open ai') || normalized === 'gpt') return 'openai';
  if (normalized.includes('google') || normalized.includes('gemini')) return 'google';
  return 'custom';
}

function inferProviderFromModelLabel(value = '') {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 'custom';
  if (normalized.includes('claude') || normalized.includes('anthropic')) return 'anthropic';
  if (normalized.includes('gpt') || normalized.includes('openai') || normalized.includes('open ai') || normalized.includes('o1') || normalized.includes('o3') || normalized.includes('o4')) return 'openai';
  if (normalized.includes('gemini') || normalized.includes('google')) return 'google';
  return 'custom';
}

function formatProviderName(providerKey = 'custom') {
  if (providerKey === 'anthropic') return 'Anthropic';
  if (providerKey === 'openai') return 'OpenAI';
  if (providerKey === 'google') return 'Google';
  return 'Custom';
}

function resolveModelDraft({ modelKey, label, provider }) {
  const rawLabel = label?.trim() || modelKey?.trim() || '';
  const normalizedProvider = normalizeProviderKey(provider || rawLabel);
  const inferredProvider = normalizedProvider !== 'custom' ? normalizedProvider : inferProviderFromModelLabel(rawLabel);
  const providerKey = inferredProvider || 'custom';
  const genericProviderAsk = rawLabel && normalizeProviderKey(rawLabel) !== 'custom' && !/[0-9]/.test(rawLabel) && !rawLabel.includes('-');
  const resolvedLabel = genericProviderAsk
    ? (PROVIDER_DEFAULT_MODEL[providerKey] || rawLabel)
    : rawLabel;

  return {
    modelKey: resolvedLabel,
    label: resolvedLabel,
    provider: formatProviderName(providerKey),
  };
}

function useResolvedWorkspaceId(workspaceId = null) {
  const workspaceContext = useWorkspaces();
  return workspaceId ?? workspaceContext?.activeWorkspace?.id ?? null;
}

const DEFAULT_TEMPLATE_SEEDS = [
  {
    name: 'Code Reviewer',
    role: 'qa',
    description: 'Reviews code changes for bugs, regressions, missing tests, and risky edge cases.',
    defaultModel: 'Claude Opus 4.6',
    systemPrompt: 'You are the code review specialist. Focus on correctness, risk, regressions, and missing validation.',
    allowedTools: ['repo', 'diff', 'lint'],
    environmentBindings: ['repository', 'pull-request'],
    vaultRequirements: [],
    approvalMode: 'review_first',
    spawnPolicy: 'ephemeral',
    defaultVisibility: 'shared',
    canDelegate: false,
  },
  {
    name: 'Frontend Builder',
    role: 'ui-agent',
    description: 'Builds polished user-facing surfaces that follow the Jarvis command-center visual language.',
    defaultModel: 'GPT-5.4',
    systemPrompt: 'You are the frontend builder. Ship tactile, intentional interfaces that preserve the established design system.',
    allowedTools: ['repo', 'design-system', 'storybook'],
    environmentBindings: ['repository'],
    vaultRequirements: [],
    approvalMode: 'review_first',
    spawnPolicy: 'ephemeral',
    defaultVisibility: 'shared',
    canDelegate: false,
  },
  {
    name: 'Supabase Operator',
    role: 'ops',
    description: 'Owns schema, migrations, policies, and runtime data plumbing for Supabase-backed features.',
    defaultModel: 'GPT-5.4',
    systemPrompt: 'You are the Supabase operator. Keep data models, RLS, and backend integrity clean and auditable.',
    allowedTools: ['supabase', 'sql', 'repo'],
    environmentBindings: ['supabase'],
    vaultRequirements: ['Supabase service role'],
    approvalMode: 'approval_required',
    spawnPolicy: 'ephemeral',
    defaultVisibility: 'restricted',
    canDelegate: false,
  },
  {
    name: 'Research Analyst',
    role: 'researcher',
    description: 'Investigates markets, product ideas, and technical options and returns structured findings.',
    defaultModel: 'Gemini 3.1',
    systemPrompt: 'You are the research analyst. Gather signal, compare options, and return concise decision support.',
    allowedTools: ['web', 'documents', 'knowledge'],
    environmentBindings: ['knowledge-base'],
    vaultRequirements: [],
    approvalMode: 'review_first',
    spawnPolicy: 'ephemeral',
    defaultVisibility: 'shared',
    canDelegate: false,
  },
  {
    name: 'Docs and Briefing Writer',
    role: 'researcher',
    description: 'Turns messy inputs into launch notes, briefings, and executive updates.',
    defaultModel: 'Claude Sonnet 4.6',
    systemPrompt: 'You are the briefing writer. Turn rough context into polished, actionable written output.',
    allowedTools: ['documents', 'repo', 'knowledge'],
    environmentBindings: ['workspace'],
    vaultRequirements: [],
    approvalMode: 'review_first',
    spawnPolicy: 'ephemeral',
    defaultVisibility: 'shared',
    canDelegate: false,
  },
  {
    name: 'Incident Commander',
    role: 'ops',
    description: 'Triages incidents, coordinates response actions, and keeps the human informed.',
    defaultModel: 'Claude Opus 4.6',
    systemPrompt: 'You are the incident commander. Triage impact, coordinate next actions, and keep updates crisp.',
    allowedTools: ['logs', 'alerts', 'repo'],
    environmentBindings: ['observability', 'workspace'],
    vaultRequirements: ['Ops pager', 'Incident webhook'],
    approvalMode: 'approval_required',
    spawnPolicy: 'ephemeral',
    defaultVisibility: 'restricted',
    canDelegate: true,
  },
  {
    name: 'Task Router',
    role: 'ops',
    description: 'Routes work to the right specialist template and keeps the execution graph organized.',
    defaultModel: 'GPT-5.4-mini',
    systemPrompt: 'You are the task router. Break requests into specialist work and delegate with discipline.',
    allowedTools: ['planner', 'repo'],
    environmentBindings: ['workspace'],
    vaultRequirements: [],
    approvalMode: 'review_first',
    spawnPolicy: 'ephemeral',
    defaultVisibility: 'shared',
    canDelegate: true,
  },
  {
    name: 'QA Regression Specialist',
    role: 'qa',
    description: 'Runs targeted validation passes, regression checks, and acceptance criteria review.',
    defaultModel: 'GPT-5.4-mini',
    systemPrompt: 'You are the QA regression specialist. Validate expected behavior and flag regressions clearly.',
    allowedTools: ['repo', 'tests', 'lint'],
    environmentBindings: ['repository'],
    vaultRequirements: [],
    approvalMode: 'review_first',
    spawnPolicy: 'ephemeral',
    defaultVisibility: 'shared',
    canDelegate: false,
  },
  {
    name: 'Growth and Content Operator',
    role: 'researcher',
    description: 'Drafts growth experiments, launch assets, and content operations workflows.',
    defaultModel: 'Gemini 3.1',
    systemPrompt: 'You are the growth operator. Produce high-leverage content and experiment ideas tied to business outcomes.',
    allowedTools: ['documents', 'web', 'knowledge'],
    environmentBindings: ['workspace'],
    vaultRequirements: ['Marketing CMS'],
    approvalMode: 'review_first',
    spawnPolicy: 'ephemeral',
    defaultVisibility: 'shared',
    canDelegate: false,
  },
  {
    name: 'Integration and MCP Technician',
    role: 'ops',
    description: 'Configures MCP servers, tool access, credentials, and integration readiness.',
    defaultModel: 'GPT-5.4',
    systemPrompt: 'You are the integration technician. Make tools available safely, validate credentials, and surface readiness blockers.',
    allowedTools: ['mcp', 'credentials', 'repo'],
    environmentBindings: ['mcp', 'connected-systems'],
    vaultRequirements: ['Tool secrets'],
    approvalMode: 'approval_required',
    spawnPolicy: 'ephemeral',
    defaultVisibility: 'restricted',
    canDelegate: false,
  },
];

async function ensureDefaultAgentTemplates(user) {
  if (!user?.id) return [];

  const rows = DEFAULT_TEMPLATE_SEEDS.map((template) => ({
    user_id: user.id,
    name: template.name,
    role: template.role,
    description: template.description,
    default_model: template.defaultModel,
    system_prompt: template.systemPrompt,
    allowed_tools: template.allowedTools,
    environment_bindings: template.environmentBindings,
    vault_requirements: template.vaultRequirements,
    approval_mode: template.approvalMode,
    spawn_policy: template.spawnPolicy,
    default_visibility: template.defaultVisibility,
    can_delegate: template.canDelegate,
  }));

  const { data, error } = await supabase
    .from('agent_templates')
    .upsert(rows, { onConflict: 'user_id,name' })
    .select('*');

  if (error) throw error;
  return (data || []).map(mapAgentTemplateFromDb);
}

async function ensureModelBankEntry(user, modelKey, provider = 'Custom') {
  if (!user?.id || !modelKey) return null;
  const normalized = resolveModelDraft({ modelKey, label: modelKey, provider });

  const row = {
    user_id: user.id,
    model_key: normalized.modelKey,
    label: normalized.label,
    provider: normalized.provider,
  };

  const { data, error } = await supabase
    .from('model_bank')
    .upsert(row, { onConflict: 'user_id,model_key' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

async function getUserSettings(userId) {
  if (!userId) return null;
  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function ensureCommanderAgent(user, workspaceId = null) {
  if (!user?.id) return null;

  const commanderName = user.user_metadata?.full_name?.trim()
    ? `${user.user_metadata.full_name.trim()} Command`
    : 'Jarvis Commander';
  const commanderModel = 'Claude Opus 4.6';

  const { data: workspaceCommander, error: workspaceError } = await supabase
    .from('agents')
    .select('*')
    .eq('user_id', user.id)
    .eq('role', 'commander')
    .eq('workspace_id', workspaceId || null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (workspaceError && workspaceId) throw workspaceError;
  if (workspaceCommander) return workspaceCommander;

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

  await ensureModelBankEntry(user, commanderModel, 'Anthropic');

  const row = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: commanderName,
    model: commanderModel,
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
  const commanderName = user?.user_metadata?.full_name?.trim()
    ? `${user.user_metadata.full_name.trim()} Command`
    : 'Jarvis Commander';

  return {
    id: 'synthetic-commander',
    userId: user?.id || null,
    name: commanderName,
    model: 'Claude Opus 4.6',
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
export function useAgents(workspaceId = null) {
  const { user } = useAuth();
  const resolvedWorkspaceId = useResolvedWorkspaceId(workspaceId);
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
      let query = supabase
        .from('agents')
        .select('*')
        .eq('user_id', user.id)
        .is('archived_at', null);

      if (resolvedWorkspaceId) query = query.eq('workspace_id', resolvedWorkspaceId);

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;

      let rows = data || [];

      if (resolvedWorkspaceId && !rows.some((agent) => agent.role === 'commander')) {
        const { data: globalCommander, error: commanderError } = await supabase
          .from('agents')
          .select('*')
          .eq('user_id', user.id)
          .eq('role', 'commander')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (commanderError) throw commanderError;
        if (globalCommander) rows = [globalCommander, ...rows];
      }

      const hasCommander = rows.some((agent) => agent.role === 'commander');

      if (!hasCommander && !commanderBootstrapAttempted.current) {
        commanderBootstrapAttempted.current = true;
        try {
          await ensureCommanderAgent(user, resolvedWorkspaceId);
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
  }, [user, resolvedWorkspaceId]);

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

  useEffect(() => {
    setAgents([]);
    setLoading(Boolean(user));
    commanderBootstrapAttempted.current = false;
  }, [resolvedWorkspaceId, user]);

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
export function useTasks(workspaceId = null) {
  const { user } = useAuth();
  const resolvedWorkspaceId = useResolvedWorkspaceId(workspaceId);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    if (!user) {
      setTasks([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id);

      if (resolvedWorkspaceId) query = query.eq('workspace_id', resolvedWorkspaceId);

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;

      setTasks((data || []).map(mapTaskFromDb));
    } catch (err) {
      console.error('[useTasks] Fetch error:', err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }, [user, resolvedWorkspaceId]);

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

  useEffect(() => {
    setTasks([]);
    setLoading(Boolean(user));
  }, [resolvedWorkspaceId, user]);

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

export function useConnectedSystems(workspaceId = null) {
  const { user } = useAuth();
  const resolvedWorkspaceId = useResolvedWorkspaceId(workspaceId);
  const [connectedSystems, setConnectedSystems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchConnectedSystems = useCallback(async () => {
    if (!user) {
      setConnectedSystems([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('connected_systems')
        .select('*')
        .eq('user_id', user.id);

      if (resolvedWorkspaceId) query = query.eq('workspace_id', resolvedWorkspaceId);

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setConnectedSystems((data || []).map(mapConnectedSystemFromDb));
    } catch (error) {
      console.error('[useConnectedSystems] Fetch error:', error);
      setConnectedSystems([]);
    } finally {
      setLoading(false);
    }
  }, [user, resolvedWorkspaceId]);

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

  useEffect(() => {
    setConnectedSystems([]);
    setLoading(Boolean(user));
  }, [resolvedWorkspaceId, user]);

  const upsertSystem = useCallback(async (system) => {
    if (!user) throw new Error('Not authenticated');

    const row = mapConnectedSystemToDb(user.id, system, resolvedWorkspaceId);
    const { data, error } = await supabase
      .from('connected_systems')
      .upsert(row, { onConflict: 'workspace_id,integration_key' })
      .select()
      .single();

    if (error) throw error;
    return mapConnectedSystemFromDb(data);
  }, [user, resolvedWorkspaceId]);

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
      permission_scope: Array.isArray(patch.permissionScope) ? patch.permissionScope : undefined,
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

export function useKnowledgeNamespaces(workspaceId = null) {
  const { user } = useAuth();
  const resolvedWorkspaceId = useResolvedWorkspaceId(workspaceId);
  const [namespaces, setNamespaces] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchNamespaces = useCallback(async () => {
    if (!user) {
      setNamespaces([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('knowledge_namespaces')
        .select('*')
        .eq('user_id', user.id);

      if (resolvedWorkspaceId) query = query.eq('workspace_id', resolvedWorkspaceId);

      const { data, error } = await query.order('updated_at', { ascending: false });

      if (error) throw error;
      setNamespaces((data || []).map(mapKnowledgeNamespaceFromDb));
    } catch (error) {
      console.error('[useKnowledgeNamespaces] Fetch error:', error);
      setNamespaces([]);
    } finally {
      setLoading(false);
    }
  }, [user, resolvedWorkspaceId]);

  useEffect(() => {
    if (!user) return undefined;
    fetchNamespaces();
    return undefined;
  }, [user, fetchNamespaces]);

  useEffect(() => {
    setNamespaces([]);
    setLoading(Boolean(user));
  }, [resolvedWorkspaceId, user]);

  return { namespaces, loading, refetch: fetchNamespaces };
}

export function useSharedDirectives(workspaceId = null) {
  const { user } = useAuth();
  const resolvedWorkspaceId = useResolvedWorkspaceId(workspaceId);
  const [directives, setDirectives] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDirectives = useCallback(async () => {
    if (!user) {
      setDirectives([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('shared_directives')
        .select('*')
        .eq('user_id', user.id);

      if (resolvedWorkspaceId) query = query.eq('workspace_id', resolvedWorkspaceId);

      const { data, error } = await query
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
  }, [user, resolvedWorkspaceId]);

  useEffect(() => {
    if (!user) return undefined;
    fetchDirectives();
    return undefined;
  }, [user, fetchDirectives]);

  useEffect(() => {
    setDirectives([]);
    setLoading(Boolean(user));
  }, [resolvedWorkspaceId, user]);

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

export function useMcpServers(workspaceId = null) {
  const { user } = useAuth();
  const resolvedWorkspaceId = useResolvedWorkspaceId(workspaceId);
  const [servers, setServers] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchServers = useCallback(async () => {
    if (!user) {
      setServers([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('mcp_servers')
        .select('*')
        .eq('user_id', user.id);

      if (resolvedWorkspaceId) query = query.eq('workspace_id', resolvedWorkspaceId);

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;
      setServers((data || []).map(mapMcpServerFromDb));
    } catch (error) {
      console.error('[useMcpServers] Fetch error:', error);
      setServers([]);
    } finally {
      setLoading(false);
    }
  }, [user, resolvedWorkspaceId]);

  useEffect(() => {
    fetchServers();
  }, [fetchServers]);

  useEffect(() => {
    setServers([]);
    setLoading(Boolean(user));
  }, [resolvedWorkspaceId, user]);

  return { servers, loading, refetch: fetchServers };
}

export function useAgentTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const seededDefaultsRef = useRef(false);

  const fetchTemplates = useCallback(async () => {
    if (!user) {
      setTemplates([]);
      setLoading(false);
      return;
    }

    try {
      let { data, error } = await supabase
        .from('agent_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if ((data || []).length === 0 && !seededDefaultsRef.current) {
        seededDefaultsRef.current = true;
        await ensureDefaultAgentTemplates(user);
        ({ data, error } = await supabase
          .from('agent_templates')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true }));
        if (error) throw error;
      }

      setTemplates((data || []).map(mapAgentTemplateFromDb));
    } catch (error) {
      console.error('[useAgentTemplates] Fetch error:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    fetchTemplates();

    const channel = supabase
      .channel(createRealtimeChannelName('agent-templates-user', user.id))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_templates', filter: `user_id=eq.${user.id}` },
        () => fetchTemplates()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchTemplates]);

  return { templates, loading, refetch: fetchTemplates };
}

export function useAgentSessions({ activeOnly = false } = {}) {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchSessions = useCallback(async () => {
    if (!user) {
      setSessions([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('agent_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (activeOnly) {
        query = query.in('status', ['queued', 'running', 'waiting_for_tool', 'needs_review']);
      }

      const { data, error } = await query;
      if (error) throw error;
      setSessions((data || []).map(mapAgentSessionFromDb));
    } catch (error) {
      console.error('[useAgentSessions] Fetch error:', error);
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [user, activeOnly]);

  useEffect(() => {
    if (!user) return undefined;
    fetchSessions();

    const channel = supabase
      .channel(createRealtimeChannelName('agent-sessions-user', user.id))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_sessions', filter: `user_id=eq.${user.id}` },
        () => fetchSessions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchSessions]);

  return { sessions, loading, refetch: fetchSessions };
}

export function useSessionEvents(sessionId) {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(Boolean(sessionId));

  const fetchEvents = useCallback(async () => {
    if (!user || !sessionId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('session_events')
        .select('*')
        .eq('user_id', user.id)
        .eq('session_id', sessionId)
        .order('sequence', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) throw error;
      setEvents((data || []).map(mapSessionEventFromDb));
    } catch (error) {
      console.error('[useSessionEvents] Fetch error:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [user, sessionId]);

  useEffect(() => {
    if (!user || !sessionId) {
      setEvents([]);
      setLoading(false);
      return undefined;
    }

    fetchEvents();

    const channel = supabase
      .channel(createRealtimeChannelName(`session-events-${sessionId}`, user.id))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'session_events', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new?.session_id === sessionId || payload.old?.session_id === sessionId) {
            fetchEvents();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, sessionId, fetchEvents]);

  return { events, loading, refetch: fetchEvents };
}

export function useCredentialVaults() {
  const { user } = useAuth();
  const [vaults, setVaults] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVaults = useCallback(async () => {
    if (!user) {
      setVaults([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('credential_vaults')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVaults((data || []).map(mapCredentialVaultFromDb));
    } catch (error) {
      console.error('[useCredentialVaults] Fetch error:', error);
      setVaults([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;
    fetchVaults();

    const channel = supabase
      .channel(createRealtimeChannelName('credential-vaults-user', user.id))
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'credential_vaults', filter: `user_id=eq.${user.id}` },
        () => fetchVaults()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchVaults]);

  return { vaults, loading, refetch: fetchVaults };
}

export function useVaultBindings(ownerType = null, ownerId = null) {
  const { user } = useAuth();
  const [bindings, setBindings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchBindings = useCallback(async () => {
    if (!user) {
      setBindings([]);
      setLoading(false);
      return;
    }

    try {
      let query = supabase
        .from('vault_bindings')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (ownerType) query = query.eq('owner_type', ownerType);
      if (ownerId) query = query.eq('owner_id', ownerId);

      const { data, error } = await query;
      if (error) throw error;
      setBindings((data || []).map(mapVaultBindingFromDb));
    } catch (error) {
      console.error('[useVaultBindings] Fetch error:', error);
      setBindings([]);
    } finally {
      setLoading(false);
    }
  }, [user, ownerType, ownerId]);

  useEffect(() => {
    if (!user) return undefined;
    fetchBindings();
    return undefined;
  }, [user, fetchBindings]);

  return { bindings, loading, refetch: fetchBindings };
}

export function useProviderCredentials() {
  const { user } = useAuth();
  const [credentials, setCredentials] = useState({
    anthropic: false,
    openai: false,
    google: false,
  });
  const [loading, setLoading] = useState(true);

  const fetchCredentials = useCallback(async () => {
    if (!user) {
      setCredentials({ anthropic: false, openai: false, google: false });
      setLoading(false);
      return;
    }

    try {
      const data = await getUserSettings(user.id);
      setCredentials({
        anthropic: Boolean(data?.anthropic_api_key),
        openai: Boolean(data?.openai_api_key),
        google: Boolean(data?.google_api_key),
      });
    } catch (error) {
      console.error('[useProviderCredentials] Fetch error:', error);
      setCredentials({ anthropic: false, openai: false, google: false });
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCredentials();
  }, [fetchCredentials]);

  return { credentials, loading, refetch: fetchCredentials };
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
    fetchPolicies();
  }, [fetchPolicies]);

  const upsertPolicy = useCallback(async (policy) => {
    if (!user) throw new Error('Not authenticated');

    const row = mapRoutingPolicyToDb(user.id, policy);
    const { data, error } = await supabase
      .from('routing_policies')
      .upsert(row, { onConflict: 'user_id,name' })
      .select()
      .single();

    if (error) throw error;
    return mapRoutingPolicyFromDb(data);
  }, [user]);

  const ensureDefaultPolicy = useCallback(async () => {
    if (!user) throw new Error('Not authenticated');

    const existingDefault = policies.find((policy) => policy.isDefault);
    if (existingDefault) return existingDefault;

    return upsertPolicy({
      name: 'Adaptive Commander Default',
      description: 'Default routing doctrine for Commander.',
      isDefault: true,
      preferredProvider: 'Anthropic',
      preferredModel: 'Claude Opus 4.6',
      preferredAgentRole: 'executor',
      taskDomain: 'general',
      intentType: 'general',
      fallbackOrder: [],
      requiredCapabilities: [],
      preferredSkills: [],
      contextPackIds: [],
      escalationTriggers: [],
      notes: '',
    });
  }, [policies, upsertPolicy, user]);

  return { policies, loading, refetch: fetchPolicies, upsertPolicy, ensureDefaultPolicy };
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
      setOutcomes((data || []).map(mapTaskOutcomeFromDb));
    } catch (error) {
      console.error('[useTaskOutcomes] Fetch error:', error);
      setOutcomes([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

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

export function useTaskInterventions() {
  const { user } = useAuth();
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchInterventions = useCallback(async () => {
    if (!user) {
      setInterventions([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('task_interventions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInterventions((data || []).map(mapTaskInterventionFromDb));
    } catch (error) {
      console.error('[useTaskInterventions] Fetch error:', error);
      setInterventions([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    fetchInterventions();
    const channel = supabase
      .channel(createRealtimeChannelName('task-interventions-user', user.id))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'task_interventions',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchInterventions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchInterventions]);

  return { interventions, loading, refetch: fetchInterventions };
}

export function useApprovalAudit() {
  const { user } = useAuth();
  const [auditTrail, setAuditTrail] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAuditTrail = useCallback(async () => {
    if (!user) {
      setAuditTrail([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('approval_audit')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAuditTrail((data || []).map(mapApprovalAuditFromDb));
    } catch (error) {
      console.error('[useApprovalAudit] Fetch error:', error);
      setAuditTrail([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    fetchAuditTrail();
    const channel = supabase
      .channel(createRealtimeChannelName('approval-audit-user', user.id))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'approval_audit',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchAuditTrail();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchAuditTrail]);

  return { auditTrail, loading, refetch: fetchAuditTrail };
}

export function useSpecialistLifecycle() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLifecycle = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('specialist_lifecycle')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvents((data || []).map(mapSpecialistLifecycleFromDb));
    } catch (error) {
      console.error('[useSpecialistLifecycle] Fetch error:', error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return undefined;

    fetchLifecycle();
    const channel = supabase
      .channel(createRealtimeChannelName('specialist-lifecycle-user', user.id))
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'specialist_lifecycle',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        fetchLifecycle();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchLifecycle]);

  return { events, loading, refetch: fetchLifecycle };
}

async function recordSpecialistLifecycleEvent({
  userId,
  agentId = null,
  rootMissionId = null,
  eventType = 'spawned',
  eventSource = 'ui',
  role = 'specialist',
  provider = null,
  model = null,
  isEphemeral = true,
  message = '',
  metadata = {},
}) {
  if (!userId || !message) return;

  const { error } = await supabase.from('specialist_lifecycle').insert({
    user_id: userId,
    agent_id: agentId,
    root_mission_id: rootMissionId,
    event_type: eventType,
    event_source: eventSource,
    role,
    provider,
    model,
    is_ephemeral: isEphemeral,
    message,
    metadata,
  });

  if (error) {
    console.error('[recordSpecialistLifecycleEvent] Insert error:', error);
  }
}

export async function createAgentTemplate(templateData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const row = mapAgentTemplateToDb(templateData);
  row.user_id = user.id;

  const { data, error } = await supabase
    .from('agent_templates')
    .upsert(row, { onConflict: 'user_id,name' })
    .select()
    .single();

  if (error) throw error;
  return mapAgentTemplateFromDb(data);
}

export async function saveProviderCredential(provider, apiKey) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const field = PROVIDER_KEY_FIELD[provider];
  if (!field) throw new Error(`Unsupported provider: ${provider}`);

  const payload = {
    user_id: user.id,
    [field]: apiKey.trim(),
  };

  const { error } = await supabase
    .from('user_settings')
    .upsert(payload, { onConflict: 'user_id' });

  if (error) throw error;
  return true;
}

export async function ensureProviderInfrastructure({ provider, identifier }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const normalizedProvider = (provider || 'custom').toLowerCase();
  if (!PROVIDER_KEY_FIELD[normalizedProvider]) {
    return { provider: normalizedProvider, status: 'unsupported', hasCredential: false };
  }

  const settings = await getUserSettings(user.id);
  const field = PROVIDER_KEY_FIELD[normalizedProvider];
  const hasCredential = Boolean(settings?.[field]);

  const displayName = normalizedProvider === 'anthropic'
    ? 'Anthropic'
    : normalizedProvider === 'openai'
      ? 'OpenAI'
      : 'Google';

  const securityState = hasCredential ? 'Encrypted vault link' : 'Credential missing';

  const { data: connectedSystem, error: systemError } = await supabase
    .from('connected_systems')
    .upsert({
      user_id: user.id,
      integration_key: normalizedProvider,
      display_name: displayName,
      category: 'Models',
      status: hasCredential ? 'connected' : 'needs_refresh',
      identifier: identifier || `${normalizedProvider}-primary`,
      capabilities: ['Read', 'Write', 'Sync'],
      permission_scope: ['read', 'write', 'sync'],
      domain: 'build',
      trust_level: 'standard',
      risk_level: 'medium',
      last_verified_at: hasCredential ? new Date().toISOString() : null,
      metadata: {
        tone: normalizedProvider === 'anthropic' ? 'violet' : normalizedProvider === 'openai' ? 'teal' : 'blue',
        securityState,
      },
    }, { onConflict: 'user_id,integration_key' })
    .select()
    .single();

  if (systemError) throw systemError;

  const { data: vault, error: vaultError } = await supabase
    .from('credential_vaults')
    .upsert({
      user_id: user.id,
      name: `${displayName} Provider Vault`,
      status: hasCredential ? 'active' : 'needs_setup',
      provider: normalizedProvider,
      secret_refs: hasCredential ? [`${normalizedProvider}_api_key`] : [`missing:${normalizedProvider}_api_key`],
      metadata: {
        source: 'settings_integrations',
        integrationKey: normalizedProvider,
      },
      last_used_at: hasCredential ? new Date().toISOString() : null,
    }, { onConflict: 'user_id,name' })
    .select()
    .single();

  if (vaultError) throw vaultError;

  return {
    provider: normalizedProvider,
    status: hasCredential ? 'connected' : 'needs_setup',
    hasCredential,
    connectedSystem: mapConnectedSystemFromDb(connectedSystem),
    vault: mapCredentialVaultFromDb(vault),
  };
}

export async function updateAgentTemplate(templateId, patch) {
  const { data, error } = await supabase
    .from('agent_templates')
    .update(mapAgentTemplateToDb(patch))
    .eq('id', templateId)
    .select()
    .single();

  if (error) throw error;
  return mapAgentTemplateFromDb(data);
}

export async function createCredentialVault(vaultData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const row = {
    user_id: user.id,
    name: vaultData.name?.trim(),
    status: vaultData.status || 'active',
    provider: vaultData.provider || 'custom',
    secret_refs: Array.isArray(vaultData.secretRefs) ? vaultData.secretRefs : [],
    metadata: vaultData.metadata || {},
    last_used_at: vaultData.lastUsedAt || null,
  };

  if (!row.name) throw new Error('Vault name is required');

  const { data, error } = await supabase
    .from('credential_vaults')
    .upsert(row, { onConflict: 'user_id,name' })
    .select()
    .single();

  if (error) throw error;
  return mapCredentialVaultFromDb(data);
}

export async function upsertVaultBinding(bindingData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const row = {
    user_id: user.id,
    vault_id: bindingData.vaultId,
    owner_type: bindingData.ownerType,
    owner_id: bindingData.ownerId,
    binding_kind: bindingData.bindingKind || 'runtime',
    metadata: bindingData.metadata || {},
  };

  if (!row.vault_id || !row.owner_type || !row.owner_id) {
    throw new Error('Vault binding requires vault, owner type, and owner id');
  }

  const { data, error } = await supabase
    .from('vault_bindings')
    .upsert(row, { onConflict: 'vault_id,owner_type,owner_id,binding_kind' })
    .select()
    .single();

  if (error) throw error;
  return mapVaultBindingFromDb(data);
}

export async function createAgentSession(sessionData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const row = {
    user_id: user.id,
    template_id: sessionData.templateId || null,
    root_agent_id: sanitizePersistedAgentId(sessionData.rootAgentId),
    worker_agent_id: sanitizePersistedAgentId(sessionData.workerAgentId),
    parent_session_id: sessionData.parentSessionId || null,
    title: sessionData.title?.trim() || 'Untitled Session',
    prompt: sessionData.prompt?.trim() || '',
    launch_mode: sessionData.launchMode || 'delegated_run',
    status: sessionData.status || 'queued',
    summary: sessionData.summary || '',
    requested_model: sessionData.requestedModel || null,
    active_worker_count: Number(sessionData.activeWorkerCount ?? 0),
    total_tokens: Number(sessionData.totalTokens ?? 0),
    total_cost: Number(sessionData.totalCost ?? 0),
    tool_call_count: Number(sessionData.toolCallCount ?? 0),
    retry_count: Number(sessionData.retryCount ?? 0),
    started_at: sessionData.startedAt || null,
    completed_at: sessionData.completedAt || null,
  };

  const { data, error } = await supabase
    .from('agent_sessions')
    .insert([row])
    .select()
    .single();

  if (error) throw error;
  return mapAgentSessionFromDb(data);
}

export async function createSessionEvent(eventData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const row = {
    user_id: user.id,
    session_id: eventData.sessionId,
    worker_agent_id: eventData.workerAgentId || null,
    event_type: eventData.eventType,
    title: eventData.title || '',
    content: eventData.content || '',
    status: eventData.status || null,
    payload: eventData.payload || {},
    sequence: Number(eventData.sequence ?? 0),
    started_at: eventData.startedAt || new Date().toISOString(),
    completed_at: eventData.completedAt || null,
    duration_ms: Number(eventData.durationMs ?? 0),
    token_delta: Number(eventData.tokenDelta ?? 0),
    cost_delta: Number(eventData.costDelta ?? 0),
  };

  const { data, error } = await supabase
    .from('session_events')
    .insert([row])
    .select()
    .single();

  if (error) throw error;
  return mapSessionEventFromDb(data);
}

/**
 * Insert a new agent into Supabase.
 */
export async function createAgent(agentData, workspaceId = null) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const resolvedWorkspaceId = workspaceId ?? agentData.workspaceId ?? getStoredWorkspaceId();
  const row = {
    ...mapAgentToDb(agentData),
    user_id: user.id,
    id: crypto.randomUUID(),
  };
  if (resolvedWorkspaceId) row.workspace_id = resolvedWorkspaceId;
  const { data, error } = await supabase.from('agents').insert([row]).select().single();
  if (error) throw error;
  return mapAgentFromDb(data);
}

/**
 * Create a temp (ephemeral) agent tied to the Commander.
 */
export async function createTempAgent({ objective, role, model, commanderId, workspaceId = null }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const resolvedWorkspaceId = workspaceId ?? getStoredWorkspaceId();

  const slug = objective.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const row = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: `temp-${slug}`,
    model,
    status: 'idle',
    role: role || 'researcher',
    parent_id: sanitizePersistedAgentId(commanderId),
    can_spawn: false,
    spawn_pattern: 'sequential',
    is_ephemeral: true,
    system_prompt: `You are a temporary specialist. Objective: ${objective}`,
    color: '#6b7280',
  };
  if (resolvedWorkspaceId) row.workspace_id = resolvedWorkspaceId;
  const { data, error } = await supabase.from('agents').insert([row]).select().single();
  if (error) throw error;
  return mapAgentFromDb(data);
}

export async function createPersistentSpecialist({ name, objective, role, model, commanderId, skills = [] }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const trimmedName = String(name || '').trim() || `${role || 'specialist'}-lane`;
  const resolvedWorkspaceId = getStoredWorkspaceId();
  const provider = formatProviderName(inferProviderFromModelLabel(model || ''));
  const row = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: trimmedName,
    model,
    provider,
    status: 'idle',
    role: role || 'researcher',
    parent_id: sanitizePersistedAgentId(commanderId),
    can_spawn: false,
    spawn_pattern: 'persistent',
    is_ephemeral: false,
    system_prompt: `You are a persistent ${role || 'specialist'} lane. Objective: ${objective || trimmedName}`,
    role_description: objective?.trim() || `Persistent ${role || 'specialist'} lane for Commander.`,
    color: '#60a5fa',
    skills,
  };
  if (resolvedWorkspaceId) row.workspace_id = resolvedWorkspaceId;

  const { data, error } = await supabase.from('agents').insert([row]).select().single();
  if (error) throw error;

  const message = `[specialist-persistent] ${data.name} (${row.role}) promoted as a persistent lane on ${model}.`;
  await supabase.from('activity_log').insert([{
    user_id: user.id,
    agent_id: data.id,
    type: 'SYS',
    message,
  }]);
  await recordSpecialistLifecycleEvent({
    userId: user.id,
    agentId: data.id,
    eventType: 'persistent_created',
    eventSource: 'intelligence',
    role: row.role,
    provider,
    model: row.model,
    isEphemeral: false,
    message,
    metadata: {
      objective: objective || trimmedName,
      skills,
      commanderId: commanderId || null,
    },
  });
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
  const provider = current.provider || formatProviderName(inferProviderFromModelLabel(data.model || ''));
  const message = `[specialist-persistent] ${data.name} (${data.role}) promoted from ephemeral to persistent coverage.`;
  await supabase.from('activity_log').insert([{
    user_id: user.id,
    agent_id: data.id,
    type: 'SYS',
    message,
  }]);
  await recordSpecialistLifecycleEvent({
    userId: user.id,
    agentId: data.id,
    eventType: 'promoted',
    eventSource: 'intelligence',
    role: data.role || 'specialist',
    provider,
    model: data.model || null,
    isEphemeral: false,
    message,
    metadata: {
      fromEphemeral: true,
      skills: Array.isArray(data.skills) ? data.skills : [],
    },
  });
  return mapAgentFromDb(data);
}

export async function launchEphemeralSession({
  template,
  prompt,
  modelOverride,
  commanderId,
  title,
  workspaceId = null,
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  if (!template?.id) throw new Error('Template is required to launch a session');
  const resolvedWorkspaceId = workspaceId ?? getStoredWorkspaceId();

  const requestedModel = modelOverride?.trim() || template.defaultModel || template.model || '';
  const effectivePrompt = prompt?.trim() || `Launch ${template.name} on the current objective.`;
  const sessionTitle = title?.trim() || `${template.name} Run`;
  const persistedCommanderId = sanitizePersistedAgentId(commanderId);

  const session = await createAgentSession({
    templateId: template.id,
    rootAgentId: persistedCommanderId,
    title: sessionTitle,
    prompt: effectivePrompt,
    launchMode: 'ephemeral_worker',
    status: 'running',
    summary: `Delegated from ${template.name} template`,
    requestedModel,
    activeWorkerCount: 1,
    startedAt: new Date().toISOString(),
  });

  const workerRow = {
    id: crypto.randomUUID(),
    user_id: user.id,
    name: `${template.name} · ${sessionTitle}`.slice(0, 90),
    model: requestedModel,
    status: 'processing',
    role: template.role || 'researcher',
    role_description: template.description || '',
    parent_id: persistedCommanderId,
    can_spawn: template.canDelegate ?? false,
    spawn_pattern: template.spawnPolicy === 'persistent' ? 'persistent' : 'sequential',
    is_ephemeral: true,
    system_prompt: template.systemPrompt || '',
    color: template.color || '#6b7280',
    skills: template.allowedTools || [],
    template_id: template.id,
    session_id: session.id,
    expires_at: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
  };
  if (resolvedWorkspaceId) workerRow.workspace_id = resolvedWorkspaceId;

  const { data: workerData, error: workerError } = await supabase
    .from('agents')
    .insert([workerRow])
    .select()
    .single();

  if (workerError) throw workerError;

  const { data: sessionData, error: sessionError } = await supabase
    .from('agent_sessions')
    .update({ worker_agent_id: workerData.id })
    .eq('id', session.id)
    .select()
    .single();

  if (sessionError) throw sessionError;

  await createSessionEvent({
    sessionId: session.id,
    workerAgentId: workerData.id,
    eventType: 'status_change',
    title: 'Delegation launched',
    content: `Commander launched ${template.name} as an ephemeral worker.`,
    status: 'running',
    sequence: 0,
  });
  await createSessionEvent({
    sessionId: session.id,
    workerAgentId: workerData.id,
    eventType: 'message',
    title: template.name,
    content: effectivePrompt,
    status: 'running',
    sequence: 1,
  });

  const taskId = crypto.randomUUID();
  const taskRow = {
    id: taskId,
    user_id: user.id,
    title: sessionTitle,
    name: sessionTitle,
    description: effectivePrompt,
    status: 'queued',
    lane: 'active',
    mode: 'balanced',
    priority: 6,
    schedule_type: 'once',
    output_type: 'summary',
    target_type: 'internal',
    agent_id: workerData.id,
    agent_name: workerData.name,
    created_by_commander_id: commanderId || null,
    progress_percent: 0,
    session_id: session.id,
    template_id: template.id,
  };
  if (resolvedWorkspaceId) taskRow.workspace_id = resolvedWorkspaceId;

  const { error: taskError } = await supabase.from('tasks').insert([taskRow]);
  if (taskError) throw taskError;

  await createSessionEvent({
    sessionId: session.id,
    workerAgentId: workerData.id,
    eventType: 'status_change',
    title: 'Task queued',
    content: 'Execution task created and handed to runtime.',
    status: 'queued',
    sequence: 2,
  });

  try {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dispatch-task`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authSession?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          task_id: taskId,
          agent_id: workerData.id,
          task_description: effectivePrompt,
          session_id: session.id,
          template_id: template.id,
        }),
      }
    );

    const result = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(result.error || `HTTP ${res.status}`);
    }
  } catch (dispatchError) {
    const message = dispatchError instanceof Error ? dispatchError.message : 'Dispatch failed';

    await supabase
      .from('agent_sessions')
      .update({
        status: 'failed',
        summary: message,
        completed_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    await supabase
      .from('tasks')
      .update({
        status: 'failed',
        lane: 'blocked',
        failed_at: new Date().toISOString(),
      })
      .eq('id', taskId);

    await supabase
      .from('agents')
      .update({
        status: 'idle',
        archived_at: new Date().toISOString(),
      })
      .eq('id', workerData.id);

    await createSessionEvent({
      sessionId: session.id,
      workerAgentId: workerData.id,
      eventType: 'error',
      title: 'Launch failed',
      content: message,
      status: 'failed',
      sequence: 3,
    });

    throw dispatchError;
  }

  return {
    session: mapAgentSessionFromDb(sessionData),
    worker: mapAgentFromDb(workerData),
  };
}

export async function archiveEphemeralAgent(agentId) {
  const { data, error } = await supabase
    .from('agents')
    .update({
      archived_at: new Date().toISOString(),
      status: 'idle',
    })
    .eq('id', agentId)
    .eq('is_ephemeral', true)
    .select()
    .single();

  if (error) throw error;
  return mapAgentFromDb(data);
}

/**
 * Delete all ephemeral agents whose tasks are in a terminal state.
 */
export async function cleanupTempAgents() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('agents')
    .update({ archived_at: new Date().toISOString() })
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
  const normalized = resolveModelDraft(modelData);

  const row = {
    user_id: user.id,
    model_key: normalized.modelKey,
    label: normalized.label,
    provider: normalized.provider,
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

export async function updateAgentConfig(agentId, patch) {
  const row = {
    model: patch.model,
    temperature: patch.temperature,
    response_length: patch.responseLength,
    system_prompt: patch.systemPrompt,
    can_spawn: patch.canSpawn,
    spawn_pattern: patch.spawnPattern,
  };

  const sanitized = Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined)
  );

  const { data, error } = await supabase
    .from('agents')
    .update(sanitized)
    .eq('id', agentId)
    .select()
    .single();

  if (error) throw error;
  return mapAgentFromDb(data);
}

export async function createMcpServer(serverData) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const resolvedWorkspaceId = serverData.workspaceId ?? getStoredWorkspaceId();

  const url = serverData.url?.trim();
  if (!url) throw new Error('Server URL is required');

  const row = {
    user_id: user.id,
    workspace_id: resolvedWorkspaceId,
    name: serverData.name?.trim() || deriveMcpServerName(url),
    url,
    status: serverData.status?.trim() || 'configured',
    tool_count: Number(serverData.toolCount ?? 0),
  };

  const { data, error } = await supabase
    .from('mcp_servers')
    .upsert(row, { onConflict: 'workspace_id,url' })
    .select()
    .single();

  if (error) throw error;
  return mapMcpServerFromDb(data);
}

export async function deleteMcpServer(serverId) {
  const { error } = await supabase
    .from('mcp_servers')
    .delete()
    .eq('id', serverId);

  if (error) throw error;
  return serverId;
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
    isEphemeral:      row.is_ephemeral ?? false,
    templateId:       row.template_id || null,
    sessionId:        row.session_id || null,
    expiresAt:        row.expires_at || null,
    archivedAt:       row.archived_at || null,
    workspaceId:      row.workspace_id || null,
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
    is_ephemeral:      agent.isEphemeral ?? false,
    template_id:       agent.templateId || null,
    session_id:        agent.sessionId || null,
    expires_at:        agent.expiresAt || null,
    archived_at:       agent.archivedAt || null,
    workspace_id:      agent.workspaceId || null,
  };
}

function mapTaskFromDb(row) {
  return {
    id:         row.id,
    userId:     row.user_id,
    workspaceId: row.workspace_id || null,
    name:       row.name,
    status:     row.status,
    parentId:   row.parent_id,
    agentId:    row.agent_id,
    agentName:  row.agent_name,
    durationMs: row.duration_ms || 0,
    costUsd:    parseFloat(row.cost_usd) || 0,
    sessionId:  row.session_id || null,
    templateId: row.template_id || null,
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
    sessionId:   row.session_id || null,
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

function mapMcpServerFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id || null,
    name: row.name,
    url: row.url,
    status: row.status || 'configured',
    toolCount: row.tool_count || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConnectedSystemFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id || null,
    integrationKey: row.integration_key,
    displayName: row.display_name,
    category: row.category || 'System',
    status: row.status || 'connected',
    identifier: row.identifier || '',
    capabilities: Array.isArray(row.capabilities) ? row.capabilities : [],
    permissionScope: Array.isArray(row.permission_scope) ? row.permission_scope : [],
    domain: row.domain || 'general',
    trustLevel: row.trust_level || 'standard',
    riskLevel: row.risk_level || 'medium',
    metadata: row.metadata || {},
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapConnectedSystemToDb(userId, system, workspaceId = null) {
  const row = {
    user_id: userId,
    integration_key: system.integrationKey,
    display_name: system.displayName,
    category: system.category || 'System',
    status: system.status || 'connected',
    identifier: system.identifier || '',
    capabilities: system.capabilities || [],
    permission_scope: system.permissionScope || [],
    domain: system.domain || 'general',
    trust_level: system.trustLevel || 'standard',
    risk_level: system.riskLevel || 'medium',
    metadata: system.metadata || {},
    last_verified_at: system.lastVerifiedAt || new Date().toISOString(),
  };
  if (workspaceId) row.workspace_id = workspaceId;
  return row;
}

function mapKnowledgeNamespaceFromDb(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id || null,
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

function mapRoutingPolicyFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    isDefault: row.is_default ?? false,
    preferredProvider: row.preferred_provider || 'Anthropic',
    preferredModel: row.preferred_model || 'Claude Opus 4.6',
    preferredAgentRole: row.preferred_agent_role || 'executor',
    taskDomain: row.task_domain || 'general',
    intentType: row.intent_type || 'general',
    budgetClass: row.budget_class || 'balanced',
    approvalMode: row.approval_mode || 'risk_weighted',
    fallbackOrder: Array.isArray(row.fallback_order) ? row.fallback_order : [],
    requiredCapabilities: Array.isArray(row.required_capabilities) ? row.required_capabilities : [],
    preferredSkills: Array.isArray(row.preferred_skills) ? row.preferred_skills : [],
    contextPackIds: Array.isArray(row.context_pack_ids) ? row.context_pack_ids : [],
    escalationTriggers: Array.isArray(row.escalation_triggers) ? row.escalation_triggers : [],
    notes: row.notes || '',
    updatedAt: row.updated_at,
  };
}

function mapRoutingPolicyToDb(userId, policy) {
  return {
    user_id: userId,
    name: policy.name?.trim() || 'Adaptive Commander Default',
    description: policy.description?.trim() || '',
    is_default: policy.isDefault ?? false,
    preferred_provider: policy.preferredProvider || 'Anthropic',
    preferred_model: policy.preferredModel || '',
    preferred_agent_role: policy.preferredAgentRole || 'executor',
    task_domain: policy.taskDomain || 'general',
    intent_type: policy.intentType || 'general',
    budget_class: policy.budgetClass || 'balanced',
    approval_mode: policy.approvalMode || 'risk_weighted',
    fallback_order: Array.isArray(policy.fallbackOrder) ? policy.fallbackOrder : [],
    required_capabilities: Array.isArray(policy.requiredCapabilities) ? policy.requiredCapabilities : [],
    preferred_skills: Array.isArray(policy.preferredSkills) ? policy.preferredSkills : [],
    context_pack_ids: Array.isArray(policy.contextPackIds) ? policy.contextPackIds : [],
    escalation_triggers: Array.isArray(policy.escalationTriggers) ? policy.escalationTriggers : [],
    notes: policy.notes || '',
  };
}

function mapSharedDirectiveFromDb(row) {
  return {
    id: row.id,
    workspaceId: row.workspace_id || null,
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

function mapTaskOutcomeFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id || null,
    rootMissionId: row.root_mission_id || null,
    outcomeStatus: row.outcome_status || 'unknown',
    score: row.score ?? null,
    trust: row.trust || 'unknown',
    domain: row.domain || 'general',
    intentType: row.intent_type || 'general',
    model: row.model || null,
    provider: row.provider || null,
    notes: row.notes || '',
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTaskInterventionFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    taskId: row.task_id || null,
    rootMissionId: row.root_mission_id || null,
    eventType: row.event_type || 'intervention',
    eventSource: row.event_source || 'runtime',
    scheduleType: row.schedule_type || null,
    domain: row.domain || 'general',
    intentType: row.intent_type || 'general',
    status: row.status || null,
    tone: row.tone || 'blue',
    provider: row.provider || null,
    model: row.model || null,
    message: row.message || '',
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapApprovalAuditFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    reviewId: row.review_id || null,
    decision: row.decision || 'approved',
    feedback: row.feedback || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
  };
}

function mapSpecialistLifecycleFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id || null,
    rootMissionId: row.root_mission_id || null,
    eventType: row.event_type || 'spawned',
    eventSource: row.event_source || 'ui',
    role: row.role || 'specialist',
    provider: row.provider || null,
    model: row.model || null,
    isEphemeral: row.is_ephemeral ?? true,
    message: row.message || '',
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}

function mapAgentTemplateFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    role: row.role || 'researcher',
    description: row.description || '',
    defaultModel: row.default_model || '',
    systemPrompt: row.system_prompt || '',
    allowedTools: Array.isArray(row.allowed_tools) ? row.allowed_tools : [],
    environmentBindings: Array.isArray(row.environment_bindings) ? row.environment_bindings : [],
    vaultRequirements: Array.isArray(row.vault_requirements) ? row.vault_requirements : [],
    approvalMode: row.approval_mode || 'review_first',
    spawnPolicy: row.spawn_policy || 'ephemeral',
    defaultVisibility: row.default_visibility || 'shared',
    canDelegate: row.can_delegate ?? false,
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAgentTemplateToDb(template) {
  const row = {};
  if (template.name !== undefined) row.name = template.name?.trim();
  if (template.role !== undefined) row.role = template.role || 'researcher';
  if (template.description !== undefined) row.description = template.description || '';
  if (template.defaultModel !== undefined) row.default_model = template.defaultModel || '';
  if (template.systemPrompt !== undefined) row.system_prompt = template.systemPrompt || '';
  if (template.allowedTools !== undefined) row.allowed_tools = Array.isArray(template.allowedTools) ? template.allowedTools : [];
  if (template.environmentBindings !== undefined) row.environment_bindings = Array.isArray(template.environmentBindings) ? template.environmentBindings : [];
  if (template.vaultRequirements !== undefined) row.vault_requirements = Array.isArray(template.vaultRequirements) ? template.vaultRequirements : [];
  if (template.approvalMode !== undefined) row.approval_mode = template.approvalMode || 'review_first';
  if (template.spawnPolicy !== undefined) row.spawn_policy = template.spawnPolicy || 'ephemeral';
  if (template.defaultVisibility !== undefined) row.default_visibility = template.defaultVisibility || 'shared';
  if (template.canDelegate !== undefined) row.can_delegate = template.canDelegate;
  if (template.metadata !== undefined) row.metadata = template.metadata || {};
  return row;
}

function mapAgentSessionFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id || null,
    rootAgentId: row.root_agent_id || null,
    workerAgentId: row.worker_agent_id || null,
    parentSessionId: row.parent_session_id || null,
    title: row.title || 'Untitled Session',
    prompt: row.prompt || '',
    launchMode: row.launch_mode || 'delegated_run',
    status: row.status || 'queued',
    summary: row.summary || '',
    requestedModel: row.requested_model || '',
    activeWorkerCount: row.active_worker_count || 0,
    totalTokens: row.total_tokens || 0,
    totalCost: Number(row.total_cost || 0),
    toolCallCount: row.tool_call_count || 0,
    retryCount: row.retry_count || 0,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapSessionEventFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    sessionId: row.session_id,
    workerAgentId: row.worker_agent_id || null,
    eventType: row.event_type || 'message',
    title: row.title || '',
    content: row.content || '',
    status: row.status || null,
    payload: row.payload || {},
    sequence: row.sequence || 0,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationMs: row.duration_ms || 0,
    tokenDelta: row.token_delta || 0,
    costDelta: Number(row.cost_delta || 0),
    createdAt: row.created_at,
  };
}

function mapCredentialVaultFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    status: row.status || 'active',
    provider: row.provider || 'custom',
    secretRefs: Array.isArray(row.secret_refs) ? row.secret_refs : [],
    metadata: row.metadata || {},
    lastUsedAt: row.last_used_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapVaultBindingFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    vaultId: row.vault_id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    bindingKind: row.binding_kind || 'runtime',
    metadata: row.metadata || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
function inferSkillIcon(source, reference) {
  if (source === 'github') return 'Monitor';
  if (source === 'local') return 'FolderOpen';
  if (reference?.includes('http')) return 'Globe';
  return 'Zap';
}

function deriveMcpServerName(url) {
  try {
    const normalized = url.startsWith('http://') || url.startsWith('https://')
      ? url
      : `http://${url}`;
    const parsed = new URL(normalized);
    return parsed.hostname === '127.0.0.1' ? 'Local MCP Server' : parsed.hostname;
  } catch {
    return url;
  }
}
