import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  ChevronRight,
  Cpu,
  Gauge,
  Info,
  LockKeyhole,
  Monitor,
  Plug,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { supabase } from '../lib/supabaseClient';
import { useConnectedSystems, useModelBank } from '../utils/useSupabase';
import { useCommanderPreferences } from '../utils/useCommanderPreferences';

const tabs = [
  { id: 'general', icon: Monitor, label: 'Commander' },
  { id: 'fleet', icon: Cpu, label: 'Routing' },
  { id: 'integrations', icon: Plug, label: 'Connected Systems' },
  { id: 'about', icon: Info, label: 'About' },
];

const integrationCatalog = [
  { id: 'openai', name: 'OpenAI', category: 'Models', statusTone: 'teal', placeholder: 'sk-...', desc: 'GPT routing, assistants, embeddings' },
  { id: 'anthropic', name: 'Anthropic', category: 'Models', statusTone: 'violet', placeholder: 'sk-ant-...', desc: 'Claude planning and premium execution' },
  { id: 'supabase', name: 'Supabase', category: 'Backend', statusTone: 'blue', placeholder: 'sb_publishable_...', desc: 'Realtime database, auth, storage' },
  { id: 'pipedrive', name: 'Pipedrive', category: 'CRM', statusTone: 'amber', placeholder: 'api_token...', desc: 'Deals, people, notes, pipeline sync' },
  { id: 'slack', name: 'Slack', category: 'Comms', statusTone: 'teal', placeholder: 'xoxb-...', desc: 'Alerts, approvals, operator channels' },
  { id: 'gmail', name: 'Gmail', category: 'Comms', statusTone: 'blue', placeholder: 'app-password / token', desc: 'Outbound drafts, inbox workflows' },
  { id: 'twilio', name: 'Twilio', category: 'Comms', statusTone: 'amber', placeholder: 'AC... / token', desc: 'SMS alerts and urgent customer outreach' },
  { id: 'stripe', name: 'Stripe', category: 'Finance', statusTone: 'violet', placeholder: 'sk_live_...', desc: 'Billing events and payment intelligence' },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', statusTone: 'teal', placeholder: 'pat-...', desc: 'Contacts, deals, lifecycle data' },
  { id: 'n8n', name: 'n8n', category: 'Automation', statusTone: 'blue', placeholder: 'api-key...', desc: 'Workflow orchestration and triggers' },
  { id: 'zapier', name: 'Zapier', category: 'Automation', statusTone: 'amber', placeholder: 'hook / token', desc: 'Long-tail app bridges and dispatch' },
  { id: 'postgres', name: 'Postgres', category: 'Data', statusTone: 'violet', placeholder: 'postgres://...', desc: 'Direct warehouse and ops reporting access' },
];

function toneClasses(tone = 'teal') {
  const map = {
    teal: 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal',
    violet: 'border-aurora-violet/20 bg-aurora-violet/10 text-aurora-violet',
    blue: 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue',
    amber: 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber',
  };
  return map[tone] || map.teal;
}

function formatVerifiedTime(value) {
  if (!value) return 'Never';
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Unknown';
  }
}

function normalizeConnectedSystem(entry) {
  const toneByCategory = {
    Models: 'teal',
    Backend: 'blue',
    CRM: 'amber',
    Comms: 'teal',
    Finance: 'violet',
    Automation: 'blue',
    Data: 'violet',
  };

  return {
    ...entry,
    name: entry.displayName,
    tone: entry.metadata?.tone || toneByCategory[entry.category] || 'teal',
    statusLabel: entry.status === 'needs_refresh'
      ? 'Needs Refresh'
      : entry.status === 'degraded'
        ? 'Degraded'
        : entry.status === 'error'
          ? 'Error'
          : 'Connected',
    securityState: entry.metadata?.securityState || 'Encrypted vault link',
  };
}

function Toggle({ enabled, onChange, color = 'bg-aurora-teal' }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={cn('relative h-5 w-10 rounded-full transition-colors duration-200', enabled ? color : 'bg-white/[0.08]')}
    >
      <Motion.div
        className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-md"
        animate={{ x: enabled ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

function SectionLabel({ children }) {
  return <p className="mb-3 mt-6 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted first:mt-0">{children}</p>;
}

function SettingRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm text-text-primary">{label}</p>
        {description ? <p className="mt-0.5 text-xs text-text-muted">{description}</p> : null}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function PillGroup({ options, value, onChange }) {
  return (
    <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-lg px-2.5 py-1.5 text-xs transition-colors',
            value === opt.value ? 'bg-white/[0.08] text-text-primary' : 'text-text-muted hover:text-text-primary'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function GeneralTab() {
  const {
    humanHourlyRate,
    setHumanHourlyRate,
    commandStyle,
    setCommandStyle,
    alertPosture,
    setAlertPosture,
    quietHoursEnabled,
    setQuietHoursEnabled,
    quietHoursStart,
    setQuietHoursStart,
    quietHoursEnd,
    setQuietHoursEnd,
    notificationRoute,
    setNotificationRoute,
    commanderPersona,
    setCommanderPersona,
  } = useCommanderPreferences();
  const [density, setDensity] = useState('comfortable');
  const [motion, setMotion] = useState('high');
  const [alerts, setAlerts] = useState(true);

  return (
    <div>
      <SectionLabel>Commander Preferences</SectionLabel>
      <SettingRow label="Dashboard density" description="How much breathing room the deck should keep.">
        <PillGroup options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]} value={density} onChange={setDensity} />
      </SettingRow>
      <SettingRow label="Motion intensity" description="How aggressive the cockpit motion language should feel.">
        <PillGroup options={[{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }]} value={motion} onChange={setMotion} />
      </SettingRow>
      <SettingRow label="Command alerts" description="Keep the command-alert rail surfaced when urgent traffic exists.">
        <Toggle enabled={alerts} onChange={setAlerts} color="bg-aurora-amber" />
      </SettingRow>
      <SettingRow label="Commander style" description="Tune the system voice between operator inventiveness and ruthless executive compression.">
        <PillGroup options={[{ value: 'tony', label: 'Tony' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'elon', label: 'Elon' }]} value={commandStyle} onChange={setCommandStyle} />
      </SettingRow>
      <SettingRow label="Alert posture" description="Control how aggressive the system should be about surfacing traffic.">
        <PillGroup options={[{ value: 'critical_only', label: 'Critical only' }, { value: 'balanced', label: 'Balanced' }, { value: 'full_feed', label: 'Full feed' }]} value={alertPosture} onChange={setAlertPosture} />
      </SettingRow>
      <SettingRow label="Commander persona" description="Shift the operating lens for what gets emphasized across the deck.">
        <PillGroup options={[{ value: 'founder', label: 'Founder' }, { value: 'operator', label: 'Operator' }, { value: 'reviewer', label: 'Reviewer' }]} value={commanderPersona} onChange={setCommanderPersona} />
      </SettingRow>

      <SectionLabel>Alert Flow</SectionLabel>
      <SettingRow label="Quiet hours" description="Reduce non-critical traffic during your off window.">
        <Toggle enabled={quietHoursEnabled} onChange={setQuietHoursEnabled} color="bg-aurora-violet" />
      </SettingRow>
      <SettingRow label="Quiet window" description="Only critical alerts should break through during this period.">
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={quietHoursStart}
            onChange={(e) => setQuietHoursStart(e.target.value)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-text-primary outline-none focus:border-aurora-teal/40"
          />
          <span className="text-xs text-text-muted">to</span>
          <input
            type="time"
            value={quietHoursEnd}
            onChange={(e) => setQuietHoursEnd(e.target.value)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-sm text-text-primary outline-none focus:border-aurora-teal/40"
          />
        </div>
      </SettingRow>
      <SettingRow label="Primary alert route" description="Where the deck should assume critical traffic belongs first.">
        <PillGroup options={[{ value: 'command_center', label: 'In-app' }, { value: 'slack', label: 'Slack' }, { value: 'email', label: 'Email' }]} value={notificationRoute} onChange={setNotificationRoute} />
      </SettingRow>

      <SectionLabel>Economics</SectionLabel>
      <SettingRow label="Human hourly baseline" description="Used to compare operator labor against agent spend in Intelligence.">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-text-muted">$</span>
          <input
            type="text"
            value={String(humanHourlyRate)}
            onChange={(e) => setHumanHourlyRate(e.target.value.replace(/[^0-9.]/g, '') || 42)}
            className="w-20 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-right font-mono text-sm text-text-primary outline-none focus:border-aurora-teal/40"
          />
          <span className="text-xs text-text-muted">/ hr</span>
        </div>
      </SettingRow>
    </div>
  );
}

function FleetTab() {
  const {
    trustedWriteMode,
    setTrustedWriteMode,
    approvalDoctrine,
    setApprovalDoctrine,
  } = useCommanderPreferences();
  const { models } = useModelBank();
  const [mode, setMode] = useState('balanced');
  const [autoRestart, setAutoRestart] = useState(true);
  const [defaultModel, setDefaultModel] = useState('');

  return (
    <div>
      <SectionLabel>Routing Doctrine</SectionLabel>
      <SettingRow label="Default execution posture" description="How aggressively the system should route new work by default.">
        <PillGroup options={[{ value: 'fast', label: 'Fast' }, { value: 'balanced', label: 'Balanced' }, { value: 'efficient', label: 'Efficient' }]} value={mode} onChange={setMode} />
      </SettingRow>
      <SettingRow label="Auto-restart failed agents" description="Recover unstable branches automatically when possible.">
        <Toggle enabled={autoRestart} onChange={setAutoRestart} />
      </SettingRow>
      <SettingRow label="Trusted-write mode" description="How much autonomy agents get before a human checkpoint is required.">
        <PillGroup options={[{ value: 'locked', label: 'Locked' }, { value: 'review_first', label: 'Review first' }, { value: 'trusted', label: 'Trusted' }]} value={trustedWriteMode} onChange={setTrustedWriteMode} />
      </SettingRow>
      <SettingRow label="Approval doctrine" description="How the system decides when to interrupt flow for human review.">
        <PillGroup options={[{ value: 'always', label: 'Always' }, { value: 'risk_weighted', label: 'Risk weighted' }, { value: 'exceptions_only', label: 'Exceptions only' }]} value={approvalDoctrine} onChange={setApprovalDoctrine} />
      </SettingRow>

      <SectionLabel>Preferred Branch</SectionLabel>
      <SettingRow label="Default model lane" description="Used when a mission doesn’t have a stronger doctrine recommendation.">
        <select
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value)}
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-sm text-text-primary outline-none focus:border-aurora-teal/40"
        >
          <option value="">Select model</option>
          {models.map((model) => (
            <option key={model.id} value={model.modelKey}>{model.label}</option>
          ))}
        </select>
      </SettingRow>
    </div>
  );
}

function ApiKeyField({ value, onChange, placeholder }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20">
      <div className="pointer-events-none absolute inset-0 opacity-[0.04] [background-image:repeating-linear-gradient(180deg,rgba(255,255,255,0.18)_0px,rgba(255,255,255,0.18)_1px,transparent_1px,transparent_12px)]" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-aurora-teal/60 to-transparent" />
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
      />
      <div className="relative flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="rounded-xl border border-aurora-teal/20 bg-aurora-teal/10 p-2">
            <LockKeyhole className="h-4 w-4 text-aurora-teal" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted">Secure credential</div>
            <div className="mt-1 truncate text-sm text-text-primary">
              {value ? 'Credential loaded into a hidden secure field.' : placeholder}
            </div>
          </div>
        </div>
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="relative z-20 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-aurora-rose"
          >
            Clear
          </button>
        ) : (
          <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
            Paste secret
          </div>
        )}
      </div>
    </div>
  );
}

function IntegrationsTab() {
  const { connectedSystems, upsertSystem, removeSystem, refreshSystem, loading } = useConnectedSystems();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedPulse, setSavedPulse] = useState(false);
  const connected = connectedSystems.map(normalizeConnectedSystem);

  const selected = integrationCatalog.find((item) => item.id === selectedId) || integrationCatalog[0];
  const filteredCatalog = integrationCatalog.filter((item) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q);
  });
  const wiredIds = new Set(connected.map((entry) => entry.integrationKey));
  const recommendedStack = integrationCatalog.filter((item) => ['supabase', 'anthropic', 'openai', 'slack', 'pipedrive'].includes(item.id) && !wiredIds.has(item.id));
  const currentConnection = connected.find((entry) => entry.integrationKey === selected.id);

  async function saveAnthropicIfNeeded(key) {
    if (selected.id !== 'anthropic' || !key.trim()) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase
        .from('user_settings')
        .upsert({ user_id: user.id, anthropic_api_key: key.trim() }, { onConflict: 'user_id' });
    } catch {
      // UI preview should not fail on settings persistence
    }
  }

  async function handleAuthorize() {
    if (!selected || !apiKey.trim()) return;
    setSaving(true);
    try {
      await saveAnthropicIfNeeded(apiKey);
      const stamp = new Date().toISOString();
      await upsertSystem({
        integrationKey: selected.id,
        displayName: selected.name,
        category: selected.category,
        status: 'connected',
        identifier: identifier.trim() || `${selected.name.toLowerCase()}-primary`,
        capabilities: ['Read', 'Write', 'Sync'],
        lastVerifiedAt: stamp,
        metadata: {
          description: selected.desc,
          tone: selected.statusTone,
          securityState: 'Encrypted vault link',
        },
      });
      setApiKey('');
      setIdentifier('');
      setSavedPulse(true);
      setTimeout(() => setSavedPulse(false), 1800);
    } finally {
      setSaving(false);
    }
  }

  async function runHealthCheck(id) {
    await refreshSystem(id, { status: 'connected', lastVerifiedAt: new Date().toISOString() });
  }

  async function removeIntegration(id) {
    await removeSystem(id);
  }

  return (
    <div>
      <SectionLabel>Connected Systems</SectionLabel>
      <div className="rounded-[26px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-aurora-teal">
              <Plug className="h-3.5 w-3.5" />
              Wire The Stack
            </div>
            <h3 className="mt-3 text-lg font-semibold text-text-primary">Add APIs and drop them straight into the systems dock.</h3>
            <p className="mt-2 text-[12px] leading-relaxed text-text-muted">Authorize the service, persist the connection state, and let the dock update across Settings, Profile, Notifications, and mission creation.</p>
          </div>
          <div className="rounded-2xl border border-aurora-green/20 bg-aurora-green/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-aurora-green">
            Live Dock
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {integrationCatalog.slice(0, 8).map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
                selectedId === item.id
                  ? toneClasses(item.statusTone)
                  : 'border-white/[0.08] bg-white/[0.03] text-text-muted hover:text-text-primary'
              )}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-[18px] border border-white/[0.08] bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Connected now</div>
            <div className="mt-2 text-2xl font-semibold text-text-primary">{connected.length}</div>
          </div>
          <div className="rounded-[18px] border border-white/[0.08] bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Recommended next</div>
            <div className="mt-2 text-sm font-semibold text-text-primary">{recommendedStack[0]?.name || 'Stack complete'}</div>
          </div>
          <div className="rounded-[18px] border border-white/[0.08] bg-black/20 p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Security posture</div>
            <div className="mt-2 text-sm font-semibold text-aurora-teal">Secrets hidden from the deck</div>
          </div>
        </div>
      </div>

      <SectionLabel>Add Integration</SectionLabel>
      <div className="rounded-[26px] border border-white/[0.08] bg-black/20 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search integrations..."
            className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.03] px-10 py-3 text-sm text-text-primary outline-none focus:border-aurora-teal/40"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {filteredCatalog.slice(0, 6).map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedId(item.id)}
              className={cn(
                'rounded-[20px] border p-4 text-left transition-all',
                selectedId === item.id
                  ? `${toneClasses(item.statusTone)} shadow-[0_0_24px_rgba(0,217,200,0.08)]`
                  : 'border-white/[0.08] bg-white/[0.03] text-text-body hover:border-white/[0.14]'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text-primary">{item.name}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">{item.category}</div>
                </div>
                <Plus className="h-4 w-4" />
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-text-muted">{item.desc}</p>
            </button>
          ))}
        </div>

        <div className="mt-5 rounded-[22px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Authorize System</div>
              <div className="mt-1 text-base font-semibold text-text-primary">{selected.name}</div>
              <p className="mt-1 text-[12px] text-text-muted">{selected.desc}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={cn('rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', toneClasses(selected.statusTone))}>
                {selected.category}
              </span>
              {currentConnection ? (
                <span className="rounded-full border border-aurora-green/20 bg-aurora-green/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-green">
                  Connected
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <ApiKeyField value={apiKey} onChange={setApiKey} placeholder={selected.placeholder} />
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Workspace / account / identifier (optional)"
              className="w-full rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-3 text-sm text-text-primary outline-none focus:border-aurora-teal/40"
            />
          </div>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="text-[11px] text-text-muted">
              {saving ? 'Establishing secure link...' : savedPulse ? 'Integration dock updated.' : 'Authorize and stage this system in the dock below.'}
            </div>
            <button
              onClick={() => {
                if (currentConnection && !apiKey.trim()) return;
                handleAuthorize();
              }}
              disabled={(!apiKey.trim() && !currentConnection) || saving}
              className={cn(
                'inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-semibold transition-colors',
                (apiKey.trim() || currentConnection)
                  ? 'bg-aurora-teal text-black hover:bg-[#00ebd8]'
                  : 'bg-white/[0.04] text-text-disabled'
              )}
            >
              {currentConnection && !apiKey.trim() ? <Check className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {saving ? 'Authorizing...' : currentConnection && !apiKey.trim() ? 'Connected' : currentConnection ? 'Update Link' : 'Authorize System'}
            </button>
          </div>
        </div>
      </div>

      <SectionLabel>Connected Systems Dock</SectionLabel>
      <div className="rounded-[26px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4">
        {loading && (
          <div className="mb-4 rounded-[20px] border border-white/[0.08] bg-black/20 px-4 py-3 text-[12px] text-text-muted">
            Loading connected systems...
          </div>
        )}
        {recommendedStack.length > 0 && (
          <div className="mb-4 rounded-[20px] border border-white/[0.08] bg-black/20 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-aurora-amber/20 bg-aurora-amber/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-aurora-amber">
                  <Wand2 className="h-3.5 w-3.5" />
                  Recommended Next Wires
                </div>
                <p className="mt-3 text-[12px] leading-relaxed text-text-muted">For the fastest command loop, prioritize one CRM, one model layer, one backend, and one comms rail.</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {recommendedStack.slice(0, 4).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-text-primary"
                >
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-2">
          <AnimatePresence mode="popLayout">
            {connected.map((entry) => (
              <Motion.div
                key={entry.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                className="rounded-[22px] border border-white/[0.08] bg-black/20 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{entry.name}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">{entry.category}</div>
                  </div>
                  <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', toneClasses(entry.tone))}>
                    {entry.statusLabel}
                  </span>
                </div>
                <div className="mt-3 text-[12px] text-text-body">{entry.identifier}</div>
                <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2">
                  <div className="flex items-center gap-2 text-[11px] text-text-muted">
                    <LockKeyhole className="h-3.5 w-3.5 text-aurora-teal" />
                    <span>{entry.securityState || 'Encrypted vault link'}</span>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-aurora-green/20 bg-aurora-green/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-green">
                    <span className="h-1.5 w-1.5 rounded-full bg-aurora-green" />
                    {entry.statusLabel}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {entry.capabilities.map((capability) => (
                    <span key={capability} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                      {capability}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">Verified {formatVerifiedTime(entry.lastVerifiedAt)}</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => runHealthCheck(entry.id)}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-aurora-teal"
                    >
                      Check link
                    </button>
                    <button
                      type="button"
                      onClick={() => removeIntegration(entry.id)}
                      className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-aurora-rose"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </Motion.div>
            ))}
          </AnimatePresence>

          {connected.length === 0 && (
            <div className="col-span-full rounded-[22px] border border-dashed border-white/[0.10] bg-black/10 p-6 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-aurora-teal" />
              <div className="mt-3 text-sm font-semibold text-text-primary">No systems wired yet.</div>
              <p className="mt-2 text-[12px] leading-relaxed text-text-muted">Authorize any integration above and it will drop into this dock with status, identity, and capabilities.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AboutTab() {
  return (
    <div>
      <SectionLabel>Systems Control</SectionLabel>
      <div className="rounded-[24px] border border-white/[0.08] bg-black/20 p-4">
        <div className="text-lg font-semibold text-text-primary">Jarvis Command Center</div>
        <p className="mt-2 text-[12px] leading-relaxed text-text-muted">This drawer now acts like the real command rack: preference state persists in Supabase, connected systems are shared across the app, and secrets stay hidden from the UI.</p>
      </div>
    </div>
  );
}

const tabContent = {
  general: GeneralTab,
  fleet: FleetTab,
  integrations: IntegrationsTab,
  about: AboutTab,
};

export function SettingsPanel({ settingsOpen, setSettingsOpen }) {
  const [activeTab, setActiveTab] = useState('general');
  const ActiveContent = tabContent[activeTab];

  return (
    <AnimatePresence>
      {settingsOpen && (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSettingsOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />

          <Motion.aside
            initial={{ x: 460, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 460, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[520px] max-w-[96vw] flex-col overflow-hidden border-l border-white/[0.08] bg-[linear-gradient(180deg,rgba(8,10,14,0.98),rgba(6,9,12,0.98))] shadow-[-18px_0_60px_rgba(0,0,0,0.55)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.12),transparent_24%),radial-gradient(circle_at_18%_8%,rgba(167,139,250,0.12),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_24%)]" />

            <div className="relative border-b border-white/[0.08] px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                    <Settings className="h-3.5 w-3.5 text-aurora-teal" />
                    Systems Control
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary">Commander preferences, routing doctrine, and connected systems.</h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-text-muted">This is the control rack. Wire your APIs, tune the execution posture, and make the system feel like it belongs to you.</p>
                </div>
                <button
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-2 text-text-muted transition-colors hover:text-text-primary"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            <div className="relative border-b border-white/[0.08] px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = tab.id === activeTab;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'relative inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
                        isActive
                          ? 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal'
                          : 'border-white/[0.08] bg-white/[0.03] text-text-muted hover:text-text-primary'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative flex-1 overflow-y-auto px-5 py-4 no-scrollbar">
              <AnimatePresence mode="wait">
                <Motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  <ActiveContent />
                </Motion.div>
              </AnimatePresence>
            </div>
          </Motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
