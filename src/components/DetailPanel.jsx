import { useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  X, RefreshCw, Pause, Play, MoreVertical,
  Crown, AlertTriangle, Sparkles, Send, CheckCircle2,
} from 'lucide-react';
import { ActivityFeed } from './ActivityFeed';
import { TraceWaterfall } from './TraceWaterfall';
import { fetchPendingReviews, fetchSpans, restartAgent } from '../lib/api';
import { cn } from '../utils/cn';
import { SetupTab } from './detail/SetupTab';
import { MetricsTab } from './detail/MetricsTab';
import { DispatchComposer } from './detail/DispatchComposer';

function getInitialTab(agent) {
  if (agent.status === 'error') return 'logs';
  return 'setup';
}

const urgencyStyles = {
  critical: 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose',
  high: 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber',
  normal: 'border-hairline ui-well text-text-dim',
};

function AgentApprovals({ agent }) {
  const [agentReviews, setAgentReviews] = useState([]);
  const [dismissed, setDismissed] = useState(new Set());

  useEffect(() => {
    let cancelled = false;

    async function loadReviews() {
      const reviews = await fetchPendingReviews();
      if (!cancelled) {
        setAgentReviews(reviews.filter((rv) => rv.agentId === agent.id));
      }
    }

    loadReviews();
    return () => {
      cancelled = true;
    };
  }, [agent.id]);

  const visible = agentReviews.filter((rv) => !dismissed.has(rv.id));
  if (visible.length === 0) return null;

  return (
    <Motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.06, duration: 0.22 }}
      className="shrink-0 border-b border-hairline px-5 py-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-aurora-amber" />
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-aurora-amber">
          Pending Approvals ({visible.length})
        </span>
      </div>
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {visible.map((rv) => (
            <Motion.div
              key={rv.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -12, transition: { duration: 0.18 } }}
              className={cn('rounded-xl border p-3.5', urgencyStyles[rv.urgency] || urgencyStyles.normal)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{rv.title}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em]',
                        urgencyStyles[rv.urgency] || urgencyStyles.normal,
                      )}
                    >
                      {rv.urgency}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-text-muted">{rv.summary}</p>
                  <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-text-disabled">
                    <span>{rv.outputType}</span>
                    <span>{rv.createdAt}</span>
                    <span>{Math.round(rv.waitingMs / 60000)}m waiting</span>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setDismissed((prev) => new Set([...prev, rv.id]))}
                  className="rounded-lg bg-aurora-teal px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-black transition-colors hover:bg-[#12e8da]"
                >
                  Approve
                </Motion.button>
                <Motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setDismissed((prev) => new Set([...prev, rv.id]))}
                  className="rounded-lg border border-hairline bg-panel-soft px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-dim transition-colors hover:border-hairline-strong hover:text-text"
                >
                  Reject
                </Motion.button>
              </div>
            </Motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Motion.div>
  );
}

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
    <Motion.div
      initial={{ opacity: 0, scale: 0.95, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -4 }}
      className="absolute right-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-lg border border-hairline bg-panel shadow-xl"
    >
      {items.map((item) => (
        <button
          key={item.label}
          onClick={onClose}
          className="w-full px-3 py-2 text-left text-xs text-text-primary transition-colors hover:bg-panel-soft"
        >
          {item.label}
        </button>
      ))}
      <div className="border-t border-hairline">
        {showTerminate ? (
          <div className="space-y-2 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-bold text-aurora-rose">
              <AlertTriangle className="h-3 w-3" /> This will permanently stop the agent
            </div>
            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-md bg-aurora-rose py-1.5 text-[10px] font-bold text-white">Confirm</button>
              <button onClick={() => setShowTerminate(false)} className="flex-1 rounded-md border border-hairline py-1.5 text-[10px] text-text-dim">Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowTerminate(true)} className="w-full px-3 py-2 text-left text-xs text-aurora-rose transition-colors hover:bg-aurora-rose/5">
            Terminate Agent
          </button>
        )}
      </div>
    </Motion.div>
  );
}

export function DetailPanel({ agent, initialMode = 'setup', onClose }) {
  const [liveAgent, setLiveAgent] = useState(agent);
  const resolveInitialTab = () => {
    if (initialMode === 'config' || initialMode === 'skills') return 'setup';
    if (['setup', 'metrics', 'logs'].includes(initialMode)) return initialMode;
    return getInitialTab(liveAgent);
  };
  const [activeTab, setActiveTab] = useState(resolveInitialTab);
  const [showKebab, setShowKebab] = useState(false);
  const [logView, setLogView] = useState('stream');
  const [composeOpen, setComposeOpen] = useState(initialMode === 'dispatch');
  const [traceSpans, setTraceSpans] = useState([]);

  useEffect(() => {
    setLiveAgent(agent);
  }, [agent]);

  useEffect(() => {
    if (['setup', 'metrics', 'logs'].includes(initialMode)) {
      setActiveTab(initialMode);
      setComposeOpen(false);
    } else if (initialMode === 'dispatch') {
      setActiveTab(getInitialTab(liveAgent));
      setComposeOpen(true);
    } else {
      setActiveTab(getInitialTab(liveAgent));
      setComposeOpen(false);
    }
    setLogView('stream');
  }, [liveAgent, initialMode]);

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        if (composeOpen) {
          setComposeOpen(false);
        } else {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [composeOpen, onClose]);

  useEffect(() => {
    if (!showKebab) return undefined;
    const handler = () => setShowKebab(false);
    setTimeout(() => document.addEventListener('click', handler), 0);
    return () => document.removeEventListener('click', handler);
  }, [showKebab]);

  useEffect(() => {
    let cancelled = false;

    async function loadSpans() {
      const spans = await fetchSpans();
      if (!cancelled) setTraceSpans(spans);
    }

    loadSpans();
    return () => {
      cancelled = true;
    };
  }, []);

  const isProcessing = liveAgent.status === 'processing';
  const tabs = useMemo(() => [
    { id: 'setup', label: 'Setup' },
    { id: 'metrics', label: 'Metrics' },
    { id: 'logs', label: 'Logs' },
  ], []);

  const contentVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  };

  return (
    <>
      <Motion.div
        key="detail-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/25 backdrop-blur-sm"
      />

      <Motion.aside
        initial={{ x: 28, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 20, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 28, mass: 0.95 }}
        className="fixed bottom-0 right-0 top-0 z-50 flex w-[620px] flex-col border-l border-hairline bg-canvas shadow-[-14px_0_40px_rgba(0,0,0,0.15)]"
      >
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ delay: 0.05, duration: 0.18, ease: 'easeOut' }}
          className="shrink-0 border-b border-hairline bg-[radial-gradient(circle_at_top_left,var(--color-aurora-teal-soft),transparent_32%),linear-gradient(180deg,var(--color-panel),var(--color-panel-soft))]"
        >
          <Motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.18, ease: 'easeOut' }}
            className="flex items-start justify-between gap-4 px-5 py-5"
          >
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-panel-soft px-2.5 py-1 font-mono text-[10px] text-text-body">
                  <span className={cn('h-2 w-2 rounded-full', isProcessing ? 'bg-aurora-teal animate-pulse' : liveAgent.status === 'error' ? 'bg-aurora-rose' : 'bg-text-dim')} />
                  {liveAgent.id?.slice?.(0, 8) || liveAgent.id}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-panel-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-body">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: liveAgent.color }} />
                  {liveAgent.status}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-hairline bg-panel-soft px-2.5 py-1 text-[10px] font-mono text-text-body">
                  {liveAgent.role}
                </div>
              </div>
              <div className="flex items-center gap-3">
                {liveAgent.role === 'commander' && <Crown className="h-4 w-4 shrink-0 text-aurora-amber" />}
                <div className="min-w-0">
                  <h2 className="truncate text-[1.9rem] font-semibold tracking-[-0.03em] text-text-primary">{liveAgent.name}</h2>
                  <div className="mt-1 flex items-center gap-2 text-sm text-text-body">
                    <span className="font-mono text-text-primary">{liveAgent.model}</span>
                    <span>•</span>
                    <span>{liveAgent.latencyMs}ms latency</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setComposeOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-aurora-teal px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-black transition-colors hover:bg-[#12e8da]"
              >
                <Send className="h-3.5 w-3.5" />
                Dispatch
              </button>
              <button onClick={() => restartAgent(liveAgent.id).catch(console.error)} className="rounded-lg p-2 text-text-body transition-colors hover:bg-panel-soft hover:text-aurora-teal" title="Restart">
                <RefreshCw className="h-4 w-4" />
              </button>
              <button className="rounded-lg p-2 text-text-body transition-colors hover:bg-panel-soft hover:text-aurora-amber" title={isProcessing ? 'Pause' : 'Resume'}>
                {isProcessing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </button>
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowKebab(!showKebab); }}
                  className="rounded-lg p-2 text-text-body transition-colors hover:bg-panel-soft hover:text-text-primary"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
                <AnimatePresence>
                  {showKebab && <KebabMenu onClose={() => setShowKebab(false)} />}
                </AnimatePresence>
              </div>
              <div className="mx-1 h-4 w-px bg-hairline" />
              <button onClick={onClose} className="rounded-lg p-2 text-text-body transition-colors hover:bg-panel-soft hover:text-text-primary">
                <X className="h-5 w-5" />
              </button>
            </div>
          </Motion.div>

          {!composeOpen && (
            <Motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.16, ease: 'easeOut' }}
              className="flex items-center justify-between gap-4 border-t border-hairline px-5 py-3"
            >
              <div className="inline-flex items-center gap-2 text-[11px] text-text-muted">
                <Sparkles className="h-3.5 w-3.5 text-aurora-teal" />
                {liveAgent.status === 'processing'
                  ? 'This workspace is live. Use logs for current execution or dispatch another task.'
                  : liveAgent.status === 'error'
                    ? 'This workspace is in recovery mode. Logs are prioritized until the error is resolved.'
                    : 'This workspace is idle and ready for a fresh task.'}
              </div>
            </Motion.div>
          )}
        </Motion.div>

        {!composeOpen && (
          <Motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.16, ease: 'easeOut' }}
            className="shrink-0 border-b border-hairline px-5"
          >
            <div className="flex py-3">
              <div className="flex rounded-2xl ui-well p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'rounded-xl px-4 py-2 text-sm font-medium transition-all focus:outline-none',
                    activeTab === tab.id
                      ? 'bg-panel-strong text-text shadow-sm border border-hairline'
                      : 'text-text-body hover:text-text-primary',
                  )}
                >
                  {tab.label}
                </button>
              ))}
              </div>
            </div>
          </Motion.div>
        )}

        {!composeOpen && <AgentApprovals key={liveAgent.id} agent={liveAgent} />}

        {liveAgent.status === 'error' && !composeOpen && (
          <div className="shrink-0 border-b border-aurora-rose/10">
            <div className="flex items-center justify-between bg-aurora-rose/5 px-5 py-2.5">
              <div className="min-w-0 flex items-center gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-aurora-rose" />
                <span className="truncate text-[11px] font-medium text-aurora-rose">
                  {liveAgent.errorMessage || 'Agent requires intervention'}
                </span>
              </div>
              <button onClick={() => restartAgent(liveAgent.id).catch(console.error)} className="ml-3 shrink-0 rounded-md border border-aurora-rose/20 bg-aurora-rose/10 px-3 py-1 text-[10px] font-bold text-aurora-rose transition-colors hover:bg-aurora-rose/20">
                Restart Agent
              </button>
            </div>
            {liveAgent.errorStack && (
              <div className="bg-aurora-rose/[0.03] px-5 py-2">
                <pre className="whitespace-pre-wrap text-[10px] leading-relaxed text-aurora-rose/70">{liveAgent.errorStack}</pre>
                <div className="mt-2 flex items-center gap-3 font-mono text-[9px] text-text-disabled">
                  <span>Last heartbeat: {liveAgent.lastHeartbeat || '—'}</span>
                  <span>Restarts: {liveAgent.restartCount || 0}/3</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="relative flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {composeOpen ? (
              <Motion.div
                key={`dispatch-${liveAgent.id}`}
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.18 }}
                className="absolute inset-0"
              >
                <DispatchComposer
                  agent={liveAgent}
                  onBack={() => setComposeOpen(false)}
                  onSuccess={(nextTab) => {
                    setComposeOpen(false);
                    setActiveTab(nextTab);
                  }}
                />
              </Motion.div>
            ) : (
              <Motion.div
                key={`${liveAgent.id}-${activeTab}`}
                variants={contentVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                transition={{ duration: 0.18 }}
                className="absolute inset-0"
              >
                {activeTab === 'setup' && <SetupTab agent={liveAgent} onAgentUpdated={setLiveAgent} />}
                {activeTab === 'metrics' && <MetricsTab agent={liveAgent} />}
                {activeTab === 'logs' && (
                  <div className="flex h-full flex-col">
                    <div className="flex gap-1 px-4 pb-1 pt-3">
                      <button
                        onClick={() => setLogView('stream')}
                        className={cn(
                          'rounded px-3 py-1 text-[10px] font-bold transition-colors',
                          logView === 'stream' ? 'bg-aurora-teal/10 text-aurora-teal' : 'text-text-muted hover:text-text-primary',
                        )}
                      >
                        Stream
                      </button>
                      <button
                        onClick={() => setLogView('trace')}
                        className={cn(
                          'rounded px-3 py-1 text-[10px] font-bold transition-colors',
                          logView === 'trace' ? 'bg-aurora-teal/10 text-aurora-teal' : 'text-text-muted hover:text-text-primary',
                        )}
                      >
                        Timeline
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      {logView === 'stream' ? <ActivityFeed agentFilter={liveAgent.id} /> : <TraceWaterfall spans={traceSpans} />}
                    </div>
                  </div>
                )}
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
      </Motion.aside>
    </>
  );
}
