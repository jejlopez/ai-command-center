import { useEffect, useMemo, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import {
  BarChart3,
  BrainCircuit,
  ChevronRight,
  CircleDot,
  Cpu,
  Database,
  FileJson,
  Gauge,
  GitBranch,
  History,
  Layers3,
  Lock,
  Radar as RadarIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { container, item } from '../utils/variants';
import { useActivityLog, useAgents, useKnowledgeNamespaces, useModelBank, useRoutingPolicies, useSharedDirectives, useSystemRecommendations, useTasks } from '../utils/useSupabase';
import { CommandDeckHero } from '../components/command/CommandDeckHero';
import { AnimatedNumber } from '../components/command/AnimatedNumber';
import { CommandSectionHeader } from '../components/command/CommandSectionHeader';
import { useCommanderPreferences } from '../utils/useCommanderPreferences';
import { useLearningMemory } from '../utils/useLearningMemory';
import { DoctrineCards } from '../components/command/DoctrineCards';
import { cn } from '../utils/cn';
import { TruthAuditStrip } from '../components/command/TruthAuditStrip';
import { useCommandCenterTruth } from '../utils/useCommandCenterTruth';
import { normalizeModelProvider } from '../utils/commanderPolicy';
import { getWorkflowMeta } from '../utils/missionLifecycle';

const tabs = [
  { id: 'models', label: 'Model Command Matrix', icon: Cpu },
  { id: 'routing', label: 'Routing Doctrine', icon: GitBranch },
  { id: 'knowledge', label: 'Knowledge Terrain', icon: Database },
  { id: 'directives', label: 'Directive Pressure', icon: ShieldCheck },
];

const modelColors = {
  'Claude Opus 4.6': '#2dd4bf',
  'Claude Sonnet 4.6': '#60a5fa',
  'GPT-4o': '#a78bfa',
  'Gemini 3.1': '#fbbf24',
  'Llama 3 70B': '#fb7185',
  'DeepSeek Coder': '#34d399',
};

const directiveIconMap = { ShieldCheck, FileJson, Lock, Zap, TrendingUp };
const capabilityMetrics = [
  { key: 'reliability', label: 'Reliability' },
  { key: 'missionLoad', label: 'Mission load' },
  { key: 'agentCoverage', label: 'Agent coverage' },
  { key: 'speed', label: 'Speed' },
  { key: 'costDiscipline', label: 'Cost discipline' },
];

function deriveAvailableModels(models, agents, tasks) {
  const modelKeys = new Map();

  models.forEach((model) => {
    modelKeys.set(model.label || model.modelKey, {
      model: model.label || model.modelKey,
      provider: normalizeModelProvider(model.provider),
      costPer1k: Number(model.costPer1k || 0),
      contextWindow: model.provider ? `${model.provider} lane` : 'Custom lane',
    });
  });

  agents.forEach((agent) => {
    if (!agent.model) return;
    if (!modelKeys.has(agent.model)) {
      modelKeys.set(agent.model, {
        model: agent.model,
        provider: 'Live agent',
        costPer1k: 0,
        contextWindow: 'Live lane',
      });
    }
  });

  const byModel = Array.from(modelKeys.values()).map((entry) => {
    const modelAgents = agents.filter((agent) => agent.model === entry.model);
    const modelTasks = tasks.filter((task) => {
      const agent = agents.find((candidate) => candidate.id === task.agentId);
      return agent?.model === entry.model;
    });

    const avgSuccess = modelAgents.length
      ? modelAgents.reduce((sum, agent) => sum + Number(agent.successRate || 0), 0) / modelAgents.length
      : modelTasks.length
        ? (modelTasks.filter((task) => ['done', 'completed'].includes(String(task.status || '').toLowerCase())).length / modelTasks.length) * 100
        : 0;
    const avgLatency = modelAgents.length
      ? modelAgents.reduce((sum, agent) => sum + Number(agent.latencyMs || 0), 0) / modelAgents.length
      : 0;
    const costDiscipline = entry.costPer1k > 0
      ? Math.max(18, Math.round(100 - Math.min(80, entry.costPer1k * 10)))
      : 96;

    return {
      ...entry,
      reliability: Math.round(avgSuccess || 0),
      missionLoad: modelTasks.length,
      agentCoverage: modelAgents.length,
      speed: avgLatency > 0 ? Math.max(12, Math.round(100 - Math.min(85, avgLatency / 12))) : 50,
      costDiscipline,
      tokensPerSec: 0,
      monthlyCost: modelTasks.reduce((sum, task) => sum + Number(task.costUsd || 0), 0),
    };
  });

  const maxLoad = Math.max(...byModel.map((model) => model.missionLoad), 1);
  const maxCoverage = Math.max(...byModel.map((model) => model.agentCoverage), 1);

  return byModel.map((model) => ({
    ...model,
    missionLoad: Math.round((model.missionLoad / maxLoad) * 100),
    agentCoverage: Math.round((model.agentCoverage / maxCoverage) * 100),
  }));
}

function HudPanel({ eyebrow, title, description, accent = 'teal', children, className = '' }) {
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
      className={`relative overflow-hidden rounded-[28px] border border-white/8 bg-black/20 p-5 ${className}`}
    >
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r ${accents[accent] || accents.teal}`} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(180deg,rgba(255,255,255,0.16)_0px,rgba(255,255,255,0.16)_1px,transparent_1px,transparent_12px)]" />
      <Motion.div
        initial={{ opacity: 0.12, x: '-30%' }}
        animate={{ opacity: 0.28, x: '135%' }}
        transition={{ duration: 5.6, repeat: Infinity, ease: 'linear' }}
        className="pointer-events-none absolute top-0 h-full w-16 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] blur-lg"
      />
      <div className="mb-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{eyebrow}</div>
        <div className="mt-1 text-lg font-semibold tracking-tight text-text-primary">{title}</div>
        {description && <div className="mt-1 text-[12px] leading-relaxed text-text-muted">{description}</div>}
      </div>
      {children}
    </Motion.div>
  );
}

function ChartReticle({ accent = '#2dd4bf' }) {
  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <circle cx="50" cy="50" r="20" fill="none" stroke={accent} strokeOpacity="0.16" strokeWidth="0.8" />
        <circle cx="50" cy="50" r="32" fill="none" stroke={accent} strokeOpacity="0.1" strokeWidth="0.6" />
        <path d="M50 8v10M50 82v10M8 50h10M82 50h10" stroke={accent} strokeOpacity="0.18" strokeWidth="0.8" />
        <path d="M8 12h12M8 12v12M92 12H80M92 12v12M8 88h12M8 88V76M92 88H80M92 88V76" fill="none" stroke={accent} strokeOpacity="0.22" strokeWidth="0.8" />
      </svg>
    </div>
  );
}

function StrategicReadFirst({ items }) {
  return (
    <Motion.section variants={item} className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {items.map((entry) => (
        <Motion.div
          key={entry.title}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="rounded-[24px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] p-4"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{entry.eyebrow}</div>
          <div className="mt-2 text-base font-semibold text-text-primary">{entry.title}</div>
          <p className="mt-2 text-[12px] leading-relaxed text-text-body">{entry.detail}</p>
        </Motion.div>
      ))}
    </Motion.section>
  );
}

function OptimizationCard({ recommendation }) {
  const toneClass = recommendation.impact === 'critical'
    ? 'border-l-aurora-rose'
    : recommendation.impact === 'high'
      ? 'border-l-aurora-amber'
      : 'border-l-aurora-teal';

  return (
    <div className={`rounded-[22px] border border-white/8 border-l-[3px] ${toneClass} bg-black/20 p-4`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
          <Sparkles className="h-4 w-4 text-aurora-teal" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-text-primary">{recommendation.title}</div>
            {recommendation.savings && (
              <span className="rounded-full border border-aurora-green/20 bg-aurora-green/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-green">
                {recommendation.savings}
              </span>
            )}
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{recommendation.description}</p>
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 text-text-disabled" />
      </div>
    </div>
  );
}

function DoctrineSignalRail({ learningMemory }) {
  const timeline = learningMemory.doctrine
    .slice()
    .sort((a, b) => new Date(b.latestSnapshotAt || 0).getTime() - new Date(a.latestSnapshotAt || 0).getTime())
    .slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-aurora-violet" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Doctrine drift</span>
        </div>
        <div className="mt-4 space-y-3">
          {timeline.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/8 bg-white/[0.02] px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] font-semibold text-text-primary">{item.owner}</div>
                <div className="text-[10px] font-mono text-aurora-teal">{item.confidence}%</div>
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-text-body">{item.changeSummary}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[24px] border border-white/8 bg-black/20 p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Memory state</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">Snapshots</div>
            <div className="mt-2 text-2xl font-semibold text-text-primary">{learningMemory.history.length}</div>
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">Persistence</div>
            <div className="mt-2 text-sm font-semibold text-text-primary">
              {learningMemory.persistenceEnabled ? 'Supabase live' : 'Derived only'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StrategyRail({ derivedRecommendations, learningMemory, humanHourlyRate, economics }) {
  const [focus, setFocus] = useState('economics');

  return (
    <div className="space-y-5">
      <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-2">
        <div className="flex flex-wrap gap-2 rounded-[24px] bg-black/20 p-2">
          {[
            { id: 'economics', label: 'Economics' },
            { id: 'doctrine', label: 'Doctrine' },
            { id: 'orders', label: 'Orders' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFocus(tab.id)}
              className={cn(
                'flex-1 rounded-[18px] px-4 py-3 text-[12px] font-semibold transition-all',
                focus === tab.id ? 'border border-white/10 bg-white/[0.05] text-text-primary' : 'text-text-muted hover:text-text-primary'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {focus === 'economics' && (
        <HudPanel
          eyebrow="Economics"
          title="Human vs agent"
          description={`Warren would want the savings line. Elon would want the efficiency multiple. Baseline is $${humanHourlyRate}/hour.`}
          accent="amber"
        >
          <CommandSectionHeader
            eyebrow="Command Economics"
            title="What the stack is actually buying"
            description="Keep the economics ruthless and visible."
            icon={TrendingUp}
            tone="amber"
          />
          <div className="mt-5 grid gap-3">
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Human equivalent</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary">
                <AnimatedNumber value={economics.humanCost} prefix="$" decimals={2} />
              </div>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Agent spend</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary">
                <AnimatedNumber value={economics.agentCost} prefix="$" decimals={2} />
              </div>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Savings</div>
                  <div className={`mt-2 text-lg font-semibold leading-none ${economics.savings >= 0 ? 'text-aurora-teal' : 'text-aurora-rose'}`}>
                    <AnimatedNumber value={Math.abs(economics.savings)} prefix={economics.savings >= 0 ? '$' : '-$'} decimals={2} />
                  </div>
                </div>
                <div className="min-w-0 border-l border-white/8 pl-4">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Efficiency</div>
                  <div className="mt-2 text-lg font-semibold leading-none text-text-primary">
                    <AnimatedNumber value={economics.multiplier} decimals={1} suffix="x" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </HudPanel>
      )}

      {focus === 'doctrine' && (
        <>
          <HudPanel
            eyebrow="Shared Doctrine"
            title="What the system is starting to believe"
            description="Tony wants signal clarity. Elon wants the shortest path to the next better default."
            accent="violet"
          >
            <CommandSectionHeader
              eyebrow="Doctrine Stack"
              title="Three live beliefs"
              description="No clutter, just the strongest shared signals."
              icon={Sparkles}
              tone="violet"
            />
            <DoctrineCards items={learningMemory.doctrine.slice(0, 3)} columns="one" />
          </HudPanel>
          <DoctrineSignalRail learningMemory={learningMemory} />
        </>
      )}

      {focus === 'orders' && (
        <HudPanel
          eyebrow="Optimization Orders"
          title="Where to tighten the stack"
          description="The shortest ruthless list, not a dashboard sermon."
          accent="blue"
        >
          <CommandSectionHeader
            eyebrow="Command Orders"
            title="Three system moves"
            description="These are the upgrades most likely to increase throughput and lower drag."
            icon={Gauge}
            tone="teal"
          />
          <div className="mt-5 space-y-3">
            {derivedRecommendations.slice(0, 2).map((recommendation) => (
              <OptimizationCard key={recommendation.id} recommendation={recommendation} />
            ))}
          </div>
        </HudPanel>
      )}
    </div>
  );
}

function ModelRegistryTab({ availableModels, agents, tasks }) {
  const [detailView, setDetailView] = useState('constellation');
  const radarSelection = availableModels.slice(0, 4);

  const groupedComparisonData = useMemo(() => (
    capabilityMetrics.map((metric) => {
      const row = { metric: metric.label };
      radarSelection.forEach((model) => {
        row[model.model] = Number(model[metric.key] || 0);
      });
      return row;
    })
  ), [radarSelection]);

  const modelLoad = useMemo(() => {
    const byModel = tasks.reduce((acc, task) => {
      const agent = agents.find((candidate) => candidate.id === task.agentId);
      const key = agent?.model || 'Unassigned';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const total = Object.values(byModel).reduce((sum, value) => sum + value, 0);
    return Object.entries(byModel)
      .map(([name, tasksCount]) => ({
      name: name.slice(0, 20),
      tasks: tasksCount,
      share: total ? Math.round((tasksCount / total) * 100) : 0,
      fill: modelColors[name] || '#2dd4bf',
    }))
      .sort((a, b) => b.tasks - a.tasks);
  }, [agents, tasks]);

  const primaryReasoner = [...availableModels].sort((a, b) => b.reliability - a.reliability)[0];
  const fastestModel = [...availableModels].sort((a, b) => b.speed - a.speed)[0];
  const cheapestModel = [...availableModels].sort((a, b) => b.costDiscipline - a.costDiscipline)[0];
  const heaviestLoad = modelLoad.slice().sort((a, b) => b.tasks - a.tasks)[0];

  return (
    <div className="space-y-5">
        <div className="rounded-[24px] border border-white/8 bg-black/20 p-2">
          <div className="flex flex-wrap gap-2 rounded-[20px] bg-black/20 p-2">
            {[
              { id: 'constellation', label: 'Constellation' },
              { id: 'load', label: 'Load' },
              { id: 'registry', label: 'Registry' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDetailView(tab.id)}
                className={cn(
                  'flex-1 rounded-[16px] px-4 py-2.5 text-[12px] font-semibold transition-all',
                  detailView === tab.id ? 'border border-white/10 bg-white/[0.05] text-text-primary' : 'text-text-muted hover:text-text-primary'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {detailView === 'constellation' && (
        <HudPanel
          eyebrow="Capability Constellation"
          title="Who wins each capability"
          description="One grouped comparison chart so you can compare model families in seconds."
          accent="violet"
        >
          <CommandSectionHeader
            eyebrow="Capability Constellation"
            title="Reliability, load, coverage, speed, and cost in one view"
            description="Real operating metrics are easier to compare than decorative capability guesses."
            icon={RadarIcon}
            tone="violet"
          />
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { label: 'Most reliable', value: primaryReasoner?.model || 'No live model data yet', detail: 'Strongest completion and success posture from your active bank.' },
              { label: 'Fastest branch', value: fastestModel?.model || 'No live model data yet', detail: 'Best current latency posture across routed branches.' },
              { label: 'Most disciplined', value: cheapestModel?.model || 'No live model data yet', detail: 'Best cost discipline based on configured spend profile.' },
            ].map((card) => (
              <div key={card.label} className="rounded-[20px] border border-white/8 bg-black/20 p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{card.label}</div>
                <div className="mt-2 text-sm font-semibold text-text-primary">{card.value}</div>
                <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{card.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="relative h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={groupedComparisonData} layout="vertical" margin={{ top: 10, right: 12, left: 8, bottom: 4 }} barCategoryGap={16}>
                    <CartesianGrid stroke="rgba(255,255,255,0.05)" strokeDasharray="3 6" horizontal={true} vertical={false} />
                    <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#8f96a3', fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="metric"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#a1a1aa', fontSize: 11 }}
                      width={110}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                      contentStyle={{ background: '#101114', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14 }}
                    />
                    {radarSelection.map((model) => (
                      <Bar
                        key={model.model}
                        dataKey={model.model}
                        fill={modelColors[model.model] || '#2dd4bf'}
                        radius={[0, 6, 6, 0]}
                        barSize={10}
                        animationDuration={700}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap gap-4">
                {radarSelection.map((model) => (
                  <div key={model.model} className="flex items-center gap-2 text-[11px] text-text-muted">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: modelColors[model.model] || '#2dd4bf' }} />
                    {model.model}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-2xl border border-aurora-violet/15 bg-aurora-violet/[0.05] px-3 py-2 text-[11px] text-text-body">
            Readback: one chart, five operating metrics, real routed model lanes. The winner strip gives the quick answer; the bars show how close the alternatives really are.
          </div>
        </HudPanel>
        )}

        {detailView === 'load' && (
        <HudPanel
          eyebrow="Live Stack Load"
          title="Which branches are doing the work"
          description="A ranked traffic wall with share-of-load and clear dominance markers."
          accent="blue"
        >
          <CommandSectionHeader
            eyebrow="Live Stack Load"
            title="Which model families are carrying traffic"
            description="Where real mission load is landing right now."
            icon={BarChart3}
            tone="blue"
          />
          <div className="mt-5 space-y-3">
            {modelLoad.length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-black/10 p-6 text-center">
                <div className="text-sm font-semibold text-text-primary">No mission load yet.</div>
                <p className="mt-2 text-[12px] leading-relaxed text-text-muted">Once tasks start routing through model families, this wall will rank them by traffic share and show the dominant lane immediately.</p>
              </div>
            ) : (
              modelLoad.map((entry, index) => (
                <div key={entry.name} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-xs font-semibold text-text-primary">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-text-primary">{entry.name}</div>
                        <div className="mt-1 text-[11px] text-text-muted">{entry.tasks} routed missions</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold text-text-primary">{entry.share}%</div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">Share</div>
                    </div>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                    <Motion.div
                      initial={{ width: 0, opacity: 0.7 }}
                      animate={{ width: `${Math.max(8, entry.share)}%`, opacity: 1 }}
                      transition={{ duration: 0.65, ease: 'easeOut' }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: entry.fill }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 rounded-2xl border border-aurora-blue/15 bg-aurora-blue/[0.05] px-3 py-2 text-[11px] text-text-body">
            Anomaly callout: {heaviestLoad ? <><span className="font-semibold text-aurora-blue">{heaviestLoad.name}</span> is carrying the heaviest traffic load at <span className="font-semibold text-aurora-blue">{heaviestLoad.tasks}</span> routed missions.</> : 'No dominant traffic lane yet.'}
          </div>
        </HudPanel>
        )}

        {detailView === 'registry' && (
        <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(45,212,191,0.05),rgba(255,255,255,0.02))] p-5">
          <CommandSectionHeader
            eyebrow="Registry"
            title="Model command matrix"
            description="Keep the strongest lanes visible and the rest behind the curtain."
            icon={Cpu}
            tone="teal"
          />
          <div className="mt-4 space-y-3">
            {availableModels.length === 0 && (
              <div className="rounded-[22px] border border-white/8 bg-black/20 p-4 text-sm text-text-muted">
                Your model bank is empty. Add models from agent creation or config before using the registry.
              </div>
            )}
            {availableModels.slice(0, 6).map((model) => (
              <div key={model.model} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CircleDot className="h-3.5 w-3.5" style={{ color: modelColors[model.model] || '#2dd4bf' }} />
                      <span className="text-sm font-semibold text-text-primary">{model.model}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-text-muted">{model.provider}</div>
                  </div>
                  <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                    {model.contextWindow}
                  </span>
                </div>
                    <div className="mt-4 grid grid-cols-3 gap-3 text-[11px]">
                  <div>
                    <div className="text-text-disabled">Live spend</div>
                    <div className="mt-1 font-mono text-text-primary">{model.monthlyCost ? `$${model.monthlyCost.toFixed(2)}` : '$0.00'}</div>
                  </div>
                  <div>
                    <div className="text-text-disabled">Reliability</div>
                    <div className="mt-1 font-mono text-text-primary">{model.reliability}</div>
                  </div>
                  <div>
                    <div className="text-text-disabled">Active agents</div>
                    <div className="mt-1 font-mono text-text-primary">{Math.round((model.agentCoverage / 100) * Math.max(availableModels.length, 1))}</div>
                  </div>
                </div>
              </div>
            ))}
            {availableModels.length > 6 && (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-black/10 p-4 text-[12px] text-text-muted">
                {availableModels.length - 6} more models are available in the bank. This view is keeping the highest-signal lanes up front.
              </div>
            )}
          </div>
        </div>
        )}
    </div>
  );
}

function RoutingDoctrineTab({ routingPolicies, tasks, agents, upsertPolicy, ensureDefaultPolicy }) {
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (!routingPolicies.length) {
      setSelectedPolicyId('');
      setDraft(null);
      return;
    }

    const fallbackPolicy = routingPolicies.find((policy) => policy.isDefault) || routingPolicies[0];
    const selected = routingPolicies.find((policy) => policy.id === selectedPolicyId) || fallbackPolicy;
    setSelectedPolicyId(selected?.id || '');
    setDraft(selected ? { ...selected } : null);
  }, [routingPolicies, selectedPolicyId]);

  const workflowDistribution = useMemo(() => {
    const counts = new Map();
    tasks.forEach((task) => {
      const key = task.workflowStatus || 'intake';
      counts.set(key, (counts.get(key) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([status, count]) => ({
        status,
        count,
        meta: getWorkflowMeta(status),
      }))
      .sort((a, b) => b.count - a.count);
  }, [tasks]);

  const capabilityDemand = useMemo(() => {
    const counts = new Map();
    tasks.forEach((task) => {
      (task.requiredCapabilities || []).forEach((capability) => {
        counts.set(capability, (counts.get(capability) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([capability, count]) => ({ capability, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [tasks]);

  const routedTasks = tasks.filter((task) => task.routingReason);
  const premiumBranches = routedTasks.filter((task) => task.budgetClass === 'premium').length;
  const humanGates = routedTasks.filter((task) => task.approvalLevel === 'human_required').length;
  const delegatedBranches = agents.filter((agent) => agent.canSpawn).length;
  const matchingTasks = useMemo(() => (
    draft
      ? routedTasks.filter((task) => {
        const domainMatch = (draft.taskDomain || 'general') === 'general' || task.domain === draft.taskDomain;
        const intentMatch = (draft.intentType || 'general') === 'general' || task.intentType === draft.intentType;
        return domainMatch && intentMatch;
      })
      : []
  ), [draft, routedTasks]);
  const modelOptions = useMemo(() => {
    const seen = new Map();
    agents.forEach((agent) => {
      if (!agent.model) return;
      seen.set(agent.model, { model: agent.model, provider: normalizeModelProvider(agent.provider || 'Live agent') });
    });
    return Array.from(seen.values());
  }, [agents]);

  function updateFallback(index, field, value) {
    setDraft((current) => {
      if (!current) return current;
      const nextFallback = Array.isArray(current.fallbackOrder) ? [...current.fallbackOrder] : [];
      const existing = nextFallback[index] || { role: 'executor', provider: 'Anthropic', model: '' };
      nextFallback[index] = { ...existing, [field]: value };
      return { ...current, fallbackOrder: nextFallback };
    });
    setSaveError('');
    setSaveMessage('');
  }

  function addFallback() {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        fallbackOrder: [
          ...(Array.isArray(current.fallbackOrder) ? current.fallbackOrder : []),
          { role: 'executor', provider: 'Anthropic', model: '' },
        ],
      };
    });
    setSaveError('');
    setSaveMessage('');
  }

  function removeFallback(index) {
    setDraft((current) => {
      if (!current) return current;
      const nextFallback = (Array.isArray(current.fallbackOrder) ? current.fallbackOrder : []).filter((_, itemIndex) => itemIndex !== index);
      return { ...current, fallbackOrder: nextFallback };
    });
    setSaveError('');
    setSaveMessage('');
  }

  function updateDraft(field, value) {
    setDraft((current) => current ? { ...current, [field]: value } : current);
    setSaveError('');
    setSaveMessage('');
  }

  async function handleSavePolicy() {
    if (!draft) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');

    try {
      await upsertPolicy(draft);
      setSaveMessage('Routing policy updated.');
    } catch (error) {
      setSaveError(error.message || 'Could not update routing policy.');
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDefaultPolicy() {
    setSaving(true);
    setSaveError('');
    setSaveMessage('');

    try {
      const policy = await ensureDefaultPolicy();
      setSelectedPolicyId(policy.id);
      setSaveMessage('Default routing policy created.');
    } catch (error) {
      setSaveError(error.message || 'Could not create default routing policy.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <HudPanel
        eyebrow="Routing Doctrine"
        title="Canonical routing is live"
        description="This is the first visible layer of Commander doctrine: what the system is routing, where risk is rising, and which policies own the work."
        accent="teal"
      >
        <CommandSectionHeader
          eyebrow="Routing Command"
          title="Policy, workflow, and capability pressure"
          description="The goal is simple: one routing truth, visible enough to trust."
          icon={GitBranch}
          tone="teal"
        />
        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {[
            { label: 'Policies live', value: routingPolicies.length },
            { label: 'Routed missions', value: routedTasks.length },
            { label: 'Human gates', value: humanGates },
            { label: 'Spawn lanes', value: delegatedBranches },
          ].map((metric) => (
            <div key={metric.label} className="rounded-[20px] border border-white/8 bg-black/20 p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{metric.label}</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary">
                <AnimatedNumber value={metric.value} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-2xl border border-aurora-blue/15 bg-aurora-blue/[0.05] px-3 py-2 text-[11px] text-text-body">
          Routing readback: {premiumBranches > 0
            ? `${premiumBranches} missions are already marked premium, so cost discipline is now explicit instead of implied.`
            : 'No premium-only branches are live yet, which is good while doctrine is still being hardened.'}
        </div>
      </HudPanel>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5">
          <CommandSectionHeader
            eyebrow="Policy Stack"
            title="Routing policies in command"
            description="Default first, overrides second, now editable instead of just observable."
            icon={Layers3}
            tone="blue"
          />
          <div className="mt-4 space-y-3">
            {routingPolicies.length === 0 && (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-black/10 p-5 text-sm text-text-muted">
                No routing policies are stored yet. Create the first default policy and Commander will start using it for mission routing.
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleCreateDefaultPolicy}
                    disabled={saving}
                    className="rounded-xl border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-2 text-[11px] font-semibold text-aurora-teal transition-colors hover:bg-aurora-teal/14 disabled:opacity-50"
                  >
                    Create default policy
                  </button>
                </div>
              </div>
            )}
            {routingPolicies.map((policy) => (
              <button
                key={policy.id}
                type="button"
                onClick={() => setSelectedPolicyId(policy.id)}
                className={cn(
                  'w-full rounded-[22px] border bg-black/20 p-4 text-left transition-colors',
                  selectedPolicyId === policy.id ? 'border-aurora-teal/30 shadow-glow-teal' : 'border-white/8 hover:border-white/12'
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-text-primary">{policy.name}</div>
                      {policy.isDefault && (
                        <span className="rounded-full border border-aurora-teal/20 bg-aurora-teal/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-teal">
                          Default
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-text-muted">{policy.description || 'Adaptive Commander doctrine.'}</div>
                  </div>
                  <div className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                    {policy.preferredProvider} / {policy.preferredAgentRole}
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] md:grid-cols-4">
                  <div>
                    <div className="text-text-disabled">Domain</div>
                    <div className="mt-1 font-semibold text-text-primary">{policy.taskDomain}</div>
                  </div>
                  <div>
                    <div className="text-text-disabled">Intent</div>
                    <div className="mt-1 font-semibold text-text-primary">{policy.intentType}</div>
                  </div>
                  <div>
                    <div className="text-text-disabled">Budget</div>
                    <div className="mt-1 font-semibold text-text-primary">{policy.budgetClass}</div>
                  </div>
                  <div>
                    <div className="text-text-disabled">Approval</div>
                    <div className="mt-1 font-semibold text-text-primary">{policy.approvalRule}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-5">
          <HudPanel
            eyebrow="Policy Editor"
            title="Tune Commander routing live"
            description="Preferred provider, model, role, approval posture, and parallelization live here."
            accent="teal"
          >
            {!draft && (
              <div className="rounded-[22px] border border-white/8 bg-black/20 p-4 text-[12px] text-text-muted">
                Select a routing policy to edit it here.
              </div>
            )}
            {draft && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Task domain</div>
                    <select
                      value={draft.taskDomain || 'general'}
                      onChange={(event) => updateDraft('taskDomain', event.target.value)}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-text-primary outline-none"
                    >
                      {['general', 'build', 'research', 'ops', 'crm', 'finance', 'personal'].map((domain) => (
                        <option key={domain} value={domain} className="bg-[#0d1015]">{domain}</option>
                      ))}
                    </select>
                  </label>
                  <label className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Intent type</div>
                    <select
                      value={draft.intentType || 'general'}
                      onChange={(event) => updateDraft('intentType', event.target.value)}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-text-primary outline-none"
                    >
                      {['general', 'planning', 'research', 'execution', 'verification', 'reporting'].map((intent) => (
                        <option key={intent} value={intent} className="bg-[#0d1015]">{intent}</option>
                      ))}
                    </select>
                  </label>
                  <label className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Policy name</div>
                    <input
                      value={draft.name || ''}
                      onChange={(event) => updateDraft('name', event.target.value)}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-text-primary outline-none"
                    />
                  </label>
                  <label className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Preferred role</div>
                    <select
                      value={draft.preferredAgentRole || 'commander'}
                      onChange={(event) => updateDraft('preferredAgentRole', event.target.value)}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-text-primary outline-none"
                    >
                      {['commander', 'planner', 'researcher', 'builder', 'verifier', 'executor'].map((role) => (
                        <option key={role} value={role} className="bg-[#0d1015]">{role}</option>
                      ))}
                    </select>
                  </label>
                  <label className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Preferred provider</div>
                    <select
                      value={draft.preferredProvider || 'Anthropic'}
                      onChange={(event) => updateDraft('preferredProvider', event.target.value)}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-text-primary outline-none"
                    >
                      {['Anthropic', 'OpenAI', 'Google', 'Ollama', 'Custom'].map((provider) => (
                        <option key={provider} value={provider} className="bg-[#0d1015]">{provider}</option>
                      ))}
                    </select>
                  </label>
                  <label className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Preferred model</div>
                    <select
                      value={draft.preferredModel || ''}
                      onChange={(event) => updateDraft('preferredModel', event.target.value)}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-text-primary outline-none"
                    >
                      <option value="" className="bg-[#0d1015]">No hard override</option>
                      {modelOptions.map((model) => (
                        <option key={model.model} value={model.model} className="bg-[#0d1015]">{model.model}</option>
                      ))}
                    </select>
                  </label>
                  <label className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Approval rule</div>
                    <select
                      value={draft.approvalRule || 'risk_weighted'}
                      onChange={(event) => updateDraft('approvalRule', event.target.value)}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-text-primary outline-none"
                    >
                      {['risk_weighted', 'human_required', 'auto_low_risk'].map((rule) => (
                        <option key={rule} value={rule} className="bg-[#0d1015]">{rule}</option>
                      ))}
                    </select>
                  </label>
                  <label className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Parallelization</div>
                    <select
                      value={draft.parallelizationPolicy || 'adaptive'}
                      onChange={(event) => updateDraft('parallelizationPolicy', event.target.value)}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-text-primary outline-none"
                    >
                      {['adaptive', 'parallel_first', 'sequential_first'].map((policy) => (
                        <option key={policy} value={policy} className="bg-[#0d1015]">{policy}</option>
                      ))}
                    </select>
                  </label>
                  <label className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Context policy</div>
                    <select
                      value={draft.contextPolicy || 'minimal'}
                      onChange={(event) => updateDraft('contextPolicy', event.target.value)}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-text-primary outline-none"
                    >
                      {['minimal', 'balanced', 'max_context'].map((policy) => (
                        <option key={policy} value={policy} className="bg-[#0d1015]">{policy}</option>
                      ))}
                    </select>
                  </label>
                  <label className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Budget class</div>
                    <select
                      value={draft.budgetClass || 'balanced'}
                      onChange={(event) => updateDraft('budgetClass', event.target.value)}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-text-primary outline-none"
                    >
                      {['lean', 'balanced', 'premium'].map((budget) => (
                        <option key={budget} value={budget} className="bg-[#0d1015]">{budget}</option>
                      ))}
                    </select>
                  </label>
                  <label className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Risk level</div>
                    <select
                      value={draft.riskLevel || 'medium'}
                      onChange={(event) => updateDraft('riskLevel', event.target.value)}
                      className="mt-2 w-full bg-transparent text-sm font-semibold text-text-primary outline-none"
                    >
                      {['low', 'medium', 'high'].map((level) => (
                        <option key={level} value={level} className="bg-[#0d1015]">{level}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="rounded-[20px] border border-white/8 bg-black/20 p-3 block">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Description</div>
                  <textarea
                    value={draft.description || ''}
                    onChange={(event) => updateDraft('description', event.target.value)}
                    className="mt-2 min-h-[88px] w-full bg-transparent text-[12px] leading-relaxed text-text-primary outline-none"
                  />
                </label>
                <label className="flex items-center gap-3 rounded-[20px] border border-white/8 bg-black/20 p-3">
                  <input
                    type="checkbox"
                    checked={draft.evidenceRequired ?? false}
                    onChange={(event) => updateDraft('evidenceRequired', event.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-transparent"
                  />
                  <div>
                    <div className="text-sm font-semibold text-text-primary">Require evidence before execution</div>
                    <div className="mt-1 text-[11px] text-text-muted">Use for research-sensitive or high-stakes branches.</div>
                  </div>
                </label>
                <div className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      { label: 'Policy reach', value: matchingTasks.length, hint: 'matching tasks' },
                      { label: 'Fallback lanes', value: (draft.fallbackOrder || []).length, hint: 'backup routes' },
                      { label: 'Evidence mode', value: draft.evidenceRequired ? 'On' : 'Off', hint: 'pre-execution proof' },
                      { label: 'Parallel bias', value: draft.parallelizationPolicy || 'adaptive', hint: 'execution posture' },
                    ].map((entry) => (
                      <div key={entry.label} className="rounded-[16px] border border-white/8 bg-white/[0.02] px-3 py-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{entry.label}</div>
                        <div className="mt-2 text-sm font-semibold text-text-primary">{entry.value}</div>
                        <div className="mt-1 text-[10px] text-text-disabled">{entry.hint}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[20px] border border-white/8 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Fallback order</div>
                      <div className="mt-1 text-[11px] text-text-muted">These are the backup lanes Commander will try when the preferred lane is unavailable or mismatched.</div>
                    </div>
                    <button
                      type="button"
                      onClick={addFallback}
                      className="rounded-xl border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-teal transition-colors hover:bg-aurora-teal/14"
                    >
                      Add lane
                    </button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(draft.fallbackOrder || []).length === 0 && (
                      <div className="rounded-[16px] border border-dashed border-white/10 bg-black/10 px-3 py-3 text-[11px] text-text-muted">
                        No explicit fallback lanes yet. Commander will rely on the preferred lane and general heuristics.
                      </div>
                    )}
                    {(draft.fallbackOrder || []).map((entry, index) => (
                      <div key={`${entry.role || 'lane'}-${index}`} className="rounded-[18px] border border-white/8 bg-white/[0.02] p-3">
                        <div className="grid gap-3 md:grid-cols-[0.9fr_0.9fr_1fr_auto]">
                          <label>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Role</div>
                            <select
                              value={entry.role || 'executor'}
                              onChange={(event) => updateFallback(index, 'role', event.target.value)}
                              className="mt-2 w-full bg-transparent text-[12px] font-semibold text-text-primary outline-none"
                            >
                              {['commander', 'planner', 'researcher', 'builder', 'verifier', 'executor'].map((role) => (
                                <option key={role} value={role} className="bg-[#0d1015]">{role}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Provider</div>
                            <select
                              value={entry.provider || 'Anthropic'}
                              onChange={(event) => updateFallback(index, 'provider', event.target.value)}
                              className="mt-2 w-full bg-transparent text-[12px] font-semibold text-text-primary outline-none"
                            >
                              {['Anthropic', 'OpenAI', 'Google', 'Ollama', 'Custom'].map((provider) => (
                                <option key={provider} value={provider} className="bg-[#0d1015]">{provider}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Model</div>
                            <select
                              value={entry.model || ''}
                              onChange={(event) => updateFallback(index, 'model', event.target.value)}
                              className="mt-2 w-full bg-transparent text-[12px] font-semibold text-text-primary outline-none"
                            >
                              <option value="" className="bg-[#0d1015]">No hard override</option>
                              {modelOptions.map((model) => (
                                <option key={model.model} value={model.model} className="bg-[#0d1015]">{model.model}</option>
                              ))}
                            </select>
                          </label>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={() => removeFallback(index)}
                              className="rounded-xl border border-aurora-rose/20 bg-aurora-rose/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-rose transition-colors hover:bg-aurora-rose/14"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-[20px] border border-aurora-blue/15 bg-aurora-blue/[0.05] p-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-blue">Doctrine readback</div>
                  <div className="mt-2 text-[12px] leading-relaxed text-text-body">
                    Commander will prefer <span className="font-semibold text-text-primary">{draft.preferredAgentRole || 'commander'}</span> on the{' '}
                    <span className="font-semibold text-text-primary">{draft.preferredProvider || 'adaptive'}</span> lane
                    {draft.preferredModel ? <> using <span className="font-semibold text-text-primary">{draft.preferredModel}</span></> : ' without a hard model lock'}.
                    {' '}This policy is targeting <span className="font-semibold text-text-primary">{draft.taskDomain || 'general'}</span> /{' '}
                    <span className="font-semibold text-text-primary">{draft.intentType || 'general'}</span> work and currently matches{' '}
                    <span className="font-semibold text-text-primary">{matchingTasks.length}</span> routed mission{matchingTasks.length === 1 ? '' : 's'}.
                  </div>
                </div>
                {(saveError || saveMessage) && (
                  <div className={cn(
                    'rounded-[18px] border px-3 py-2 text-[11px]',
                    saveError ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose' : 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                  )}>
                    {saveError || saveMessage}
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSavePolicy}
                    disabled={saving}
                    className="rounded-xl border border-aurora-teal/20 bg-aurora-teal/10 px-4 py-2 text-[11px] font-semibold text-aurora-teal transition-colors hover:bg-aurora-teal/14 disabled:opacity-50"
                  >
                    {saving ? 'Saving...' : 'Save routing policy'}
                  </button>
                </div>
              </div>
            )}
          </HudPanel>

          <HudPanel
            eyebrow="Workflow Status"
            title="Canonical mission posture"
            description="This is the live split between intake, ready, running, blocked, and human-gated work."
            accent="violet"
          >
            <div className="space-y-3">
              {workflowDistribution.length === 0 && (
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4 text-[12px] text-text-muted">
                  No task workflow data is live yet.
                </div>
              )}
              {workflowDistribution.map((entry) => (
                <div key={entry.status} className="rounded-[20px] border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">{entry.meta.label}</div>
                      <div className="mt-1 text-[11px] text-text-muted">Canonical state: `{entry.status}`</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-semibold text-text-primary">
                        <AnimatedNumber value={entry.count} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </HudPanel>

          <HudPanel
            eyebrow="Capability Demand"
            title="What missions are asking for"
            description="Capability pressure is the first step toward a real system capability graph."
            accent="amber"
          >
            <div className="space-y-3">
              {capabilityDemand.length === 0 && (
                <div className="rounded-[22px] border border-white/8 bg-black/20 p-4 text-[12px] text-text-muted">
                  No required capabilities have been inferred yet.
                </div>
              )}
              {capabilityDemand.map((entry) => (
                <div key={entry.capability} className="rounded-[20px] border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold capitalize text-text-primary">{entry.capability}</div>
                    <div className="text-sm font-mono text-aurora-amber">{entry.count}</div>
                  </div>
                </div>
              ))}
            </div>
          </HudPanel>
        </div>
      </div>
    </div>
  );
}

function KnowledgeMapTab({ namespaces }) {
  const totalVectors = namespaces.reduce((sum, namespace) => sum + Number(namespace.vectors || 0), 0);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-5">
        <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(45,212,191,0.05),rgba(255,255,255,0.02))] p-5">
          <CommandSectionHeader
            eyebrow="Terrain Readout"
            title="Memory pressure at a glance"
            description="The live shape of the knowledge map."
            icon={Database}
            tone="teal"
          />
          <div className="mt-5 grid gap-3">
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Total vectors</div>
              <div className="mt-2 text-3xl font-semibold text-text-primary">{totalVectors.toLocaleString()}</div>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Namespaces</div>
              <div className="mt-2 text-3xl font-semibold text-text-primary">{namespaces.length}</div>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Stale terrain</div>
              <div className="mt-2 text-3xl font-semibold text-text-primary">
                {namespaces.filter((namespace) => namespace.status !== 'active').length}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(96,165,250,0.05),rgba(255,255,255,0.02))] p-5">
          <CommandSectionHeader
            eyebrow="Territory Ranking"
            title="Memory zones by size"
            description="The namespaces taking the most space and attention."
            icon={Layers3}
            tone="blue"
          />
          <div className="mt-5 space-y-3">
            {namespaces.length === 0 && (
              <div className="rounded-[22px] border border-dashed border-white/10 bg-black/10 p-4 text-[12px] text-text-muted">
                No knowledge namespaces are stored yet. Once memory zones are persisted, this terrain will rank them here instead of inventing placeholders.
              </div>
            )}
            {namespaces
              .slice()
              .sort((a, b) => Number(b.vectors || 0) - Number(a.vectors || 0))
              .map((namespace, index) => (
                <div key={namespace.id} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-sm font-semibold text-text-primary">
                        {String(index + 1).padStart(2, '0')}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-text-primary">{namespace.name}</div>
                        <div className="mt-1 text-[11px] text-text-muted">{namespace.description}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-text-primary">{namespace.sizeLabel}</div>
                      <div className="mt-1 text-[11px] text-text-muted">{Number(namespace.vectors || 0).toLocaleString()} vectors</div>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(167,139,250,0.06),rgba(255,255,255,0.02))] p-5">
        <CommandSectionHeader
          eyebrow="Knowledge Terrain"
          title="Where your memory is strongest"
          description="Namespace health, vector density, and attached operators."
          icon={Database}
          tone="violet"
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {namespaces.slice(0, 6).map((namespace) => (
            <div key={namespace.id} className="rounded-[24px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text-primary">{namespace.name}</div>
                  <div className="mt-1 text-[11px] text-text-muted">{namespace.lastSyncAt ? new Date(namespace.lastSyncAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Not synced yet'}</div>
                </div>
                <span
                  className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                    namespace.status === 'active'
                      ? 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                      : 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
                  }`}
                >
                  {namespace.status}
                </span>
              </div>
              <p className="mt-3 text-[12px] leading-relaxed text-text-muted">{namespace.description}</p>
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="text-text-body">Vector density</span>
                  <span className="font-mono text-text-muted">{namespace.vectors.toLocaleString()}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-aurora-teal to-aurora-blue"
                    style={{ width: `${Math.max(12, Math.min(100, totalVectors > 0 ? (Number(namespace.vectors || 0) / totalVectors) * 220 : 12))}%` }}
                  />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {namespace.agents.map((agent) => (
                  <span key={agent} className="rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                    {agent}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {namespaces.length > 6 && (
          <div className="mt-4 rounded-[22px] border border-dashed border-white/10 bg-black/10 p-4 text-[12px] text-text-muted">
            {namespaces.length - 6} more namespaces are tracked. The terrain map is showing the strongest and largest zones first.
          </div>
        )}
      </div>
    </div>
  );
}

function DirectivesTab({ directives, agents, tasks, recommendations }) {
  const directivePressure = useMemo(() => {
    return directives.map((directive) => ({
      ...directive,
      affected: directive.appliedTo.filter((name) => agents.some((agent) => agent.name === name)).length || directive.appliedTo.length,
      drag: directive.priority === 'critical' ? 88 : directive.priority === 'high' ? 64 : 38,
    }));
  }, [agents, directives]);

  const approvalSensitiveTasks = tasks.filter((task) => task.status === 'needs_approval').length;

  return (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5">
        <CommandSectionHeader
          eyebrow="Directive Pressure"
          title="Rules shaping throughput and safety"
          description="The operating constraints most responsible for safety, drift control, and friction."
          icon={ShieldCheck}
          tone="teal"
        />
        <div className="mt-5 space-y-3">
          {directivePressure.map((directive) => {
            const Icon = directiveIconMap[directive.icon] || ShieldCheck;
            return (
              <div key={directive.id} className="rounded-[22px] border border-white/8 bg-black/20 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                      <Icon className="h-4 w-4 text-aurora-teal" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-text-primary">{directive.name}</div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                          directive.priority === 'critical'
                            ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
                            : directive.priority === 'high'
                              ? 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
                              : 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                        }`}>
                          {directive.priority}
                        </span>
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{directive.content}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-mono text-text-muted">{directive.affected} agents</div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-text-body">Constraint weight</span>
                    <span className="font-mono text-text-muted">{directive.drag}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div
                      className={`h-full rounded-full ${
                        directive.priority === 'critical'
                          ? 'bg-aurora-rose'
                          : directive.priority === 'high'
                            ? 'bg-aurora-amber'
                            : 'bg-aurora-teal'
                      }`}
                      style={{ width: `${directive.drag}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-5">
        <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(45,212,191,0.05),rgba(255,255,255,0.02))] p-5">
          <CommandSectionHeader
            eyebrow="System Readback"
            title="What the rules are doing to the system"
            description="A quick readback of approval load and directive density."
            icon={Gauge}
            tone="teal"
          />
          <div className="mt-5 space-y-3">
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Approval sensitivity</div>
              <div className="mt-2 text-3xl font-semibold text-text-primary">{approvalSensitiveTasks}</div>
              <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
                Missions currently halted by directives or approval gates before execution can continue.
              </p>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Directives live</div>
              <div className="mt-2 text-3xl font-semibold text-text-primary">{directives.length}</div>
              <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
                Shared command constraints protecting output quality, privacy, and operating cost.
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(167,139,250,0.06),rgba(255,255,255,0.02))] p-5">
          <CommandSectionHeader
            eyebrow="Optimization Orders"
            title="Directive upgrades to consider"
            description="Improvements with the highest leverage on quality and throughput."
            icon={Sparkles}
            tone="violet"
          />
          <div className="mt-4 space-y-3">
            {(recommendations.length > 0 ? recommendations : [
              {
                title: 'No live directive upgrades yet',
                description: 'Once recommendation rows are persisted, this rail will promote the highest-leverage directive improvements here.',
                impact: 'normal',
              },
            ]).map((recommendation) => (
              <OptimizationCard key={recommendation.title} recommendation={recommendation} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function IntelligenceView() {
  const [activeTab, setActiveTab] = useState('models');
  const { agents } = useAgents();
  const { models } = useModelBank();
  const { tasks } = useTasks();
  const { policies: routingPolicies, upsertPolicy, ensureDefaultPolicy } = useRoutingPolicies();
  const { logs } = useActivityLog();
  const { namespaces: knowledgeNamespaces } = useKnowledgeNamespaces();
  const { directives: sharedDirectives } = useSharedDirectives();
  const { recommendations: persistedRecommendations } = useSystemRecommendations();
  const { humanHourlyRate } = useCommanderPreferences();
  const truth = useCommandCenterTruth();

  const availableModels = useMemo(() => {
    return deriveAvailableModels(models, agents, tasks);
  }, [agents, models, tasks]);

  const systemSummary = useMemo(() => {
    const activeAgents = agents.filter((agent) => agent.status === 'processing').length;
    const errorAgents = agents.filter((agent) => agent.status === 'error').length;
    const localModels = availableModels.filter((model) => model.provider === 'Ollama').length;
    const directivesLive = sharedDirectives.length;
    const recommendationCount = persistedRecommendations.length;
    const liveTraffic = logs.length;
    const routedMissions = tasks.filter((task) => task.routingPolicyId || task.routingReason).length;

    return {
      activeAgents,
      errorAgents,
      localModels,
      directivesLive,
      recommendationCount,
      liveTraffic,
      routedMissions,
    };
  }, [agents, availableModels, logs.length, persistedRecommendations.length, sharedDirectives.length, tasks]);

  const derivedRecommendations = useMemo(() => {
    const runningTasks = tasks.filter((task) => task.status === 'running').length;
    const failedTasks = tasks.filter((task) => ['failed', 'error', 'blocked'].includes(task.status)).length;
    const recommendations = [...persistedRecommendations];

    if (failedTasks > 0) {
      recommendations.unshift({
        id: 'derived-failure',
        type: 'optimization',
        title: 'Stabilize the weakest execution branch',
        description: `${failedTasks} mission failures are active. Tighten model routing and move unstable jobs into safer branches before scaling.`,
        impact: 'critical',
      });
    }

    if (runningTasks > 4) {
      recommendations.unshift({
        id: 'derived-throughput',
        type: 'performance',
        title: 'Current traffic supports more specialization',
        description: `${runningTasks} live missions are active. This is enough volume to justify sharper split-routing between strategy, ops, and utility lanes.`,
        impact: 'high',
      });
    }

    return recommendations.slice(0, 5);
  }, [persistedRecommendations, tasks]);

  const economics = useMemo(() => {
    const durationHours = tasks.reduce((sum, task) => sum + Number(task.durationMs || 0), 0) / (1000 * 60 * 60);
    const humanCost = durationHours * humanHourlyRate;
    const agentCost = tasks.reduce((sum, task) => sum + Number(task.costUsd || 0), 0);
    const savings = humanCost - agentCost;
    const multiplier = agentCost > 0 ? humanCost / agentCost : humanCost > 0 ? humanCost : 0;

    return {
      durationHours,
      humanCost,
      agentCost,
      savings,
      multiplier,
    };
  }, [humanHourlyRate, tasks]);

  const learningMemory = useLearningMemory({ agents, tasks, logs, approvals: [], costData: { total: economics.agentCost, models: [] }, humanHourlyRate });
  const readFirstItems = useMemo(() => {
    const bestReasoner = availableModels.slice().sort((a, b) => b.reliability - a.reliability)[0];
    const fastest = availableModels.slice().sort((a, b) => b.speed - a.speed)[0];
    const cheapest = availableModels.slice().sort((a, b) => b.costDiscipline - a.costDiscipline)[0];
    return [
      {
        eyebrow: 'Use First',
        title: bestReasoner ? `${bestReasoner.model} is the most reliable lane` : 'No clear reliable lane yet',
        detail: bestReasoner
          ? `This branch is currently closing the highest-quality work most consistently across the live deck.`
          : 'You do not have enough live model data yet to pick a dominant lane confidently.',
      },
      {
        eyebrow: 'Move Faster',
        title: fastest ? `${fastest.model} is the speed lane` : 'No clear speed lane yet',
        detail: fastest
          ? `This branch has the best current latency posture for time-sensitive and repetitive work.`
          : 'More live traffic is needed before a true speed winner emerges.',
      },
      {
        eyebrow: 'Spend Smarter',
        title: cheapest ? `${cheapest.model} is the cost-discipline lane` : 'No clear efficiency lane yet',
        detail: cheapest
          ? `This is the best current lane for keeping spend disciplined before a mission truly needs premium depth.`
          : 'Cost signals are still too weak to make a hard routing doctrine call.',
      },
    ];
  }, [availableModels]);

  return (
    <div className="relative flex h-full flex-col overflow-y-auto pb-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-16 left-[-8%] h-[360px] w-[360px] rounded-full bg-aurora-teal/10 blur-[120px]" />
        <div className="absolute top-[10%] right-[-12%] h-[420px] w-[420px] rounded-full bg-aurora-violet/10 blur-[140px]" />
        <div className="absolute bottom-[-22%] left-[18%] h-[420px] w-[420px] rounded-full bg-aurora-blue/10 blur-[160px]" />
      </div>

      <Motion.div variants={container} initial="hidden" animate="show" className="relative space-y-5">
        <Motion.div variants={item}>
          <CommandDeckHero
            glow="teal"
            eyebrow="Strategic Systems"
            eyebrowIcon={BrainCircuit}
            title="Strategic Systems"
            description="Model power, doctrine drift, and execution efficiency in one clean command surface."
            chrome="epic"
            titleClassName="text-[clamp(2.2rem,4vw,3.4rem)] leading-[1] tracking-[-0.04em]"
            descriptionClassName="max-w-2xl text-[15px] leading-7 text-text-body"
            badges={[
              { label: 'models online', value: availableModels.length, tone: 'teal' },
              { label: 'active agents', value: systemSummary.activeAgents, tone: 'blue' },
              { label: 'routed missions', value: systemSummary.routedMissions, tone: 'amber' },
              { label: 'local branches', value: systemSummary.localModels, tone: 'violet' },
            ]}
            sideContent={
              <div className="grid w-full grid-cols-2 gap-3 rounded-[24px] border border-white/10 bg-black/25 p-4 backdrop-blur-sm">
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Recommendations</div>
                  <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={systemSummary.recommendationCount} /></div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Error agents</div>
                  <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={systemSummary.errorAgents} /></div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Routing policies</div>
                  <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={routingPolicies.length} /></div>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-3">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Live telemetry</div>
                  <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={systemSummary.liveTraffic} /></div>
                </div>
              </div>
            }
          />
        </Motion.div>

        <StrategicReadFirst items={readFirstItems.slice(0, 2)} />
        <TruthAuditStrip truth={truth} />

        <Motion.section variants={item} className="grid grid-cols-1 gap-5 xl:grid-cols-[1.55fr_0.45fr]">
          <div className="space-y-5">
            <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-2">
              <div className="flex flex-wrap gap-2 rounded-[24px] bg-black/20 p-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-[18px] px-4 py-3 text-[13px] font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'border border-white/10 bg-white/[0.05] text-text-primary shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[28px] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.015))] p-5">
              {activeTab === 'models' && <ModelRegistryTab availableModels={availableModels} agents={agents} tasks={tasks} />}
              {activeTab === 'routing' && <RoutingDoctrineTab routingPolicies={routingPolicies} tasks={tasks} agents={agents} upsertPolicy={upsertPolicy} ensureDefaultPolicy={ensureDefaultPolicy} />}
              {activeTab === 'knowledge' && <KnowledgeMapTab namespaces={knowledgeNamespaces} />}
              {activeTab === 'directives' && <DirectivesTab directives={sharedDirectives} agents={agents} tasks={tasks} recommendations={persistedRecommendations} />}
            </div>
          </div>

          <StrategyRail
            derivedRecommendations={derivedRecommendations}
            learningMemory={learningMemory}
            humanHourlyRate={humanHourlyRate}
            economics={economics}
          />
        </Motion.section>
      </Motion.div>
    </div>
  );
}
