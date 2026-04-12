import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

const noopAsync = async () => {};
const noop = () => {};

const WorkspaceContext = createContext({
  workspaces: [],
  activeWorkspace: null,
  setActiveWorkspace: noop,
  createWorkspace: noopAsync,
  updateWorkspace: noopAsync,
  deleteWorkspace: noopAsync,
  cloneWorkspaceData: noopAsync,
  loading: false,
  refetch: noopAsync,
});

const LS_KEY = 'jarvis_active_workspace';

function mapWorkspaceFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    color: row.color || '#00D9C8',
    description: row.description || '',
    isDefault: row.is_default ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function WorkspaceProvider({ children }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(() => {
    try { return localStorage.getItem(LS_KEY); } catch { return null; }
  });
  const [loading, setLoading] = useState(true);
  const bootstrapAttempted = useRef(false);

  const fetchWorkspaces = useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      let rows = data || [];

      // Auto-bootstrap: create default workspace if none exist
      if (rows.length === 0 && !bootstrapAttempted.current) {
        bootstrapAttempted.current = true;
        const defaultName = user.user_metadata?.full_name?.trim()
          ? `${user.user_metadata.full_name.trim()} Command`
          : 'Jarvis Command';

        const { data: newWs, error: createErr } = await supabase
          .from('workspaces')
          .insert([{
            user_id: user.id,
            name: defaultName,
            color: '#00D9C8',
            is_default: true,
          }])
          .select()
          .single();

        if (createErr) {
          console.error('[WorkspaceContext] Bootstrap failed:', createErr);
        } else {
          rows = [newWs];
        }
      }

      const mapped = rows.map(mapWorkspaceFromDb);
      setWorkspaces(mapped);

      // Resolve active workspace
      if (mapped.length > 0) {
        const stored = activeWorkspaceId;
        const match = mapped.find(w => w.id === stored);
        if (!match) {
          const def = mapped.find(w => w.isDefault) || mapped[0];
          setActiveWorkspaceId(def.id);
          try {
            localStorage.setItem(LS_KEY, def.id);
          } catch {
            // Ignore storage failures so workspace selection still works in-memory.
          }
        }
      }
    } catch (err) {
      console.error('[WorkspaceContext] Fetch error:', err);
      setWorkspaces([]);
    } finally {
      setLoading(false);
    }
  }, [user, activeWorkspaceId]);

  useEffect(() => {
    if (!user) {
      bootstrapAttempted.current = false;
      return undefined;
    }

    fetchWorkspaces();

    const channel = supabase
      .channel(`workspaces-${user.id}-${crypto.randomUUID()}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'workspaces',
        filter: `user_id=eq.${user.id}`,
      }, () => fetchWorkspaces())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, fetchWorkspaces]);

  const setActiveWorkspace = useCallback((id) => {
    setActiveWorkspaceId(id);
    try {
      localStorage.setItem(LS_KEY, id);
    } catch {
      // Ignore storage failures so switching still works in-memory.
    }
  }, []);

  const createWorkspace = useCallback(async ({ name, color, description }) => {
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('workspaces')
      .insert([{
        user_id: user.id,
        name: name.trim(),
        color: color || '#00D9C8',
        description: description || '',
        is_default: false,
      }])
      .select()
      .single();

    if (error) throw error;
    return mapWorkspaceFromDb(data);
  }, [user]);

  const updateWorkspace = useCallback(async (id, patch) => {
    if (!user) throw new Error('Not authenticated');

    const row = {};
    if (patch.name !== undefined) row.name = patch.name.trim();
    if (patch.color !== undefined) row.color = patch.color;
    if (patch.description !== undefined) row.description = patch.description;

    const { data, error } = await supabase
      .from('workspaces')
      .update(row)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;
    return mapWorkspaceFromDb(data);
  }, [user]);

  const deleteWorkspace = useCallback(async (id) => {
    if (!user) throw new Error('Not authenticated');
    if (workspaces.length <= 1) throw new Error('Cannot delete the last workspace');

    const ws = workspaces.find(w => w.id === id);
    if (ws?.isDefault) throw new Error('Cannot delete the default workspace');

    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    // Switch to default if we just deleted the active one
    if (activeWorkspaceId === id) {
      const def = workspaces.find(w => w.isDefault && w.id !== id) || workspaces.find(w => w.id !== id);
      if (def) setActiveWorkspace(def.id);
    }
  }, [user, workspaces, activeWorkspaceId, setActiveWorkspace]);

  const cloneWorkspaceData = useCallback(async (sourceWorkspaceId, targetWorkspaceId) => {
    if (!user) throw new Error('Not authenticated');

    // Clone MCP servers
    const { data: mcpRows } = await supabase
      .from('mcp_servers')
      .select('*')
      .eq('user_id', user.id)
      .eq('workspace_id', sourceWorkspaceId);

    if (mcpRows?.length) {
      const cloned = mcpRows.map(r => ({
        user_id: user.id,
        workspace_id: targetWorkspaceId,
        name: r.name,
        url: r.url,
        status: r.status,
        tool_count: r.tool_count,
      }));
      const { error } = await supabase.from('mcp_servers').insert(cloned);
      if (error) throw error;
    }

    // Clone shared directives
    const { data: directiveRows } = await supabase
      .from('shared_directives')
      .select('*')
      .eq('user_id', user.id)
      .eq('workspace_id', sourceWorkspaceId);

    if (directiveRows?.length) {
      const cloned = directiveRows.map(r => ({
        id: crypto.randomUUID(),
        user_id: user.id,
        workspace_id: targetWorkspaceId,
        name: r.name,
        scope: r.scope,
        applied_to: r.applied_to,
        content: r.content,
        priority: r.priority,
        icon: r.icon,
      }));
      const { error } = await supabase.from('shared_directives').insert(cloned);
      if (error) throw error;
    }

    // Clone knowledge namespaces
    const { data: nsRows } = await supabase
      .from('knowledge_namespaces')
      .select('*')
      .eq('user_id', user.id)
      .eq('workspace_id', sourceWorkspaceId);

    if (nsRows?.length) {
      const cloned = nsRows.map(r => ({
        id: crypto.randomUUID(),
        user_id: user.id,
        workspace_id: targetWorkspaceId,
        name: r.name,
        vectors: r.vectors,
        size_label: r.size_label,
        status: r.status,
        agents: [],
        description: r.description,
      }));
      const { error } = await supabase.from('knowledge_namespaces').insert(cloned);
      if (error) throw error;
    }
  }, [user]);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0] || null;

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspace,
      setActiveWorkspace,
      createWorkspace,
      updateWorkspace,
      deleteWorkspace,
      cloneWorkspaceData,
      loading,
      refetch: fetchWorkspaces,
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkspaces = () => useContext(WorkspaceContext);
