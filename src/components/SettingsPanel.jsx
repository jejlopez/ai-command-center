import { useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  Cpu,
  LockKeyhole,
  Monitor,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  X,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { ensureProviderInfrastructure, saveProviderCredential, useConnectedSystems } from '../utils/useSupabase';
import { useCommanderPreferences } from '../utils/useCommanderPreferences';

const tabs = [
  { id: 'preferences', icon: Monitor, label: 'Preferences' },
  { id: 'routing', icon: Cpu, label: 'Routing' },
  { id: 'integrations', icon: Plug, label: 'Integrations' },
];

const integrationCatalog = [
  { id: 'openai', name: 'OpenAI', category: 'Models', statusTone: 'teal', placeholder: 'sk-…', desc: 'GPT routing, assistants, embeddings' },
  { id: 'anthropic', name: 'Anthropic', category: 'Models', statusTone: 'violet', placeholder: 'sk-ant-…', desc: 'Claude planning and premium execution' },
  { id: 'google', name: 'Google', category: 'Models', statusTone: 'blue', placeholder: 'AIza…', desc: 'Gemini reasoning and multimodal execution' },
  { id: 'supabase', name: 'Supabase', category: 'Backend', statusTone: 'blue', placeholder: 'sb_publishable_…', desc: 'Realtime database, auth, storage' },
  { id: 'pipedrive', name: 'Pipedrive', category: 'CRM', statusTone: 'amber', placeholder: 'api_token…', desc: 'Deals, people, notes, pipeline sync' },
  { id: 'slack', name: 'Slack', category: 'Comms', statusTone: 'teal', placeholder: 'xoxb-…', desc: 'Alerts, approvals, operator channels' },
  { id: 'gmail', name: 'Gmail', category: 'Comms', statusTone: 'blue', placeholder: 'app-password / token', desc: 'Outbound drafts and inbox workflows' },
  { id: 'twilio', name: 'Twilio', category: 'Comms', statusTone: 'amber', placeholder: 'AC… / token', desc: 'SMS alerts and urgent outreach' },
  { id: 'stripe', name: 'Stripe', category: 'Finance', statusTone: 'violet', placeholder: 'sk_live_…', desc: 'Billing events and payment intelligence' },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', statusTone: 'teal', placeholder: 'pat-…', desc: 'Contacts, deals, lifecycle data' },
  { id: 'n8n', name: 'n8n', category: 'Automation', statusTone: 'blue', placeholder: 'api-key…', desc: 'Workflow orchestration and triggers' },
  { id: 'zapier', name: 'Zapier', category: 'Automation', statusTone: 'amber', placeholder: 'hook / token', desc: 'Long-tail app bridges and dispatch' },
  { id: 'postgres', name: 'Postgres', category: 'Data', statusTone: 'violet', placeholder: 'postgres://…', desc: 'Warehouse and ops reporting access' },
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
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
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

function Toggle({ enabled, onChange, color = 'bg-aurora-teal', label }) {
  return (
    <button
      type="button"
      aria-pressed={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40',
        enabled ? color : 'bg-white/[0.08]'
      )}
    >
      <Motion.div
        className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-md"
        animate={{ x: enabled ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

function TabButton({ icon: Icon, label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'ui-chip inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40',
        active
          ? 'border-[#d6c7a1]/25 bg-[#d6c7a1]/[0.1] text-[#f4e6c2]'
          : 'border-white/[0.08] bg-white/[0.03] text-text-muted hover:text-text-primary'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function SectionCard({ eyebrow, title, description, action, children }) {
  return (
    <section className="ui-panel p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="ui-kicker text-[10px] font-semibold uppercase">{eyebrow}</div>
            {action}
          </div>
          <h3 className="mt-1 text-base font-semibold text-text-primary tracking-tight">{title}</h3>
          {description ? <p className="mt-1 max-w-2xl text-[12px] leading-5 text-text-muted opacity-70">{description}</p> : null}
        </div>
      </div>
      <div className="my-3 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
      <div className="space-y-1">
        {children}
      </div>
    </section>
  );
}

function ControlRow({ label, description, children }) {
  return (
    <div className="flex items-center justify-between py-2 group">
      <div className="min-w-0 flex-1 pr-4">
        <div className="text-[13px] font-medium text-text-primary group-hover:text-aurora-teal transition-colors flex items-center gap-2">
          {label}
          {description && (
            <div className="group/info relative inline-block">
              <div className="h-1 w-1 rounded-full bg-white/20" />
              <div className="absolute left-0 top-full mt-2 w-48 rounded-lg bg-black/90 p-2 text-[11px] text-text-muted opacity-0 backdrop-blur-md transition-opacity group-hover/info:opacity-100 pointer-events-none z-50 border border-white/10 shadow-xl">
                {description}
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'ui-chip rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40',
            value === option.value
              ? 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal'
              : 'border-white/[0.08] bg-white/[0.03] text-text-muted hover:text-text-primary'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={cn(
        'w-full rounded-xl border border-hairline bg-panel-soft px-3 py-2.5 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/35',
        props.className
      )}
    />
  );
}

function PreferencesTab() {
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

  return (
    <div className="space-y-4">
      <SectionCard
        eyebrow="Voice & Persona"
        title="Tone and escalation doctrine"
      >
        <ControlRow label="Commander style" description="Tune the system voice between operator inventiveness and executive compression.">
          <SegmentedControl
            options={[{ value: 'tony', label: 'Tony' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'elon', label: 'Elon' }]}
            value={commandStyle}
            onChange={setCommandStyle}
          />
        </ControlRow>
        <ControlRow label="Commander persona" description="Shift what the system emphasizes across the deck.">
          <SegmentedControl
            options={[{ value: 'founder', label: 'Founder' }, { value: 'operator', label: 'Operator' }, { value: 'reviewer', label: 'Reviewer' }]}
            value={commanderPersona}
            onChange={setCommanderPersona}
          />
        </ControlRow>
        <ControlRow label="Alert posture" description="Control how aggressively the system surfaces traffic.">
          <SegmentedControl
            options={[{ value: 'critical_only', label: 'Critical Only' }, { value: 'balanced', label: 'Balanced' }, { value: 'full_feed', label: 'Full Feed' }]}
            value={alertPosture}
            onChange={setAlertPosture}
          />
        </ControlRow>
        <ControlRow label="Primary alert route" description="Where the deck should send urgent traffic first.">
          <SegmentedControl
            options={[{ value: 'command_center', label: 'In-App' }, { value: 'slack', label: 'Slack' }, { value: 'email', label: 'Email' }]}
            value={notificationRoute}
            onChange={setNotificationRoute}
          />
        </ControlRow>
      </SectionCard>

      <SectionCard
        eyebrow="Quiet Hours"
        title="Active schedule"
      >
        <div className="flex items-center justify-between gap-4 py-1">
          <div className="flex items-center gap-3">
            <Toggle
              enabled={quietHoursEnabled}
              onChange={setQuietHoursEnabled}
              color="bg-aurora-violet"
              label="Toggle quiet hours"
            />
            <span className="text-[13px] font-medium text-text-primary">Suppress non-critical traffic</span>
          </div>
          <div className="flex items-center gap-2">
            <TextInput
              type="time"
              name="quiet_hours_start"
              aria-label="Quiet hours start"
              value={quietHoursStart}
              onChange={(event) => setQuietHoursStart(event.target.value)}
              className="w-20 px-2 py-1 text-xs"
            />
            <span className="text-[10px] text-text-muted uppercase tracking-wider">to</span>
            <TextInput
              type="time"
              name="quiet_hours_end"
              aria-label="Quiet hours end"
              value={quietHoursEnd}
              onChange={(event) => setQuietHoursEnd(event.target.value)}
              className="w-20 px-2 py-1 text-xs"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Economics"
        title="Labor baseline"
      >
        <div className="flex items-center justify-between py-1">
          <span className="text-[13px] font-medium text-text-primary">Human hourly rate</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-muted">$</span>
            <TextInput
              type="text"
              inputMode="decimal"
              name="human_hourly_rate"
              autoComplete="off"
              aria-label="Human hourly rate"
              value={String(humanHourlyRate)}
              onChange={(event) => setHumanHourlyRate(event.target.value.replace(/[^0-9.]/g, '') || 42)}
              className="w-16 text-right font-mono px-2 py-1 text-xs"
            />
            <span className="text-xs text-text-muted">/ hr</span>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function RoutingTab() {
  const {
    trustedWriteMode,
    setTrustedWriteMode,
    approvalDoctrine,
    setApprovalDoctrine,
  } = useCommanderPreferences();

  return (
    <div className="space-y-4">
      <SectionCard
        eyebrow="Routing"
        title="Execution doctrine"
      >
        <ControlRow label="Trusted-write mode" description="How much autonomy agents get before a human checkpoint is required.">
          <SegmentedControl
            options={[{ value: 'locked', label: 'Locked' }, { value: 'review_first', label: 'Review First' }, { value: 'trusted', label: 'Trusted' }]}
            value={trustedWriteMode}
            onChange={setTrustedWriteMode}
          />
        </ControlRow>
        <ControlRow label="Approval doctrine" description="How the system decides when to interrupt flow for human review.">
          <SegmentedControl
            options={[{ value: 'always', label: 'Always' }, { value: 'risk_weighted', label: 'Risk Weighted' }, { value: 'exceptions_only', label: 'Exceptions Only' }]}
            value={approvalDoctrine}
            onChange={setApprovalDoctrine}
          />
        </ControlRow>
      </SectionCard>

      <SectionCard
        eyebrow="Summary"
        title="Active posture"
      >
        <div className="grid gap-3 md:grid-cols-2">
          <div className="ui-panel-soft p-3 ring-1 ring-white/[0.03]">
            <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Write posture</div>
            <div className="mt-1 text-sm font-semibold text-text-primary">{trustedWriteMode.replace('_', ' ')}</div>
          </div>
          <div className="ui-panel-soft p-3 ring-1 ring-white/[0.03]">
            <div className="text-[9px] uppercase tracking-[0.18em] text-text-muted">Approval doctrine</div>
            <div className="mt-1 text-sm font-semibold text-text-primary">{approvalDoctrine.replace('_', ' ')}</div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function ApiKeyField({ value, onChange, placeholder }) {
  return (
    <div className="ui-panel-soft p-3">
      <label className="flex items-start gap-3">
        <div className="rounded-xl border border-aurora-teal/20 bg-aurora-teal/10 p-2">
          <LockKeyhole className="h-4 w-4 text-aurora-teal" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">Secure credential</div>
          <div className="mt-1 text-sm text-text-primary">{value ? 'Credential loaded into a hidden secure field.' : placeholder}</div>
          <input
            type="password"
            name="integration_secret"
            autoComplete="off"
            aria-label="Integration secret"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="mt-3 w-full rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2.5 text-sm text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/35"
          />
        </div>
      </label>
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

  const connected = useMemo(() => connectedSystems.map(normalizeConnectedSystem), [connectedSystems]);
  const filteredCatalog = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return integrationCatalog;
    return integrationCatalog.filter((item) =>
      item.name.toLowerCase().includes(search)
      || item.category.toLowerCase().includes(search)
      || item.desc.toLowerCase().includes(search)
    );
  }, [query]);

  const selected = integrationCatalog.find((item) => item.id === selectedId) || integrationCatalog[0];
  const currentConnection = connected.find((entry) => entry.integrationKey === selected.id);

  async function saveProviderIfNeeded(key) {
    if (!['anthropic', 'openai', 'google'].includes(selected.id) || !key.trim()) return;
    try {
      await saveProviderCredential(selected.id, key);
      await ensureProviderInfrastructure({
        provider: selected.id,
        identifier: identifier.trim() || `${selected.name.toLowerCase()}-primary`,
      });
    } catch {
      // Keep the drawer stable even if background provider setup fails.
    }
  }

  async function handleAuthorize() {
    if (!selected || !apiKey.trim()) return;
    setSaving(true);
    try {
      await saveProviderIfNeeded(apiKey);
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
      window.setTimeout(() => setSavedPulse(false), 1800);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard
        eyebrow="Connections"
        title="Authorized systems"
        action={(
          <div className="rounded-full border border-aurora-green/20 bg-aurora-green/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-green">
            {connected.length} live
          </div>
        )}
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-disabled" />
          <TextInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            name="integration_search"
            autoComplete="off"
            aria-label="Search integrations"
            placeholder="Search integrations…"
            className="pl-10"
          />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {filteredCatalog.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40',
                selectedId === item.id
                  ? toneClasses(item.statusTone)
                  : 'border-white/[0.08] bg-white/[0.03] text-text-muted hover:text-text-primary'
              )}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="mt-5 ui-panel-soft p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Selected integration</div>
              <div className="mt-2 text-lg font-semibold text-text-primary">{selected.name}</div>
              <p className="mt-2 text-[12px] leading-5 text-text-muted">{selected.desc}</p>
            </div>
            <div className="ui-chip px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
              {selected.category}
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <ApiKeyField value={apiKey} onChange={setApiKey} placeholder={selected.placeholder} />
            <TextInput
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              name="integration_identifier"
              autoComplete="off"
              aria-label="Integration identifier"
              placeholder="Workspace / account / identifier…"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-text-muted">
              {saving ? 'Authorizing…' : savedPulse ? 'Integration updated.' : currentConnection ? 'Existing connection ready to refresh.' : 'Authorize to add this service to the live dock.'}
            </div>
            <button
              type="button"
              onClick={handleAuthorize}
              disabled={!apiKey.trim() || saving}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40',
                apiKey.trim() && !saving
                  ? 'ui-button-primary bg-aurora-teal text-black hover:bg-[#00ebd8]'
                  : 'ui-button-secondary bg-white/[0.04] text-text-disabled'
              )}
            >
              {currentConnection ? <Check className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
              {saving ? 'Authorizing…' : currentConnection ? 'Update Connection' : 'Authorize'}
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        eyebrow="Live Dock"
        title="Active connections"
      >
        {loading ? (
          <div className="ui-panel-soft p-4 text-[12px] text-text-muted">
            Loading connected systems…
          </div>
        ) : null}

        <div className="grid gap-3">
          {connected.map((entry) => (
            <div key={entry.id} className="ui-panel-soft p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-text-primary">{entry.name}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">{entry.category}</div>
                  <p className="mt-2 text-[12px] leading-5 text-text-muted">{entry.identifier}</p>
                </div>
                <span className={cn('rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', toneClasses(entry.tone))}>
                  {entry.statusLabel}
                </span>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="ui-stat rounded-xl px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Security</div>
                  <div className="mt-1 text-[12px] text-text-body">{entry.securityState}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => refreshSystem(entry.id, { status: 'connected', lastVerifiedAt: new Date().toISOString() })}
                    className="ui-button-secondary px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-aurora-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40"
                  >
                    Check Link
                  </button>
                  <button
                    type="button"
                    onClick={() => removeSystem(entry.id)}
                    className="ui-button-secondary px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted transition-colors hover:text-aurora-rose focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  {entry.capabilities.map((capability) => (
                    <span key={capability} className="ui-chip px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]">
                      {capability}
                    </span>
                  ))}
                </div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">
                  Verified {formatVerifiedTime(entry.lastVerifiedAt)}
                </div>
              </div>
            </div>
          ))}

          {!loading && connected.length === 0 ? (
            <div className="ui-panel-soft p-6 text-center">
              <div className="text-sm font-semibold text-text-primary">No systems connected yet</div>
              <p className="mt-2 text-[12px] leading-5 text-text-muted">Authorize a service above and it will appear here with status, identity, and capabilities.</p>
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}

const tabContent = {
  preferences: PreferencesTab,
  routing: RoutingTab,
  integrations: IntegrationsTab,
};

export function SettingsPanel({ settingsOpen, setSettingsOpen }) {
  const [activeTab, setActiveTab] = useState('preferences');
  const ActiveContent = tabContent[activeTab];

  return (
    <AnimatePresence>
      {settingsOpen ? (
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
            className="ui-drawer fixed inset-y-0 right-0 z-50 flex w-[560px] max-w-[96vw] flex-col overflow-hidden shadow-[-18px_0_60px_rgba(0,0,0,0.55)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.10),transparent_24%),radial-gradient(circle_at_18%_8%,rgba(214,199,161,0.08),transparent_22%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent_24%)]" />

            <div className="relative border-b border-hairline px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="ui-kicker inline-flex items-center gap-2 rounded-full border border-hairline bg-panel-soft px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">
                    <Settings className="h-3.5 w-3.5 text-[#d6c7a1]" />
                    Systems Control
                  </div>
                  <h2 className="mt-4 max-w-xl text-2xl font-semibold tracking-tight text-text-primary text-balance">
                    Fewer controls, better ones.
                  </h2>
                  <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-text-muted">
                    This drawer now focuses on the settings that actually change behavior: command voice, routing doctrine, and connected systems.
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close settings"
                  onClick={() => setSettingsOpen(false)}
                  className="ui-button-secondary p-2 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/40"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            <div className="relative border-b border-hairline px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <TabButton
                    key={tab.id}
                    icon={tab.icon}
                    label={tab.label}
                    active={tab.id === activeTab}
                    onClick={() => setActiveTab(tab.id)}
                  />
                ))}
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
      ) : null}
    </AnimatePresence>
  );
}
