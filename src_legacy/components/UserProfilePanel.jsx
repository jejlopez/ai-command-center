import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  ArrowUpRight,
  Bell,
  Bot,
  Briefcase,
  Crown,
  LogOut,
  Shield,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSystemState } from '../context/SystemStateContext';
import { useAgents, useConnectedSystems, useTasks } from '../utils/useSupabase';
import { useCommanderPreferences } from '../utils/useCommanderPreferences';
import { cn } from '../utils/cn';

function SectionLabel({ children }) {
  return <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-text-muted">{children}</p>;
}

function InfoPill({ children, tone = 'teal' }) {
  const toneMap = {
    teal: 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal',
    amber: 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber',
    violet: 'border-aurora-violet/20 bg-aurora-violet/10 text-aurora-violet',
    blue: 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue',
  };

  return (
    <span className={cn('inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]', toneMap[tone] || toneMap.teal)}>
      {children}
    </span>
  );
}

function MetricCard({ label, value, detail, tone = 'teal' }) {
  const toneMap = {
    teal: 'text-aurora-teal',
    amber: 'text-aurora-amber',
    violet: 'text-aurora-violet',
    blue: 'text-aurora-blue',
  };

  return (
    <div className="ui-stat">
      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{label}</div>
      <div className={cn('mt-3 text-2xl font-semibold tracking-tight', toneMap[tone] || toneMap.teal)}>{value}</div>
      <div className="mt-2 text-[12px] leading-relaxed text-text-muted">{detail}</div>
    </div>
  );
}

function CommandLink({ iconComponent: IconComponent, label, detail, onClick, tone = 'teal', destructive = false }) {
  const toneClass = destructive
    ? 'border-aurora-rose/18 bg-aurora-rose/6 text-aurora-rose hover:bg-aurora-rose/10'
    : tone === 'amber'
      ? 'border-aurora-amber/18 bg-aurora-amber/[0.06] text-text-primary hover:border-aurora-amber/30'
      : 'border-white/[0.08] bg-white/[0.03] text-text-primary hover:border-aurora-teal/20';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center justify-between rounded-[18px] border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-teal/60', toneClass)}
    >
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5 rounded-xl border p-2', destructive ? 'border-aurora-rose/20 bg-aurora-rose/10' : 'border-hairline bg-panel-soft')}>
          {React.createElement(IconComponent, {
            className: cn('h-4 w-4', destructive ? 'text-aurora-rose' : 'text-aurora-teal'),
          })}
        </div>
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <div className="mt-1 text-[12px] text-text-muted">{detail}</div>
        </div>
      </div>
      <ArrowUpRight className={cn('h-4 w-4', destructive ? 'text-aurora-rose' : 'text-text-muted')} />
    </button>
  );
}

function formatDateTime(value) {
  if (!value) return 'Unknown';
  try {
    const date = new Date(value);
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  } catch {
    return 'Unknown';
  }
}

function deriveExecutionPosture(tasks, pendingCount) {
  const running = tasks.filter((task) => ['queued', 'running', 'pending', 'in_progress'].includes(task.status)).length;
  if (pendingCount > 0) return { label: 'Human attention required', tone: 'amber', detail: 'Approvals are the current constraint.' };
  if (running > 0) return { label: 'Tony running hot', tone: 'teal', detail: 'Execution branches are moving cleanly.' };
  return { label: 'Deck is clear', tone: 'blue', detail: 'No live pressure on the command queue.' };
}

function buildCommanderDirective({ pendingCount, runningTasks, connectedSystems }) {
  if (pendingCount > 0) {
    return {
      eyebrow: 'Commander priority',
      title: 'Clear the approval rail first.',
      detail: 'Human decisions are currently slowing the machine more than missing integrations or idle agents.',
      tone: 'amber',
    };
  }

  if (runningTasks > 0) {
    return {
      eyebrow: 'Commander priority',
      title: 'Execution is live. Stay in oversight mode.',
      detail: 'The system is already moving work. Best move is monitoring alerts and keeping route friction low.',
      tone: 'teal',
    };
  }

  return {
    eyebrow: 'Commander priority',
    title: connectedSystems > 0 ? 'Deck is clear. Prime the next mission.' : 'Wire the stack before scaling harder.',
    detail: connectedSystems > 0
      ? 'No immediate pressure. You can use this calm state to launch or tighten doctrine.'
      : 'Adding the right core systems will improve the reach of every mission you launch.',
    tone: connectedSystems > 0 ? 'blue' : 'violet',
  };
}

export function UserProfilePanel({ profileOpen, setProfileOpen, onAction }) {
  const { user, signOut, signOutAll } = useAuth();
  const { pendingCount } = useSystemState();
  const { agents } = useAgents();
  const { tasks } = useTasks();
  const { connectedSystems } = useConnectedSystems();
  const { commandStyle, alertPosture, commanderPersona, trustedWriteMode, approvalDoctrine, notificationRoute } = useCommanderPreferences();

  const runningTasks = tasks.filter((task) => ['queued', 'running', 'pending', 'in_progress'].includes(task.status)).length;
  const completedToday = tasks.filter((task) => ['done', 'completed'].includes(task.status)).length;
  const posture = deriveExecutionPosture(tasks, pendingCount ?? 0);
  const directive = buildCommanderDirective({ pendingCount: pendingCount ?? 0, runningTasks, connectedSystems: connectedSystems.length });
  const commanderName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Commander';
  const initials = commanderName
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CM';

  async function handleSignOut() {
    await signOut();
    setProfileOpen(false);
  }

  async function handleSignOutAll() {
    await signOutAll();
    setProfileOpen(false);
  }

  function handleAction(action) {
    onAction?.(action);
    setProfileOpen(false);
  }

  return (
    <AnimatePresence>
      {profileOpen && (
        <>
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setProfileOpen(false)}
            className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
          />

          <Motion.aside
            initial={{ x: 460, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 460, opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 220 }}
            className="ui-drawer fixed inset-y-0 right-0 z-50 flex w-[540px] max-w-[96vw] flex-col overflow-hidden shadow-[-18px_0_60px_rgba(0,0,0,0.55)]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.12),transparent_22%),radial-gradient(circle_at_24%_10%,rgba(96,165,250,0.08),transparent_24%)]" />

            <div className="relative border-b border-hairline px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="ui-kicker inline-flex items-center gap-2 px-3 py-1">
                    <Shield className="h-3.5 w-3.5 text-aurora-teal" />
                    Profile
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold tracking-tight text-text-primary">Operator access, posture, and session control.</h2>
                  <p className="mt-2 text-[13px] leading-relaxed text-text-muted">Your profile should help with decisions and control, not repeat the whole dashboard in miniature.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="ui-button-secondary p-2 text-text-muted hover:text-text-primary"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            </div>

            <div className="relative flex-1 overflow-y-auto px-5 py-5 no-scrollbar">
              <div className="ui-shell p-5 shadow-[0_24px_80px_rgba(0,0,0,0.25)]">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[22px] border border-aurora-teal/20 bg-aurora-teal/10">
                    <span className="text-lg font-semibold tracking-[0.12em] text-aurora-teal">{initials}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold tracking-tight text-text-primary">{commanderName}</h3>
                      <InfoPill tone="amber">OMEGA Clearance</InfoPill>
                      <InfoPill tone={posture.tone}>Live posture</InfoPill>
                    </div>
                    <p className="mt-2 text-sm text-text-muted">{user?.email || 'No email linked yet.'}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <InfoPill tone="teal">Commander</InfoPill>
                      <InfoPill tone="blue">Jarvis Primary</InfoPill>
                      <InfoPill tone="violet">{connectedSystems.length} systems wired</InfoPill>
                      <InfoPill tone="amber">{commandStyle === 'tony' ? 'Tony mode' : commandStyle === 'elon' ? 'Elon mode' : 'Hybrid mode'}</InfoPill>
                      <InfoPill tone="blue">{alertPosture === 'critical_only' ? 'Critical alerts' : alertPosture === 'full_feed' ? 'Full-feed alerts' : 'Balanced alerts'}</InfoPill>
                      <InfoPill tone="violet">{commanderPersona}</InfoPill>
                    </div>
                  </div>
                </div>

                <div className="mt-5 ui-panel-soft p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Execution doctrine</div>
                      <div className="mt-2 text-base font-semibold text-text-primary">{posture.label}</div>
                    </div>
                    <div className={cn('rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]',
                      posture.tone === 'amber'
                        ? 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
                        : posture.tone === 'blue'
                          ? 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue'
                          : 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                    )}>
                      Human + System
                    </div>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{posture.detail}</p>
                </div>

                <div className={cn(
                  'mt-4 rounded-[24px] border p-4',
                  directive.tone === 'amber'
                    ? 'border-aurora-amber/20 bg-aurora-amber/[0.07]'
                    : directive.tone === 'violet'
                      ? 'border-aurora-violet/20 bg-aurora-violet/[0.07]'
                      : directive.tone === 'blue'
                        ? 'border-aurora-blue/20 bg-aurora-blue/[0.07]'
                        : 'border-aurora-teal/20 bg-aurora-teal/[0.07]'
                )}>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{directive.eyebrow}</div>
                  <div className="mt-2 text-base font-semibold text-text-primary">{directive.title}</div>
                  <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{directive.detail}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <MetricCard label="Approvals in queue" value={pendingCount ?? 0} detail="The asks waiting for your judgment right now." tone={pendingCount ? 'amber' : 'teal'} />
                <MetricCard label="Active branches" value={runningTasks} detail="Queued or running work currently moving through the deck." tone="teal" />
                <MetricCard label="Connected systems" value={connectedSystems.length} detail="APIs and command surfaces currently wired into the stack." tone="violet" />
                <MetricCard label="Completed missions" value={completedToday} detail="Finished work the system can already use as operating memory." tone="blue" />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                <div className="ui-panel p-4">
                  <SectionLabel>Command Access</SectionLabel>
                  <div className="space-y-3">
                    <CommandLink
                      iconComponent={Bell}
                      label="Open command alerts"
                      detail="Failures, approvals, and system anomalies that need attention."
                      onClick={() => handleAction({ type: 'panel', panel: 'notifications' })}
                      tone="amber"
                    />
                    <CommandLink
                      iconComponent={ShieldCheck}
                      label="Open systems control"
                      detail="Tune doctrine, wire integrations, and configure the command rack."
                      onClick={() => handleAction({ type: 'panel', panel: 'settings' })}
                    />
                    <CommandLink
                      iconComponent={Activity}
                      label="Go to Mission Control"
                      detail="Jump straight into live execution and approvals."
                      onClick={() => handleAction({ type: 'navigate', route: 'missions' })}
                    />
                    <CommandLink
                      iconComponent={Briefcase}
                      label="Open Executive Debrief"
                      detail="Review pressure, economics, and where operator attention belongs."
                      onClick={() => handleAction({ type: 'navigate', route: 'reports' })}
                    />
                  </div>
                </div>

                <div className="ui-panel p-4">
                  <SectionLabel>Operator Snapshot</SectionLabel>
                  <div className="space-y-3">
                    <div className="ui-card-row p-3">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        <Crown className="h-3.5 w-3.5 text-aurora-amber" />
                        Clearance
                      </div>
                      <div className="mt-2 text-sm font-semibold text-text-primary">Full command authority</div>
                      <div className="mt-1 text-[12px] text-text-muted">Approvals, routing, missions, and command surfaces are all under your control.</div>
                    </div>
                    <div className="ui-card-row p-3">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        <Bot className="h-3.5 w-3.5 text-aurora-teal" />
                        Fleet reach
                      </div>
                      <div className="mt-2 text-sm font-semibold text-text-primary">{agents.length} agents standing by</div>
                      <div className="mt-1 text-[12px] text-text-muted">The system can route through operations, planning, and specialized branches from one command layer.</div>
                    </div>
                    <div className="ui-card-row p-3">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        <User className="h-3.5 w-3.5 text-aurora-blue" />
                        Session state
                      </div>
                      <div className="mt-2 text-sm font-semibold text-text-primary">Last sign-in {formatDateTime(user?.last_sign_in_at)}</div>
                      <div className="mt-1 text-[12px] text-text-muted">Member since {formatDateTime(user?.created_at)}.</div>
                    </div>
                    <div className="ui-card-row p-3">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        <ShieldCheck className="h-3.5 w-3.5 text-aurora-violet" />
                        Integration posture
                      </div>
                      <div className="mt-2 text-sm font-semibold text-text-primary">{connectedSystems.length} systems connected</div>
                      <div className="mt-1 text-[12px] text-text-muted">{connectedSystems.length > 0 ? 'Core command surfaces are available from your profile, settings, and mission workflows.' : 'No external systems are wired yet. Use Systems Control to establish your base stack.'}</div>
                    </div>
                    <div className="ui-card-row p-3">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        <Shield className="h-3.5 w-3.5 text-aurora-amber" />
                        Approval doctrine
                      </div>
                      <div className="mt-2 text-sm font-semibold text-text-primary">
                        {trustedWriteMode === 'locked' ? 'Locked writes' : trustedWriteMode === 'trusted' ? 'Trusted writes enabled' : 'Review-first writes'}
                      </div>
                      <div className="mt-1 text-[12px] text-text-muted">
                        {approvalDoctrine === 'always' ? 'Every meaningful write waits for human review.' : approvalDoctrine === 'exceptions_only' ? 'Only anomalies and exceptions should interrupt flow.' : 'Approval pressure is weighted by risk, not by volume.'}
                      </div>
                    </div>
                    <div className="ui-card-row p-3">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                        <Bell className="h-3.5 w-3.5 text-aurora-blue" />
                        Alert routing
                      </div>
                      <div className="mt-2 text-sm font-semibold text-text-primary">
                        {notificationRoute === 'command_center' ? 'Command center first' : `${notificationRoute} first`}
                      </div>
                      <div className="mt-1 text-[12px] text-text-muted">Critical traffic is currently biased toward this rail before the rest of the system fans out.</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 ui-panel p-4">
                <SectionLabel>Command Actions</SectionLabel>
                <div className="grid gap-3 md:grid-cols-2">
                  <CommandLink
                    iconComponent={Sparkles}
                    label="Open Strategic Systems"
                    detail="Inspect doctrine, models, learning memory, and cost posture."
                    onClick={() => handleAction({ type: 'navigate', route: 'intelligence' })}
                  />
                  <CommandLink
                    iconComponent={Activity}
                    label="Return to Overview"
                    detail="See the high-level operating readback before diving into details."
                    onClick={() => handleAction({ type: 'navigate', route: 'overview' })}
                  />
                  <CommandLink
                    iconComponent={LogOut}
                    label="Sign out"
                    detail="Close this session on the current device."
                    onClick={handleSignOut}
                    destructive
                  />
                  <CommandLink
                    iconComponent={Shield}
                    label="Sign out all sessions"
                    detail="Force a clean reset across every connected session."
                    onClick={handleSignOutAll}
                    destructive
                  />
                </div>
              </div>
            </div>
          </Motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export default UserProfilePanel;
