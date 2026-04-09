import { useMemo, useState } from 'react';
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
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  directiveTemplates,
  knowledgeNamespaces,
  modelBenchmarks,
  systemRecommendations,
} from '../utils/staticCatalog';
import { container, item } from '../utils/variants';
import { useActivityLog, useAgents, useModelBank, useTasks } from '../utils/useSupabase';
import { CommandDeckHero } from '../components/command/CommandDeckHero';
import { AnimatedNumber } from '../components/command/AnimatedNumber';
import { CommandSectionHeader } from '../components/command/CommandSectionHeader';
import { useCommanderPreferences } from '../utils/useCommanderPreferences';
import { useLearningMemory } from '../utils/useLearningMemory';
import { DoctrineCards } from '../components/command/DoctrineCards';
import { cn } from '../utils/cn';

const tabs = [
  { id: 'models', label: 'Model Command Matrix', icon: Cpu },
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
  { key: 'reasoning', label: 'Reasoning' },
  { key: 'codeGen', label: 'Code generation' },
  { key: 'extraction', label: 'Extraction' },
  { key: 'latency', label: 'Speed' },
  { key: 'costEfficiency', label: 'Cost efficiency' },
];

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

  const primaryReasoner = [...availableModels].sort((a, b) => b.reasoning - a.reasoning)[0];
  const fastestModel = [...availableModels].sort((a, b) => b.latency - a.latency)[0];
  const cheapestModel = [...availableModels].sort((a, b) => b.costEfficiency - a.costEfficiency)[0];
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
            title="Reasoning, code, extraction, speed, and cost in one view"
            description="Grouped bars are easier to compare than overlapping radar shapes."
            icon={RadarIcon}
            tone="violet"
          />
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { label: 'Best reasoner', value: primaryReasoner?.model || 'No model bank yet', detail: 'Highest-quality planning and ambiguity handling.' },
              { label: 'Fastest branch', value: fastestModel?.model || 'No model bank yet', detail: 'Best for speed-sensitive workflows and volume dispatch.' },
              { label: 'Most efficient', value: cheapestModel?.model || 'No model bank yet', detail: 'Best for inexpensive background work and utility jobs.' },
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
            Readback: one chart, five metrics, four model families. The winner strip tells you the default choice; the bars tell you how close the alternatives really are.
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
                    <div className="text-text-disabled">Tok / sec</div>
                    <div className="mt-1 font-mono text-text-primary">{model.tokensPerSec || 0}</div>
                  </div>
                  <div>
                    <div className="text-text-disabled">Reasoning</div>
                    <div className="mt-1 font-mono text-text-primary">{model.reasoning}</div>
                  </div>
                  <div>
                    <div className="text-text-disabled">Monthly cost</div>
                    <div className="mt-1 font-mono text-text-primary">{model.monthlyCost ? `$${model.monthlyCost}` : 'Free'}</div>
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

function KnowledgeMapTab() {
  const totalVectors = knowledgeNamespaces.reduce((sum, namespace) => sum + namespace.vectors, 0);

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
              <div className="mt-2 text-3xl font-semibold text-text-primary">{knowledgeNamespaces.length}</div>
            </div>
            <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Stale terrain</div>
              <div className="mt-2 text-3xl font-semibold text-text-primary">
                {knowledgeNamespaces.filter((namespace) => namespace.status !== 'active').length}
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
            {knowledgeNamespaces
              .slice()
              .sort((a, b) => b.vectors - a.vectors)
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
                      <div className="text-sm font-semibold text-text-primary">{namespace.size}</div>
                      <div className="mt-1 text-[11px] text-text-muted">{namespace.vectors.toLocaleString()} vectors</div>
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
          {knowledgeNamespaces.slice(0, 6).map((namespace) => (
            <div key={namespace.id} className="rounded-[24px] border border-white/8 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-text-primary">{namespace.name}</div>
                  <div className="mt-1 text-[11px] text-text-muted">{namespace.lastSync}</div>
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
                    style={{ width: `${Math.max(12, Math.min(100, (namespace.vectors / totalVectors) * 220))}%` }}
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
        {knowledgeNamespaces.length > 6 && (
          <div className="mt-4 rounded-[22px] border border-dashed border-white/10 bg-black/10 p-4 text-[12px] text-text-muted">
            {knowledgeNamespaces.length - 6} more namespaces are tracked. The terrain map is showing the strongest and largest zones first.
          </div>
        )}
      </div>
    </div>
  );
}

function DirectivesTab({ agents, tasks }) {
  const directivePressure = useMemo(() => {
    return directiveTemplates.map((directive) => ({
      ...directive,
      affected: directive.appliedTo.filter((name) => agents.some((agent) => agent.name === name)).length || directive.appliedTo.length,
      drag: directive.priority === 'critical' ? 88 : directive.priority === 'high' ? 64 : 38,
    }));
  }, [agents]);

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
              <div className="mt-2 text-3xl font-semibold text-text-primary">{directiveTemplates.length}</div>
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
            {[
              {
                title: 'Consolidate overlapping output rules',
                description: 'Several directives are describing formatting and review behavior in parallel. Centralizing that language will reduce drift and approval churn.',
                impact: 'high',
              },
              {
                title: 'Protect expensive planning lanes',
                description: 'Premium planning models should stay reserved for strategy, ambiguity, and high-risk work rather than commodity execution.',
                impact: 'critical',
              },
              {
                title: 'Lower human interrupts',
                description: 'Make high-confidence CRM and summary tasks resolve through stronger directives instead of asking for operator attention each time.',
                impact: 'normal',
              },
            ].map((recommendation) => (
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
  const { logs } = useActivityLog();
  const { humanHourlyRate } = useCommanderPreferences();

  const availableModels = useMemo(() => {
    const bankBenchmarks = models.map((model) => {
      const known = modelBenchmarks.find((entry) => entry.model === model.label || entry.model === model.modelKey);
      return known || {
        model: model.label,
        provider: model.provider || 'Custom',
        reasoning: 72,
        codeGen: 72,
        extraction: 70,
        latency: 72,
        costEfficiency: model.costPer1k > 0 ? 58 : 96,
        tokensPerSec: 0,
        contextWindow: 'Custom',
        monthlyCost: 0,
      };
    });

    return bankBenchmarks.length > 0 ? bankBenchmarks : modelBenchmarks;
  }, [models]);

  const systemSummary = useMemo(() => {
    const activeAgents = agents.filter((agent) => agent.status === 'processing').length;
    const errorAgents = agents.filter((agent) => agent.status === 'error').length;
    const localModels = availableModels.filter((model) => model.provider === 'Ollama').length;
    const directivesLive = directiveTemplates.length;
    const recommendationCount = systemRecommendations.length;
    const liveTraffic = logs.length;

    return {
      activeAgents,
      errorAgents,
      localModels,
      directivesLive,
      recommendationCount,
      liveTraffic,
    };
  }, [agents, availableModels, logs.length]);

  const derivedRecommendations = useMemo(() => {
    const runningTasks = tasks.filter((task) => task.status === 'running').length;
    const failedTasks = tasks.filter((task) => ['failed', 'error', 'blocked'].includes(task.status)).length;
    const recommendations = [...systemRecommendations];

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
  }, [tasks]);

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
    const bestReasoner = availableModels.slice().sort((a, b) => b.reasoning - a.reasoning)[0];
    const fastest = availableModels.slice().sort((a, b) => b.latency - a.latency)[0];
    const cheapest = availableModels.slice().sort((a, b) => b.costEfficiency - a.costEfficiency)[0];
    return [
      {
        eyebrow: 'Use First',
        title: bestReasoner ? `${bestReasoner.model} is the planning brain` : 'No clear planning brain yet',
        detail: bestReasoner
          ? `For ambiguity, strategy, and high-risk reasoning, this is the strongest first-choice lane right now.`
          : 'You do not have enough model data yet to pick a dominant strategy lane confidently.',
      },
      {
        eyebrow: 'Move Faster',
        title: fastest ? `${fastest.model} is the speed lane` : 'No clear speed lane yet',
        detail: fastest
          ? `This branch should be absorbing time-sensitive and repetitive work where latency matters more than maximal depth.`
          : 'More live traffic is needed before a true speed winner emerges.',
      },
      {
        eyebrow: 'Spend Smarter',
        title: cheapest ? `${cheapest.model} is the efficiency lane` : 'No clear efficiency lane yet',
        detail: cheapest
          ? `Default cheap utility work here unless the mission explicitly needs a more premium reasoning branch.`
          : 'Cost-efficiency signals are still too weak to make a hard routing doctrine call.',
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
              { label: 'directives live', value: systemSummary.directivesLive, tone: 'amber' },
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
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Knowledge zones</div>
                  <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={knowledgeNamespaces.length} /></div>
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
              {activeTab === 'knowledge' && <KnowledgeMapTab />}
              {activeTab === 'directives' && <DirectivesTab agents={agents} tasks={tasks} />}
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
