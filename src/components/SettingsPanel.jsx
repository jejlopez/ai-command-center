import { useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Check,
  Cpu,
  LockKeyhole,
  Moon,
  Plug,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  X,
  Zap,
  Globe,
  Terminal,
  FolderOpen,
  Database,
  MessageSquare,
  Monitor,
  ArrowRight
} from 'lucide-react';
import { cn } from '../utils/cn';
import { ensureProviderInfrastructure, saveProviderCredential, useConnectedSystems } from '../utils/useSupabase';
import { useAuth } from '../context/AuthContext';
import { usePreferences } from '../context/PreferenceContext';

const integrationCatalog = [
  { 
    id: 'openai', 
    name: 'OpenAI', 
    category: 'Foundation', 
    statusTone: 'teal', 
    placeholder: 'sk-…', 
    desc: 'GPT-4o and reasoning models',
    logo: 'https://upload.wikimedia.org/wikipedia/commons/4/4d/OpenAI_Logo.svg'
  },
  { 
    id: 'anthropic', 
    name: 'Anthropic', 
    category: 'Foundation', 
    statusTone: 'violet', 
    placeholder: 'sk-ant-…', 
    desc: 'Claude 3.5 Sonnet & premium agents',
    logo: 'https://cdn.brandfetch.io/id8yGvD6A0/theme/dark/logo.svg'
  },
  { 
    id: 'google', 
    name: 'Google Gemini', 
    category: 'Foundation', 
    statusTone: 'blue', 
    placeholder: 'AIza…', 
    desc: 'Multimodal execution & context',
    logo: 'https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff62945944f4.svg'
  },
];

function SectionLabel({ children }) {
  return <p className="mb-3 text-[10px] font-black uppercase tracking-[0.4em] text-text-dim">{children}</p>;
}

function Toggle({ enabled, onChange, color = 'bg-aurora-teal' }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className={cn(
        'relative h-6 w-11 rounded-full transition-all duration-300 ring-1 ring-hairline',
        enabled ? color : 'bg-surface-dim'
      )}
    >
      <Motion.div
        className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
        animate={{ x: enabled ? 20 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5 p-1 bg-panel-soft rounded-xl border border-hairline-soft shadow-inner">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            'px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all',
            value === option.value
              ? 'bg-panel-strong text-text shadow-sm border border-hairline'
              : 'text-text-dim hover:text-text'
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
        'w-full rounded-xl border border-hairline-soft bg-surface-dim px-4 py-3 text-sm text-text placeholder:text-text-dim/40 outline-none transition-all focus:border-aurora-teal/50 focus:ring-1 focus:ring-aurora-teal/10 font-mono shadow-inner',
        props.className
      )}
    />
  );
}

function MaskedKey({ value }) {
  if (!value) return null;
  return (
    <span className="text-text font-mono tracking-widest opacity-60">
      VAULT<span className="text-text-dim opacity-30">••••</span>LINK
    </span>
  );
}

export function SettingsPanel({ settingsOpen, setSettingsOpen }) {
  const { user } = useAuth();
  const {
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
    themePreference,
    setThemePreference,
  } = usePreferences();

  const { connectedSystems, upsertSystem, removeSystem } = useConnectedSystems();
  const [selectedId, setSelectedId] = useState('openai');
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedIntegration = integrationCatalog.find(i => i.id === selectedId) || integrationCatalog[0];
  const activeSystem = connectedSystems.find(s => s.integrationKey === selectedIntegration.id);

  const handleAuthorize = async () => {
    if (!apiKey.trim()) return;
    setSaving(true);
    try {
      await saveProviderCredential(selectedIntegration.id, apiKey);
      await upsertSystem({
        integrationKey: selectedIntegration.id,
        displayName: selectedIntegration.name,
        category: selectedIntegration.category,
        status: 'connected',
        lastVerifiedAt: new Date().toISOString(),
      });
      setApiKey('');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {settingsOpen && (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSettingsOpen(false)}
            className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[6px]"
          />

          <Motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 35, stiffness: 220 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[680px] max-w-[96vw] flex-col overflow-hidden bg-canvas border-l border-hairline shadow-[-60px_0_120px_rgba(0,0,0,0.5)]"
          >
            {/* Header */}
            <div className="relative border-b border-hairline-soft px-10 py-10 flex items-center justify-between">
              <div>
                <h2 className="text-[10px] font-black tracking-[0.65em] text-text-dim uppercase">Systems Control</h2>
                <p className="mt-2 text-[11px] font-mono font-bold text-text-dim tracking-widest">Global Configuration</p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="group p-3.5 text-text-dim hover:text-text transition-all bg-panel-soft border border-hairline-soft rounded-xl font-mono"
              >
                <X className="h-6 w-6 group-hover:rotate-90 transition-transform duration-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-10 py-10 no-scrollbar space-y-12">
               {/* Visual Identity Section */}
               <section className="ui-panel p-8 space-y-6 shadow-main">
                  <SectionLabel>Visual Persona</SectionLabel>
                  <div className="flex items-center justify-between">
                     <div className="space-y-1">
                        <span className="text-[11px] font-bold text-text">Interface Mode</span>
                        <p className="text-[10px] text-text-dim font-mono italic">Current: {themePreference === 'obsidian' ? 'Obsidian Void' : 'Spectral Pearl'}</p>
                     </div>
                     <SegmentedControl
                        options={[
                           { value: 'obsidian', label: 'Obsidian' },
                           { value: 'aurora-light', label: 'Spectral' }
                        ]}
                        value={themePreference}
                        onChange={setThemePreference}
                     />
                  </div>
               </section>

               {/* Operational Doctrine Section */}
               <section className="ui-panel p-8 space-y-8 shadow-main">
                  <SectionLabel>Operating Doctrine</SectionLabel>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-3">
                        <span className="text-[9px] font-black uppercase text-text-dim tracking-widest">Alert Readiness</span>
                        <SegmentedControl
                           options={[
                              { value: 'critical_only', label: 'Critical' },
                              { value: 'balanced', label: 'Balanced' },
                              { value: 'full_feed', label: 'Full' }
                           ]}
                           value={alertPosture}
                           onChange={setAlertPosture}
                        />
                     </div>
                     <div className="space-y-3">
                        <span className="text-[9px] font-black uppercase text-text-dim tracking-widest">Notification Path</span>
                        <SegmentedControl
                           options={[
                              { value: 'command_center', label: 'App' },
                              { value: 'slack', label: 'Slack' },
                              { value: 'email', label: 'Email' }
                           ]}
                           value={notificationRoute}
                           onChange={setNotificationRoute}
                        />
                     </div>
                  </div>

                  <div className="pt-8 border-t border-hairline-soft flex items-center justify-between">
                     <div className="space-y-1">
                        <span className="text-[11px] font-bold text-text">Suppression Window</span>
                        <p className="text-[10px] text-text-dim font-mono italic">Holding non-critical traffic during quiet hours</p>
                     </div>
                     <Toggle enabled={quietHoursEnabled} onChange={setQuietHoursEnabled} color="bg-aurora-violet" />
                  </div>
               </section>

               {/* Intelligence Vault Section */}
               <section className="ui-panel p-8 space-y-8 shadow-main">
                  <SectionLabel>Intelligence Vault</SectionLabel>
                  <div className="flex flex-wrap gap-2 pb-4">
                     {integrationCatalog.map(item => {
                        const isConnected = connectedSystems.some(s => s.integrationKey === item.id);
                        return (
                           <button
                              key={item.id}
                              onClick={() => setSelectedId(item.id)}
                              className={cn(
                                 "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-2",
                                 selectedId === item.id 
                                 ? "bg-aurora-teal/20 border-aurora-teal/40 text-aurora-teal shadow-md" 
                                 : "bg-surface-dim border-hairline-soft text-text-dim hover:text-text"
                              )}
                           >
                              {isConnected && <div className="w-1.5 h-1.5 rounded-full bg-aurora-teal shadow-[0_0_8px_var(--color-aurora-teal)]" />}
                              {item.name}
                           </button>
                        );
                     })}
                  </div>

                  <div className="p-8 ui-well rounded-2xl bg-panel-soft border border-hairline-soft space-y-6 relative overflow-hidden group shadow-inner">
                     <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity pointer-events-none">
                        <Cpu className="h-24 w-24" />
                     </div>

                     <div className="space-y-1 relative z-10">
                        <h4 className="text-sm font-black text-text uppercase tracking-widest">{selectedIntegration.name} Integration</h4>
                        <p className="text-[11px] text-text-dim font-medium italic">{selectedIntegration.desc}</p>
                     </div>

                     <div className="space-y-4 relative z-10">
                        <div className="flex items-center justify-between">
                           <span className="text-[9px] font-black uppercase text-text-dim tracking-widest">Vaulted API Key</span>
                           {activeSystem && <MaskedKey />}
                        </div>
                        <TextInput 
                           type="password" 
                           placeholder={activeSystem ? "Verified & Encrypted" : `Enter ${selectedIntegration.name} Key...`}
                           value={apiKey}
                           onChange={(e) => setApiKey(e.target.value)}
                           disabled={saving}
                        />
                     </div>

                     <div className="flex gap-4 relative z-10">
                        <button
                           onClick={handleAuthorize}
                           disabled={!apiKey.trim() || saving}
                           className="flex-1 py-4 rounded-2xl bg-aurora-teal text-white text-[11px] font-black uppercase tracking-[0.4em] transition-all hover:bg-aurora-teal/90 disabled:opacity-50 flex items-center justify-center gap-3 shadow-lg shadow-aurora-teal/10"
                        >
                           {saving ? "Verifying..." : "Commit Key"}
                        </button>
                        
                        {activeSystem && (
                           <button
                              onClick={() => removeSystem(activeSystem.id)}
                              className="px-6 rounded-2xl bg-surface-dim border border-hairline-soft text-text-dim hover:text-aurora-rose hover:border-aurora-rose/40 transition-all shadow-sm"
                           >
                              <X className="h-6 w-6" />
                           </button>
                        )}
                     </div>
                  </div>
               </section>
            </div>
            
            {/* Visual Continuity */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-canvas to-transparent pointer-events-none z-10 opacity-60" />
          </Motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default SettingsPanel;
