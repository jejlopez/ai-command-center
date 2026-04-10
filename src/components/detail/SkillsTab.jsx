import { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Info, ChevronDown, Search, Zap, Trash2, ExternalLink, Server,
  Globe, Terminal, FolderOpen, Database, MessageSquare, Monitor, BarChart3,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { createSkillBankEntry, updateAgentSkills, useConnectedSystems, useSkillBank } from '../../utils/useSupabase';

const iconMap = { Globe, Terminal, FolderOpen, Zap, Database, MessageSquare, Monitor, BarChart3 };

function InfoBubble({ text }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-text-disabled hover:text-text-muted transition-colors"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      <AnimatePresence>
        {show && (
          <Motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-hairline bg-panel-elevated p-3 text-[11px] leading-relaxed text-text-body shadow-elevated pointer-events-none"
          >
            {text}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SkillsTab({ agent }) {
  const { skills: skillBank, refetch: refetchSkills } = useSkillBank();
  const { connectedSystems, upsertSystem, loading: systemsLoading } = useConnectedSystems();
  const [searchInput, setSearchInput] = useState('');
  const [showMcp, setShowMcp] = useState(false);
  const [showAddServer, setShowAddServer] = useState(false);
  const [serverUrl, setServerUrl] = useState('');

  const agentSkills = skillBank.filter((skill) => agent.skills?.includes(skill.id));
  const availableSkills = skillBank.filter((skill) => !agent.skills?.includes(skill.id));
  const isPath = searchInput.startsWith('/') || searchInput.startsWith('~');
  const isGithub = searchInput.includes('github.com');
  const filteredAvailable = searchInput && !isPath && !isGithub
    ? availableSkills.filter((skill) =>
        skill.name.toLowerCase().includes(searchInput.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchInput.toLowerCase())
      )
    : [];
  const mcpServers = connectedSystems
    .filter((system) => system.category === 'MCP' || system.metadata?.protocol === 'mcp')
    .map((system) => ({
      id: system.id,
      name: system.displayName,
      url: system.identifier || system.metadata?.url || 'Connected through systems dock',
      tools: Array.isArray(system.capabilities) ? system.capabilities.length : 0,
      status: system.status,
    }));

  const syncAgentSkills = async (nextSkills) => {
    await updateAgentSkills(agent.id, nextSkills);
  };

  const handleCreateSkill = async () => {
    const trimmed = searchInput.trim();
    if (!trimmed) return;

    const source = isGithub ? 'github' : isPath ? 'local' : 'custom';
    const skill = await createSkillBankEntry({
      name: isGithub || isPath ? trimmed.split('/').filter(Boolean).pop() || trimmed : trimmed,
      description: source === 'custom' ? 'User-added custom skill' : `User-added ${source} skill`,
      source,
      reference: trimmed,
    });
    await refetchSkills();
    await syncAgentSkills([...(agent.skills || []), skill.id]);
    setSearchInput('');
  };

  const handleConnectMcpServer = async () => {
    const trimmed = serverUrl.trim();
    if (!trimmed) return;

    await upsertSystem({
      integrationKey: `mcp-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      displayName: trimmed.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'MCP Server',
      category: 'MCP',
      status: 'connected',
      identifier: trimmed,
      capabilities: ['Tools', 'Read', 'Dispatch'],
      metadata: {
        protocol: 'mcp',
        url: trimmed,
        securityState: 'Connected through systems dock',
      },
      lastVerifiedAt: new Date().toISOString(),
    });

    setServerUrl('');
    setShowAddServer(false);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Add Skill</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search skills, paste path, or GitHub URL..."
              className="w-full rounded-lg border border-hairline bg-panel-soft py-2.5 pl-9 pr-3 text-xs font-mono text-text-primary outline-none transition-colors placeholder:text-text-disabled focus:border-aurora-teal/40"
            />
          </div>

          {isPath && (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-aurora-teal/20 bg-aurora-teal/5 p-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-aurora-teal">Local Path Detected</div>
                <div className="mt-0.5 max-w-[360px] truncate font-mono text-[11px] text-text-muted">{searchInput}</div>
              </div>
              <button onClick={handleCreateSkill} className="shrink-0 rounded-md bg-aurora-teal px-3 py-1.5 text-[10px] font-bold text-[#000]">Save + Attach</button>
            </div>
          )}
          {isGithub && (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-aurora-violet/20 bg-aurora-violet/5 p-3">
              <div>
                <div className="text-[10px] font-bold uppercase text-aurora-violet">GitHub Repo Detected</div>
                <div className="mt-0.5 max-w-[360px] truncate font-mono text-[11px] text-text-muted">{searchInput}</div>
              </div>
              <button onClick={handleCreateSkill} className="shrink-0 rounded-md bg-aurora-violet px-3 py-1.5 text-[10px] font-bold text-white">Save + Attach</button>
            </div>
          )}
          {searchInput && !isPath && !isGithub && filteredAvailable.length === 0 && (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-hairline bg-panel-soft p-3">
              <div className="text-[11px] text-text-muted">Create a new skill bank entry for "{searchInput}"</div>
              <button onClick={handleCreateSkill} className="shrink-0 rounded-md bg-aurora-teal px-3 py-1.5 text-[10px] font-bold text-black">Save + Attach</button>
            </div>
          )}

          {filteredAvailable.length > 0 && (
            <div className="mt-2 overflow-hidden rounded-lg border border-hairline">
              {filteredAvailable.map((skill) => {
                const Icon = iconMap[skill.icon] || Zap;
                return (
                  <div key={skill.id} className="flex items-center justify-between border-b border-hairline px-3 py-2.5 transition-colors hover:bg-panel-soft last:border-0">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-text-primary">{skill.name}</div>
                        <div className="truncate text-[10px] text-text-disabled">{skill.description}</div>
                      </div>
                    </div>
                    <button
                      onClick={() => syncAgentSkills([...(agent.skills || []), skill.id])}
                      className="ml-2 shrink-0 rounded px-2 py-1 text-[10px] font-bold text-aurora-teal transition-colors hover:bg-aurora-teal/10"
                    >
                      + Add
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <label className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
            Installed ({agentSkills.length})
          </label>
          <div className="space-y-1">
            {agentSkills.map((skill) => {
              const Icon = iconMap[skill.icon] || Zap;
              return (
                <div key={skill.id} className="group flex items-center justify-between rounded-lg border border-hairline bg-panel-soft px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-text-primary">{skill.name}</div>
                      <div className="truncate text-[10px] text-text-disabled">{skill.description}</div>
                    </div>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-2">
                    <span className="rounded bg-panel-soft px-1.5 py-0.5 font-mono text-[9px] text-text-disabled">{skill.source}</span>
                    <button
                      onClick={() => syncAgentSkills((agent.skills || []).filter((skillId) => skillId !== skill.id))}
                      className="text-text-disabled opacity-0 transition-opacity group-hover:opacity-100 hover:text-aurora-rose"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
            {agentSkills.length === 0 && (
              <div className="rounded-lg border border-hairline bg-panel-soft px-3 py-4 text-xs text-text-muted">
                No skills attached to this agent yet.
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">
            Skill Bank
            <span className="ml-2 normal-case tracking-normal text-text-disabled">Shared across all agents</span>
          </label>
          <div className="space-y-1">
            {availableSkills.map((skill) => {
              const Icon = iconMap[skill.icon] || Zap;
              return (
                <div key={skill.id} className="flex items-center justify-between rounded-lg border border-hairline bg-panel-soft px-3 py-2 transition-colors hover:border-hairline">
                  <div className="flex items-center gap-2.5">
                    <Icon className="h-3.5 w-3.5 text-text-disabled" />
                    <span className="text-xs text-text-muted">{skill.name}</span>
                  </div>
                  <button
                    onClick={() => syncAgentSkills([...(agent.skills || []), skill.id])}
                    className="rounded px-2 py-1 text-[10px] font-bold text-aurora-teal transition-colors hover:bg-aurora-teal/10"
                  >
                    + Add
                  </button>
                </div>
              );
            })}
            {availableSkills.length === 0 && (
              <div className="rounded-lg border border-hairline bg-panel-soft px-3 py-4 text-xs text-text-muted">
                Your skill bank is empty. Add a local path, GitHub URL, or custom skill above.
              </div>
            )}
          </div>
        </div>

        <div>
          <button
            onClick={() => setShowMcp(!showMcp)}
            className="mb-3 flex w-full items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted"
          >
            <ChevronDown className={cn('h-3 w-3 transition-transform', showMcp && 'rotate-180')} />
            MCP Servers
            <InfoBubble text="MCP servers expose tools your agents can use. Connect a server by pasting its URL." />
          </button>

          <AnimatePresence>
            {showMcp && (
              <Motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {mcpServers.map((server) => (
                  <div key={server.id} className="flex items-center justify-between rounded-lg border border-hairline bg-panel-soft px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className={cn('h-2 w-2 rounded-full', server.status === 'connected' ? 'bg-aurora-green' : 'bg-aurora-rose')} />
                      <div>
                        <div className="font-mono text-xs text-text-primary">{server.url}</div>
                        <div className="text-[10px] text-text-disabled">{server.name} · {server.tools} tools</div>
                      </div>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 text-text-disabled" />
                  </div>
                ))}
                {!systemsLoading && mcpServers.length === 0 && (
                  <div className="rounded-lg border border-dashed border-hairline bg-panel-soft px-3 py-4 text-xs text-text-muted">
                    No MCP servers are wired yet. Connect one below and it will appear everywhere the systems dock is used.
                  </div>
                )}
                {showAddServer ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={serverUrl}
                      onChange={(e) => setServerUrl(e.target.value)}
                      placeholder="Server URL (e.g., localhost:3001)"
                      className="flex-1 rounded-lg border border-hairline bg-panel-soft px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-aurora-teal/40"
                    />
                    <button
                      onClick={handleConnectMcpServer}
                      className="shrink-0 rounded-lg bg-aurora-teal px-3 py-2 text-[10px] font-bold text-[#000]"
                    >
                      Connect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddServer(true)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-hairline py-2.5 text-[10px] text-text-muted transition-colors hover:border-aurora-teal/30 hover:text-aurora-teal shadow-sm"
                  >
                    <Server className="h-3 w-3" /> Connect MCP Server
                  </button>
                )}
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
