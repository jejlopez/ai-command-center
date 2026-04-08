import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Shield, ChevronRight, LogOut, Activity, Download,
  Bell, Key, ShieldCheck, Crown,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSystemState } from '../context/SystemStateContext';
import { cn } from '../utils/cn';

// ── Placeholder data (structured for easy backend wiring later) ──
const COMMANDER_DEFAULTS = {
  name: 'J. Jarvis',
  initials: 'JJ',
  role: 'Commander',
  workspace: 'Nexus Primary',
  clearance: 'OMEGA',
  activeSince: 'Today, 2:15 PM',
  agentsDeployed: 6,
  tokenUsage: 142800,
  tokenLimit: 500000,
  currentMode: 'Operational',
  permissionLevel: 'Full Authority',
  approvalAuthority: 'All agents, all actions',
  connectedProviders: [
    { name: 'Anthropic', status: 'connected' },
    { name: 'OpenAI', status: 'connected' },
    { name: 'Google AI', status: 'connected' },
    { name: 'Ollama (local)', status: 'connected' },
  ],
  apiAccess: 'Active',
  lastSignIn: 'Apr 8, 2026 — 9:04 AM',
};

// ── Section label ────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mt-6 mb-3 px-0.5">
      {children}
    </div>
  );
}

// ── Stat row ─────────────────────────────────────────────────────
function StatRow({ label, value, valueClass }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[11px] text-text-muted">{label}</span>
      <span className={cn("text-[11px] font-mono font-medium", valueClass || "text-text-primary")}>{value}</span>
    </div>
  );
}

// ── Action row ───────────────────────────────────────────────────
function ActionRow({ icon: Icon, label, onClick, badge, destructive }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center justify-between w-full py-2 px-2.5 -mx-2.5 rounded-lg text-[12px] transition-colors group",
        destructive
          ? "text-aurora-rose hover:bg-aurora-rose/5"
          : "text-text-body hover:text-text-primary hover:bg-white/[0.03]"
      )}
    >
      <span className="flex items-center gap-2.5">
        <Icon className={cn("w-3.5 h-3.5 shrink-0", destructive ? "text-aurora-rose" : "text-text-muted group-hover:text-text-primary transition-colors")} />
        {label}
      </span>
      <span className="flex items-center gap-2">
        {badge && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-aurora-amber/10 text-aurora-amber">
            {badge}
          </span>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-text-disabled group-hover:text-text-muted transition-colors" />
      </span>
    </button>
  );
}

// ── Provider dot ─────────────────────────────────────────────────
function ProviderDot({ name, status }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-text-muted">{name}</span>
      <div className="flex items-center gap-1.5">
        <div className={cn("w-1.5 h-1.5 rounded-full", status === 'connected' ? "bg-aurora-green" : "bg-text-disabled")} />
        <span className={cn("text-[9px] font-mono uppercase", status === 'connected' ? "text-aurora-green" : "text-text-disabled")}>
          {status}
        </span>
      </div>
    </div>
  );
}

// ── Commander content ────────────────────────────────────────────
function CommanderView({ onSignOut, userEmail, pendingCount }) {
  const data = { ...COMMANDER_DEFAULTS, email: userEmail || null };
  const usagePercent = Math.round((data.tokenUsage / data.tokenLimit) * 100);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-5 flex flex-col">

      {/* ── Commander Identity ─────────────────────────────────── */}
      <div className="flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-aurora-teal/10 border border-aurora-teal/20 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-aurora-teal font-mono">{data.initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary truncate">{data.name}</h3>
            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-aurora-amber/10 text-aurora-amber border border-aurora-amber/20">
              {data.clearance}
            </span>
          </div>
          <p className="text-[11px] font-mono mt-0.5 truncate" style={{ color: data.email ? undefined : 'var(--text-disabled, #3f3f46)' }}>
            {data.email || 'No email linked'}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="flex items-center gap-1 text-[9px] font-mono text-aurora-teal">
              <Crown className="w-2.5 h-2.5" />
              {data.role}
            </span>
            <span className="text-text-disabled text-[9px]">/</span>
            <span className="text-[9px] font-mono text-text-disabled">{data.workspace}</span>
          </div>
        </div>
      </div>

      {/* ── Live Status ───────────────────────────────────────── */}
      <SectionLabel>Live Status</SectionLabel>
      <div className="space-y-0.5">
        <StatRow label="Active since" value={data.activeSince} />
        <StatRow label="Agents deployed" value={data.agentsDeployed} />
        <StatRow
          label="Approvals pending"
          value={pendingCount}
          valueClass={pendingCount > 0 ? "text-aurora-amber" : "text-text-primary"}
        />
        <StatRow label="Mode" value={data.currentMode} valueClass="text-aurora-green" />
        <div className="pt-1.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-text-muted">Token budget</span>
            <span className="text-[10px] font-mono text-text-disabled">
              {(data.tokenUsage / 1000).toFixed(0)}k / {(data.tokenLimit / 1000).toFixed(0)}k
            </span>
          </div>
          <div className="w-full h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-aurora-teal"
              initial={{ width: 0 }}
              animate={{ width: `${usagePercent}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      </div>

      {/* ── Authority / Access ────────────────────────────────── */}
      <SectionLabel>Authority</SectionLabel>
      <div className="space-y-0.5">
        <StatRow label="Permission level" value={data.permissionLevel} valueClass="text-aurora-teal" />
        <StatRow label="Approval scope" value={data.approvalAuthority} />
        <StatRow label="API access" value={data.apiAccess} valueClass="text-aurora-green" />
        <StatRow label="Last sign-in" value={data.lastSignIn} valueClass="text-text-disabled" />
      </div>

      {/* Connected providers */}
      <div className="mt-3 p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
        <div className="text-[9px] uppercase tracking-[0.15em] text-text-disabled font-bold mb-2">Connected Providers</div>
        {data.connectedProviders.map(p => (
          <ProviderDot key={p.name} name={p.name} status={p.status} />
        ))}
      </div>

      {/* ── Command Actions ───────────────────────────────────── */}
      <SectionLabel>Command Actions</SectionLabel>
      <div className="space-y-0.5">
        <ActionRow icon={ShieldCheck} label="Review pending approvals" badge={pendingCount > 0 ? pendingCount : null} />
        <ActionRow icon={Activity} label="View activity log" />
        <ActionRow icon={Bell} label="Notification preferences" />
        <ActionRow icon={Download} label="Export session data" />
        <ActionRow icon={Key} label="API access settings" />
      </div>

      {/* ── Sign Out ──────────────────────────────────────────── */}
      <div className="mt-auto pt-5 space-y-1.5">
        <button
          onClick={onSignOut}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-aurora-rose/20 text-aurora-rose text-[12px] font-medium hover:bg-aurora-rose/5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
        <button className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-[10px] text-text-disabled hover:text-text-muted transition-colors">
          Sign out all sessions
        </button>
      </div>
    </div>
  );
}

// ── Main panel shell ─────────────────────────────────────────────
export function UserProfilePanel({ profileOpen, setProfileOpen }) {
  const { user, signOut } = useAuth();
  const { pendingCount } = useSystemState();

  async function handleSignOut() {
    await signOut();
    setProfileOpen(false);
  }

  return (
    <AnimatePresence>
      {profileOpen && (
        <>
          <motion.div
            key="commander-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setProfileOpen(false)}
          />

          <motion.div
            key="commander-panel"
            initial={{ x: 380, opacity: 0, scale: 0.98 }}
            animate={{ x: 0, opacity: 1, scale: 1 }}
            exit={{ x: 380, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', damping: 32, stiffness: 200, mass: 0.8 }}
            className="fixed top-0 bottom-0 right-0 z-50 w-[360px] bg-surface/95 backdrop-blur-2xl border-l border-border flex flex-col shadow-[-4px_0_24px_-4px_rgba(0,0,0,0.5)]"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2.5">
                <Shield className="w-5 h-5 text-aurora-teal" />
                <h2 className="text-sm font-semibold text-text-primary tracking-wide">Commander</h2>
              </div>
              <button
                onClick={() => setProfileOpen(false)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-white/[0.06] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="h-px bg-border mx-5" />

            <CommanderView
              onSignOut={handleSignOut}
              userEmail={user?.email}
              pendingCount={pendingCount ?? 0}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default UserProfilePanel;
