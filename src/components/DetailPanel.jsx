import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, RefreshCw, Pause, Play, MoreVertical, Info,
  Crown, ArrowUpRight, ChevronDown, Plus, Search,
  Globe, Terminal, FolderOpen, Zap, Database, MessageSquare, Monitor, BarChart3,
  Trash2, ExternalLink, Server, AlertTriangle,
} from 'lucide-react';
import { ActivityFeed } from './ActivityFeed';
import { TraceWaterfall } from './TraceWaterfall';
import { mockSpans, agents, modelRegistry, skillBank, mcpServers } from '../utils/mockData';
import { cn } from '../utils/cn';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

// ── Icon map for skills ─────────────────────────────────────────
const iconMap = { Globe, Terminal, FolderOpen, Zap, Database, MessageSquare, Monitor, BarChart3 };

// ── Info Tooltip ─────────────────────────────────────────────────
function InfoBubble({ text }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative inline-flex">
      <button
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="text-text-disabled hover:text-text-muted transition-colors"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-3 bg-surface border border-white/10 rounded-lg shadow-2xl z-50 text-[11px] text-text-body leading-relaxed pointer-events-none"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Toggle Switch ────────────────────────────────────────────────
function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn("w-9 h-5 rounded-full transition-colors relative", value ? "bg-aurora-teal" : "bg-white/10")}
    >
      <div className={cn("w-3.5 h-3.5 rounded-full bg-white absolute top-[3px] transition-transform", value ? "translate-x-[18px]" : "translate-x-[3px]")} />
    </button>
  );
}

// ── Config Tab ───────────────────────────────────────────────────
function ConfigTab({ agent }) {
  const defaults = {
    model: agent.model,
    temp: agent.temperature ?? 0.7,
    respLength: agent.responseLength ?? 'medium',
    sysPrompt: agent.systemPrompt ?? '',
    spawnPattern: agent.spawnPattern ?? 'sequential',
    canSpawn: agent.canSpawn ?? false,
    parallelCalls: true,
  };

  const [model, setModel] = useState(defaults.model);
  const [temp, setTemp] = useState(defaults.temp);
  const [respLength, setRespLength] = useState(defaults.respLength);
  const [sysPrompt, setSysPrompt] = useState(defaults.sysPrompt);
  const [spawnPattern, setSpawnPattern] = useState(defaults.spawnPattern);
  const [canSpawn, setCanSpawn] = useState(defaults.canSpawn);
  const [parallelCalls, setParallelCalls] = useState(defaults.parallelCalls);
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [customTemp, setCustomTemp] = useState('');
  const [dirty, setDirty] = useState(false);

  const handleDiscard = () => {
    setModel(defaults.model);
    setTemp(defaults.temp);
    setRespLength(defaults.respLength);
    setSysPrompt(defaults.sysPrompt);
    setSpawnPattern(defaults.spawnPattern);
    setCanSpawn(defaults.canSpawn);
    setParallelCalls(defaults.parallelCalls);
    setCustomTemp('');
    setDirty(false);
  };

  const parentAgent = agent.parentId ? agents.find(a => a.id === agent.parentId) : null;

  const tempPresets = [
    { label: 'Precise', value: 0.1 },
    { label: 'Balanced', value: 0.7 },
    { label: 'Creative', value: 1.2 },
  ];

  const lengthPresets = ['short', 'medium', 'long', 'unlimited'];

  const spawnPatterns = [
    { id: 'fan-out', label: 'Fan-out / Fan-in', desc: 'Spawn multiple agents in parallel, collect all results before continuing.' },
    { id: 'sequential', label: 'Sequential', desc: 'Run one agent at a time in order, passing results along the chain.' },
    { id: 'persistent', label: 'Persistent', desc: 'Agent stays alive between tasks, maintaining context and state.' },
  ];

  const allModels = [
    { group: 'Cloud', items: modelRegistry.cloud },
    { group: 'Local (Ollama)', items: modelRegistry.local },
    { group: 'Agents', items: modelRegistry.agents },
  ];

  const markDirty = () => setDirty(true);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">

        {/* Agent Identity */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {agent.role === 'commander' && <Crown className="w-4 h-4 text-aurora-amber" />}
            <div>
              <h3 className="text-text-primary font-semibold text-base">{agent.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-mono text-text-disabled uppercase tracking-wider">{agent.role}</span>
                {parentAgent && (
                  <span className="flex items-center gap-1 text-[10px] text-text-disabled font-mono">
                    <ArrowUpRight className="w-2.5 h-2.5" /> {parentAgent.name}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={cn(
            "px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase tracking-wider",
            agent.status === 'processing' ? 'bg-aurora-teal/10 text-aurora-teal' :
            agent.status === 'error' ? 'bg-aurora-rose/10 text-aurora-rose' :
            'bg-white/5 text-text-muted'
          )}>
            {agent.status}
          </div>
        </div>

        {/* Model Selector */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-2 block">Model</label>
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-sm text-text-primary hover:border-white/[0.14] transition-colors"
            >
              <span className="font-mono text-sm">{model}</span>
              <ChevronDown className={cn("w-4 h-4 text-text-muted transition-transform", showModelDropdown && "rotate-180")} />
            </button>
            <AnimatePresence>
              {showModelDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-surface border border-white/10 rounded-lg shadow-2xl z-50 max-h-64 overflow-y-auto no-scrollbar"
                >
                  {allModels.map(group => (
                    <div key={group.group}>
                      <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold bg-canvas/50">
                        {group.group}
                      </div>
                      {group.items.map(m => (
                        <button
                          key={m.id}
                          onClick={() => { setModel(m.id); setShowModelDropdown(false); markDirty(); }}
                          className={cn(
                            "w-full px-3 py-2 flex items-center justify-between text-left hover:bg-white/[0.05] transition-colors",
                            model === m.id && "bg-aurora-teal/5"
                          )}
                        >
                          <span className="text-xs text-text-primary font-mono">{m.label}</span>
                          {m.costPer1k > 0 ? (
                            <span className="text-[10px] text-text-disabled font-mono">${m.costPer1k}/1k</span>
                          ) : (
                            <span className="text-[10px] text-aurora-green font-mono">Free</span>
                          )}
                        </button>
                      ))}
                    </div>
                  ))}
                  <button className="w-full px-3 py-2.5 flex items-center gap-2 text-xs text-aurora-teal hover:bg-white/[0.05] transition-colors border-t border-white/5">
                    <Plus className="w-3.5 h-3.5" /> Add Custom Endpoint
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Temperature */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold">Temperature</label>
            <InfoBubble text="Controls how creative vs deterministic the agent's responses are. Lower = more precise and reliable. Higher = more creative and varied." />
          </div>
          <div className="flex items-center gap-2">
            {tempPresets.map(p => (
              <button
                key={p.label}
                onClick={() => { setTemp(p.value); setCustomTemp(''); markDirty(); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                  temp === p.value
                    ? "border-aurora-teal/40 bg-aurora-teal/10 text-aurora-teal"
                    : "border-white/[0.07] bg-white/[0.03] text-text-muted hover:border-white/[0.14]"
                )}
              >
                {p.label}
              </button>
            ))}
            <input
              type="number"
              min="0" max="2" step="0.05"
              placeholder="Custom"
              value={customTemp}
              onChange={e => { setCustomTemp(e.target.value); setTemp(parseFloat(e.target.value) || 0); markDirty(); }}
              className="w-20 px-2 py-1.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-xs font-mono text-text-primary text-center focus:border-aurora-teal/40 outline-none transition-colors"
            />
          </div>
        </div>

        {/* Response Length */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <label className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold">Response Length</label>
            <InfoBubble text="Controls the maximum length of agent responses. Maps to token limits under the hood." />
          </div>
          <div className="flex items-center gap-2">
            {lengthPresets.map(l => (
              <button
                key={l}
                onClick={() => { setRespLength(l); markDirty(); }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-medium border capitalize transition-all",
                  respLength === l
                    ? "border-aurora-teal/40 bg-aurora-teal/10 text-aurora-teal"
                    : "border-white/[0.07] bg-white/[0.03] text-text-muted hover:border-white/[0.14]"
                )}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* System Prompt */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-2 block">System Prompt</label>
          <textarea
            value={sysPrompt}
            onChange={e => { setSysPrompt(e.target.value); markDirty(); }}
            rows={5}
            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-xs font-mono text-text-primary resize-none focus:border-aurora-teal/40 outline-none transition-colors leading-relaxed"
          />
          <div className="flex justify-between mt-1.5 text-[10px] text-text-disabled font-mono">
            <span>{sysPrompt.length} chars</span>
            <span>~{Math.ceil(sysPrompt.length / 4)} tokens</span>
          </div>
        </div>

        {/* Orchestration Settings */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-3 block">Orchestration</label>
          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-text-body">Spawn Pattern</span>
                <InfoBubble text="Determines how this agent creates and manages sub-agents. Fan-out runs them in parallel. Sequential runs one at a time. Persistent keeps them alive between tasks." />
              </div>
              <div className="space-y-1.5">
                {spawnPatterns.map(p => (
                  <button
                    key={p.id}
                    onClick={() => { setSpawnPattern(p.id); markDirty(); }}
                    className={cn(
                      "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
                      spawnPattern === p.id
                        ? "border-aurora-teal/30 bg-aurora-teal/5"
                        : "border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1]"
                    )}
                  >
                    <div className={cn(
                      "w-3 h-3 rounded-full border-2 mt-0.5 shrink-0 transition-colors",
                      spawnPattern === p.id ? "border-aurora-teal bg-aurora-teal" : "border-white/20"
                    )} />
                    <div>
                      <div className="text-xs font-medium text-text-primary">{p.label}</div>
                      <div className="text-[10px] text-text-disabled mt-0.5">{p.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-body">Can Spawn Sub-agents</span>
                <InfoBubble text="Whether this agent is allowed to create child agents to delegate work to." />
              </div>
              <Toggle value={canSpawn} onChange={v => { setCanSpawn(v); markDirty(); }} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-body">Parallel Tool Calls</span>
                <InfoBubble text="When enabled, the agent can execute multiple tools at the same time (e.g., scrape 3 websites simultaneously instead of one by one). Faster but uses more resources." />
              </div>
              <Toggle value={parallelCalls} onChange={v => { setParallelCalls(v); markDirty(); }} />
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Footer */}
      <div className="border-t border-white/[0.07] p-4 bg-canvas/80 backdrop-blur shrink-0">
        <div className="flex gap-2">
          <button
            disabled={!dirty}
            className={cn(
              "flex-1 py-2.5 rounded-lg text-xs font-bold font-mono uppercase tracking-wider transition-all",
              dirty ? "bg-aurora-teal text-[#000] hover:bg-aurora-teal/90" : "bg-white/5 text-text-disabled cursor-not-allowed"
            )}
          >
            Save Changes
          </button>
          <button
            disabled={!dirty}
            onClick={handleDiscard}
            className="px-4 py-2.5 rounded-lg text-xs font-medium text-text-muted border border-white/[0.07] hover:border-white/[0.14] transition-colors"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Skills Tab ───────────────────────────────────────────────────
function SkillsTab({ agent }) {
  const [searchInput, setSearchInput] = useState('');
  const [showMcp, setShowMcp] = useState(false);
  const [showAddServer, setShowAddServer] = useState(false);
  const [serverUrl, setServerUrl] = useState('');

  const agentSkills = skillBank.filter(s => agent.skills?.includes(s.id));
  const availableSkills = skillBank.filter(s => !agent.skills?.includes(s.id));

  const isPath = searchInput.startsWith('/') || searchInput.startsWith('~');
  const isGithub = searchInput.includes('github.com');

  const filteredAvailable = searchInput && !isPath && !isGithub
    ? availableSkills.filter(s =>
        s.name.toLowerCase().includes(searchInput.toLowerCase()) ||
        s.description.toLowerCase().includes(searchInput.toLowerCase())
      )
    : [];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">

        {/* Add Skill Input */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-2 block">Add Skill</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search skills, paste path, or GitHub URL..."
              className="w-full pl-9 pr-3 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-xs font-mono text-text-primary placeholder-text-disabled focus:border-aurora-teal/40 outline-none transition-colors"
            />
          </div>

          {isPath && (
            <div className="mt-2 p-3 bg-aurora-teal/5 border border-aurora-teal/20 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-[10px] text-aurora-teal font-bold uppercase">Local Path Detected</div>
                <div className="text-[11px] text-text-muted font-mono mt-0.5 truncate max-w-[360px]">{searchInput}</div>
              </div>
              <button className="px-3 py-1.5 bg-aurora-teal text-[#000] text-[10px] font-bold rounded-md shrink-0">Install</button>
            </div>
          )}
          {isGithub && (
            <div className="mt-2 p-3 bg-aurora-violet/5 border border-aurora-violet/20 rounded-lg flex items-center justify-between">
              <div>
                <div className="text-[10px] text-aurora-violet font-bold uppercase">GitHub Repo Detected</div>
                <div className="text-[11px] text-text-muted font-mono mt-0.5 truncate max-w-[360px]">{searchInput}</div>
              </div>
              <button className="px-3 py-1.5 bg-aurora-violet text-white text-[10px] font-bold rounded-md shrink-0">Install</button>
            </div>
          )}

          {filteredAvailable.length > 0 && (
            <div className="mt-2 border border-white/[0.07] rounded-lg overflow-hidden">
              {filteredAvailable.map(skill => {
                const Icon = iconMap[skill.icon] || Zap;
                return (
                  <div key={skill.id} className="flex items-center justify-between px-3 py-2.5 hover:bg-white/[0.03] transition-colors border-b border-white/[0.03] last:border-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs text-text-primary font-medium">{skill.name}</div>
                        <div className="text-[10px] text-text-disabled truncate">{skill.description}</div>
                      </div>
                    </div>
                    <button className="px-2 py-1 text-[10px] font-bold text-aurora-teal hover:bg-aurora-teal/10 rounded transition-colors shrink-0 ml-2">
                      + Add
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Installed Skills */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-3 block">
            Installed ({agentSkills.length})
          </label>
          <div className="space-y-1">
            {agentSkills.map(skill => {
              const Icon = iconMap[skill.icon] || Zap;
              return (
                <div key={skill.id} className="flex items-center justify-between px-3 py-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05] group">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-text-primary font-medium">{skill.name}</div>
                      <div className="text-[10px] text-text-disabled truncate">{skill.description}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[9px] font-mono text-text-disabled px-1.5 py-0.5 bg-white/[0.03] rounded">{skill.source}</span>
                    <button className="opacity-0 group-hover:opacity-100 transition-opacity text-text-disabled hover:text-aurora-rose">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Skill Bank */}
        <div>
          <label className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-2 block">
            Skill Bank
            <span className="ml-2 text-text-disabled normal-case tracking-normal">Shared across all agents</span>
          </label>
          <div className="space-y-1">
            {availableSkills.map(skill => {
              const Icon = iconMap[skill.icon] || Zap;
              return (
                <div key={skill.id} className="flex items-center justify-between px-3 py-2 bg-white/[0.01] rounded-lg border border-white/[0.03] hover:border-white/[0.07] transition-colors">
                  <div className="flex items-center gap-2.5">
                    <Icon className="w-3.5 h-3.5 text-text-disabled" />
                    <span className="text-xs text-text-muted">{skill.name}</span>
                  </div>
                  <button className="text-[10px] font-bold text-aurora-teal hover:bg-aurora-teal/10 px-2 py-1 rounded transition-colors">
                    + Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* MCP Servers */}
        <div>
          <button
            onClick={() => setShowMcp(!showMcp)}
            className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-3 w-full"
          >
            <ChevronDown className={cn("w-3 h-3 transition-transform", showMcp && "rotate-180")} />
            MCP Servers
            <InfoBubble text="MCP (Model Context Protocol) servers expose tools your agents can use. Connect a server by pasting its URL. The server advertises available tools automatically." />
          </button>

          <AnimatePresence>
            {showMcp && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden space-y-2"
              >
                {mcpServers.map(s => (
                  <div key={s.id} className="flex items-center justify-between px-3 py-2.5 bg-white/[0.02] rounded-lg border border-white/[0.05]">
                    <div className="flex items-center gap-2.5">
                      <div className={cn("w-2 h-2 rounded-full", s.status === 'connected' ? "bg-aurora-green" : "bg-aurora-rose")} />
                      <div>
                        <div className="text-xs text-text-primary font-mono">{s.url}</div>
                        <div className="text-[10px] text-text-disabled">{s.name} · {s.tools} tools</div>
                      </div>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-text-disabled" />
                  </div>
                ))}
                {showAddServer ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={serverUrl}
                      onChange={e => setServerUrl(e.target.value)}
                      placeholder="Server URL (e.g., localhost:3001)"
                      className="flex-1 px-3 py-2 bg-white/[0.03] border border-white/[0.07] rounded-lg text-xs font-mono text-text-primary focus:border-aurora-teal/40 outline-none"
                    />
                    <button className="px-3 py-2 bg-aurora-teal text-[#000] text-[10px] font-bold rounded-lg shrink-0">Connect</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddServer(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 border border-dashed border-white/10 rounded-lg text-[10px] text-text-muted hover:border-aurora-teal/30 hover:text-aurora-teal transition-colors"
                  >
                    <Server className="w-3 h-3" /> Connect MCP Server
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

// ── Metrics Tab ──────────────────────────────────────────────────
function MetricsTab({ agent }) {
  const uptimeHrs = agent.uptimeMs ? (agent.uptimeMs / 3_600_000).toFixed(1) : '0.0';
  const stats = [
    { label: 'Total Tokens', value: (agent.totalTokens || 0).toLocaleString(), sub: `$${(agent.totalCost || 0).toFixed(2)}` },
    { label: 'Avg Latency', value: `${agent.latencyMs}ms`, sub: `p95: ${Math.round(agent.latencyMs * 1.4)}ms` },
    { label: 'Success Rate', value: `${agent.successRate || 0}%`, sub: `${agent.taskCount || 0} tasks` },
    { label: 'Uptime', value: `${uptimeHrs}h`, sub: `${agent.restartCount || 0} restarts` },
  ];

  const tokenHistory = (agent.tokenHistory24h || []).map((tokens, i) => ({ hour: i, tokens }));

  // Deterministic tool call counts seeded from agent token data
  const seedBase = agent.totalTokens || 1000;
  const topTools = (agent.skills || []).slice(0, 4).map((sid, idx) => {
    const skill = skillBank.find(s => s.id === sid);
    return { name: skill?.name || sid, calls: Math.max(5, Math.floor(((seedBase * (idx + 7)) % 47) + 8)) };
  }).sort((a, b) => b.calls - a.calls);

  const maxCalls = Math.max(...topTools.map(t => t.calls), 1);

  return (
    <div className="p-6 space-y-6 overflow-y-auto no-scrollbar h-full">
      <div className="grid grid-cols-2 gap-3">
        {stats.map(s => (
          <div key={s.label} className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3.5">
            <div className="text-[10px] uppercase tracking-[0.15em] text-text-disabled font-semibold mb-1">{s.label}</div>
            <div className="text-xl font-mono font-semibold text-text-primary font-tabular">{s.value}</div>
            <div className="text-[10px] font-mono text-text-disabled mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-3 block">Token Usage (24h)</label>
        <div className="h-24 bg-white/[0.02] border border-white/[0.05] rounded-lg p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={tokenHistory}>
              <defs>
                <linearGradient id={`tokenGrad-${agent.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={agent.color} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={agent.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="tokens" stroke={agent.color} strokeWidth={1.5} fill={`url(#tokenGrad-${agent.id})`} dot={false} isAnimationActive={true} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div>
        <label className="text-[10px] uppercase tracking-[0.15em] text-text-muted font-semibold mb-3 block">Top Tool Calls</label>
        <div className="space-y-2.5">
          {topTools.map(t => (
            <div key={t.name}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-text-primary">{t.name}</span>
                <span className="font-mono text-text-disabled">{t.calls}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: agent.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${(t.calls / maxCalls) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Kebab Menu ───────────────────────────────────────────────────
function KebabMenu({ onClose }) {
  const [showTerminate, setShowTerminate] = useState(false);

  const items = [
    { label: 'Clone Agent' },
    { label: 'Promote Priority' },
    { label: 'Demote Priority' },
    { label: 'Reassign Task' },
    { label: 'Detach from DAG' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      className="absolute top-full right-0 mt-1 w-48 bg-surface border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden"
    >
      {items.map(item => (
        <button
          key={item.label}
          onClick={onClose}
          className="w-full px-3 py-2 text-xs text-text-primary text-left hover:bg-white/[0.05] transition-colors"
        >
          {item.label}
        </button>
      ))}
      <div className="border-t border-white/[0.07]">
        {showTerminate ? (
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-aurora-rose text-[10px] font-bold">
              <AlertTriangle className="w-3 h-3" /> This will permanently stop the agent
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 py-1.5 bg-aurora-rose text-white text-[10px] font-bold rounded-md">Confirm</button>
              <button onClick={() => setShowTerminate(false)} className="flex-1 py-1.5 border border-white/10 text-text-muted text-[10px] rounded-md">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowTerminate(true)} className="w-full px-3 py-2 text-xs text-aurora-rose text-left hover:bg-aurora-rose/5 transition-colors">
            Terminate Agent
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ── Main Detail Panel ────────────────────────────────────────────
export function DetailPanel({ agentId, onClose }) {
  const [activeTab, setActiveTab] = useState('config');
  const [showKebab, setShowKebab] = useState(false);
  const [logView, setLogView] = useState('stream');

  const agent = agents.find(a => a.id === agentId);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
    if (showKebab) {
      const handler = () => setShowKebab(false);
      setTimeout(() => document.addEventListener('click', handler), 0);
      return () => document.removeEventListener('click', handler);
    }
  }, [showKebab]);

  if (!agent) return null;

  const isProcessing = agent.status === 'processing';

  const tabs = [
    { id: 'config', label: 'Config' },
    { id: 'skills', label: 'Skills' },
    { id: 'metrics', label: 'Metrics' },
    { id: 'logs', label: 'Logs' },
  ];

  return (
    <>
      <motion.div
        key="detail-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
      />
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: '0%' }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 300, damping: 35 }}
          className="fixed top-0 right-0 bottom-0 w-[560px] bg-surface border-l border-border z-50 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)]"
        >
          {/* Header */}
          <div className="p-5 border-b border-border flex justify-between items-start bg-canvas/30 backdrop-blur shrink-0">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-lg font-semibold text-text-primary">{agent.name}</h2>
                <div className="spatial-panel px-2 py-0.5 text-[10px] font-mono text-text-muted bg-white/[0.02]">{agent.id}</div>
              </div>
              <div className="flex items-center gap-2 text-xs font-medium">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  isProcessing ? "bg-aurora-teal animate-pulse" : agent.status === 'error' ? "bg-aurora-rose" : "bg-text-muted"
                )} />
                <span className={cn(
                  isProcessing ? "text-aurora-teal" : agent.status === 'error' ? "text-aurora-rose" : "text-text-muted"
                )}>
                  {isProcessing ? 'Active' : agent.status === 'error' ? 'Error' : 'Idle'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button className="p-2 text-text-muted hover:text-aurora-teal hover:bg-white/[0.05] rounded-lg transition-colors" title="Restart">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button className="p-2 text-text-muted hover:text-aurora-amber hover:bg-white/[0.05] rounded-lg transition-colors" title={isProcessing ? 'Pause' : 'Resume'}>
                {isProcessing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowKebab(!showKebab); }}
                  className="p-2 text-text-muted hover:text-text-primary hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                <AnimatePresence>
                  {showKebab && <KebabMenu onClose={() => setShowKebab(false)} />}
                </AnimatePresence>
              </div>
              <div className="w-[1px] h-4 bg-border mx-1" />
              <button onClick={onClose} className="p-2 text-text-muted hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border px-5 shrink-0">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                  activeTab === tab.id ? "border-aurora-teal text-aurora-teal" : "border-transparent text-text-muted hover:text-text-primary"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Status action bar */}
          {agent.status === 'error' && (
            <div className="border-b border-aurora-rose/10 shrink-0">
              <div className="px-5 py-2.5 bg-aurora-rose/5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <AlertTriangle className="w-3.5 h-3.5 text-aurora-rose shrink-0" />
                  <span className="text-[11px] text-aurora-rose font-medium truncate">
                    {agent.errorMessage || 'Agent requires intervention'}
                  </span>
                </div>
                <button className="px-3 py-1 bg-aurora-rose/10 hover:bg-aurora-rose/20 text-aurora-rose text-[10px] font-bold rounded-md border border-aurora-rose/20 transition-colors shrink-0 ml-3">
                  Restart Agent
                </button>
              </div>
              {agent.errorStack && (
                <div className="px-5 py-2 bg-aurora-rose/[0.03]">
                  <pre className="text-[10px] font-mono text-aurora-rose/70 leading-relaxed whitespace-pre-wrap">{agent.errorStack}</pre>
                  <div className="flex items-center gap-3 mt-2 text-[9px] font-mono text-text-disabled">
                    <span>Last heartbeat: {agent.lastHeartbeat || '—'}</span>
                    <span>Restarts: {agent.restartCount || 0}/3</span>
                  </div>
                </div>
              )}
            </div>
          )}
          {agent.status === 'idle' && (
            <div className="px-5 py-2.5 bg-aurora-teal/5 border-b border-aurora-teal/10 flex items-center justify-between shrink-0">
              <span className="text-[11px] text-text-muted font-medium">Agent is idle</span>
              <button className="px-3 py-1 bg-aurora-teal/10 hover:bg-aurora-teal/20 text-aurora-teal text-[10px] font-bold rounded-md border border-aurora-teal/20 transition-colors">
                Assign Task
              </button>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-hidden relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0"
              >
                {activeTab === 'config' && <ConfigTab agent={agent} />}
                {activeTab === 'skills' && <SkillsTab agent={agent} />}
                {activeTab === 'metrics' && <MetricsTab agent={agent} />}
                {activeTab === 'logs' && (
                  <div className="flex flex-col h-full">
                    <div className="px-4 pt-3 pb-1 flex gap-1 shrink-0">
                      <button
                        onClick={() => setLogView('stream')}
                        className={cn(
                          "px-3 py-1 text-[10px] font-bold rounded transition-colors",
                          logView === 'stream' ? 'bg-aurora-teal/10 text-aurora-teal' : 'text-text-muted hover:text-text-primary'
                        )}
                      >
                        Stream
                      </button>
                      <button
                        onClick={() => setLogView('trace')}
                        className={cn(
                          "px-3 py-1 text-[10px] font-bold rounded transition-colors",
                          logView === 'trace' ? 'bg-aurora-teal/10 text-aurora-teal' : 'text-text-muted hover:text-text-primary'
                        )}
                      >
                        Timeline
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      {logView === 'stream' ? <ActivityFeed agentFilter={agentId} /> : <TraceWaterfall spans={mockSpans} />}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
    </>
  );
}
