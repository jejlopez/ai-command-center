import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Settings, X, Monitor, Cpu, Plug, Info, ChevronRight, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '../utils/cn';

/* ------------------------------------------------------------------ */
/*  Reusable primitives                                                */
/* ------------------------------------------------------------------ */

function Toggle({ enabled, onChange, color = 'bg-aurora-teal' }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative w-10 h-5 rounded-full transition-colors duration-200 flex-shrink-0',
        enabled ? color : 'bg-white/[0.08]',
      )}
    >
      <motion.div
        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-md"
        animate={{ x: enabled ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs uppercase tracking-wider text-text-muted mb-3 mt-6 first:mt-0">
      {children}
    </p>
  );
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-text-primary">{label}</p>
        {description && (
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        )}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function PillGroup({ options, value, onChange }) {
  return (
    <div className="flex bg-surface-input rounded-lg p-0.5 gap-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-2.5 py-1 text-xs rounded-md transition-all duration-150 whitespace-nowrap',
            value === opt.value
              ? 'bg-white/[0.1] text-text-primary font-medium'
              : 'text-text-muted hover:text-text-body',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab definitions                                                    */
/* ------------------------------------------------------------------ */

const tabs = [
  { id: 'general', icon: Monitor, label: 'General' },
  { id: 'fleet', icon: Cpu, label: 'Fleet' },
  { id: 'integrations', icon: Plug, label: 'Integrations' },
  { id: 'about', icon: Info, label: 'About' },
];

/* ------------------------------------------------------------------ */
/*  Tab: General                                                       */
/* ------------------------------------------------------------------ */

function GeneralTab() {
  const [theme, setTheme] = useState('dark');
  const [density, setDensity] = useState('comfortable');
  const [refreshInterval, setRefreshInterval] = useState('10s');
  const [notifications, setNotifications] = useState({
    agentErrors: true,
    taskCompletions: true,
    approvals: true,
    systemAlerts: false,
  });

  const toggleNotif = (key) =>
    setNotifications((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div>
      <SectionLabel>Appearance</SectionLabel>
      <SettingRow label="Theme">
        <PillGroup
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'System' },
          ]}
          value={theme}
          onChange={setTheme}
        />
      </SettingRow>
      <SettingRow label="Dashboard density">
        <PillGroup
          options={[
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'compact', label: 'Compact' },
          ]}
          value={density}
          onChange={setDensity}
        />
      </SettingRow>

      <SectionLabel>Notifications</SectionLabel>
      <SettingRow label="Agent errors" description="Alerts when an agent fails or is OOMKilled">
        <Toggle enabled={notifications.agentErrors} onChange={() => toggleNotif('agentErrors')} color="bg-aurora-rose" />
      </SettingRow>
      <SettingRow label="Task completions">
        <Toggle enabled={notifications.taskCompletions} onChange={() => toggleNotif('taskCompletions')} />
      </SettingRow>
      <SettingRow label="Approval requests" description="Human-in-the-loop review prompts">
        <Toggle enabled={notifications.approvals} onChange={() => toggleNotif('approvals')} color="bg-aurora-amber" />
      </SettingRow>
      <SettingRow label="System alerts">
        <Toggle enabled={notifications.systemAlerts} onChange={() => toggleNotif('systemAlerts')} />
      </SettingRow>

      <SectionLabel>Data</SectionLabel>
      <SettingRow label="Auto-refresh interval">
        <PillGroup
          options={[
            { value: '5s', label: '5s' },
            { value: '10s', label: '10s' },
            { value: '30s', label: '30s' },
            { value: '1m', label: '1m' },
            { value: 'off', label: 'Off' },
          ]}
          value={refreshInterval}
          onChange={setRefreshInterval}
        />
      </SettingRow>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Fleet                                                         */
/* ------------------------------------------------------------------ */

function FleetTab() {
  const [defaultModel, setDefaultModel] = useState('claude-opus-4-6');
  const [maxConcurrent, setMaxConcurrent] = useState(8);
  const [autoRestart, setAutoRestart] = useState(true);
  const [tokenBudget, setTokenBudget] = useState('500000');

  const models = [
    { value: 'claude-opus-4-6', label: 'Claude Opus 4' },
    { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gemini-1.5', label: 'Gemini 1.5 Pro' },
  ];

  return (
    <div>
      <SectionLabel>Defaults</SectionLabel>
      <SettingRow label="Default agent model">
        <select
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
          className="bg-surface-input border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary outline-none focus:border-aurora-teal/50 transition-colors cursor-pointer appearance-none pr-8"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
          }}
        >
          {models.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </SettingRow>

      <SectionLabel>Concurrency</SectionLabel>
      <SettingRow label="Max concurrent agents" description={`Currently set to ${maxConcurrent}`}>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted font-mono w-5 text-right">{maxConcurrent}</span>
          <input
            type="range"
            min={1}
            max={20}
            value={maxConcurrent}
            onChange={(e) => setMaxConcurrent(Number(e.target.value))}
            className="w-28 h-1 accent-aurora-teal bg-white/[0.06] rounded-full appearance-none cursor-pointer
              [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
              [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-aurora-teal [&::-webkit-slider-thumb]:shadow-md"
          />
        </div>
      </SettingRow>

      <SectionLabel>Recovery</SectionLabel>
      <SettingRow label="Auto-restart failed agents" description="Automatically retry agents that crash or OOM">
        <Toggle enabled={autoRestart} onChange={setAutoRestart} />
      </SettingRow>

      <SectionLabel>Budget</SectionLabel>
      <SettingRow label="Token budget limit" description="Max tokens per session (0 = unlimited)">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={tokenBudget}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9]/g, '');
              setTokenBudget(val);
            }}
            className="w-24 bg-surface-input border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary font-mono outline-none focus:border-aurora-teal/50 transition-colors text-right"
          />
          <span className="text-xs text-text-muted">tkns</span>
        </div>
      </SettingRow>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: Integrations                                                  */
/* ------------------------------------------------------------------ */

const integrationsList = [
  { id: 'supabase', name: 'Supabase', desc: 'Database & auth', defaultOn: true },
  { id: 'github', name: 'GitHub', desc: 'Code & issue tracking', defaultOn: true },
  { id: 'slack', name: 'Slack', desc: 'Notifications & alerts', defaultOn: false },
  { id: 'linear', name: 'Linear', desc: 'Project management', defaultOn: false },
];

function IntegrationsTab() {
  const [connections, setConnections] = useState(() =>
    Object.fromEntries(integrationsList.map((i) => [i.id, i.defaultOn])),
  );

  const toggle = (id) =>
    setConnections((prev) => ({ ...prev, [id]: !prev[id] }));

  return (
    <div>
      <SectionLabel>Connected Services</SectionLabel>
      <div className="flex flex-col gap-2">
        {integrationsList.map((item) => {
          const connected = connections[item.id];
          return (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-border hover:border-border-strong transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full flex-shrink-0 transition-colors',
                    connected ? 'bg-aurora-green' : 'bg-text-disabled',
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm text-text-primary font-medium">{item.name}</p>
                  <p className="text-xs text-text-muted">{item.desc}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={cn('text-xs', connected ? 'text-aurora-green' : 'text-text-muted')}>
                  {connected ? 'Connected' : 'Disconnected'}
                </span>
                <Toggle enabled={connected} onChange={() => toggle(item.id)} color="bg-aurora-green" />
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-text-muted mt-6">
        Integration credentials are stored in your Supabase vault. Manage API keys in your project dashboard.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab: About                                                         */
/* ------------------------------------------------------------------ */

function AboutTab() {
  const links = [
    { label: 'Documentation', href: '#' },
    { label: 'Changelog', href: '#' },
    { label: 'Support', href: '#' },
    { label: 'GitHub', href: '#' },
  ];

  return (
    <div>
      <SectionLabel>Application</SectionLabel>
      <div className="p-4 rounded-xl bg-white/[0.02] border border-border mb-4">
        <p className="text-lg font-semibold text-text-primary">Nexus <span className="text-aurora-teal">v4.2.0</span></p>
        <p className="text-xs text-text-muted mt-1">AI Agent Command Center</p>
      </div>

      <SectionLabel>Build Info</SectionLabel>
      <div className="space-y-2 font-mono text-xs">
        {[
          ['Build', '2026.04.07-a3f8c1e'],
          ['Runtime', 'React 18.3 + Vite 5'],
          ['Node', 'v20.11.0'],
          ['Platform', navigator.platform || 'Unknown'],
        ].map(([key, val]) => (
          <div key={key} className="flex justify-between">
            <span className="text-text-muted">{key}</span>
            <span className="text-text-body">{val}</span>
          </div>
        ))}
      </div>

      <SectionLabel>Links</SectionLabel>
      <div className="flex flex-col gap-1">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            className="flex items-center justify-between py-2 px-3 -mx-3 rounded-lg text-sm text-text-body hover:text-text-primary hover:bg-white/[0.03] transition-colors group"
          >
            {link.label}
            <ChevronRight className="w-4 h-4 text-text-disabled group-hover:text-text-muted transition-colors" />
          </a>
        ))}
      </div>

      <div className="mt-8 pt-4 border-t border-border">
        <p className="text-xs text-text-disabled text-center">
          Built with Claude Code &middot; Anthropic 2026
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Tab content map                                                    */
/* ------------------------------------------------------------------ */

const tabContent = {
  general: GeneralTab,
  fleet: FleetTab,
  integrations: IntegrationsTab,
  about: AboutTab,
};

/* ------------------------------------------------------------------ */
/*  Main panel                                                         */
/* ------------------------------------------------------------------ */

export function SettingsPanel({ settingsOpen, setSettingsOpen }) {
  const [activeTab, setActiveTab] = useState('general');
  const ActiveContent = tabContent[activeTab];

  return (
    <AnimatePresence>
      {settingsOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setSettingsOpen(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: 420, opacity: 0, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 420, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 32, stiffness: 200, mass: 0.8 }}
            className="fixed top-0 bottom-0 right-0 w-[400px] bg-surface/95 backdrop-blur-2xl border-l border-border z-50 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)]"
          >
            {/* Header */}
            <div className="p-5 border-b border-border flex items-center justify-between bg-canvas/30 backdrop-blur flex-shrink-0">
              <div className="flex items-center gap-3">
                <Settings className="w-5 h-5 text-aurora-teal" />
                <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
              </div>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-2 text-text-muted hover:text-text-primary hover:bg-white/[0.05] rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs (horizontal pills) */}
            <div className="px-5 pt-4 pb-2 flex gap-1 border-b border-border flex-shrink-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150',
                      isActive
                        ? 'bg-white/[0.08] text-text-primary'
                        : 'text-text-muted hover:text-text-body hover:bg-white/[0.03]',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {tab.label}
                    {isActive && (
                      <motion.div
                        layoutId="settings-tab-indicator"
                        className="absolute inset-0 rounded-lg bg-white/[0.08]"
                        initial={false}
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        style={{ zIndex: -1 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  <ActiveContent />
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
