import React, { useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowUpRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  DollarSign,
  FileText,
  Gauge,
  History,
  Layers3,
  Sparkles,
  Target,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { container, item } from '../utils/variants';
import { useActivityLog, useAgents, useCostData, usePendingReviews, useSpecialistLifecycle, useSystemRecommendations, useTaskInterventions, useTaskOutcomes, useTasks } from '../utils/useSupabase';
import { AnimatedNumber } from '../components/command/AnimatedNumber';
import { CommandSectionHeader } from '../components/command/CommandSectionHeader';
import { useLearningMemory } from '../utils/useLearningMemory';
import { DoctrineCards } from '../components/command/DoctrineCards';
import { TruthAuditStrip } from '../components/command/TruthAuditStrip';
import { useCommandCenterTruth } from '../utils/useCommandCenterTruth';
import { buildPolicyDemotionSummary, buildProviderEscalationExplanation, getAutomationCandidates, getAutomationRoiSummary, getAutonomyMetrics, getObservedModelBenchmarks, getPrimaryBottleneck, parseAutomationGuardrailEvents, parseDoctrineFeedbackLogs, parseOutcomeScoreLogs, rankCommanderRecommendations, scoreTaskOutcome } from '../utils/commanderAnalytics';
import { createMission, updateRecurringMissionFlow } from '../lib/api';

const PERIOD_OPTIONS = ['30d', '90d', 'QTD'];
const STATUS_COLORS = {
  running: '#fbbf24',
  queued: '#60a5fa',
  pending: '#60a5fa',
  done: '#34d399',
  completed: '#34d399',
  failed: '#fb7185',
  error: '#fb7185',
  blocked: '#fb7185',
  cancelled: '#94a3b8',
  needs_approval: '#2dd4bf',
};

function formatCurrency(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function HudFrame({ eyebrow, title, detail, accent = 'teal', children, className = '' }) {
  const accents = {
    teal: 'from-aurora-teal/18 to-transparent',
    violet: 'from-aurora-violet/18 to-transparent',
    blue: 'from-aurora-blue/18 to-transparent',
    amber: 'from-aurora-amber/18 to-transparent',
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={`relative overflow-hidden rounded-[24px] border border-white/8 bg-black/20 p-4 ${className}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accents[accent] || accents.teal}`} />
      <div className="pointer-events-none absolute right-4 top-4 h-12 w-12 rounded-full bg-white/[0.03] blur-2xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(180deg,rgba(255,255,255,0.16)_0px,rgba(255,255,255,0.16)_1px,transparent_1px,transparent_12px)]" />
      <Motion.div
        initial={{ opacity: 0.12, x: '-30%' }}
        animate={{ opacity: 0.28, x: '135%' }}
        transition={{ duration: 5.2, repeat: Infinity, ease: 'linear' }}
        className="pointer-events-none absolute top-0 h-full w-16 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] blur-lg"
      />
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{eyebrow}</div>
          <div className="mt-1 text-sm font-semibold text-text-primary">{title}</div>
          {detail && <div className="mt-1 text-[12px] leading-relaxed text-text-muted">{detail}</div>}
        </div>
        <div className="h-2 w-2 rounded-full bg-aurora-teal shadow-[0_0_16px_rgba(0,217,200,0.55)]" />
      </div>
      {children}
    </Motion.div>
  );
}

function TelemetryTag({ label, value, tone = 'teal' }) {
  const styles = {
    teal: 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal',
    amber: 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber',
    violet: 'border-aurora-violet/20 bg-aurora-violet/10 text-aurora-violet',
    blue: 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue',
  };
  return (
    <div className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${styles[tone] || styles.teal}`}>
      {label}: {value}
    </div>
  );
}

function ExecutiveReadFirst({ items }) {
  return (
    <Motion.section variants={item} className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {items.map((entry) => (
        <Motion.div
          key={entry.title}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="rounded-[22px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-3.5"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{entry.eyebrow}</div>
          <div className="mt-1.5 text-[15px] font-semibold text-text-primary">{entry.title}</div>
          <p className="mt-1.5 text-[11px] leading-5 text-text-body">{entry.detail}</p>
        </Motion.div>
      ))}
    </Motion.section>
  );
}

function ChartHudOverlay({ accent = '#2dd4bf' }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <circle cx="82" cy="18" r="10" fill="none" stroke={accent} strokeOpacity="0.22" strokeWidth="0.6" />
        <circle cx="82" cy="18" r="5" fill="none" stroke={accent} strokeOpacity="0.35" strokeWidth="0.8" />
        <path d="M6 10h12M6 10v10M94 10H82M94 10v10M6 90h12M6 90V80M94 90H82M94 90V80" fill="none" stroke={accent} strokeOpacity="0.26" strokeWidth="0.8" />
      </svg>
      <div className="absolute inset-x-0 top-1/2 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
    </div>
  );
}

function ExecutiveKpi({ label, value, detail, tone = 'teal', icon, valueNode }) {
  const KpiIcon = icon;
  const toneStyles = {
    teal: 'text-aurora-teal border-aurora-teal/20 bg-aurora-teal/8',
    amber: 'text-aurora-amber border-aurora-amber/20 bg-aurora-amber/8',
    rose: 'text-aurora-rose border-aurora-rose/20 bg-aurora-rose/8',
    blue: 'text-aurora-blue border-aurora-blue/20 bg-aurora-blue/8',
  };

  return (
    <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.22em] text-text-muted">{label}</span>
        <div className={`rounded-xl border px-2.5 py-2 ${toneStyles[tone]}`}>
          <KpiIcon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-4 text-3xl font-semibold tracking-tight text-text-primary">{valueNode || value}</div>
      <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{detail}</p>
    </div>
  );
}

function DoctrineTimelinePanel({ learningMemory }) {
  const timeline = learningMemory.doctrine
    .slice()
    .sort((a, b) => new Date(b.latestSnapshotAt || 0).getTime() - new Date(a.latestSnapshotAt || 0).getTime())
    .slice(0, 4);

  return (
    <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-aurora-violet" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Doctrine timeline</span>
      </div>
      <div className="mt-4 space-y-3">
        {timeline.map((item) => (
          <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[12px] font-semibold text-text-primary">{item.owner}</div>
              <div className="text-[10px] font-mono text-aurora-teal">{item.confidence}%</div>
            </div>
            <div className="mt-1 text-[11px] text-text-body">{item.changeSummary}</div>
            <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-text-disabled">
              {item.latestSnapshotAt ? new Date(item.latestSnapshotAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Current session'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExecutiveSignalRail({ learningMemory, summary, burnByModel }) {
  const [focus, setFocus] = useState('doctrine');
  const orders = [
    {
      title: 'Cut approval drag',
      detail: summary.approvalPressure
        ? `${summary.approvalPressure} missions are still waiting on humans. Bundle low-risk approvals and clear the lightest work automatically.`
        : 'Approval pressure is quiet. Keep the bar high and spend attention on scaling cleaner branches.',
      tone: summary.approvalPressure ? 'amber' : 'teal',
    },
    {
      title: 'Protect the expensive lane',
      detail: burnByModel[0]
        ? `${burnByModel[0].name} is the hottest cost center. Route only ambiguity-heavy work there and push routine traffic down-stack.`
        : 'No single model family dominates spend yet, which is the perfect moment to lock in disciplined routing.',
      tone: 'rose',
    },
    {
      title: 'Scale the winner',
      detail: summary.topAgents[0]
        ? `${summary.topAgents[0].name} is carrying the deck. Clone the pattern that is closing work cleanly before the load diffuses.`
        : 'Volume is still light enough to set standards before habits harden.',
      tone: 'blue',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-1.5">
        <div className="flex flex-wrap gap-2 rounded-[20px] bg-black/20 p-1.5">
          {[
            { id: 'doctrine', label: 'Doctrine' },
            { id: 'orders', label: 'Orders' },
            { id: 'timeline', label: 'Timeline' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFocus(tab.id)}
              className={`flex-1 rounded-[16px] px-3 py-2.5 text-[11px] font-semibold transition-all ${
                focus === tab.id ? 'border border-white/10 bg-white/[0.05] text-text-primary' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {focus === 'doctrine' && (
        <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(167,139,250,0.06),rgba(255,255,255,0.02))] p-4">
          <CommandSectionHeader
            eyebrow="Boardroom Doctrine"
            title="What the system has learned this cycle"
            description="Executive signals only. Click any card for the why and the drift over time."
            icon={Sparkles}
            tone="violet"
          />
          <DoctrineCards items={learningMemory.executiveThree} columns="one" />
        </div>
      )}

      {focus === 'orders' && (
        <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(45,212,191,0.05),rgba(255,255,255,0.02))] p-4">
          <CommandSectionHeader
            eyebrow="Executive Orders"
            title="What Tony and Elon would do next"
            description="Three moves with the most leverage right now."
            icon={TrendingUp}
            tone="teal"
          />
          <div className="mt-5 space-y-3">
            {orders.map((entry) => (
              <div key={entry.title} className="rounded-[20px] border border-white/8 bg-black/20 p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[13px] font-semibold text-text-primary">{entry.title}</div>
                    <p className="mt-1.5 text-[11px] leading-5 text-text-muted">{entry.detail}</p>
                  </div>
                  <ArrowUpRight className={`mt-0.5 h-4 w-4 ${
                    entry.tone === 'rose' ? 'text-aurora-rose' : entry.tone === 'amber' ? 'text-aurora-amber' : entry.tone === 'blue' ? 'text-aurora-blue' : 'text-aurora-teal'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {focus === 'timeline' && <DoctrineTimelinePanel learningMemory={learningMemory} />}
    </div>
  );
}

function PressureModeIntro({ title, description }) {
  return (
    <div className="mb-3 rounded-[16px] border border-white/8 bg-white/[0.03] px-3.5 py-2.5">
      <div className="text-[13px] font-semibold text-text-primary">{title}</div>
      <p className="mt-1 text-[11px] leading-5 text-text-muted">{description}</p>
    </div>
  );
}

function TopOperatorTable({ agents }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4">
      <CommandSectionHeader
        eyebrow="Top Operators"
        title="Who is carrying the work"
        description="A simple ranked table instead of another wall of cards."
        icon={Layers3}
        tone="blue"
      />
      <div className="mt-4 overflow-hidden rounded-[20px] border border-white/8 bg-black/20">
        <div className="grid grid-cols-[1.3fr_0.8fr_0.8fr] border-b border-white/8 px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-text-muted">
          <div>Operator</div>
          <div>Missions</div>
          <div>Cost</div>
        </div>
        {agents.length === 0 ? (
          <div className="px-4 py-6 text-sm text-text-muted">
            No mission traffic yet. Once work lands, this table will rank the strongest branches.
          </div>
        ) : (
          agents.map((agent, index) => (
            <div
              key={agent.name}
              className={`grid grid-cols-[1.3fr_0.8fr_0.8fr] px-4 py-2.5 text-[13px] ${index !== agents.length - 1 ? 'border-b border-white/8' : ''}`}
            >
              <div className="font-semibold text-text-primary">{agent.name}</div>
              <div className="text-text-body">{agent.tasks}</div>
              <div className="text-text-body">{formatCurrency(agent.cost)}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function CollapsedPanel({ eyebrow, title, summary, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-[24px] border border-white/8 bg-[#111827]/90 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{eyebrow}</div>
          <div className="mt-1 text-base font-semibold text-text-primary">{title}</div>
          <div className="mt-1 text-[11px] leading-5 text-text-muted">{summary}</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-semibold text-text-primary transition-colors hover:bg-white/[0.06]"
        >
          {open ? 'Hide' : 'Open'}
        </button>
      </div>
      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function ReportsDashboardHeader({ period, setPeriod, summary }) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-[#111827]/92 p-5">
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted">Executive Debrief</div>
          <h1 className="mt-2 text-[clamp(1.8rem,2.5vw,2.55rem)] font-semibold tracking-[-0.04em] text-text-primary">Executive Debrief</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-5 text-text-muted">One clean board for mission health, approval drag, and spend.</p>
        </div>
        <div className="rounded-[20px] border border-white/8 bg-[#0d1420] p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Board controls</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-aurora-teal">Live</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPeriod(option)}
                className={`rounded-xl border px-3 py-2 text-[11px] font-semibold transition-colors ${
                  period === option
                    ? 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal'
                    : 'border-white/8 bg-white/[0.03] text-text-muted hover:text-text-primary'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-[16px] border border-white/8 bg-[#111827] p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Burn today</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary">{formatCurrency(summary.totalCost)}</div>
            </div>
            <div className="rounded-[16px] border border-white/8 bg-[#111827] p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Cost / mission</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary">{formatCurrency(summary.avgCost)}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReportsView() {
  const [period, setPeriod] = useState('30d');
  const [pressureFocus, setPressureFocus] = useState('activity');
  const [automationMessage, setAutomationMessage] = useState('');
  const [automationDraft, setAutomationDraft] = useState(null);
  const [automationLaunching, setAutomationLaunching] = useState(false);
  const { data: costData } = useCostData();
  const { agents } = useAgents();
  const { tasks } = useTasks();
  const { outcomes } = useTaskOutcomes();
  const { interventions } = useTaskInterventions();
  const { reviews } = usePendingReviews();
  const { logs } = useActivityLog();
  const { recommendations: persistedRecommendations } = useSystemRecommendations();
  const { events: lifecycleEvents } = useSpecialistLifecycle();
  const truth = useCommandCenterTruth();
  const humanHourlyRate = 150;

  const summary = useMemo(() => {
    const completed = tasks.filter((task) => ['completed', 'done'].includes(task.status));
    const running = tasks.filter((task) => ['running', 'queued', 'pending'].includes(task.status));
    const blocked = tasks.filter((task) => ['failed', 'error', 'blocked', 'cancelled'].includes(task.status));
    const successRate = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 100;
    const approvalPressure = reviews.length;
    const totalCost = costData.total || tasks.reduce((sum, task) => sum + Number(task.costUsd || 0), 0);
    const avgCost = tasks.length ? totalCost / tasks.length : 0;
    const tasksByAgent = tasks.reduce((acc, task) => {
      const key = task.agentName || 'Unassigned';
      if (!acc[key]) acc[key] = { name: key, tasks: 0, cost: 0, completed: 0 };
      acc[key].tasks += 1;
      acc[key].cost += Number(task.costUsd || 0);
      if (['completed', 'done'].includes(task.status)) acc[key].completed += 1;
      return acc;
    }, {});

    const topAgents = Object.values(tasksByAgent)
      .sort((a, b) => (b.cost === a.cost ? b.tasks - a.tasks : b.cost - a.cost))
      .slice(0, 4);

    return {
      totalCost,
      avgCost,
      successRate,
      running: running.length,
      blocked: blocked.length,
      approvalPressure,
      completed: completed.length,
      topAgents,
    };
  }, [costData.total, reviews.length, tasks]);

  const burnByModel = useMemo(() => {
    return [...(costData.models || [])].sort((a, b) => Number(b.cost || 0) - Number(a.cost || 0)).map((model, index) => ({
      name: model.name.replace(/\s+/g, ' ').slice(0, 16),
      cost: Number(model.cost || 0),
      fill: ['#2dd4bf', '#60a5fa', '#a78bfa', '#fbbf24'][index % 4],
    }));
  }, [costData.models]);

  const statusPressure = useMemo(() => {
    const counts = tasks.reduce((acc, task) => {
      const key = task.status || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts)
      .map(([status, count]) => ({
        status: status.replaceAll('_', ' '),
        count,
        color: STATUS_COLORS[status] || '#94a3b8',
      }))
      .sort((a, b) => b.count - a.count);
  }, [tasks]);

  const activityWave = useMemo(() => {
    const recentLogs = [...logs].slice(-24);
    const bucketCount = 6;
    const chunkSize = recentLogs.length > 0 ? Math.ceil(recentLogs.length / bucketCount) : 1;
    const labels = ['6 slices ago', '5 slices ago', '4 slices ago', '3 slices ago', '2 slices ago', 'Now'];
    const buckets = Array.from({ length: bucketCount }, (_, index) => ({
      name: labels[index],
      volume: 0,
    }));

    recentLogs.forEach((_, index) => {
      const bucketIndex = Math.min(bucketCount - 1, Math.floor(index / chunkSize));
      buckets[bucketIndex].volume += 1;
    });

    return buckets.map((bucket) => ({ ...bucket, volume: bucket.volume || 0 }));
  }, [logs]);

  const learningMemory = useLearningMemory({ tasks, approvals: reviews, logs, costData });
  const qualitySummary = useMemo(() => {
    const scored = tasks.map((task) => ({ task, outcome: scoreTaskOutcome(task) }));
    const average = scored.length
      ? Math.round(scored.reduce((sum, entry) => sum + entry.outcome.score, 0) / scored.length)
      : 0;
    const top = scored.slice().sort((left, right) => right.outcome.score - left.outcome.score).slice(0, 3);
    return { average, top };
  }, [tasks]);
  const roiSummary = useMemo(() => getAutomationRoiSummary(tasks, humanHourlyRate), [tasks]);
  const benchmarkBoard = useMemo(() => getObservedModelBenchmarks(outcomes.length ? outcomes : tasks, agents, logs, interventions).slice(0, 5), [outcomes, tasks, agents, logs, interventions]);
  const providerEscalation = useMemo(() => buildProviderEscalationExplanation(benchmarkBoard), [benchmarkBoard]);
  const automationCandidates = useMemo(() => getAutomationCandidates(tasks, humanHourlyRate).slice(0, 4), [tasks]);
  const autonomyMetrics = useMemo(() => getAutonomyMetrics(tasks, interventions, logs), [tasks, interventions, logs]);
  const primaryBottleneck = useMemo(() => getPrimaryBottleneck({ tasks, reviews, schedules: [], agents, interventions, logs, costData }), [tasks, reviews, agents, interventions, logs, costData]);
  const automationGuardrailEvents = useMemo(() => parseAutomationGuardrailEvents(interventions, logs).slice(0, 4), [interventions, logs]);
  const persistedOutcomeScores = useMemo(() => (
    outcomes.length
      ? outcomes.slice(0, 5).map((entry) => ({ id: entry.id, trust: entry.trust, score: entry.score, cleanMessage: `${entry.outcomeStatus} · ${entry.domain} / ${entry.intentType} · ${entry.model || 'adaptive lane'}`, createdAt: entry.createdAt }))
      : parseOutcomeScoreLogs(logs).slice(0, 5)
  ), [outcomes, logs]);
  const persistedDoctrineFeedback = useMemo(() => parseDoctrineFeedbackLogs(logs).slice(0, 4), [logs]);
  const automationTuningHistory = useMemo(() => {
    if (!automationDraft?.candidate) return { entries: [], summary: null };
    const candidate = automationDraft.candidate;
    const candidateTasks = tasks.filter((task) => task.domain === candidate.domain && task.intentType === candidate.intentType);
    const rootIds = new Set(candidateTasks.map((task) => task.rootMissionId || task.id).filter(Boolean));
    const entries = interventions.filter((entry) => (
      ((entry.domain === candidate.domain && entry.intentType === candidate.intentType) || rootIds.has(entry.rootMissionId || entry.taskId))
      && (entry.scheduleType === 'recurring' || entry.eventType === 'guardrail')
    ));

    return {
      entries: entries.slice(0, 6),
      summary: buildPolicyDemotionSummary({
        taskDomain: candidate.domain,
        intentType: candidate.intentType,
      }, tasks, interventions, logs),
    };
  }, [automationDraft, interventions, logs, tasks]);
  const rankedRecommendations = useMemo(() => (
    rankCommanderRecommendations({
      recommendations: persistedRecommendations,
      tasks,
      interventions,
      logs,
      lifecycleEvents,
      agents,
    }).slice(0, 4)
  ), [agents, interventions, lifecycleEvents, logs, persistedRecommendations, tasks]);

  const managedRecurringFlows = useMemo(() => {
    const recurringRoots = tasks.filter((task) => task.scheduleType === 'recurring' && (task.rootMissionId || task.id) === task.id);

    return recurringRoots.map((task) => {
      const recurrence = task.recurrenceRule || {};
      const rootId = task.rootMissionId || task.id;
      const latestOutcome = outcomes
        .filter((entry) => (entry.rootMissionId || entry.taskId) === rootId)
        .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())[0] || null;
      const latestIntervention = interventions
        .filter((entry) => (entry.rootMissionId || entry.taskId) === rootId)
        .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())[0] || null;
      const latestGuardrail = interventions
        .filter((entry) => entry.eventType === 'guardrail' && (entry.rootMissionId || entry.taskId) === rootId)
        .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())[0] || null;

      return {
        id: task.id,
        rootMissionId: rootId,
        title: task.title || task.name,
        domain: task.domain || 'general',
        intentType: task.intentType || 'general',
        frequency: recurrence.frequency || 'weekly',
        time: recurrence.time || '09:00',
        missionMode: recurrence.missionMode || (task.workflowStatus === 'planned' ? 'plan_first' : task.requiresApproval || task.approvalLevel === 'human_required' ? 'watch_and_approve' : 'do_now'),
        approvalPosture: recurrence.approvalPosture || task.approvalLevel || 'risk_weighted',
        paused: recurrence.paused ?? (String(task.status || '').toLowerCase() === 'paused'),
        nextRunAt: task.runAt || null,
        lastRunAt: task.lastRunAt || latestOutcome?.createdAt || null,
        latestOutcome,
        latestIntervention,
        latestGuardrail,
      };
    }).sort((left, right) => {
      const leftTs = new Date(left.nextRunAt || left.lastRunAt || 0).getTime();
      const rightTs = new Date(right.nextRunAt || right.lastRunAt || 0).getTime();
      return rightTs - leftTs;
    });
  }, [tasks, outcomes, interventions]);

  function openAutomationDraft(candidate) {
    setAutomationMessage('');
    setAutomationDraft({
      mode: 'create',
      candidate,
      frequency: candidate.runs >= 4 ? 'daily' : 'weekly',
      time: '09:00',
      outputType: candidate.intentType === 'report' ? 'summary' : 'action_plan',
      missionMode: candidate.roi >= 3 ? 'plan_first' : 'watch_and_approve',
      approvalPosture: ['finance', 'money', 'billing'].includes(String(candidate.domain || '').toLowerCase()) ? 'human_required' : 'risk_weighted',
    });
  }

  function openManagedFlowDraft(flow) {
    setAutomationMessage('');
    setAutomationDraft({
      mode: 'manage',
      taskId: flow.id,
      candidate: {
        title: flow.title,
        domain: flow.domain,
        intentType: flow.intentType,
        runs: tasks.filter((task) => task.domain === flow.domain && task.intentType === flow.intentType).length,
        roi: getAutomationCandidates(tasks, humanHourlyRate).find((entry) => entry.domain === flow.domain && entry.intentType === flow.intentType && entry.title === flow.title)?.roi || 0,
      },
      frequency: flow.frequency,
      time: flow.time,
      outputType: 'summary',
      missionMode: flow.missionMode,
      approvalPosture: flow.approvalPosture,
      paused: flow.paused,
    });
  }

  function getAutomationGuardrails(candidate, draft) {
    if (!candidate || !draft) return [];
    return [
      candidate.roi < 1.5 ? 'ROI is still modest, so keep this in watch-and-approve until the workflow proves itself.' : null,
      candidate.runs < 3 ? 'This flow is only lightly repeated so far. Start with a slower cadence before scaling it.' : null,
      ['finance', 'money', 'billing'].includes(String(candidate.domain || '').toLowerCase()) ? 'Financial or money-adjacent work should stay human-gated by default.' : null,
      draft.frequency === 'daily' && candidate.runs < 4 ? 'Daily cadence is aggressive for a flow with limited history. Weekly may be safer first.' : null,
    ].filter(Boolean);
  }

  async function handleLaunchRecurring() {
    if (!automationDraft?.candidate) return;
    const candidate = automationDraft.candidate;
    try {
      setAutomationLaunching(true);
      if (automationDraft.mode === 'manage' && automationDraft.taskId) {
        const result = await updateRecurringMissionFlow(automationDraft.taskId, {
          frequency: automationDraft.frequency,
          time: automationDraft.time,
          missionMode: automationDraft.missionMode,
          approvalPosture: automationDraft.approvalPosture,
          paused: automationDraft.paused ?? false,
          outputType: automationDraft.outputType,
          automationCandidate: {
            runs: candidate.runs,
            roi: candidate.roi,
            domain: candidate.domain,
          },
        });
        setAutomationMessage(
          result?.guardrails?.length
            ? `Recurring flow updated for ${candidate.title}. Guardrails applied: ${result.guardrails.join(' ')}`
            : `Recurring flow updated for ${candidate.title}.`
        );
      } else {
        const commander = agents.find((agent) => agent.role === 'commander' && !agent.isSyntheticCommander) || agents.find((agent) => agent.role === 'commander') || agents[0] || null;
        const cadence = { frequency: automationDraft.frequency, time: automationDraft.time, approvalPosture: automationDraft.approvalPosture, missionMode: automationDraft.missionMode, paused: automationDraft.paused ?? false };
        const result = await createMission({
          intent: candidate.title,
          agentId: commander?.id || null,
          agentName: commander?.name || 'Commander',
          missionMode: automationDraft.missionMode,
          mode: 'normal',
          when: 'repeat',
          repeat: cadence,
          targetType: candidate.domain,
          outputType: automationDraft.outputType,
          priority: 'normal',
          priorityScore: 5,
          automationCandidate: {
            runs: candidate.runs,
            roi: candidate.roi,
            domain: candidate.domain,
          },
        }, agents);
        setAutomationMessage(
          result?.guardrails?.length
            ? `Recurring flow launched for ${candidate.title}. Guardrails applied: ${result.guardrails.join(' ')}`
            : `Recurring flow launched for ${candidate.title}.`
        );
      }
      setAutomationDraft(null);
    } catch (error) {
      setAutomationMessage(error.message || 'Could not launch recurring flow.');
    } finally {
      setAutomationLaunching(false);
    }
  }
  const peakActivity = useMemo(
    () => activityWave.reduce((best, bucket) => (bucket.volume > best.volume ? bucket : best), activityWave[0] || { name: 'No activity yet', volume: 0 }),
    [activityWave]
  );
  const topCostCenter = burnByModel[0] || null;
  const readFirstItems = useMemo(() => [
    {
      eyebrow: 'Read First',
      title: summary.approvalPressure > 0 ? 'Human approvals are the first drag point' : 'Approval drag is currently contained',
      detail: summary.approvalPressure > 0
        ? `${summary.approvalPressure} items are waiting on people, which means the fastest win is clearing or bundling those decisions.`
        : 'No meaningful queue is forming at human gates, so the system can lean harder into autonomous flow.',
    },
    {
      eyebrow: 'Margin Signal',
      title: topCostCenter ? `${topCostCenter.name} is the budget hotspot` : 'Spend is still distributed',
      detail: topCostCenter
        ? `The most expensive lane is ${topCostCenter.name} at ${formatCurrency(topCostCenter.cost)}. That is the first place to tighten routing discipline.`
        : 'No single branch dominates spend yet, which means you still have room to shape habits before cost locks in.',
    },
    {
      eyebrow: 'Execution Signal',
      title: summary.topAgents[0] ? `${summary.topAgents[0].name} is carrying the deck` : 'No operator is dominating yet',
      detail: summary.topAgents[0]
        ? `${summary.topAgents[0].name} has become the strongest branch by load and completion, which makes it the best pattern to replicate.`
        : 'Traffic is still broad enough that you should keep focusing on standards and quality before scaling one branch.',
    },
  ], [summary, topCostCenter]);

  return (
    <div className="relative flex h-full flex-col overflow-y-auto pb-10">
      <Motion.div variants={container} initial="hidden" animate="show" className="relative space-y-5">
        <Motion.div variants={item}>
          <ReportsDashboardHeader period={period} setPeriod={setPeriod} summary={summary} />
        </Motion.div>

        <Motion.section variants={item} className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
          <ExecutiveKpi
            label="Mission Success"
            value={`${summary.successRate}%`}
            valueNode={<AnimatedNumber value={summary.successRate} suffix="%" />}
            detail="Closed work that made it across the line without stalling the operator."
            tone="teal"
            icon={Target}
          />
          <ExecutiveKpi
            label="Approval Friction"
            value={summary.approvalPressure}
            valueNode={<AnimatedNumber value={summary.approvalPressure} />}
            detail="Human checkpoints still waiting for a decision before the system can accelerate."
            tone="amber"
            icon={Clock3}
          />
          <ExecutiveKpi
            label="Daily Burn"
            value={formatCurrency(summary.totalCost)}
            valueNode={<AnimatedNumber value={summary.totalCost} prefix="$" decimals={2} />}
            detail="Tracked spend concentration today across active mission traffic and orchestration."
            tone="blue"
            icon={DollarSign}
          />
        </Motion.section>

        <Motion.section variants={item}>
          <HudFrame
            eyebrow="Command Constraint"
            title={primaryBottleneck?.title || 'No dominant bottleneck is visible'}
            detail={primaryBottleneck?.detail || 'The board is distributed enough that no single drag source is dominating yet.'}
            accent="violet"
          >
            <div className="grid gap-3 md:grid-cols-[1.2fr_0.8fr_0.8fr]">
              <div className="rounded-[20px] border border-white/8 bg-[#111827] p-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">What to do now</div>
                <div className="mt-2 text-sm font-semibold text-text-primary">{primaryBottleneck?.action || 'Keep watching the board and let clean lanes scale.'}</div>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-[#111827] p-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Autonomy ratio</div>
                <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={autonomyMetrics.autonomyRatio} suffix="%" /></div>
                <div className="mt-1 text-[11px] text-text-muted">{autonomyMetrics.label}</div>
              </div>
              <div className="rounded-[20px] border border-white/8 bg-[#111827] p-4">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Rescue rate</div>
                <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={autonomyMetrics.rescueRate} suffix="%" /></div>
                <div className="mt-1 text-[11px] text-text-muted">{autonomyMetrics.rescueTouchedMissions} rescue-touched missions</div>
              </div>
            </div>
          </HudFrame>
        </Motion.section>

        <Motion.section variants={item}>
          <HudFrame
            eyebrow="Managed Automations"
            title="Recurring flows under command"
            detail="These are live recurring products now: tune cadence, posture, and approval instead of relaunching from scratch."
            accent="violet"
          >
            <div className="space-y-3">
              {managedRecurringFlows.length === 0 && (
                <div className="text-[12px] text-text-muted">No managed recurring flows yet. Launch one from the automation rack and it will appear here for ongoing tuning.</div>
              )}
              {managedRecurringFlows.map((flow) => (
                <div key={flow.id} className="rounded-[18px] border border-white/8 bg-[#111827] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-semibold text-text-primary">{flow.title}</div>
                      <div className="mt-1 text-[11px] text-text-muted">{flow.domain} / {flow.intentType}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <TelemetryTag label="Cadence" value={`${flow.frequency} ${flow.time}`} tone="blue" />
                      <TelemetryTag label="Mode" value={flow.missionMode.replaceAll('_', ' ')} tone="teal" />
                      <TelemetryTag label="Approval" value={flow.approvalPosture.replaceAll('_', ' ')} tone={flow.approvalPosture === 'human_required' ? 'amber' : 'violet'} />
                      {flow.paused && <TelemetryTag label="State" value="Paused" tone="amber" />}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <div className="rounded-[14px] border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-text-body">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Latest outcome</div>
                      <div className="mt-1 font-semibold text-text-primary">{flow.latestOutcome ? `${flow.latestOutcome.outcomeStatus} · ${flow.latestOutcome.score}` : 'No outcome yet'}</div>
                    </div>
                    <div className="rounded-[14px] border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-text-body">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Latest intervention</div>
                      <div className="mt-1 font-semibold text-text-primary">{flow.latestIntervention ? flow.latestIntervention.eventType : 'No intervention yet'}</div>
                    </div>
                    <div className="rounded-[14px] border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-text-body">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Latest guardrail</div>
                      <div className="mt-1 font-semibold text-text-primary">{flow.latestGuardrail ? 'Triggered' : 'Quiet'}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap justify-between gap-3 text-[11px] text-text-muted">
                    <div>{flow.nextRunAt ? `Next run ${new Date(flow.nextRunAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : 'No next run scheduled yet'}</div>
                    <button
                      type="button"
                      onClick={() => openManagedFlowDraft(flow)}
                      className="rounded-xl border border-aurora-violet/20 bg-aurora-violet/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-violet transition-colors hover:bg-aurora-violet/14"
                    >
                      Tune recurring flow
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </HudFrame>
        </Motion.section>

        <Motion.section variants={item}>
          <HudFrame
            eyebrow="Automate Next"
            title="What Commander should automate next"
            detail="This recommendation rack is tied to repetition and ROI, so the next automation targets are measurable."
            accent="blue"
          >
            <div className="space-y-3">
              {automationCandidates.length === 0 && <div className="text-[12px] text-text-muted">Commander needs at least a little repeated work history before it can recommend the next automation target.</div>}
              {automationCandidates.map((entry) => (
                <div key={entry.key} className="rounded-[18px] border border-white/8 bg-[#111827] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[12px] font-semibold text-text-primary">{entry.title}</div>
                    <div className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-blue">
                      {entry.automationScore}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-text-muted">{entry.domain} / {entry.intentType}</div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] text-text-muted">
                    <div>{entry.runs} runs</div>
                    <div>{entry.estimatedHours.toFixed(1)}h</div>
                    <div>{entry.roi.toFixed(1)}x ROI</div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => openAutomationDraft(entry)}
                      className="rounded-xl border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-blue transition-colors hover:bg-aurora-blue/14"
                    >
                      Configure recurring flow
                    </button>
                  </div>
                </div>
              ))}
              {automationDraft && (
                <div className="rounded-[18px] border border-aurora-blue/20 bg-[linear-gradient(180deg,rgba(96,165,250,0.08),rgba(255,255,255,0.02))] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-blue">Recurring Flow Editor</div>
                      <div className="mt-1 text-[13px] font-semibold text-text-primary">{automationDraft.candidate.title}</div>
                      <div className="mt-1 text-[11px] text-text-muted">{automationDraft.candidate.domain} / {automationDraft.candidate.intentType}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutomationDraft(null)}
                      className="rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted"
                    >
                      Close
                    </button>
                  </div>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Cadence</div>
                      <select
                        value={automationDraft.frequency}
                        onChange={(event) => setAutomationDraft((current) => ({ ...current, frequency: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] text-text-primary outline-none"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </label>
                    <label>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Time</div>
                      <input
                        type="time"
                        value={automationDraft.time}
                        onChange={(event) => setAutomationDraft((current) => ({ ...current, time: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] text-text-primary outline-none"
                      />
                    </label>
                    <label>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Mission mode</div>
                      <select
                        value={automationDraft.missionMode}
                        onChange={(event) => setAutomationDraft((current) => ({ ...current, missionMode: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] text-text-primary outline-none"
                      >
                        <option value="do_now">Do now</option>
                        <option value="plan_first">Plan first</option>
                        <option value="watch_and_approve">Watch and approve</option>
                      </select>
                    </label>
                    <label>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Approval posture</div>
                      <select
                        value={automationDraft.approvalPosture}
                        onChange={(event) => setAutomationDraft((current) => ({ ...current, approvalPosture: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] text-text-primary outline-none"
                      >
                        <option value="risk_weighted">Risk weighted</option>
                        <option value="auto_low_risk">Auto low risk</option>
                        <option value="human_required">Human required</option>
                      </select>
                    </label>
                    <label>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Output</div>
                      <select
                        value={automationDraft.outputType}
                        onChange={(event) => setAutomationDraft((current) => ({ ...current, outputType: event.target.value }))}
                        className="mt-2 w-full rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-[12px] text-text-primary outline-none"
                      >
                        <option value="summary">Summary</option>
                        <option value="action_plan">Action plan</option>
                        <option value="report">Report</option>
                        <option value="email_drafts">Email drafts</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 px-3 py-2">
                      <input
                        type="checkbox"
                        checked={automationDraft.paused ?? false}
                        onChange={(event) => setAutomationDraft((current) => ({ ...current, paused: event.target.checked }))}
                        className="h-4 w-4 rounded border-white/20 bg-transparent"
                      />
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Paused</div>
                        <div className="mt-1 text-[11px] text-text-body">Keep the recurring flow configured but not runnable.</div>
                      </div>
                    </label>
                  </div>
                  <div className="mt-4 rounded-[16px] border border-white/8 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Automation guardrails</div>
                    <div className="mt-2 space-y-2">
                      {getAutomationGuardrails(automationDraft.candidate, automationDraft).map((guardrail) => (
                        <div key={guardrail} className="rounded-[12px] border border-aurora-amber/20 bg-aurora-amber/10 px-3 py-2 text-[11px] text-text-body">
                          {guardrail}
                        </div>
                      ))}
                      {getAutomationGuardrails(automationDraft.candidate, automationDraft).length === 0 && (
                        <div className="rounded-[12px] border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-2 text-[11px] text-text-body">
                          This flow has enough repetition and ROI signal to automate with the selected mission posture.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 rounded-[16px] border border-white/8 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Guardrail and intervention history</div>
                    <div className="mt-2 space-y-2">
                      {automationTuningHistory.summary && (
                        <div className="rounded-[12px] border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-2 text-[11px] text-text-body">
                          {automationTuningHistory.summary.interventionCount > 0
                            ? `${automationTuningHistory.summary.interventionCount} historical intervention signals match this flow.`
                            : 'No recurring intervention pressure has been recorded for this flow yet.'}
                        </div>
                      )}
                      {(automationTuningHistory.summary?.reasons || []).map((reason) => (
                        <div key={reason} className="rounded-[12px] border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] text-text-body">
                          {reason}
                        </div>
                      ))}
                      {automationTuningHistory.entries.map((entry) => (
                        <div key={entry.id} className="rounded-[12px] border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] text-text-body">
                          <div className="font-semibold text-text-primary">{entry.eventType}</div>
                          <div className="mt-1 text-text-muted">{entry.message}</div>
                        </div>
                      ))}
                      {automationTuningHistory.entries.length === 0 && !(automationTuningHistory.summary?.reasons || []).length && (
                        <div className="rounded-[12px] border border-dashed border-white/10 bg-black/10 px-3 py-2 text-[11px] text-text-muted">
                          Commander will start writing recurring-flow history here once this automation sees guardrails, approvals, or human interventions over time.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      type="button"
                      onClick={handleLaunchRecurring}
                      disabled={automationLaunching}
                      className="rounded-xl border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-blue transition-colors hover:bg-aurora-blue/14 disabled:opacity-50"
                    >
                      {automationLaunching ? (automationDraft.mode === 'manage' ? 'Saving...' : 'Launching...') : (automationDraft.mode === 'manage' ? 'Save recurring flow' : 'Launch recurring flow')}
                    </button>
                  </div>
                </div>
              )}
              {automationMessage && (
                <div className="rounded-[14px] border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-text-body">
                  {automationMessage}
                </div>
              )}
              {automationGuardrailEvents.length > 0 && (
                <div className="rounded-[16px] border border-aurora-amber/20 bg-aurora-amber/10 p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-amber">Recent automation guardrails</div>
                  <div className="mt-2 space-y-2">
                    {automationGuardrailEvents.map((entry) => (
                      <div key={entry.id} className="rounded-[12px] border border-white/8 bg-black/20 px-3 py-2 text-[11px] text-text-body">
                        {entry.cleanMessage}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </HudFrame>

        </Motion.section>

        <Motion.section variants={item}>
          <div className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-4">
            <CommandSectionHeader
              eyebrow="Pressure Map"
              title="Main board trend"
              description="One chart at a time so you can read the board without decoding it."
              icon={Gauge}
              tone="teal"
              action={<span className="rounded-full border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-aurora-teal">Primary chart</span>}
            />

            <div className="mt-5">
              <HudFrame
                eyebrow="Pressure View"
                title="One chart, three ways to read the board"
                detail="Flip the lens instead of scanning multiple different panels."
                accent="teal"
              >
                <div className="mb-4 flex flex-wrap gap-2">
                  {[
                    { id: 'activity', label: 'Mission activity' },
                    { id: 'cost', label: 'Spend by lane' },
                    { id: 'state', label: 'Status mix' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPressureFocus(tab.id)}
                      className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                        pressureFocus === tab.id
                          ? 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal'
                          : 'border-white/8 bg-white/[0.03] text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {pressureFocus === 'activity' && (
                  <>
                    <PressureModeIntro
                      title="Mission activity over time"
                      description="Each bar is one recent time slice. Taller bar = more mission activity. Left is older, right is newest."
                    />
                    <div className="mb-3 flex flex-wrap gap-2">
                      <TelemetryTag label="Wave peak" value={Math.max(...activityWave.map((bucket) => bucket.volume), 0)} />
                      <TelemetryTag label="Burst count" value={activityWave.reduce((sum, bucket) => sum + bucket.volume, 0)} tone="blue" />
                    </div>
                    {activityWave.some((bucket) => bucket.volume > 0) ? (
                      <div className="relative h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={activityWave} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
                            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 6" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                            <Tooltip
                              contentStyle={{ background: '#101114', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}
                              itemStyle={{ color: '#e5e7eb' }}
                              formatter={(value) => [value, 'Mission activity']}
                            />
                            <Bar dataKey="volume" radius={[8, 8, 0, 0]} barSize={44} animationDuration={700}>
                              {activityWave.map((entry, index) => (
                                <Cell key={`${entry.name}-${index}`} fill={index === activityWave.length - 1 ? '#60a5fa' : '#2dd4bf'} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex h-72 items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-black/10 text-center">
                        <div>
                          <div className="text-sm font-semibold text-text-primary">No recent mission activity yet.</div>
                          <p className="mt-2 max-w-[320px] text-[12px] leading-relaxed text-text-muted">Once missions start moving, this chart will show how work volume rises and falls over time.</p>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 rounded-2xl border border-aurora-teal/15 bg-aurora-teal/[0.05] px-3 py-2 text-[11px] text-text-body">
                      Readback: the highest recent activity was <span className="font-semibold text-aurora-teal">{peakActivity.name}</span> with <span className="font-semibold text-aurora-teal">{peakActivity.volume}</span> logged events.
                    </div>
                  </>
                )}

                {pressureFocus === 'cost' && (
                  <>
                    <PressureModeIntro
                      title="Spend by branch"
                      description="This bar chart ranks where money is being spent. Longer bar = more spend in that model or execution lane."
                    />
                    <div className="mb-3 flex flex-wrap gap-2">
                      <TelemetryTag label="Top lane" value={topCostCenter?.name || 'None'} tone="amber" />
                      <TelemetryTag label="Tracked lanes" value={burnByModel.length} tone="blue" />
                    </div>
                    {burnByModel.length > 0 ? (
                      <div className="relative h-72">
                        <ChartHudOverlay accent="#fbbf24" />
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={burnByModel} layout="vertical" margin={{ top: 10, right: 10, left: 8, bottom: 0 }}>
                            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 6" horizontal={false} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#8f96a3', fontSize: 11 }} />
                            <YAxis
                              type="category"
                              dataKey="name"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#a1a1aa', fontSize: 11 }}
                              width={96}
                            />
                            <Tooltip
                              cursor={false}
                              contentStyle={{ background: '#101114', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}
                              formatter={(value) => [formatCurrency(value), 'Burn']}
                            />
                            <Bar dataKey="cost" radius={[0, 8, 8, 0]} barSize={16} animationDuration={900}>
                              {burnByModel.map((entry) => (
                                <Cell key={entry.name} fill={entry.fill} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex h-72 items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-black/10 text-center">
                        <div>
                          <div className="text-sm font-semibold text-text-primary">No tracked spend yet.</div>
                          <p className="mt-2 max-w-[320px] text-[12px] leading-relaxed text-text-muted">Once costs are recorded, this view will rank the most expensive execution lanes from highest spend to lowest.</p>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 rounded-2xl border border-aurora-amber/15 bg-aurora-amber/[0.05] px-3 py-2 text-[11px] text-text-body">
                      Threshold marker: {topCostCenter ? <><span className="font-semibold text-aurora-amber">{topCostCenter.name}</span> is the hottest spend lane at <span className="font-semibold text-aurora-amber">{formatCurrency(topCostCenter.cost)}</span>.</> : 'No spend concentration detected yet.'}
                    </div>
                  </>
                )}

                {pressureFocus === 'state' && (
                  <>
                    <PressureModeIntro
                      title="Mission status mix"
                      description="This chart shows how many missions are sitting in each state. Longer bar = more missions in that status."
                    />
                    <div className="mb-3 flex flex-wrap gap-2">
                      <TelemetryTag label="State leader" value={statusPressure[0]?.status || 'None'} tone="violet" />
                      <TelemetryTag label="Tracked states" value={statusPressure.length} tone="blue" />
                    </div>
                    {statusPressure.length > 0 ? (
                      <div className="relative h-72">
                        <ChartHudOverlay accent="#a78bfa" />
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={statusPressure.slice(0, 5)} layout="vertical" margin={{ top: 10, right: 10, left: 8, bottom: 0 }}>
                            <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 6" horizontal={false} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#8f96a3', fontSize: 11 }} />
                            <YAxis
                              type="category"
                              dataKey="status"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: '#a1a1aa', fontSize: 11 }}
                              width={100}
                            />
                            <Tooltip
                              cursor={false}
                              contentStyle={{ background: '#101114', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}
                              formatter={(value) => [value, 'Count']}
                            />
                            <Bar dataKey="count" radius={[0, 8, 8, 0]} barSize={16} animationDuration={900}>
                              {statusPressure.slice(0, 5).map((entry) => (
                                <Cell key={entry.status} fill={entry.color} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="flex h-72 items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-black/10 text-center">
                        <div>
                          <div className="text-sm font-semibold text-text-primary">No mission states to compare yet.</div>
                          <p className="mt-2 max-w-[320px] text-[12px] leading-relaxed text-text-muted">Once tasks exist, this view will show which status buckets are owning the board, like running, blocked, or done.</p>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 rounded-2xl border border-aurora-violet/15 bg-aurora-violet/[0.05] px-3 py-2 text-[11px] text-text-body">
                      State readback: {statusPressure[0] ? <><span className="font-semibold text-aurora-violet">{statusPressure[0].status}</span> is owning the board with <span className="font-semibold text-aurora-violet">{statusPressure[0].count}</span> missions.</> : 'No dominant state yet.'}
                    </div>
                  </>
                )}
              </HudFrame>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Peak burst</div>
                  <div className="mt-2 text-sm font-semibold text-text-primary">{peakActivity.name} with {peakActivity.volume} events</div>
                  <p className="mt-2 text-[12px] leading-relaxed text-text-muted">The highest recent pressure spike on the board.</p>
                </div>
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Top cost lane</div>
                  <div className="mt-2 text-sm font-semibold text-text-primary">{topCostCenter ? `${topCostCenter.name} at ${formatCurrency(topCostCenter.cost)}` : 'No spend leader yet'}</div>
                  <p className="mt-2 text-[12px] leading-relaxed text-text-muted">The branch drawing the most budget right now.</p>
                </div>
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">State owner</div>
                  <div className="mt-2 text-sm font-semibold text-text-primary">{statusPressure[0] ? `${statusPressure[0].status} with ${statusPressure[0].count}` : 'No dominant state yet'}</div>
                  <p className="mt-2 text-[12px] leading-relaxed text-text-muted">The operational state owning the board at a glance.</p>
                </div>
              </div>
            </div>
          </div>
        </Motion.section>

        <Motion.section variants={item}>
          <TopOperatorTable agents={summary.topAgents} />
        </Motion.section>

        <Motion.section variants={item}>
          <CollapsedPanel
            eyebrow="Details"
            title="Audit, doctrine, and deeper analysis"
            summary="Open only when you want validation, economics, quality scoring, and doctrine moves."
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <HudFrame
                  eyebrow="Outcome Quality"
                  title="Was the work actually good?"
                  detail="Completion is not enough. This board scores trust, context discipline, autonomy, and cost posture."
                  accent="violet"
                >
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-[20px] border border-white/8 bg-[#111827] p-4">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Average quality</div>
                      <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={qualitySummary.average} /></div>
                    </div>
                    <div className="rounded-[20px] border border-white/8 bg-[#111827] p-4">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Autonomous wins</div>
                      <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={roiSummary.autonomousRuns} /></div>
                    </div>
                    <div className="rounded-[20px] border border-white/8 bg-[#111827] p-4">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Scored missions</div>
                      <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={tasks.length} /></div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {qualitySummary.top.length === 0 && <div className="text-[12px] text-text-muted">No mission outcomes are scored yet.</div>}
                    {qualitySummary.top.map(({ task, outcome }) => (
                      <div key={task.id} className="rounded-[18px] border border-white/8 bg-black/20 px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[12px] font-semibold text-text-primary">{task.name || task.title || 'Mission'}</div>
                          <div className="rounded-full border border-aurora-violet/20 bg-aurora-violet/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-violet">
                            {outcome.score} {outcome.label}
                          </div>
                        </div>
                        <div className="mt-1 text-[11px] text-text-muted">{task.domain} / {task.intentType} / {task.workflowStatus || task.status}</div>
                      </div>
                    ))}
                  </div>
                </HudFrame>

                <HudFrame
                  eyebrow="Automation ROI"
                  title="Where Commander is creating leverage"
                  detail="This ties mission throughput to time saved and spend."
                  accent="teal"
                >
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="rounded-[20px] border border-white/8 bg-[#111827] p-4">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Human equivalent</div>
                      <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={roiSummary.humanEquivalent} prefix="$" decimals={2} /></div>
                    </div>
                    <div className="rounded-[20px] border border-white/8 bg-[#111827] p-4">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Agent spend</div>
                      <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={roiSummary.totalAgentSpend} prefix="$" decimals={2} /></div>
                    </div>
                    <div className="rounded-[20px] border border-white/8 bg-[#111827] p-4">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Savings</div>
                      <div className={`mt-2 text-2xl font-semibold ${roiSummary.savings >= 0 ? 'text-aurora-teal' : 'text-aurora-rose'}`}>
                        <AnimatedNumber value={Math.abs(roiSummary.savings)} prefix={roiSummary.savings >= 0 ? '$' : '-$'} decimals={2} />
                      </div>
                    </div>
                    <div className="rounded-[20px] border border-white/8 bg-[#111827] p-4">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">ROI multiple</div>
                      <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={roiSummary.roiMultiple} decimals={1} suffix="x" /></div>
                    </div>
                  </div>
                </HudFrame>
              </div>

              <HudFrame
                eyebrow="Model Benchmark Board"
                title="Observed winners by real mission outcomes"
                detail="Ranks lanes by quality, success, speed, and cost."
                accent="amber"
              >
                <div className="mb-3 rounded-[18px] border border-aurora-amber/20 bg-aurora-amber/10 px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-amber">Provider escalation explanation</div>
                  <div className="mt-1 text-[13px] font-semibold text-text-primary">{providerEscalation.title}</div>
                  <div className="mt-1 text-[11px] leading-5 text-text-body">{providerEscalation.detail}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-5">
                  {benchmarkBoard.length === 0 && <div className="text-[12px] text-text-muted">No benchmark data yet. Commander needs more routed mission history.</div>}
                  {benchmarkBoard.map((entry) => (
                    <div key={entry.key} className="rounded-[18px] border border-white/8 bg-[#111827] p-3">
                      <div className="text-[12px] font-semibold text-text-primary">{entry.model}</div>
                      <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-text-muted">{entry.provider}</div>
                      <div className="mt-3 text-xl font-semibold text-text-primary">{entry.benchmarkScore}</div>
                      <div className="mt-2 space-y-1 text-[10px] text-text-muted">
                        <div>quality {entry.avgQuality}</div>
                        <div>success {entry.successRate}%</div>
                        <div>avg cost ${entry.avgCost.toFixed(2)}</div>
                        <div>interventions {entry.avgInterventions}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </HudFrame>

              <HudFrame
                eyebrow="Persisted Recommendations"
                title="What the system is explicitly telling you to change"
                detail="These are durable recommendation rows, not just local UI heuristics."
                accent="blue"
              >
                <div className="grid gap-3 md:grid-cols-2">
                  {rankedRecommendations.length === 0 && <div className="text-[12px] text-text-muted">No persisted recommendations yet. Commander will fill this rail as doctrine and outcome memory harden.</div>}
                  {rankedRecommendations.map((entry) => (
                    <div key={entry.id} className="rounded-[18px] border border-white/8 bg-[#111827] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-[12px] font-semibold text-text-primary">{entry.title}</div>
                        <div className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-blue">
                          {entry.type}
                        </div>
                      </div>
                      <div className="mt-2 text-[11px] leading-5 text-text-body">{entry.description}</div>
                      {entry.whyNow && <div className="mt-2 text-[10px] leading-5 text-aurora-blue">Why now: {entry.whyNow}</div>}
                      {entry.savings && <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-aurora-teal">{entry.savings}</div>}
                    </div>
                  ))}
                </div>
              </HudFrame>

              <HudFrame
                eyebrow="Persisted Feedback"
                title="Outcome memory and doctrine pressure"
                detail="These entries are persisted in the runtime log so the system can learn from real outcomes."
                accent="violet"
              >
                <div className="grid gap-3">
                  <div className="rounded-[18px] border border-white/8 bg-[#111827] p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Latest outcome scores</div>
                    <div className="mt-3 space-y-2">
                      {persistedOutcomeScores.length === 0 && <div className="text-[11px] text-text-muted">No persisted outcome-score logs yet.</div>}
                      {persistedOutcomeScores.map((entry) => (
                        <div key={entry.id} className="rounded-[14px] border border-white/8 bg-black/20 px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[10px] font-mono uppercase text-aurora-teal">{entry.trust} trust</div>
                            <div className="text-[10px] font-mono text-text-disabled">{entry.score ?? '—'}</div>
                          </div>
                          <div className="mt-1 text-[11px] text-text-body">{entry.cleanMessage}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-[18px] border border-white/8 bg-[#111827] p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Latest doctrine feedback</div>
                    <div className="mt-3 space-y-2">
                      {persistedDoctrineFeedback.length === 0 && <div className="text-[11px] text-text-muted">No persisted doctrine feedback yet.</div>}
                      {persistedDoctrineFeedback.map((entry) => (
                        <div key={entry.id} className="rounded-[14px] border border-white/8 bg-black/20 px-3 py-2.5 text-[11px] text-text-body">
                          {entry.cleanMessage}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </HudFrame>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.6fr_1.4fr]">
                <div className="space-y-3">
                  <div className="rounded-[24px] border border-white/8 bg-[#111827]/90 p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Read first</div>
                    <div className="mt-2 text-[15px] font-semibold text-text-primary">{readFirstItems[0]?.title}</div>
                    <p className="mt-2 text-[11px] leading-5 text-text-muted">{readFirstItems[0]?.detail}</p>
                  </div>
                  <div className="rounded-[24px] border border-white/8 bg-[#111827]/90 p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Next action</div>
                    <div className="mt-2 text-[15px] font-semibold text-text-primary">{readFirstItems[1]?.title}</div>
                    <p className="mt-2 text-[11px] leading-5 text-text-muted">{readFirstItems[1]?.detail}</p>
                  </div>
                </div>
                <ExecutiveSignalRail learningMemory={learningMemory} summary={summary} burnByModel={burnByModel} />
              </div>

              <TruthAuditStrip truth={truth} />
            </div>
          </CollapsedPanel>
        </Motion.section>
      </Motion.div>
    </div>
  );
}
