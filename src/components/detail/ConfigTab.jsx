import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, ArrowUpRight, ChevronDown, Plus, Info } from 'lucide-react';
import { cn } from '../../utils/cn';
import { createModelBankEntry, useModelBank } from '../../utils/useSupabase';

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
            className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-lg border border-white/10 bg-surface p-3 text-[11px] leading-relaxed text-text-body shadow-2xl pointer-events-none"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={cn('relative h-5 w-9 rounded-full transition-colors', value ? 'bg-aurora-teal' : 'bg-white/10')}
    >
      <div className={cn('absolute top-[3px] h-3.5 w-3.5 rounded-full bg-white transition-transform', value ? 'translate-x-[18px]' : 'translate-x-[3px]')} />
    </button>
  );
}

export function ConfigTab({ agent }) {
  const { models, refetch: refetchModels } = useModelBank();
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
  const [newModelLabel, setNewModelLabel] = useState('');

  useEffect(() => {
    setModel(agent.model);
    setTemp(agent.temperature ?? 0.7);
    setRespLength(agent.responseLength ?? 'medium');
    setSysPrompt(agent.systemPrompt ?? '');
    setSpawnPattern(agent.spawnPattern ?? 'sequential');
    setCanSpawn(agent.canSpawn ?? false);
    setParallelCalls(true);
    setCustomTemp('');
    setDirty(false);
  }, [agent]);

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
  const markDirty = () => setDirty(true);

  const handleAddModel = async () => {
    if (!newModelLabel.trim()) return;

    const saved = await createModelBankEntry({
      label: newModelLabel,
      modelKey: newModelLabel,
    });
    await refetchModels();
    setModel(saved.modelKey);
    setNewModelLabel('');
    setShowModelDropdown(false);
    markDirty();
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {agent.role === 'commander' && <Crown className="w-4 h-4 text-aurora-amber" />}
            <div>
              <h3 className="text-base font-semibold text-text-primary">{agent.name}</h3>
              <div className="mt-0.5 flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-text-disabled">{agent.role}</span>
                {agent.parentId && (
                  <span className="flex items-center gap-1 text-[10px] font-mono text-text-disabled">
                    <ArrowUpRight className="w-2.5 h-2.5" /> Parent linked
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={cn(
            'rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider',
            agent.status === 'processing' ? 'bg-aurora-teal/10 text-aurora-teal' :
            agent.status === 'error' ? 'bg-aurora-rose/10 text-aurora-rose' :
            'bg-white/5 text-text-muted'
          )}>
            {agent.status}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Model</label>
          <div className="relative">
            <button
              onClick={() => setShowModelDropdown(!showModelDropdown)}
              className="flex w-full items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-sm text-text-primary transition-colors hover:border-white/[0.14]"
            >
              <span className="font-mono text-sm">{model}</span>
              <ChevronDown className={cn('h-4 w-4 text-text-muted transition-transform', showModelDropdown && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {showModelDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-surface shadow-2xl no-scrollbar"
                >
                  <div>
                    <div className="bg-canvas/50 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-text-disabled">
                      Your Model Bank
                    </div>
                    {models.length > 0 ? models.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => { setModel(m.modelKey); setShowModelDropdown(false); markDirty(); }}
                          className={cn(
                            'flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-white/[0.05]',
                            model === m.modelKey && 'bg-aurora-teal/5'
                          )}
                        >
                          <span className="font-mono text-xs text-text-primary">{m.label}</span>
                          <span className="font-mono text-[10px] text-text-disabled">{m.provider}</span>
                        </button>
                      ))
                      : <div className="px-3 py-3 text-xs text-text-muted">No saved models yet.</div>}
                  </div>
                  <div className="border-t border-white/5 p-3 space-y-2">
                    <input
                      type="text"
                      value={newModelLabel}
                      onChange={(e) => setNewModelLabel(e.target.value)}
                      placeholder="Add model to your bank"
                      className="w-full rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs font-mono text-text-primary outline-none focus:border-aurora-teal/40"
                    />
                    <button
                      type="button"
                      onClick={handleAddModel}
                      className="flex w-full items-center gap-2 rounded-lg bg-aurora-teal px-3 py-2.5 text-xs font-bold text-black disabled:opacity-50"
                      disabled={!newModelLabel.trim()}
                    >
                      <Plus className="h-3.5 w-3.5" /> Save Model
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Temperature</label>
            <InfoBubble text="Controls how creative vs deterministic the agent's responses are. Lower = more precise and reliable. Higher = more creative and varied." />
          </div>
          <div className="flex items-center gap-2">
            {tempPresets.map((preset) => (
              <button
                key={preset.label}
                onClick={() => { setTemp(preset.value); setCustomTemp(''); markDirty(); }}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                  temp === preset.value
                    ? 'border-aurora-teal/40 bg-aurora-teal/10 text-aurora-teal'
                    : 'border-white/[0.07] bg-white/[0.03] text-text-muted hover:border-white/[0.14]'
                )}
              >
                {preset.label}
              </button>
            ))}
            <input
              type="number"
              min="0"
              max="2"
              step="0.05"
              placeholder="Custom"
              value={customTemp}
              onChange={(e) => { setCustomTemp(e.target.value); setTemp(parseFloat(e.target.value) || 0); markDirty(); }}
              className="w-20 rounded-lg border border-white/[0.07] bg-white/[0.03] px-2 py-1.5 text-center font-mono text-xs text-text-primary outline-none transition-colors focus:border-aurora-teal/40"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Response Length</label>
            <InfoBubble text="Controls the maximum length of agent responses. Maps to token limits under the hood." />
          </div>
          <div className="flex items-center gap-2">
            {lengthPresets.map((length) => (
              <button
                key={length}
                onClick={() => { setRespLength(length); markDirty(); }}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-xs font-medium capitalize transition-all',
                  respLength === length
                    ? 'border-aurora-teal/40 bg-aurora-teal/10 text-aurora-teal'
                    : 'border-white/[0.07] bg-white/[0.03] text-text-muted hover:border-white/[0.14]'
                )}
              >
                {length}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">System Prompt</label>
          <textarea
            value={sysPrompt}
            onChange={(e) => { setSysPrompt(e.target.value); markDirty(); }}
            rows={5}
            className="w-full resize-none rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-xs leading-relaxed text-text-primary outline-none transition-colors focus:border-aurora-teal/40"
          />
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-text-disabled">
            <span>{sysPrompt.length} chars</span>
            <span>~{Math.ceil(sysPrompt.length / 4)} tokens</span>
          </div>
        </div>

        <div>
          <label className="mb-3 block text-[10px] font-semibold uppercase tracking-[0.15em] text-text-muted">Orchestration</label>
          <div className="space-y-3">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs text-text-body">Spawn Pattern</span>
                <InfoBubble text="Determines how this agent creates and manages sub-agents. Fan-out runs them in parallel. Sequential runs one at a time. Persistent keeps them alive between tasks." />
              </div>
              <div className="space-y-1.5">
                {spawnPatterns.map((pattern) => (
                  <button
                    key={pattern.id}
                    onClick={() => { setSpawnPattern(pattern.id); markDirty(); }}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all',
                      spawnPattern === pattern.id
                        ? 'border-aurora-teal/30 bg-aurora-teal/5'
                        : 'border-white/[0.05] bg-white/[0.02] hover:border-white/[0.1]'
                    )}
                  >
                    <div className={cn(
                      'mt-0.5 h-3 w-3 shrink-0 rounded-full border-2 transition-colors',
                      spawnPattern === pattern.id ? 'border-aurora-teal bg-aurora-teal' : 'border-white/20'
                    )} />
                    <div>
                      <div className="text-xs font-medium text-text-primary">{pattern.label}</div>
                      <div className="mt-0.5 text-[10px] text-text-disabled">{pattern.desc}</div>
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
              <Toggle value={canSpawn} onChange={(value) => { setCanSpawn(value); markDirty(); }} />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-body">Parallel Tool Calls</span>
                <InfoBubble text="When enabled, the agent can execute multiple tools at the same time. Faster but uses more resources." />
              </div>
              <Toggle value={parallelCalls} onChange={(value) => { setParallelCalls(value); markDirty(); }} />
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.07] bg-canvas/80 p-4 backdrop-blur">
        <div className="flex gap-2">
          <button
            disabled={!dirty}
            className={cn(
              'flex-1 rounded-lg py-2.5 text-xs font-bold uppercase tracking-wider transition-all',
              dirty ? 'bg-aurora-teal text-[#000] hover:bg-aurora-teal/90' : 'cursor-not-allowed bg-white/5 text-text-disabled'
            )}
          >
            Save Changes
          </button>
          <button
            disabled={!dirty}
            onClick={handleDiscard}
            className="rounded-lg border border-white/[0.07] px-4 py-2.5 text-xs font-medium text-text-muted transition-colors hover:border-white/[0.14]"
          >
            Discard
          </button>
        </div>
      </div>
    </div>
  );
}
