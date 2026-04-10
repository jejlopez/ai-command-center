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
import { useActivityLog, useCostData, usePendingReviews, useTasks } from '../utils/useSupabase';
import { CommandDeckHero } from '../components/command/CommandDeckHero';
import { AnimatedNumber } from '../components/command/AnimatedNumber';
import { CommandSectionHeader } from '../components/command/CommandSectionHeader';
import { useLearningMemory } from '../utils/useLearningMemory';
import { DoctrineCards } from '../components/command/DoctrineCards';
import { TruthAuditStrip } from '../components/command/TruthAuditStrip';
import { useCommandCenterTruth } from '../utils/useCommandCenterTruth';

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
      className={`ui-panel relative overflow-hidden p-4 ${className}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accents[accent] || accents.teal}`} />
      <div className="pointer-events-none absolute right-4 top-4 h-12 w-12 rounded-full bg-panel-soft blur-2xl" />
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
    <div className={`ui-chip rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${styles[tone] || styles.teal}`}>
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
          className="ui-panel p-4"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{entry.eyebrow}</div>
          <div className="mt-2 text-base font-semibold text-text-primary">{entry.title}</div>
          <p className="mt-2 text-[12px] leading-relaxed text-text-body">{entry.detail}</p>
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
    <div className="ui-panel p-4">
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
    <div className="ui-panel-soft p-4">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-aurora-violet" />
        <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Doctrine timeline</span>
      </div>
      <div className="mt-4 space-y-3">
        {timeline.map((item) => (
          <div key={item.id} className="ui-card-row px-3 py-3">
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
      <div className="ui-panel p-2">
        <div className="ui-segmented flex flex-wrap gap-2 rounded-[24px] p-2">
          {[
            { id: 'doctrine', label: 'Doctrine' },
            { id: 'orders', label: 'Orders' },
            { id: 'timeline', label: 'Timeline' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFocus(tab.id)}
              className={`flex-1 rounded-[18px] px-4 py-3 text-[12px] font-semibold transition-all ${
                focus === tab.id ? 'ui-card border border-hairline shadow-sm text-text-primary' : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {focus === 'doctrine' && (
        <div className="ui-panel border-aurora-violet/15 bg-[linear-gradient(180deg,rgba(167,139,250,0.06),rgba(255,255,255,0.02))] p-5">
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
        <div className="ui-panel border-aurora-teal/15 bg-[linear-gradient(180deg,rgba(45,212,191,0.05),rgba(255,255,255,0.02))] p-5">
          <CommandSectionHeader
            eyebrow="Executive Orders"
            title="What Tony and Elon would do next"
            description="Three moves with the most leverage right now."
            icon={TrendingUp}
            tone="teal"
          />
          <div className="mt-5 space-y-3">
            {orders.map((entry) => (
              <div key={entry.title} className="ui-card-row p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{entry.title}</div>
                    <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{entry.detail}</p>
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
    <div className="mb-4 ui-card-row px-4 py-3">
      <div className="text-sm font-semibold text-text-primary">{title}</div>
      <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{description}</p>
    </div>
  );
}

export function ReportsView() {
  const [period, setPeriod] = useState('30d');
  const [pressureFocus, setPressureFocus] = useState('activity');
  const { data: costData } = useCostData();
  const { tasks } = useTasks();
  const { reviews } = usePendingReviews();
  const { logs } = useActivityLog();
  const truth = useCommandCenterTruth();

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
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 left-[-8%] h-[360px] w-[360px] rounded-full bg-aurora-violet/10 blur-[120px]" />
        <div className="absolute top-[12%] right-[-12%] h-[420px] w-[420px] rounded-full bg-aurora-teal/10 blur-[140px]" />
        <div className="absolute bottom-[-20%] left-[22%] h-[420px] w-[420px] rounded-full bg-aurora-blue/10 blur-[160px]" />
      </div>

      <Motion.div variants={container} initial="hidden" animate="show" className="relative space-y-5">
        <Motion.div variants={item}>
          <CommandDeckHero
            glow="violet"
            eyebrow="Executive Debrief"
            eyebrowIcon={BrainCircuit}
            title="Executive Debrief"
            description="Margin, execution drag, and compounding momentum in one readable board."
            chrome="epic"
            titleClassName="text-[clamp(2.25rem,4.2vw,3.5rem)] leading-[1] tracking-[-0.04em]"
            descriptionClassName="max-w-2xl text-[15px] leading-7 text-text-body"
            badges={[
              { label: 'mission success', value: `${summary.successRate}%`, tone: 'teal' },
              { label: 'live missions', value: summary.running, tone: 'blue' },
              { label: 'approvals in queue', value: summary.approvalPressure, tone: 'amber' },
            ]}
            actions={
              <button className="ui-button-primary inline-flex items-center gap-2 rounded-xl bg-aurora-violet px-4 py-2 text-sm font-semibold text-black shadow-glow-violet transition-colors hover:bg-aurora-violet/90">
                <FileText className="h-4 w-4" />
                Generate Brief
              </button>
            }
            sideContent={
              <div className="ui-panel flex w-full flex-col gap-3 p-4 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Board controls</span>
                  <span className="text-[10px] font-mono text-aurora-violet">LIVE</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {PERIOD_OPTIONS.map((option) => (
                    <button
                      key={option}
                      onClick={() => setPeriod(option)}
                      className={`ui-chip rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition-colors ${
                        period === option
                          ? 'border-aurora-teal/30 bg-aurora-teal/10 text-aurora-teal shadow-sm'
                          : 'border-hairline bg-panel-soft text-text-muted hover:text-text-primary'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="ui-stat p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Burn today</div>
                    <div className="mt-2 text-2xl font-semibold text-text-primary">{formatCurrency(summary.totalCost)}</div>
                  </div>
                  <div className="ui-stat p-3">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Cost / mission</div>
                    <div className="mt-2 text-2xl font-semibold text-text-primary">{formatCurrency(summary.avgCost)}</div>
                  </div>
                </div>
              </div>
            }
          />
        </Motion.div>

        <Motion.section variants={item} className="grid grid-cols-1 gap-4 xl:grid-cols-3">
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

        <ExecutiveReadFirst items={readFirstItems.slice(0, 2)} />
        <TruthAuditStrip truth={truth} />

        <Motion.section variants={item} className="space-y-5">
          <div className="ui-panel p-5">
            <CommandSectionHeader
              eyebrow="Pressure Map"
              title="Where the board is heating up"
              description="A reactor-style readout of pace, burn, and operational pressure."
              icon={Gauge}
              tone="teal"
              action={<span className="ui-chip border-aurora-teal/20 bg-aurora-teal/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-aurora-teal">Live telemetry</span>}
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
                      className={`ui-chip rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                        pressureFocus === tab.id
                          ? 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal shadow-sm'
                          : 'border-hairline bg-panel-soft text-text-muted hover:text-text-primary'
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
                            <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 6" vertical={false} />
                            <XAxis dataKey="name" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
                            <Tooltip
                              contentStyle={{ background: 'var(--color-canvas-elevated)', border: '1px solid var(--color-hairline)', borderRadius: 14 }}
                              itemStyle={{ color: 'var(--color-text)' }}
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
                      <div className="flex h-72 items-center justify-center ui-well border-dashed text-center">
                        <div>
                          <div className="text-sm font-semibold text-text-primary">No recent mission activity yet.</div>
                          <p className="mt-2 max-w-[320px] text-[12px] leading-relaxed text-text-muted">Once missions start moving, this chart will show how work volume rises and falls over time.</p>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 ui-card-row border-aurora-teal/15 bg-aurora-teal/[0.05] px-3 py-2 text-[11px] text-text-body">
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
                            <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 6" horizontal={false} />
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
                              contentStyle={{ background: 'var(--color-canvas-elevated)', border: '1px solid var(--color-hairline)', borderRadius: 14 }}
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
                      <div className="flex h-72 items-center justify-center ui-well border-dashed text-center">
                        <div>
                          <div className="text-sm font-semibold text-text-primary">No tracked spend yet.</div>
                          <p className="mt-2 max-w-[320px] text-[12px] leading-relaxed text-text-muted">Once costs are recorded, this view will rank the most expensive execution lanes from highest spend to lowest.</p>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 ui-card-row border-aurora-amber/15 bg-aurora-amber/[0.05] px-3 py-2 text-[11px] text-text-body">
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
                            <CartesianGrid stroke="var(--color-hairline)" strokeDasharray="3 6" horizontal={false} />
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
                              contentStyle={{ background: 'var(--color-canvas-elevated)', border: '1px solid var(--color-hairline)', borderRadius: 14 }}
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
                      <div className="flex h-72 items-center justify-center ui-well border-dashed text-center">
                        <div>
                          <div className="text-sm font-semibold text-text-primary">No mission states to compare yet.</div>
                          <p className="mt-2 max-w-[320px] text-[12px] leading-relaxed text-text-muted">Once tasks exist, this view will show which status buckets are owning the board, like running, blocked, or done.</p>
                        </div>
                      </div>
                    )}
                    <div className="mt-3 ui-card-row border-aurora-violet/15 bg-aurora-violet/[0.05] px-3 py-2 text-[11px] text-text-body">
                      State readback: {statusPressure[0] ? <><span className="font-semibold text-aurora-violet">{statusPressure[0].status}</span> is owning the board with <span className="font-semibold text-aurora-violet">{statusPressure[0].count}</span> missions.</> : 'No dominant state yet.'}
                    </div>
                  </>
                )}
              </HudFrame>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="ui-stat p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Peak burst</div>
                  <div className="mt-2 text-sm font-semibold text-text-primary">{peakActivity.name} with {peakActivity.volume} events</div>
                  <p className="mt-2 text-[12px] leading-relaxed text-text-muted">The highest recent pressure spike on the board.</p>
                </div>
                <div className="ui-stat p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Top cost lane</div>
                  <div className="mt-2 text-sm font-semibold text-text-primary">{topCostCenter ? `${topCostCenter.name} at ${formatCurrency(topCostCenter.cost)}` : 'No spend leader yet'}</div>
                  <p className="mt-2 text-[12px] leading-relaxed text-text-muted">The branch drawing the most budget right now.</p>
                </div>
                <div className="ui-stat p-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">State owner</div>
                  <div className="mt-2 text-sm font-semibold text-text-primary">{statusPressure[0] ? `${statusPressure[0].status} with ${statusPressure[0].count}` : 'No dominant state yet'}</div>
                  <p className="mt-2 text-[12px] leading-relaxed text-text-muted">The operational state owning the board at a glance.</p>
                </div>
              </div>
            </div>
          </div>
        </Motion.section>

        <Motion.section variants={item}>
          <ExecutiveSignalRail learningMemory={learningMemory} summary={summary} burnByModel={burnByModel} />
        </Motion.section>

        <Motion.section variants={item}>
          <div className="ui-panel p-5">
            <CommandSectionHeader
              eyebrow="Top Operators"
              title="Who is carrying the work"
              description="The branches absorbing the most load, cost, and closures without turning this page into a spreadsheet."
              icon={Layers3}
              tone="blue"
            />
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {summary.topAgents.length === 0 && (
                <div className="ui-card-row p-4 text-sm text-text-muted">
                  No mission traffic yet. Once tasks land, this panel will rank agents by volume, cost, and closure rate.
                </div>
              )}
              {summary.topAgents.map((agent, index) => (
                <div key={agent.name} className="ui-card-row p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="ui-panel-soft flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold text-text-primary">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-text-primary">{agent.name}</div>
                        <div className="mt-1 text-[11px] text-text-muted">{agent.tasks} missions routed through this branch</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-text-primary">{formatCurrency(agent.cost)}</div>
                      <div className="mt-1 text-[11px] text-aurora-teal">{agent.completed} completed</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Motion.section>
      </Motion.div>
    </div>
  );
}
