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
import { approveMissionTask, interruptAndRedirectTask, stopTask } from '../lib/api';
import { container, item } from '../utils/variants';
import { cleanupTempAgents, createPersistentSpecialist, createTempAgent, promoteAgentToPersistent, useActivityLog, useAgents, useKnowledgeNamespaces, useModelBank, useRoutingPolicies, useSharedDirectives, useSkillBank, useSpecialistLifecycle, useSystemRecommendations, useTaskInterventions, useTaskOutcomes, useTasks } from '../utils/useSupabase';
import { AnimatedNumber } from '../components/command/AnimatedNumber';
import { CommandSectionHeader } from '../components/command/CommandSectionHeader';
import { useCommanderPreferences } from '../utils/useCommanderPreferences';
import { buildFailureTriageActionDraft, getCommanderNextMove, getFailureTriageSummary, getRecurringBriefFitReadback } from '../utils/commanderAnalytics';
import { useLearningMemory } from '../utils/useLearningMemory';
import { buildConnectorActionDraft, buildDispatchActionDraft, formatFallbackStrategyLabel, getBranchConnectorPressureSummary, getFallbackStrategyDetail, getGraphContractPressureSummary, getGraphReasoningSummary, getGroupedConnectorBlockers, getLaunchReadinessPressure, getMissionDispatchPressureSummary } from '../utils/executionReadiness';
import { DoctrineCards } from '../components/command/DoctrineCards';
import { cn } from '../utils/cn';
import { TruthAuditStrip } from '../components/command/TruthAuditStrip';
import { useCommandCenterTruth } from '../utils/useCommandCenterTruth';
import { normalizeModelProvider } from '../utils/commanderPolicy';
import { getApprovalTransitionState, getDecisionNarrativeSummary, getLiveControlNarrativeSummary, getTaskControlActionMode, getTaskExecutableControlAction, getWorkflowMeta } from '../utils/missionLifecycle';
import { buildPolicyDemotionSummary, getBatchRoutingTrustSummary, getDoctrineDeltaSummary, getFleetPostureSummary, getLatestBatchCommandAudit, getObservedModelBenchmarks, getPersistentPromotionGuidance, getPolicyActionGuidance, getPolicyDeltaReadback, getSpecialistLifecycleSummary, getTradeoffCorrectiveAction, getTradeoffOutcomeSummary, rankCommanderRecommendations, scoreTaskOutcome } from '../utils/commanderAnalytics';

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
      className={`ui-panel relative overflow-hidden p-5 ${className}`}
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
          className="ui-panel p-4"
        >
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{entry.eyebrow}</div>
          <div className="mt-1.5 text-[15px] font-semibold text-text-primary">{entry.title}</div>
          <p className="mt-1.5 text-[11px] leading-5 text-text-body">{entry.detail}</p>
        </Motion.div>
      ))}
    </Motion.section>
  );
}

function OptimizationCard({ recommendation, onStageCorrectiveAction = null, onExecuteCorrectiveAction = null, actionLoading = false }) {
  const toneClass = recommendation.impact === 'critical'
    ? 'border-l-aurora-rose'
    : recommendation.impact === 'high'
      ? 'border-l-aurora-amber'
      : 'border-l-aurora-teal';
  const controlActionMode = recommendation.correctiveAction?.controlActionMode || null;

  return (
    <div className={`ui-card-row border-l-[3px] ${toneClass} p-4`}>
      <div className="flex items-start gap-3">
        <div className="ui-panel-soft flex h-10 w-10 items-center justify-center rounded-2xl">
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
          {recommendation.whyNow && (
            <div className="mt-3 ui-panel-soft px-3 py-2 text-[11px] leading-relaxed text-text-body">
              <span className="font-semibold text-text-primary">Why now:</span> {recommendation.whyNow}
            </div>
          )}
          {recommendation.correctiveAction?.label && (
            <div className="mt-3 ui-panel-soft px-3 py-2 text-[11px] leading-relaxed text-text-body">
              <span className="font-semibold text-text-primary">Corrective action:</span> {recommendation.correctiveAction.label}. {recommendation.correctiveAction.detail}
              {(recommendation.correctiveAction.targetRole || recommendation.correctiveAction.targetApprovalPosture) ? (
                <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                  Target lane: {recommendation.correctiveAction.targetRole || 'ops'}. Approval: {String(recommendation.correctiveAction.targetApprovalPosture || 'risk_weighted').replaceAll('_', ' ')}.
                </div>
              ) : null}
              {(recommendation.correctiveAction.executableAction || recommendation.correctiveAction.routeState || recommendation.correctiveAction.opsPrompt) ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {controlActionMode?.helperText ? (
                    <div className="w-full text-[10px] leading-relaxed text-text-muted">
                      {controlActionMode.helperText}
                    </div>
                  ) : null}
                  {recommendation.correctiveAction.executableAction && onExecuteCorrectiveAction ? (
                    <button
                      type="button"
                      onClick={() => onExecuteCorrectiveAction(recommendation)}
                      disabled={actionLoading}
                      className="rounded-2xl border border-aurora-teal/20 bg-aurora-teal/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-teal transition-colors hover:bg-aurora-teal/15 disabled:opacity-50"
                    >
                      {actionLoading ? 'Running action...' : recommendation.correctiveAction.executableAction.label}
                    </button>
                  ) : null}
                  {(recommendation.correctiveAction.routeState || recommendation.correctiveAction.opsPrompt) && onStageCorrectiveAction ? (
                    <button
                      type="button"
                      onClick={() => onStageCorrectiveAction(recommendation.correctiveAction)}
                      className="rounded-2xl border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-blue transition-colors hover:bg-aurora-blue/15"
                    >
                      {controlActionMode?.stageLabel || 'Stage corrective action'}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
        <ChevronRight className="mt-0.5 h-4 w-4 text-text-disabled" />
      </div>
    </div>
  );
}

function DoctrineSignalRail({ learningMemory, logs = [] }) {
  const timeline = learningMemory.doctrine
    .slice()
    .sort((a, b) => new Date(b.latestSnapshotAt || 0).getTime() - new Date(a.latestSnapshotAt || 0).getTime())
    .slice(0, 4);
  const latestBatchAudit = useMemo(() => getLatestBatchCommandAudit(logs), [logs]);
  const batchDoctrine = learningMemory?.doctrineById?.['batch-command-memory'] || null;

  return (
    <div className="space-y-4">
      {(latestBatchAudit || batchDoctrine) && (
        <div className="ui-panel-soft p-4">
          <div className="flex items-center gap-2">
            <Layers3 className="h-4 w-4 text-aurora-blue" />
            <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Batch command pressure</span>
          </div>
          {latestBatchAudit && (
            <div className="mt-4 ui-card-row px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] font-semibold text-text-primary">{latestBatchAudit.label}</div>
                <div className="text-[10px] font-mono uppercase text-aurora-blue">{latestBatchAudit.type}</div>
              </div>
              <div className="mt-2 text-[11px] leading-relaxed text-text-body">{latestBatchAudit.message}</div>
            </div>
          )}
          {batchDoctrine && (
            <div className="mt-3 ui-card-row px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] font-semibold text-text-primary">{batchDoctrine.title}</div>
                <div className="text-[10px] font-mono text-aurora-teal">{batchDoctrine.confidence}%</div>
              </div>
              <div className="mt-2 text-[11px] leading-relaxed text-text-body">{batchDoctrine.detail}</div>
            </div>
          )}
        </div>
      )}

      <div className="ui-panel-soft p-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-aurora-violet" />
          <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Doctrine drift</span>
        </div>
        <div className="mt-4 space-y-3">
          {timeline.map((item) => (
            <div key={item.id} className="ui-card-row px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[12px] font-semibold text-text-primary">{item.owner}</div>
                <div className="text-[10px] font-mono text-aurora-teal">{item.confidence}%</div>
              </div>
              <div className="mt-1 text-[11px] leading-relaxed text-text-body">{item.changeSummary}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="ui-panel-soft p-4">
        <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Memory state</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="ui-stat p-3">
            <div className="text-[10px] uppercase tracking-[0.16em] text-text-disabled">Snapshots</div>
            <div className="mt-2 text-2xl font-semibold text-text-primary">{learningMemory.history.length}</div>
          </div>
          <div className="ui-stat p-3">
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

function StrategyRail({ derivedRecommendations, learningMemory, humanHourlyRate, economics, logs = [], onStageCorrectiveAction = null, onExecuteCorrectiveAction = null, executingRecommendationId = null }) {
  const [focus, setFocus] = useState('economics');

  return (
    <div className="space-y-5">
      <div className="ui-panel p-1.5">
        <div className="ui-segmented flex flex-wrap gap-2 rounded-[20px] p-1.5">
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
                'ui-chip flex-1 rounded-[16px] px-3 py-2.5 text-[11px] font-semibold transition-all',
                focus === tab.id ? 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal' : 'text-text-muted hover:text-text-primary'
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
          description={`Baseline is $${humanHourlyRate}/hour.`}
          accent="amber"
        >
          <CommandSectionHeader
            eyebrow="Command Economics"
            title="What the stack is actually buying"
            description="Quick economics read."
            icon={TrendingUp}
            tone="amber"
          />
          <div className="mt-5 grid gap-3">
            <div className="ui-stat p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Human equivalent</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary">
                <AnimatedNumber value={economics.humanCost} prefix="$" decimals={2} />
              </div>
            </div>
            <div className="ui-stat p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Agent spend</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary">
                <AnimatedNumber value={economics.agentCost} prefix="$" decimals={2} />
              </div>
            </div>
            <div className="ui-stat p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Savings</div>
                  <div className={`mt-2 text-lg font-semibold leading-none ${economics.savings >= 0 ? 'text-aurora-teal' : 'text-aurora-rose'}`}>
                    <AnimatedNumber value={Math.abs(economics.savings)} prefix={economics.savings >= 0 ? '$' : '-$'} decimals={2} />
                  </div>
                </div>
                <div className="min-w-0 border-l border-hairline pl-4">
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
          description="The strongest live signals."
          accent="violet"
        >
            <CommandSectionHeader
              eyebrow="Doctrine Stack"
              title="Three live beliefs"
            description="Three live beliefs."
            icon={Sparkles}
            tone="violet"
          />
            <DoctrineCards items={learningMemory.doctrine.slice(0, 3)} columns="one" />
          </HudPanel>
          <DoctrineSignalRail learningMemory={learningMemory} logs={logs} />
        </>
      )}

      {focus === 'orders' && (
        <HudPanel
          eyebrow="Optimization Orders"
          title="Where to tighten the stack"
          description="Three high-leverage moves."
          accent="blue"
        >
          <CommandSectionHeader
            eyebrow="Command Orders"
            title="Three system moves"
            description="Highest leverage next."
            icon={Gauge}
            tone="teal"
          />
          <div className="mt-5 space-y-3">
            {derivedRecommendations.slice(0, 2).map((recommendation) => (
              <OptimizationCard
                key={recommendation.id}
                recommendation={recommendation}
                onStageCorrectiveAction={onStageCorrectiveAction}
                onExecuteCorrectiveAction={onExecuteCorrectiveAction}
                actionLoading={executingRecommendationId === recommendation.id}
              />
            ))}
          </div>
        </HudPanel>
      )}
    </div>
  );
}

function StrategicKpi({ label, detail, tone = 'teal', icon, valueNode }) {
  const KpiIcon = icon;
  const toneStyles = {
    teal: 'text-aurora-teal border-aurora-teal/20 bg-aurora-teal/8',
    amber: 'text-aurora-amber border-aurora-amber/20 bg-aurora-amber/8',
    rose: 'text-aurora-rose border-aurora-rose/20 bg-aurora-rose/8',
    blue: 'text-aurora-blue border-aurora-blue/20 bg-aurora-blue/8',
  };

  return (
    <div className="ui-panel p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.22em] text-text-muted">{label}</span>
        <div className={`rounded-xl border px-2.5 py-2 ${toneStyles[tone]}`}>
          <KpiIcon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-3 text-[30px] font-semibold tracking-tight text-text-primary">{valueNode}</div>
      <p className="mt-1.5 text-[11px] leading-5 text-text-muted">{detail}</p>
    </div>
  );
}

function SystemsOperatorTable({ models }) {
  return (
    <div className="ui-panel p-4">
      <CommandSectionHeader
        eyebrow="Model Roles"
        title="Which branch wins which role"
        description="Simple ranked answers instead of more floating cards."
        icon={Cpu}
        tone="blue"
      />
      <div className="mt-4 overflow-hidden rounded-[20px] border border-hairline bg-panel-soft">
        <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr] border-b border-hairline px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-text-muted">
          <div>Model</div>
          <div>Reliability</div>
          <div>Cost discipline</div>
        </div>
        {models.length === 0 ? (
          <div className="px-4 py-6 text-sm text-text-muted">
            No live model data yet.
          </div>
        ) : (
          models.slice(0, 5).map((model, index) => (
            <div
              key={model.model}
              className={`grid grid-cols-[1.4fr_0.9fr_0.9fr] px-4 py-2.5 text-[13px] ${index !== Math.min(models.length, 5) - 1 ? 'border-b border-hairline' : ''}`}
            >
              <div className="font-semibold text-text-primary">{model.model}</div>
              <div className="text-text-body">{model.reliability}</div>
              <div className="text-text-body">{model.costDiscipline}</div>
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
    <div className="ui-panel p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{eyebrow}</div>
          <div className="mt-1 text-base font-semibold text-text-primary">{title}</div>
          <div className="mt-1 text-[11px] leading-5 text-text-muted">{summary}</div>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="ui-button-secondary rounded-xl px-3 py-2 text-[11px] font-semibold text-text-primary transition-colors hover:bg-white/[0.06]"
        >
          {open ? 'Hide' : 'Open'}
        </button>
      </div>
      {open ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function IntelligenceHeaderChip({ label, value, tone = 'teal' }) {
  const tones = {
    teal: 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal',
    amber: 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber',
    blue: 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue',
  };

  return (
    <div className={`ui-chip rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${tones[tone]}`}>
      {value} {label}
    </div>
  );
}

function IntelligenceHeader({ activeTab, setActiveTab, systemSummary, availableModels, truth }) {
  return (
    <div className="ui-shell p-5">
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
        <div>
          <div className="text-[10px] uppercase tracking-[0.22em] text-text-muted">Strategic Systems</div>
          <h1 className="mt-2 text-[clamp(1.8rem,2.5vw,2.55rem)] font-semibold tracking-[-0.04em] text-text-primary">Strategic Systems</h1>
          <p className="mt-2 max-w-xl text-[13px] leading-5 text-text-muted">A clean board for models, routing, and system efficiency.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <IntelligenceHeaderChip label="models online" value={availableModels.length} tone="teal" />
            <IntelligenceHeaderChip label="active agents" value={systemSummary.activeAgents} tone="blue" />
            <IntelligenceHeaderChip label="routed missions" value={systemSummary.routedMissions} tone="amber" />
          </div>
        </div>
        <div className="ui-panel p-4">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-[0.18em] text-text-muted">System Controls</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-aurora-teal">Live</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`ui-chip rounded-xl border px-3 py-2 text-[11px] font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal'
                    : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {tab.label.replace('Model Command Matrix', 'Models').replace('Routing Doctrine', 'Routing').replace('Knowledge Terrain', 'Knowledge').replace('Directive Pressure', 'Directives')}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="ui-stat p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Recommendations</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={systemSummary.recommendationCount} /></div>
            </div>
            <div className="ui-stat p-3">
              <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Connected systems</div>
              <div className="mt-2 text-2xl font-semibold text-text-primary"><AnimatedNumber value={truth.connectedSystemsCount} /></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ModelRegistryTab({ availableModels, agents, tasks, logs, interventions, learningMemory }) {
  const [detailView, setDetailView] = useState('constellation');
  const radarSelection = availableModels.slice(0, 4);
  const observedBenchmarks = useMemo(() => getObservedModelBenchmarks(tasks, agents, logs, interventions).slice(0, 6), [tasks, agents, logs, interventions]);
  const batchRoutingTrust = useMemo(() => getBatchRoutingTrustSummary({ logs, doctrineItem: learningMemory?.doctrineById?.['batch-command-memory'] || null }), [logs, learningMemory]);

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
        <div className="ui-panel p-2">
          <div className="ui-segmented flex flex-wrap gap-2 p-2">
            {[
              { id: 'constellation', label: 'Constellation' },
              { id: 'load', label: 'Load' },
              { id: 'benchmarks', label: 'Benchmarks' },
              { id: 'registry', label: 'Registry' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDetailView(tab.id)}
                className={cn(
                  'ui-chip flex-1 rounded-[16px] px-4 py-2.5 text-[12px] font-semibold transition-all',
                  detailView === tab.id ? 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal' : 'text-text-muted hover:text-text-primary'
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
              <div key={card.label} className="ui-panel p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{card.label}</div>
                <div className="mt-2 text-sm font-semibold text-text-primary">{card.value}</div>
                <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{card.detail}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-3">
            <div className="ui-panel p-4">
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
              <div className="ui-panel-soft border border-dashed border-hairline p-6 text-center">
                <div className="text-sm font-semibold text-text-primary">No mission load yet.</div>
                <p className="mt-2 text-[12px] leading-relaxed text-text-muted">Once tasks start routing through model families, this wall will rank them by traffic share and show the dominant lane immediately.</p>
              </div>
            ) : (
              modelLoad.map((entry, index) => (
                <div key={entry.name} className="ui-panel p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="ui-panel-soft flex h-9 w-9 items-center justify-center rounded-2xl text-xs font-semibold text-text-primary">
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

        {detailView === 'benchmarks' && (
        <HudPanel
          eyebrow="Observed Benchmarks"
          title="Which model lanes are actually winning"
          description="Benchmarks score real routed missions by quality, success, speed, and spend discipline."
          accent="amber"
        >
          <CommandSectionHeader
            eyebrow="Observed Winners"
            title="Live model benchmark board"
            description="Use real outcomes to steer doctrine instead of static assumptions."
            icon={Gauge}
            tone="amber"
          />
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              { label: 'Top benchmark', value: observedBenchmarks[0]?.model || 'No benchmark data yet', detail: observedBenchmarks[0] ? `${observedBenchmarks[0].provider} is leading with score ${observedBenchmarks[0].benchmarkScore}.` : 'Run more routed missions to establish a clear winner.' },
              { label: 'Highest quality', value: [...observedBenchmarks].sort((a, b) => b.avgQuality - a.avgQuality)[0]?.model || 'No benchmark data yet', detail: 'Quality favors completion quality, trust, and clean routing posture.' },
              { label: 'Best value', value: [...observedBenchmarks].sort((a, b) => b.costScore - a.costScore)[0]?.model || 'No benchmark data yet', detail: 'Value favors low-cost lanes that still close work reliably.' },
            ].map((card) => (
              <div key={card.label} className="ui-panel p-4">
                <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{card.label}</div>
                <div className="mt-2 text-sm font-semibold text-text-primary">{card.value}</div>
                <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{card.detail}</p>
              </div>
            ))}
          </div>
          {batchRoutingTrust.available && (
            <div className="mt-4 rounded-2xl border border-aurora-teal/15 bg-aurora-teal/[0.05] px-3 py-2 text-[11px] text-text-body">
              Routing trust readback: <span className="font-semibold text-aurora-teal">{batchRoutingTrust.title}</span> {batchRoutingTrust.detail}
            </div>
          )}
          <div className="mt-5 space-y-3">
            {observedBenchmarks.length === 0 ? (
              <div className="ui-panel-soft border border-dashed border-hairline p-6 text-center">
                <div className="text-sm font-semibold text-text-primary">No observed benchmark data yet.</div>
                <p className="mt-2 text-[12px] leading-relaxed text-text-muted">This board fills in as Commander accumulates more routed mission outcomes.</p>
              </div>
            ) : (
              observedBenchmarks.map((entry, index) => (
                <div key={entry.key} className="ui-panel p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="ui-panel-soft flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold text-text-primary">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-semibold text-text-primary">{entry.model}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-text-muted">{entry.provider}</div>
                    </div>
                    <div className="rounded-full border border-aurora-amber/20 bg-aurora-amber/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-aurora-amber">
                      Score {entry.benchmarkScore}
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] md:grid-cols-5">
                    <div>
                      <div className="text-text-disabled">Runs</div>
                      <div className="mt-1 font-mono text-text-primary">{entry.runs}</div>
                    </div>
                    <div>
                      <div className="text-text-disabled">Quality</div>
                      <div className="mt-1 font-mono text-text-primary">{entry.avgQuality}</div>
                    </div>
                    <div>
                      <div className="text-text-disabled">Success</div>
                      <div className="mt-1 font-mono text-text-primary">{entry.successRate}%</div>
                    </div>
                    <div>
                      <div className="text-text-disabled">Avg cost</div>
                      <div className="mt-1 font-mono text-text-primary">${entry.avgCost.toFixed(2)}</div>
                    </div>
                    <div>
                      <div className="text-text-disabled">Speed</div>
                      <div className="mt-1 font-mono text-text-primary">{entry.speedScore}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </HudPanel>
        )}

        {detailView === 'registry' && (
        <div className="ui-panel p-5">
          <CommandSectionHeader
            eyebrow="Registry"
            title="Model command matrix"
            description="Keep the strongest lanes visible and the rest behind the curtain."
            icon={Cpu}
            tone="teal"
          />
          <div className="mt-4 space-y-3">
            {availableModels.length === 0 && (
              <div className="ui-panel p-4 text-sm text-text-muted">
                Your model bank is empty. Add models from agent creation or config before using the registry.
              </div>
            )}
            {availableModels.slice(0, 6).map((model) => (
              <div key={model.model} className="ui-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <CircleDot className="h-3.5 w-3.5" style={{ color: modelColors[model.model] || '#2dd4bf' }} />
                      <span className="text-sm font-semibold text-text-primary">{model.model}</span>
                    </div>
                    <div className="mt-1 text-[11px] text-text-muted">{model.provider}</div>
                  </div>
                  <span className="ui-chip px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
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
              <div className="ui-panel-soft border border-dashed border-hairline p-4 text-[12px] text-text-muted">
                {availableModels.length - 6} more models are available in the bank. This view is keeping the highest-signal lanes up front.
              </div>
            )}
          </div>
        </div>
        )}
    </div>
  );
}

function RoutingDoctrineTab({ routingPolicies, tasks, agents, logs, interventions, lifecycleEvents, skills, upsertPolicy, ensureDefaultPolicy, routeState = null, onConsumeRouteState = null }) {
  const [selectedPolicyId, setSelectedPolicyId] = useState('');
  const [policyActionContext, setPolicyActionContext] = useState(null);
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

  useEffect(() => {
    if (!routeState?.selectedPolicyId || !routingPolicies.length) return;
    const selected = routingPolicies.find((policy) => policy.id === routeState.selectedPolicyId);
    if (!selected) return;

    setSelectedPolicyId(selected.id);
    setPolicyActionContext(routeState.actionContext || null);
    setDraft((current) => {
      const nextDraft = { ...(current?.id === selected.id ? current : selected) };
      const adjustmentAllowed = routeState.actionContext?.enabled ?? true;
      if (routeState.adjustment === 'harden' && adjustmentAllowed) {
        nextDraft.approvalRule = nextDraft.approvalRule === 'auto_low_risk' ? 'risk_weighted' : 'human_required';
      } else if (routeState.adjustment === 'loosen' && adjustmentAllowed) {
        nextDraft.approvalRule = nextDraft.approvalRule === 'human_required' ? 'risk_weighted' : 'auto_low_risk';
      }
      if (routeState.providerSwap) {
        nextDraft.preferredProvider = routeState.providerSwap;
      }
      if (routeState.modelSwap) {
        nextDraft.preferredModel = routeState.modelSwap;
      }
      if (typeof routeState.evidenceRequired === 'boolean') {
        nextDraft.evidenceRequired = routeState.evidenceRequired;
      }
      if (routeState.contextPolicy) {
        nextDraft.contextPolicy = routeState.contextPolicy;
      }
      if (routeState.stageFallback && routeState.fallbackSwap) {
        const existingFallbacks = Array.isArray(nextDraft.fallbackOrder) ? [...nextDraft.fallbackOrder] : [];
        const fallbackEntry = {
          role: nextDraft.preferredAgentRole || 'executor',
          provider: routeState.fallbackSwap.provider || nextDraft.preferredProvider || 'Anthropic',
          model: routeState.fallbackSwap.model || '',
        };
        const alreadyPresent = existingFallbacks.some((entry) => entry.provider === fallbackEntry.provider && entry.model === fallbackEntry.model && entry.role === fallbackEntry.role);
        if (!alreadyPresent) {
          existingFallbacks.unshift(fallbackEntry);
          nextDraft.fallbackOrder = existingFallbacks;
        }
      }
      return nextDraft;
    });
    onConsumeRouteState?.();
  }, [routeState, routingPolicies, onConsumeRouteState]);

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
  const launchReadinessPressure = useMemo(
    () => getLaunchReadinessPressure(interventions),
    [interventions]
  );

  const contextDemand = useMemo(() => {
    const counts = new Map();
    tasks.forEach((task) => {
      (task.contextPackIds || []).forEach((packId) => {
        counts.set(packId, (counts.get(packId) || 0) + 1);
      });
    });

    return Array.from(counts.entries())
      .map(([packId, count]) => ({ packId, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [tasks]);

  const observedBestLanes = useMemo(() => {
    const grouped = new Map();
    tasks
      .filter((task) => ['completed', 'done'].includes(String(task.status || '').toLowerCase()) || task.workflowStatus === 'completed')
      .forEach((task) => {
        const agent = agents.find((candidate) => candidate.id === task.agentId);
        const key = `${task.domain || 'general'}::${task.intentType || 'general'}`;
        const current = grouped.get(key) || [];
        current.push({
          lane: `${agent?.name || task.agentRole || 'unassigned'} · ${agent?.model || task.modelOverride || 'adaptive'}`,
          cost: Number(task.costUsd || 0),
          quality: scoreTaskOutcome(task).score,
        });
        grouped.set(key, current);
      });

    return Array.from(grouped.entries())
      .map(([key, entries]) => {
        const laneGroups = new Map();
        entries.forEach((entry) => {
          const current = laneGroups.get(entry.lane) || { lane: entry.lane, count: 0, totalCost: 0, totalQuality: 0 };
          current.count += 1;
          current.totalCost += entry.cost;
          current.totalQuality += entry.quality;
          laneGroups.set(entry.lane, current);
        });
        const ranked = Array.from(laneGroups.values()).sort((left, right) => {
          const leftQuality = left.count ? left.totalQuality / left.count : 0;
          const rightQuality = right.count ? right.totalQuality / right.count : 0;
          if (rightQuality !== leftQuality) return rightQuality - leftQuality;
          if (right.count !== left.count) return right.count - left.count;
          return left.totalCost - right.totalCost;
        });
        const [domain, intentType] = key.split('::');
        return {
          domain,
          intentType,
          winner: ranked[0] ? { ...ranked[0], avgQuality: Math.round(ranked[0].totalQuality / ranked[0].count) } : null,
          runnersUp: ranked.slice(1, 3),
          sampleCount: entries.length,
        };
      })
      .filter((entry) => entry.winner)
      .sort((left, right) => right.sampleCount - left.sampleCount)
      .slice(0, 6);
  }, [agents, tasks]);

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
  const demotionSummary = useMemo(() => buildPolicyDemotionSummary(draft, tasks, interventions, logs), [draft, tasks, interventions, logs]);
  const policyDelta = useMemo(() => getPolicyDeltaReadback(draft, tasks, interventions, logs), [draft, tasks, interventions, logs]);
  const policyActionGuidance = useMemo(() => getPolicyActionGuidance(draft, tasks, interventions, logs, agents), [draft, tasks, interventions, logs, agents]);
  const trendTone = demotionSummary.trend === 'improving'
    ? 'text-aurora-teal border-aurora-teal/20 bg-aurora-teal/10'
    : demotionSummary.trend === 'demoted'
      ? 'text-aurora-rose border-aurora-rose/20 bg-aurora-rose/10'
      : demotionSummary.trend === 'forming'
        ? 'text-aurora-amber border-aurora-amber/20 bg-aurora-amber/10'
        : 'text-aurora-blue border-aurora-blue/20 bg-aurora-blue/10';

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
            <div key={metric.label} className="ui-panel p-4">
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
        <div className="ui-panel p-5">
          <CommandSectionHeader
            eyebrow="Policy Stack"
            title="Routing policies in command"
            description="Default first, overrides second, now editable instead of just observable."
            icon={Layers3}
            tone="blue"
          />
          <div className="mt-4 space-y-3">
            {routingPolicies.length === 0 && (
              <div className="ui-panel-soft border border-dashed border-hairline p-5 text-sm text-text-muted">
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
            {routingPolicies.map((policy) => {
              const listDelta = getPolicyDeltaReadback(policy, tasks, interventions, logs);
              return (
              <button
                key={policy.id}
                type="button"
                onClick={() => setSelectedPolicyId(policy.id)}
                className={cn(
                  'ui-card-row w-full p-4 text-left transition-colors',
                  selectedPolicyId === policy.id ? 'border-aurora-teal/30 bg-aurora-teal/[0.06] shadow-glow-teal' : 'hover:border-hairline-strong'
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
                  <div className="ui-chip px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
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
                <div className={cn(
                  'mt-3 rounded-2xl border px-3 py-2 text-[11px]',
                  listDelta.tone === 'teal'
                    ? 'border-aurora-teal/15 bg-aurora-teal/[0.05] text-text-body'
                    : listDelta.tone === 'amber'
                      ? 'border-aurora-amber/15 bg-aurora-amber/[0.05] text-text-body'
                      : 'border-white/[0.08] bg-white/[0.03] text-text-body'
                )}>
                  <span className="font-semibold text-text-primary">{listDelta.title}.</span> {listDelta.providerDelta}, {listDelta.modelDelta}, {listDelta.approvalDelta}.
                </div>
              </button>
              );
            })}
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
              <div className="ui-panel p-4 text-[12px] text-text-muted">
                Select a routing policy to edit it here.
              </div>
            )}
            {draft && (
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="ui-panel-soft p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Task domain</div>
                    <select
                      value={draft.taskDomain || 'general'}
                      onChange={(event) => updateDraft('taskDomain', event.target.value)}
                      className="ui-input mt-2 w-full bg-transparent px-3 py-2 text-sm font-semibold text-text-primary"
                    >
                      {['general', 'build', 'research', 'ops', 'crm', 'finance', 'personal'].map((domain) => (
                        <option key={domain} value={domain} className="bg-[#0d1015]">{domain}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-panel-soft p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Intent type</div>
                    <select
                      value={draft.intentType || 'general'}
                      onChange={(event) => updateDraft('intentType', event.target.value)}
                      className="ui-input mt-2 w-full bg-transparent px-3 py-2 text-sm font-semibold text-text-primary"
                    >
                      {['general', 'planning', 'research', 'execution', 'verification', 'reporting'].map((intent) => (
                        <option key={intent} value={intent} className="bg-[#0d1015]">{intent}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-panel-soft p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Policy name</div>
                    <input
                      value={draft.name || ''}
                      onChange={(event) => updateDraft('name', event.target.value)}
                      className="ui-input mt-2 w-full bg-transparent px-3 py-2 text-sm font-semibold text-text-primary"
                    />
                  </label>
                  <label className="ui-panel-soft p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Preferred role</div>
                    <select
                      value={draft.preferredAgentRole || 'commander'}
                      onChange={(event) => updateDraft('preferredAgentRole', event.target.value)}
                      className="ui-input mt-2 w-full bg-transparent px-3 py-2 text-sm font-semibold text-text-primary"
                    >
                      {['commander', 'planner', 'researcher', 'builder', 'verifier', 'executor'].map((role) => (
                        <option key={role} value={role} className="bg-[#0d1015]">{role}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-panel-soft p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Preferred provider</div>
                    <select
                      value={draft.preferredProvider || 'Anthropic'}
                      onChange={(event) => updateDraft('preferredProvider', event.target.value)}
                      className="ui-input mt-2 w-full bg-transparent px-3 py-2 text-sm font-semibold text-text-primary"
                    >
                      {['Anthropic', 'OpenAI', 'Google', 'Ollama', 'Custom'].map((provider) => (
                        <option key={provider} value={provider} className="bg-[#0d1015]">{provider}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-panel-soft p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Preferred model</div>
                    <select
                      value={draft.preferredModel || ''}
                      onChange={(event) => updateDraft('preferredModel', event.target.value)}
                      className="ui-input mt-2 w-full bg-transparent px-3 py-2 text-sm font-semibold text-text-primary"
                    >
                      <option value="" className="bg-[#0d1015]">No hard override</option>
                      {modelOptions.map((model) => (
                        <option key={model.model} value={model.model} className="bg-[#0d1015]">{model.model}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-panel-soft p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Approval rule</div>
                    <select
                      value={draft.approvalRule || 'risk_weighted'}
                      onChange={(event) => updateDraft('approvalRule', event.target.value)}
                      className="ui-input mt-2 w-full bg-transparent px-3 py-2 text-sm font-semibold text-text-primary"
                    >
                      {['risk_weighted', 'human_required', 'auto_low_risk'].map((rule) => (
                        <option key={rule} value={rule} className="bg-[#0d1015]">{rule}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-panel-soft p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Parallelization</div>
                    <select
                      value={draft.parallelizationPolicy || 'adaptive'}
                      onChange={(event) => updateDraft('parallelizationPolicy', event.target.value)}
                      className="ui-input mt-2 w-full bg-transparent px-3 py-2 text-sm font-semibold text-text-primary"
                    >
                      {['adaptive', 'parallel_first', 'sequential_first'].map((policy) => (
                        <option key={policy} value={policy} className="bg-[#0d1015]">{policy}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-panel-soft p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Context policy</div>
                    <select
                      value={draft.contextPolicy || 'minimal'}
                      onChange={(event) => updateDraft('contextPolicy', event.target.value)}
                      className="ui-input mt-2 w-full bg-transparent px-3 py-2 text-sm font-semibold text-text-primary"
                    >
                      {['minimal', 'balanced', 'max_context'].map((policy) => (
                        <option key={policy} value={policy} className="bg-[#0d1015]">{policy}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-panel-soft p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Budget class</div>
                    <select
                      value={draft.budgetClass || 'balanced'}
                      onChange={(event) => updateDraft('budgetClass', event.target.value)}
                      className="ui-input mt-2 w-full bg-transparent px-3 py-2 text-sm font-semibold text-text-primary"
                    >
                      {['lean', 'balanced', 'premium'].map((budget) => (
                        <option key={budget} value={budget} className="bg-[#0d1015]">{budget}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ui-panel-soft p-3">
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
                <label className="ui-panel-soft p-3 block">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Description</div>
                  <textarea
                    value={draft.description || ''}
                    onChange={(event) => updateDraft('description', event.target.value)}
                    className="ui-input mt-2 min-h-[88px] w-full bg-transparent px-3 py-2 text-[12px] leading-relaxed text-text-primary"
                  />
                </label>
                <label className="flex items-center gap-3 ui-panel-soft p-3">
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
                <div className="ui-panel-soft p-3">
                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      { label: 'Policy reach', value: matchingTasks.length, hint: 'matching tasks' },
                      { label: 'Fallback lanes', value: (draft.fallbackOrder || []).length, hint: 'backup routes' },
                      { label: 'Evidence mode', value: draft.evidenceRequired ? 'On' : 'Off', hint: 'pre-execution proof' },
                      { label: 'Parallel bias', value: draft.parallelizationPolicy || 'adaptive', hint: 'execution posture' },
                    ].map((entry) => (
                      <div key={entry.label} className="ui-card-row px-3 py-3">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{entry.label}</div>
                        <div className="mt-2 text-sm font-semibold text-text-primary">{entry.value}</div>
                        <div className="mt-1 text-[10px] text-text-disabled">{entry.hint}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="ui-panel-soft p-3">
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
                      <div className="ui-panel-soft border border-dashed border-hairline px-3 py-3 text-[11px] text-text-muted">
                        No explicit fallback lanes yet. Commander will rely on the preferred lane and general heuristics.
                      </div>
                    )}
                    {(draft.fallbackOrder || []).map((entry, index) => (
                      <div key={`${entry.role || 'lane'}-${index}`} className="ui-card-row p-3">
                        <div className="grid gap-3 md:grid-cols-[0.9fr_0.9fr_1fr_auto]">
                          <label>
                            <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Role</div>
                            <select
                              value={entry.role || 'executor'}
                              onChange={(event) => updateFallback(index, 'role', event.target.value)}
                              className="ui-input mt-2 w-full bg-transparent px-3 py-2 text-[12px] font-semibold text-text-primary"
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
                              className="ui-input mt-2 w-full bg-transparent px-3 py-2 text-[12px] font-semibold text-text-primary"
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
                              className="ui-input mt-2 w-full bg-transparent px-3 py-2 text-[12px] font-semibold text-text-primary"
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
                <div className="ui-card-row border-aurora-blue/15 bg-aurora-blue/[0.05] p-3">
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
                <div className={cn(
                  'ui-card-row p-3',
                  policyDelta.tone === 'teal'
                    ? 'border-aurora-teal/15 bg-aurora-teal/[0.05]'
                    : policyDelta.tone === 'amber'
                      ? 'border-aurora-amber/15 bg-aurora-amber/[0.05]'
                      : 'border-white/[0.08] bg-white/[0.03]'
                )}>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Policy delta readback</div>
                  <div className="mt-2 text-[12px] font-semibold text-text-primary">{policyDelta.title}</div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    {[
                      { label: 'Provider', value: policyDelta.providerDelta },
                      { label: 'Model', value: policyDelta.modelDelta },
                      { label: 'Approval', value: policyDelta.approvalDelta },
                    ].map((entry) => (
                      <div key={entry.label} className="ui-panel-soft px-3 py-2">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{entry.label}</div>
                        <div className="mt-1 text-[11px] font-semibold text-text-primary">{entry.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-[11px] leading-relaxed text-text-body">{policyDelta.detail}</div>
                </div>
                {policyActionContext ? (
                  <div className="ui-card-row border-aurora-violet/15 bg-aurora-violet/[0.05] p-3">
                    <div className="text-[10px] uppercase tracking-[0.16em] text-aurora-violet">Incoming action evidence</div>
                    <div className="mt-2 text-[12px] font-semibold text-text-primary">{policyActionContext.label || 'Open policy'}</div>
                    <div className="mt-2 text-[11px] leading-relaxed text-text-body">{policyActionContext.detail}</div>
                    {routeState?.providerSwap || routeState?.modelSwap ? (
                      <div className="mt-3 ui-panel-soft px-3 py-2 text-[11px] text-text-body">
                        Commander staged {routeState.providerSwap || draft.preferredProvider || 'adaptive'} / {routeState.modelSwap || draft.preferredModel || 'adaptive model'} into this draft from the summary surface.
                      </div>
                    ) : null}
                    {policyActionContext.currentLane && policyActionContext.suggestedLane ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        <div className="ui-panel-soft px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Current lane</div>
                          <div className="mt-1 text-[12px] font-semibold text-text-primary">{policyActionContext.currentLane.provider} / {policyActionContext.currentLane.model}</div>
                          <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                            Benchmark {policyActionContext.currentLane.benchmarkScore} • Quality {policyActionContext.currentLane.avgQuality} • Success {policyActionContext.currentLane.successRate}% • Avg interventions {policyActionContext.currentLane.avgInterventions}
                          </div>
                        </div>
                        <div className="ui-panel-soft px-3 py-3">
                          <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-blue">Suggested lane</div>
                          <div className="mt-1 text-[12px] font-semibold text-text-primary">{policyActionContext.suggestedLane.provider} / {policyActionContext.suggestedLane.model}</div>
                          <div className="mt-2 text-[11px] leading-relaxed text-text-muted">
                            Benchmark {policyActionContext.suggestedLane.benchmarkScore} • Quality {policyActionContext.suggestedLane.avgQuality} • Success {policyActionContext.suggestedLane.successRate}% • Avg interventions {policyActionContext.suggestedLane.avgInterventions}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {policyActionContext.comparison ? (
                      <div className="mt-3 ui-panel-soft px-3 py-3 text-[11px] text-text-body">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                          {policyActionContext.intent === 'safer'
                            ? 'Safety threshold'
                            : policyActionContext.intent === 'cheaper'
                              ? 'Cost threshold'
                              : policyActionContext.intent === 'faster'
                                ? 'Speed threshold'
                                : 'Performance threshold'}
                        </div>
                        <div className="mt-1 font-semibold text-text-primary">{policyActionContext.thresholdLabel}</div>
                        <div className="mt-2 leading-relaxed text-text-muted">
                          Benchmark delta {policyActionContext.comparison.benchmarkDelta ?? 'n/a'} • Quality delta {policyActionContext.comparison.qualityDelta ?? 'n/a'} • Intervention delta {policyActionContext.comparison.interventionDelta ?? 'n/a'} • Cost delta {policyActionContext.comparison.costDelta ?? 'n/a'} • Time delta {policyActionContext.comparison.durationDeltaMinutes ?? 'n/a'}m
                        </div>
                        {policyActionContext.signal ? (
                          <div className="mt-2 text-aurora-blue">{policyActionContext.signal}</div>
                        ) : null}
                        {routeState?.stageFallback ? (
                          <div className="mt-2 text-text-body">
                            Commander also staged the previous lane into fallback order so this swap stays reversible.
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    {(policyActionContext.evidence || policyActionGuidance.evidence).length ? (
                      <div className="mt-3 grid gap-2 md:grid-cols-2">
                        {(policyActionContext.evidence || policyActionGuidance.evidence).slice(0, 4).map((entry) => (
                          <div key={entry} className="ui-panel-soft px-3 py-2 text-[11px] text-text-muted">
                            {entry}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {policyActionContext.expectedImpact ? (
                      <div className="mt-3 space-y-3">
                        {policyActionContext.postureComparison ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            <div className="ui-panel-soft px-3 py-3 text-[11px] text-text-body">
                              <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Current posture</div>
                              <div className="mt-2 leading-relaxed">{policyActionContext.postureComparison.current}</div>
                            </div>
                            <div className="ui-panel-soft px-3 py-3 text-[11px] text-text-body">
                              <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-blue">Proposed posture</div>
                              <div className="mt-2 leading-relaxed">{policyActionContext.postureComparison.proposed}</div>
                            </div>
                          </div>
                        ) : null}
                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="ui-panel-soft px-3 py-3 text-[11px] text-text-body">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-teal">Expected improvement</div>
                            <div className="mt-2 leading-relaxed">{policyActionContext.expectedImpact.primary}</div>
                          </div>
                          <div className="ui-panel-soft px-3 py-3 text-[11px] text-text-body">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-amber">Expected tradeoff</div>
                            <div className="mt-2 leading-relaxed">{policyActionContext.expectedImpact.tradeoff}</div>
                          </div>
                        </div>
                        {policyActionContext.doctrineImpact ? (
                          <div className="ui-panel-soft px-3 py-3 text-[11px] text-text-body">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-violet">Doctrine confidence impact</div>
                            <div className="mt-2 leading-relaxed">{policyActionContext.doctrineImpact.confidence}</div>
                            <div className="mt-1 leading-relaxed text-text-muted">{policyActionContext.doctrineImpact.trust}</div>
                          </div>
                        ) : null}
                        {policyActionContext.verificationImpact ? (
                          <div className="ui-panel-soft px-3 py-3 text-[11px] text-text-body">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-blue">Recommended verification</div>
                            <div className="mt-2 font-semibold leading-relaxed text-text-primary">{policyActionContext.verificationImpact.threshold}</div>
                            <div className="mt-1 leading-relaxed text-text-muted">{policyActionContext.verificationImpact.detail}</div>
                          </div>
                        ) : null}
                        {policyActionContext.successCriteria?.length ? (
                          <div className="ui-panel-soft px-3 py-3 text-[11px] text-text-body">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-green">Success criteria</div>
                            <div className="mt-2 leading-relaxed text-text-muted">
                              {policyActionContext.successCriteria.slice(0, 3).map((entry) => `• ${entry}`).join(' ')}
                            </div>
                          </div>
                        ) : null}
                        {policyActionContext.rollbackCriteria?.length ? (
                          <div className="ui-panel-soft px-3 py-3 text-[11px] text-text-body">
                            <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-rose">Rollback criteria</div>
                            <div className="mt-2 leading-relaxed text-text-muted">
                              {policyActionContext.rollbackCriteria.slice(0, 3).map((entry) => `• ${entry}`).join(' ')}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="ui-panel-soft p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Policy trend and demotion pressure</div>
                      <div className="mt-1 text-[11px] text-text-muted">
                        {demotionSummary.interventionCount > 0
                          ? `${demotionSummary.interventionCount} intervention signals are shaping this policy across ${demotionSummary.matchingRuns} matching run${demotionSummary.matchingRuns === 1 ? '' : 's'}.`
                          : 'This policy has not accumulated enough intervention pressure to rank as weak yet.'}
                      </div>
                    </div>
                    <span className={cn('rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]', trendTone)}>
                      {demotionSummary.trend}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    {[
                      { label: 'Confidence', value: demotionSummary.confidence },
                      { label: 'Recent quality', value: demotionSummary.recentOutcome || 'n/a' },
                      { label: 'Recent rescue rate', value: demotionSummary.recentInterventionRate || 0 },
                      { label: 'Trend delta', value: demotionSummary.trendDelta },
                    ].map((entry) => (
                      <div key={entry.label} className="ui-stat px-3 py-2">
                        <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{entry.label}</div>
                        <div className="mt-1 text-[12px] font-semibold text-text-primary">{entry.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 ui-stat px-3 py-2 text-[11px] text-text-body">
                    {demotionSummary.trendDetail}
                  </div>
                  <div className="mt-3 grid gap-3 xl:grid-cols-2">
                    <div className="ui-card-row border-aurora-teal/15 bg-aurora-teal/[0.05] p-3">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-teal">Why this lane still wins</div>
                      <div className="mt-2 space-y-2">
                        {demotionSummary.laneStrengths.length === 0 && (
                          <div className="text-[11px] text-text-muted">Commander still needs more matching runs before this lane has a durable strength signature.</div>
                        )}
                        {demotionSummary.laneStrengths.map((reason) => (
                          <div key={reason} className="ui-panel-soft px-3 py-2 text-[11px] text-text-body">
                            {reason}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="ui-card-row border-aurora-amber/15 bg-aurora-amber/[0.05] p-3">
                      <div className="text-[10px] uppercase tracking-[0.14em] text-aurora-amber">Why this lane is losing trust</div>
                      <div className="mt-2 space-y-2">
                        {demotionSummary.pressureSources.map((source) => (
                          <div key={source.key} className="ui-panel-soft px-3 py-2 text-[11px] text-text-body">
                            <span className="font-semibold text-text-primary">{source.label}:</span> {source.count} signal{source.count === 1 ? '' : 's'}. {source.detail}
                          </div>
                        ))}
                        {demotionSummary.reasons.map((reason) => (
                          <div key={reason} className="ui-panel-soft px-3 py-2 text-[11px] text-text-body">
                            {reason}
                          </div>
                        ))}
                        {demotionSummary.interventionCount > 0 && demotionSummary.pressureSources.length === 0 && demotionSummary.reasons.length === 0 && (
                          <div className="ui-panel-soft border border-dashed border-hairline px-3 py-2 text-[11px] text-text-muted">
                            Rescue pressure exists, but Commander still needs a little more run density before the losing signals become specific.
                          </div>
                        )}
                        {demotionSummary.interventionCount === 0 && demotionSummary.laneRisks.length === 0 && (
                          <div className="ui-panel-soft border border-dashed border-hairline px-3 py-2 text-[11px] text-text-muted">
                            No meaningful demotion pressure is registered yet.
                          </div>
                        )}
                        {demotionSummary.laneRisks.map((reason) => (
                          <div key={reason} className="ui-panel-soft px-3 py-2 text-[11px] text-text-body">
                            {reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {(saveError || saveMessage) && (
                  <div className={cn(
                    'ui-panel-soft px-3 py-2 text-[11px]',
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
                <div className="ui-panel p-4 text-[12px] text-text-muted">
                  No task workflow data is live yet.
                </div>
              )}
              {workflowDistribution.map((entry) => (
                <div key={entry.status} className="ui-panel p-4">
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
              {launchReadinessPressure.available && launchReadinessPressure.score > 0 && (
                <div className="ui-panel p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-text-primary">{launchReadinessPressure.title}</div>
                      <div className="mt-1 text-[11px] text-text-muted">{launchReadinessPressure.detail}</div>
                    </div>
                    <div className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                      launchReadinessPressure.tone === 'rose'
                        ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
                        : 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
                    }`}>
                      {launchReadinessPressure.affectedMissionCount} missions
                    </div>
                  </div>
                  {launchReadinessPressure.topSystems.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {launchReadinessPressure.topSystems.map((system) => (
                        <span
                          key={`${system.key}-${system.status}`}
                          className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
                            system.status === 'degraded'
                              ? 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber'
                              : 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
                          }`}
                        >
                          {system.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {capabilityDemand.length === 0 && (
                <div className="ui-panel p-4 text-[12px] text-text-muted">
                  No required capabilities have been inferred yet.
                </div>
              )}
              {capabilityDemand.map((entry) => (
                <div key={entry.capability} className="ui-panel p-4">
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

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <HudPanel
          eyebrow="Observed Winners"
          title="Best lane recommendations from real outcomes"
          description="This is the first evidence-based layer for 'use the best model for the job' instead of relying only on policy intent."
          accent="blue"
        >
          <div className="space-y-3">
            {observedBestLanes.length === 0 && (
              <div className="ui-panel p-4 text-[12px] text-text-muted">
                Not enough completed routed missions yet to name winner lanes with confidence.
              </div>
            )}
            {observedBestLanes.map((entry) => (
              <div key={`${entry.domain}-${entry.intentType}`} className="ui-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">{entry.domain} / {entry.intentType}</div>
                    <div className="mt-1 text-sm font-semibold text-text-primary">{entry.winner?.lane}</div>
                    <div className="mt-1 text-[11px] text-text-muted">{entry.sampleCount} successful mission sample{entry.sampleCount === 1 ? '' : 's'}</div>
                  </div>
                  <div className="rounded-full border border-aurora-teal/20 bg-aurora-teal/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-teal">
                    {entry.winner?.agentRole || 'lane winner'}
                  </div>
                </div>
                {entry.runnersUp.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {entry.runnersUp.map((runner) => (
                      <span key={`${entry.domain}-${entry.intentType}-${runner.lane}`} className="ui-chip px-2 py-1 text-[10px] font-semibold text-text-muted">
                        fallback {runner.lane}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </HudPanel>

        <HudPanel
          eyebrow="Context Discipline"
          title="Context packs and skill pressure"
          description="The machine gets cheaper and cleaner when each branch sees only the right context and the right playbook."
          accent="amber"
        >
          <div className="grid gap-4">
            <div className="ui-panel p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Top context packs</div>
                <div className="text-[10px] font-mono text-aurora-amber">{contextDemand.length} active</div>
              </div>
              <div className="mt-3 space-y-2">
                {contextDemand.length === 0 && <div className="text-[11px] text-text-muted">No context-pack usage yet.</div>}
                {contextDemand.map((entry) => (
                  <div key={entry.packId} className="flex items-center justify-between ui-card-row px-3 py-2.5">
                    <div className="text-[12px] font-semibold text-text-primary">{entry.packId}</div>
                    <div className="text-[10px] font-mono text-aurora-amber">{entry.count}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="ui-panel p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Skill bank coverage</div>
                <div className="text-[10px] font-mono text-aurora-blue">{skills.length} skills</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {skills.length === 0 && <div className="text-[11px] text-text-muted">No reusable skills stored yet.</div>}
                {skills.slice(0, 8).map((skill) => (
                  <span key={skill.id || skill.name} className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-2 py-1 text-[10px] font-semibold text-aurora-blue">
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </HudPanel>
      </div>

      <SpecialistFleetTab agents={agents} lifecycleEvents={lifecycleEvents} skills={skills} tasks={tasks} />
    </div>
  );
}

function SpecialistFleetTab({ agents, lifecycleEvents, skills, tasks }) {
  const commander = agents.find((agent) => agent.role === 'commander' && !agent.isSyntheticCommander) || agents.find((agent) => agent.role === 'commander') || null;
  const modelOptions = [...new Set(agents.map((agent) => agent.model).filter(Boolean))];
  const persistentSpecialists = agents.filter((agent) => !agent.isEphemeral && !['commander', 'executor'].includes(agent.role || ''));
  const spawnedSpecialists = agents.filter((agent) => agent.isEphemeral);
  const fleetHistory = getSpecialistLifecycleSummary(lifecycleEvents, agents);
  const fleetPosture = getFleetPostureSummary(lifecycleEvents, agents);
  const promotionGuidance = getPersistentPromotionGuidance({ lifecycleEvents, agents, tasks });
  const recommendedPromotionAgent = useMemo(() => (
    promotionGuidance.topGap
      ? spawnedSpecialists.find((agent) => (agent.role || 'specialist') === promotionGuidance.topGap.role) || null
      : null
  ), [promotionGuidance.topGap, spawnedSpecialists]);
  const recentLifecycleEvents = fleetHistory.events.slice(0, 6);
  const promotionHistory = fleetHistory.promotions.slice(0, 6);
  const [objective, setObjective] = useState('');
  const [persistentName, setPersistentName] = useState('');
  const [persistentObjective, setPersistentObjective] = useState('');
  const [role, setRole] = useState('researcher');
  const [model, setModel] = useState(modelOptions[0] || '');
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function handleSpawn() {
    if (!objective.trim() || !model) return;
    setBusy(true);
    setMessage('');
    try {
      const agent = await createTempAgent({ objective: objective.trim(), role, model, commanderId: commander?.id || null });
      setObjective('');
      setMessage(`Spawned ${agent.name}. Refresh the dock after the next live event to see it on the deck.`);
    } catch (error) {
      setMessage(error.message || 'Could not spawn specialist.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCleanup() {
    setBusy(true);
    setMessage('');
    try {
      const removed = await cleanupTempAgents();
      setMessage(removed > 0 ? `Retired ${removed} idle specialist lane${removed === 1 ? '' : 's'}.` : 'No idle spawned specialists were eligible for cleanup.');
    } catch (error) {
      setMessage(error.message || 'Could not clean up specialists.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePersistent() {
    if (!model) return;
    setBusy(true);
    setMessage('');
    try {
      const agent = await createPersistentSpecialist({
        name: persistentName.trim(),
        objective: persistentObjective.trim() || objective.trim(),
        role,
        model,
        commanderId: commander?.id || null,
        skills: selectedSkills,
      });
      setPersistentName('');
      setPersistentObjective('');
      setSelectedSkills([]);
      setMessage(`Persistent lane ${agent.name} is now live for Commander.`);
    } catch (error) {
      setMessage(error.message || 'Could not create persistent specialist.');
    } finally {
      setBusy(false);
    }
  }

  async function handlePromote(agentId) {
    setBusy(true);
    setMessage('');
    try {
      const promoted = await promoteAgentToPersistent(agentId, { skills: selectedSkills.length ? selectedSkills : undefined });
      setMessage(`${promoted.name} is now a persistent specialist lane.`);
    } catch (error) {
      setMessage(error.message || 'Could not promote specialist.');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateRecommendedPersistent(target) {
    if (!target?.role || !model) return;
    setBusy(true);
    setMessage('');
    try {
      const laneName = `${target.role}-${target.domain || 'core'}-lane`;
      const objectiveText = target.domain
        ? `Persistent ${target.role} coverage for ${target.domain}${target.intentType ? ` / ${target.intentType}` : ''} missions.`
        : `Persistent ${target.role} coverage for Commander where durable fleet pressure is highest.`;
      const agent = await createPersistentSpecialist({
        name: laneName,
        objective: objectiveText,
        role: target.role,
        model,
        commanderId: commander?.id || null,
        skills: selectedSkills,
      });
      setMessage(`Persistent lane ${agent.name} is now live for ${target.domain ? `${target.domain} coverage` : `${target.role} coverage`}.`);
    } catch (error) {
      setMessage(error.message || 'Could not create recommended persistent specialist.');
    } finally {
      setBusy(false);
    }
  }

  function toggleSkill(name) {
    setSelectedSkills((current) => (
      current.includes(name)
        ? current.filter((entry) => entry !== name)
        : [...current, name]
    ));
  }

  return (
    <HudPanel
      eyebrow="Specialist Fleet"
      title="Persistent and spawned lanes"
      description="Keep the specialist rack visible, spawn utility lanes on demand, and retire idle ephemeral lanes without leaving Intelligence."
      accent="violet"
    >
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: 'Persistent', value: persistentSpecialists.length, tone: 'text-aurora-blue' },
          { label: 'Spawned', value: spawnedSpecialists.length, tone: 'text-aurora-violet' },
          { label: 'Promotions', value: fleetHistory.promotions.length, tone: 'text-aurora-teal' },
        ].map((metric) => (
          <div key={metric.label} className="ui-panel p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">{metric.label}</div>
            <div className={cn('mt-2 text-2xl font-semibold', metric.tone)}>{metric.value}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 ui-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Fleet posture</div>
            <div className="mt-1 text-sm font-semibold text-text-primary">{fleetPosture.label}</div>
            <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-text-body">{fleetPosture.detail}</p>
            <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-aurora-blue">{promotionGuidance.recommendation}</p>
            {promotionGuidance.autoCreateRoles?.length > 1 && (
              <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-aurora-violet">
                Durable pressure is now high enough that Commander can justify auto-creating coverage for: {promotionGuidance.autoCreateRoles.join(', ')}.
              </p>
            )}
            {promotionGuidance.domainTargets?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {promotionGuidance.domainTargets.map((entry) => (
                  <span
                    key={`${entry.domain}-${entry.intentType}-${entry.role}`}
                    className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-2 py-1 text-[10px] font-semibold text-aurora-blue"
                  >
                    {entry.domain}/{entry.intentType}: {entry.role} x{entry.count}
                  </span>
                ))}
              </div>
            )}
            {promotionGuidance.domainPackTargets?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {promotionGuidance.domainPackTargets.map((entry) => (
                  <span
                    key={`${entry.domain}-${entry.role}-pack`}
                    className="rounded-full border border-aurora-violet/20 bg-aurora-violet/10 px-2 py-1 text-[10px] font-semibold text-aurora-violet"
                  >
                    {entry.domain} pack: {entry.role} x{entry.count}
                  </span>
                ))}
              </div>
            )}
            {(promotionGuidance.autoCreateRoles?.length > 0 || promotionGuidance.domainPackTargets?.length > 0) && (
              <div className="mt-4 ui-panel-soft p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Fleet-shaping actions</div>
                    <div className="mt-1 text-[11px] text-text-body">Recommended next coverage defaults from lifecycle pressure and recurring branch demand.</div>
                  </div>
                  {promotionGuidance.recommendedActions?.[0] && (
                    <span className="rounded-full border border-aurora-amber/20 bg-aurora-amber/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-amber">
                      next: {promotionGuidance.recommendedActions[0].label}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {promotionGuidance.recommendedActions?.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      disabled={busy || !model}
                      onClick={() => handleCreateRecommendedPersistent(entry)}
                      className={cn(
                        'rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors disabled:opacity-50',
                        entry.tone === 'violet'
                          ? 'border-aurora-violet/20 bg-aurora-violet/10 text-aurora-violet hover:bg-aurora-violet/14'
                          : 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue hover:bg-aurora-blue/14'
                      )}
                    >
                      {busy ? 'Working...' : entry.label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-text-muted">
                  These actions turn durable coverage pressure into persistent lanes immediately, so Commander does not have to keep relearning the same missing role through spawned specialists.
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-blue">
              roles {fleetPosture.activeRoles}
            </span>
            <span className="rounded-full border border-aurora-violet/20 bg-aurora-violet/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-violet">
              retirements {fleetPosture.retirementCount}
            </span>
            <span className="rounded-full border border-aurora-teal/20 bg-aurora-teal/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-teal">
              cleanup {fleetPosture.cleanedCount}
            </span>
            {recommendedPromotionAgent && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handlePromote(recommendedPromotionAgent.id)}
                className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-blue transition-colors hover:bg-aurora-blue/14 disabled:opacity-50"
              >
                {busy ? 'Working...' : `Promote ${recommendedPromotionAgent.role}`}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="ui-panel p-4">
          <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Create lane</div>
          <div className="mt-3 space-y-3">
            <input
              value={objective}
              onChange={(event) => setObjective(event.target.value)}
              placeholder="Objective for the next specialist lane"
              className="w-full ui-input px-3 py-2 text-[12px] text-text-primary outline-none placeholder:text-text-disabled"
            />
            <input
              value={persistentName}
              onChange={(event) => setPersistentName(event.target.value)}
              placeholder="Optional persistent lane name"
              className="w-full ui-input px-3 py-2 text-[12px] text-text-primary outline-none placeholder:text-text-disabled"
            />
            <input
              value={persistentObjective}
              onChange={(event) => setPersistentObjective(event.target.value)}
              placeholder="Persistent lane mission focus"
              className="w-full ui-input px-3 py-2 text-[12px] text-text-primary outline-none placeholder:text-text-disabled"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <select value={role} onChange={(event) => setRole(event.target.value)} className="w-full ui-input px-3 py-2 text-[12px] text-text-primary outline-none">
                {['planner', 'researcher', 'builder', 'verifier', 'executor'].map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
              <select value={model} onChange={(event) => setModel(event.target.value)} className="w-full ui-input px-3 py-2 text-[12px] text-text-primary outline-none">
                {modelOptions.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">Attach skills</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {skills.length === 0 && <div className="text-[11px] text-text-muted">No skill bank entries yet.</div>}
                {skills.slice(0, 8).map((skill) => (
                  <button
                    key={skill.id || skill.name}
                    type="button"
                    onClick={() => toggleSkill(skill.name)}
                    className={cn(
                      'rounded-full border px-2 py-1 text-[10px] font-semibold transition-colors',
                      selectedSkills.includes(skill.name)
                        ? 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue'
                        : 'text-text-muted hover:border-hairline-strong'
                    )}
                  >
                    {skill.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={busy || !objective.trim() || !model} onClick={handleSpawn} className="ui-button-secondary rounded-xl border-aurora-violet/20 bg-aurora-violet/10 px-3 py-2 text-[11px] font-semibold text-aurora-violet transition-colors hover:bg-aurora-violet/14 disabled:opacity-50">
                {busy ? 'Working...' : 'Spawn specialist'}
              </button>
              <button type="button" disabled={busy || !model} onClick={handleCreatePersistent} className="ui-button-secondary rounded-xl border-aurora-blue/20 bg-aurora-blue/10 px-3 py-2 text-[11px] font-semibold text-aurora-blue transition-colors hover:bg-aurora-blue/14 disabled:opacity-50">
                Create persistent lane
              </button>
              <button type="button" disabled={busy} onClick={handleCleanup} className="ui-button-secondary rounded-xl border-aurora-teal/20 bg-aurora-teal/10 px-3 py-2 text-[11px] font-semibold text-aurora-teal transition-colors hover:bg-aurora-teal/14 disabled:opacity-50">
                Cleanup idle spawned
              </button>
            </div>
            {message && (
              <div className="ui-panel-soft px-3 py-2 text-[11px] text-text-body">
                {message}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-4">
          <div className="ui-panel p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Persistent lanes</div>
            <div className="mt-3 space-y-2">
              {persistentSpecialists.length === 0 && <div className="text-[11px] text-text-muted">No persistent specialist lanes yet.</div>}
              {persistentSpecialists.slice(0, 5).map((agent) => (
                <div key={agent.id} className="ui-card-row px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-semibold text-text-primary">{agent.name}</div>
                      <div className="mt-1 text-[10px] font-mono uppercase text-aurora-blue">{agent.role}</div>
                    </div>
                    <div className="text-[10px] font-mono text-text-disabled">{agent.model || 'Adaptive lane'}</div>
                  </div>
                  {(agent.skills || []).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {agent.skills.slice(0, 4).map((skillName) => (
                        <span key={`${agent.id}-${skillName}`} className="rounded-full border border-aurora-blue/20 bg-aurora-blue/10 px-2 py-0.5 text-[9px] font-semibold text-aurora-blue">
                          {skillName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="ui-panel p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Spawned lanes</div>
            <div className="mt-3 space-y-2">
              {spawnedSpecialists.length === 0 && <div className="text-[11px] text-text-muted">No spawned specialists are active right now.</div>}
              {spawnedSpecialists.map((agent) => (
                <div key={agent.id} className="ui-card-row px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[12px] font-semibold text-text-primary">{agent.name}</div>
                      <div className="mt-1 text-[10px] font-mono uppercase text-aurora-violet">{agent.role || 'specialist'}</div>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handlePromote(agent.id)}
                      className="rounded-xl border border-aurora-blue/20 bg-aurora-blue/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-aurora-blue transition-colors hover:bg-aurora-blue/14 disabled:opacity-50"
                    >
                      Promote
                    </button>
                  </div>
                  <div className="mt-2 text-[10px] font-mono text-text-disabled">{agent.model || 'Adaptive lane'}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="ui-panel p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Coverage map</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {['planner', 'researcher', 'builder', 'verifier'].map((roleName) => (
                <div key={roleName} className="ui-card-row px-3 py-3">
                  <div className="text-[10px] uppercase tracking-[0.14em] text-text-muted">{roleName}</div>
                  <div className="mt-2 text-lg font-semibold text-text-primary">{fleetHistory.coverageByRole[roleName] || 0}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="ui-panel p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Lifecycle rail</div>
            <div className="mt-3 space-y-2">
              {lifecycleEvents.length === 0 && <div className="text-[11px] text-text-muted">No specialist lifecycle events yet.</div>}
              {recentLifecycleEvents.map((entry) => (
                <div key={entry.id} className="ui-card-row px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-mono uppercase text-text-muted">{entry.type}</div>
                    <div className="text-[10px] font-mono text-text-disabled">{entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : 'Live'}</div>
                  </div>
                  <div className="mt-2 text-[11px] leading-relaxed text-text-body">
                    {entry.cleanMessage}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="ui-panel p-4">
            <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Promotion history</div>
            <div className="mt-3 space-y-2">
              {promotionHistory.length === 0 && <div className="text-[11px] text-text-muted">No promotion events yet.</div>}
              {promotionHistory.map((entry) => (
                <div key={entry.id} className="ui-card-row px-3 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[10px] font-mono uppercase text-aurora-blue">PROMOTED</div>
                    <div className="text-[10px] font-mono text-text-disabled">{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : 'Live'}</div>
                  </div>
                  <div className="mt-2 text-[11px] leading-relaxed text-text-body">
                    {entry.cleanMessage}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </HudPanel>
  );
}

function KnowledgeMapTab({ namespaces }) {
  const totalVectors = namespaces.reduce((sum, namespace) => sum + Number(namespace.vectors || 0), 0);

  return (
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <div className="space-y-5">
        <div className="ui-panel p-5">
          <CommandSectionHeader
            eyebrow="Terrain Readout"
            title="Memory pressure at a glance"
            description="The live shape of the knowledge map."
            icon={Database}
            tone="teal"
          />
          <div className="mt-5 grid gap-3">
            <div className="ui-panel p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Total vectors</div>
              <div className="mt-2 text-3xl font-semibold text-text-primary">{totalVectors.toLocaleString()}</div>
            </div>
            <div className="ui-panel p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Namespaces</div>
              <div className="mt-2 text-3xl font-semibold text-text-primary">{namespaces.length}</div>
            </div>
            <div className="ui-panel p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Stale terrain</div>
              <div className="mt-2 text-3xl font-semibold text-text-primary">
                {namespaces.filter((namespace) => namespace.status !== 'active').length}
              </div>
            </div>
          </div>
        </div>

        <div className="ui-panel p-5">
          <CommandSectionHeader
            eyebrow="Territory Ranking"
            title="Memory zones by size"
            description="The namespaces taking the most space and attention."
            icon={Layers3}
            tone="blue"
          />
          <div className="mt-5 space-y-3">
            {namespaces.length === 0 && (
              <div className="ui-panel-soft border border-dashed border-hairline p-4 text-[12px] text-text-muted">
                No knowledge namespaces are stored yet. Once memory zones are persisted, this terrain will rank them here instead of inventing placeholders.
              </div>
            )}
            {namespaces
              .slice()
              .sort((a, b) => Number(b.vectors || 0) - Number(a.vectors || 0))
              .map((namespace, index) => (
                <div key={namespace.id} className="ui-panel p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="ui-panel-soft flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold text-text-primary">
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

      <div className="ui-panel p-5">
        <CommandSectionHeader
          eyebrow="Knowledge Terrain"
          title="Where your memory is strongest"
          description="Namespace health, vector density, and attached operators."
          icon={Database}
          tone="violet"
        />
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {namespaces.slice(0, 6).map((namespace) => (
            <div key={namespace.id} className="ui-panel p-4">
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
                  <span key={agent} className="ui-chip px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                    {agent}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {namespaces.length > 6 && (
          <div className="mt-4 ui-panel-soft border border-dashed border-hairline p-4 text-[12px] text-text-muted">
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

  const approvalSensitiveTasks = tasks.filter((task) => task.status === 'needs_approval' || task.requiresApproval).length;

  return (
    <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
      <div className="ui-panel p-5">
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
              <div key={directive.id} className="ui-panel p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="ui-panel-soft flex h-10 w-10 items-center justify-center rounded-2xl">
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
        <div className="ui-panel p-5">
          <CommandSectionHeader
            eyebrow="System Readback"
            title="What the rules are doing to the system"
            description="A quick readback of approval load and directive density."
            icon={Gauge}
            tone="teal"
          />
          <div className="mt-5 space-y-3">
            <div className="ui-panel p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Approval sensitivity</div>
              <div className="mt-2 text-3xl font-semibold text-text-primary">{approvalSensitiveTasks}</div>
              <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
                Missions currently halted by directives or approval gates before execution can continue.
              </p>
            </div>
            <div className="ui-panel p-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Directives live</div>
              <div className="mt-2 text-3xl font-semibold text-text-primary">{directives.length}</div>
              <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
                Shared command constraints protecting output quality, privacy, and operating cost.
              </p>
            </div>
          </div>
        </div>

        <div className="ui-panel p-5">
          <CommandSectionHeader
            eyebrow="Optimization Orders"
            title="Persisted recommendation pressure"
            description="Durable recommendations and live upgrades with the highest leverage on quality and throughput."
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
              <OptimizationCard key={recommendation.title} recommendation={recommendation} onStageCorrectiveAction={null} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function IntelligenceView({ routeState = null, onConsumeRouteState = null, onNavigate = null }) {
  const [activeTab, setActiveTab] = useState(routeState?.tab || 'models');
  const [localRouteState, setLocalRouteState] = useState(null);
  const [executingRecommendationId, setExecutingRecommendationId] = useState(null);
  const [actionError, setActionError] = useState('');
  const { agents } = useAgents();
  const { models } = useModelBank();
  const { skills } = useSkillBank();
  const { tasks } = useTasks();
  const { policies: routingPolicies, upsertPolicy, ensureDefaultPolicy } = useRoutingPolicies();
  const { logs } = useActivityLog();
  const { interventions } = useTaskInterventions();
  const { outcomes } = useTaskOutcomes();
  const { events: lifecycleEvents } = useSpecialistLifecycle();
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
  const branchConnectorPressure = useMemo(
    () => getBranchConnectorPressureSummary(tasks, interventions),
    [tasks, interventions]
  );
  const groupedConnectorBlockers = useMemo(
    () => getGroupedConnectorBlockers(tasks, interventions),
    [tasks, interventions]
  );
  const missionDispatchPressure = useMemo(
    () => getMissionDispatchPressureSummary(tasks),
    [tasks]
  );
  const graphContractPressure = useMemo(
    () => getGraphContractPressureSummary(tasks, interventions),
    [tasks, interventions]
  );
  const graphReasoning = useMemo(
    () => getGraphReasoningSummary(tasks, interventions),
    [tasks, interventions]
  );
  const liveControlNarrative = useMemo(
    () => getLiveControlNarrativeSummary(tasks, interventions),
    [tasks, interventions]
  );
  const liveControlRedirectAgent = useMemo(() => {
    const topBranch = liveControlNarrative.topBranch;
    if (!topBranch?.id) return null;
    const currentAgentId = topBranch.agentId || topBranch.agent_id || null;
    return agents.find((agent) => (
      !agent.isSyntheticCommander
      && agent.role !== 'commander'
      && agent.status !== 'error'
      && agent.id !== currentAgentId
    )) || null;
  }, [agents, liveControlNarrative.topBranch]);
  const liveControlExecutableAction = useMemo(() => {
    const topBranch = liveControlNarrative.topBranch;
    const topControlState = liveControlNarrative.topControlState;
    if (!topBranch?.id || !topControlState?.available) return null;
    return getTaskExecutableControlAction({
      task: topBranch,
      controlState: topControlState,
      approvalTransition: getApprovalTransitionState(topBranch, interventions),
      redirectAgent: liveControlRedirectAgent,
    });
  }, [interventions, liveControlNarrative.topBranch, liveControlNarrative.topControlState, liveControlRedirectAgent]);
  const decisionNarrative = useMemo(
    () => getDecisionNarrativeSummary(tasks, interventions),
    [tasks, interventions]
  );
  const commanderNextMove = useMemo(
    () => getCommanderNextMove({ tasks, reviews: [], schedules: [], agents, interventions, logs, approvalAudit: [], learningMemory }),
    [tasks, agents, interventions, logs, learningMemory]
  );
  const doctrineDeltas = useMemo(() => getDoctrineDeltaSummary(learningMemory.doctrine).slice(0, 3), [learningMemory.doctrine]);
  const failureTriage = useMemo(
    () => getFailureTriageSummary({ tasks, interventions, logs }),
    [tasks, interventions, logs]
  );
  const topPolicy = useMemo(
    () => routingPolicies.find((policy) => policy.isDefault) || routingPolicies[0] || null,
    [routingPolicies]
  );
  const topPolicyActionGuidance = useMemo(
    () => getPolicyActionGuidance(topPolicy, tasks, interventions, logs, agents),
    [topPolicy, tasks, interventions, logs, agents]
  );
  const topTradeoffOutcome = useMemo(
    () => getTradeoffOutcomeSummary(topPolicyActionGuidance.swap),
    [topPolicyActionGuidance]
  );
  const topTradeoffCorrectiveAction = useMemo(
    () => getTradeoffCorrectiveAction(topTradeoffOutcome, topPolicyActionGuidance.swap),
    [topTradeoffOutcome, topPolicyActionGuidance]
  );
  const effectiveRouteState = localRouteState || routeState || null;
  const derivedRecommendations = useMemo(() => {
    const runningTasks = tasks.filter((task) => task.status === 'running').length;
    const failedTasks = tasks.filter((task) => ['failed', 'error', 'blocked'].includes(task.status)).length;
    const recommendations = [...persistedRecommendations];
    const recurringBriefReadback = getRecurringBriefFitReadback(tasks, interventions, outcomes);
    const recurringPaybackDoctrine = learningMemory?.doctrineById?.['recurring-payback-memory'] || null;
    const recurringAdaptiveDoctrine = learningMemory?.doctrineById?.['recurring-adaptive-control'] || null;
    const hybridApprovalDoctrine = learningMemory?.doctrineById?.['hybrid-approval-memory'] || null;
    const failureTriageDoctrine = learningMemory?.doctrineById?.['failure-triage-memory'] || null;
    const executionAuditDoctrine = learningMemory?.doctrineById?.['execution-audit-memory'] || null;

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

    if (recurringBriefReadback.available && recurringBriefReadback.tone !== 'teal') {
      recommendations.unshift({
        id: 'derived-recurring-brief-fit',
        type: 'optimization',
        title: recurringBriefReadback.title,
        description: recurringBriefReadback.detail,
        impact: recurringBriefReadback.tone === 'amber' ? 'high' : 'medium',
      });
    }

    if (recurringPaybackDoctrine && recurringPaybackDoctrine.tone !== 'teal') {
      recommendations.unshift({
        id: 'derived-recurring-payback',
        type: 'optimization',
        title: recurringPaybackDoctrine.title,
        description: recurringPaybackDoctrine.detail,
        impact: recurringPaybackDoctrine.tone === 'amber' ? 'high' : 'medium',
      });
    }

    if (recurringAdaptiveDoctrine) {
      recommendations.unshift({
        id: 'derived-recurring-adaptive-control',
        type: 'optimization',
        title: recurringAdaptiveDoctrine.title,
        description: recurringAdaptiveDoctrine.detail,
        impact: recurringAdaptiveDoctrine.tone === 'amber' ? 'high' : recurringAdaptiveDoctrine.tone === 'teal' ? 'medium' : 'medium',
      });
    }

    if (hybridApprovalDoctrine && hybridApprovalDoctrine.tone !== 'teal') {
      recommendations.unshift({
        id: 'derived-hybrid-approval-control',
        type: 'optimization',
        title: hybridApprovalDoctrine.title,
        description: hybridApprovalDoctrine.detail,
        impact: hybridApprovalDoctrine.tone === 'amber' ? 'high' : 'medium',
        whyNow: hybridApprovalDoctrine.evidence?.[0] || null,
        correctiveAction: {
          label: 'Bundle or clear low-risk approvals',
          detail: 'Use the approval trail to move the lightest gates together so human drag stops compounding.',
          opsPrompt: `Review the live approval queue and clear or bundle the lowest-risk decisions first. Use this control context: ${hybridApprovalDoctrine.detail}`,
        },
      });
    }

    if (failureTriageDoctrine) {
      recommendations.unshift({
        id: 'derived-failure-triage-control',
        type: 'optimization',
        title: failureTriageDoctrine.title,
        description: failureTriageDoctrine.detail,
        impact: failureTriageDoctrine.tone === 'rose' ? 'critical' : failureTriageDoctrine.tone === 'amber' ? 'high' : 'medium',
        whyNow: failureTriageDoctrine.evidence?.[1] || failureTriageDoctrine.evidence?.[0] || null,
        correctiveAction: {
          label: 'Run the top triage order first',
          detail: 'Keep the highest-pressure failed branch on the shortest safe recovery path before scaling adjacent work.',
          opsPrompt: `Stabilize the highest-pressure failed branch first. Follow the current triage doctrine and decide whether to retry, reroute, or hold for approval. Context: ${failureTriageDoctrine.detail}`,
        },
      });
    }

    if (failureTriage.available) {
      recommendations.unshift({
        id: 'derived-live-failure-triage',
        type: 'optimization',
        title: failureTriage.title,
        description: `${failureTriage.detail} ${failureTriage.resolutionLabel}. Do next: ${failureTriage.nextMove}.${failureTriage.graphContract?.label ? ` Graph contract: ${failureTriage.graphContract.label}.` : ''}`,
        impact: failureTriage.tone === 'rose' ? 'critical' : failureTriage.tone === 'amber' ? 'high' : 'medium',
        whyNow: String(failureTriage.recoveryMode || '').replaceAll('_', ' '),
        correctiveAction: failureTriage.opsPrompt
          ? {
              label: failureTriage.actionLabel || 'Run top triage order',
              detail: failureTriage.resolutionLabel || failureTriage.nextMove,
              opsPrompt: failureTriage.opsPrompt,
              controlActionBrief: {
                title: failureTriage.title,
                actionLabel: failureTriage.actionLabel || 'Run top triage order',
                currentState: failureTriage.verdict,
                expectedImprovement: 'Recovery pressure should drop because Commander is following the graph-aware recovery path instead of retrying blindly.',
                verificationTarget: 'Verify that the next control event reduces rescue churn and moves the branch into a clearer release, reroute, or held posture.',
                successCriteria: 'The branch takes one cleaner recovery path and stops bouncing between blocked, retry, and hold.',
                rollbackCriteria: 'Back this recovery move out if it adds rescue noise, widens risk, or fails to change the branch control state on the next pass.',
                nextMove: failureTriage.nextMove,
              },
            }
          : null,
      });
    }

    if (executionAuditDoctrine && executionAuditDoctrine.tone !== 'teal') {
      recommendations.unshift({
        id: 'derived-execution-audit-order',
        type: 'optimization',
        title: executionAuditDoctrine.title,
        description: executionAuditDoctrine.detail,
        impact: 'medium',
        whyNow: executionAuditDoctrine.evidence?.[0] || null,
        correctiveAction: {
          label: 'Follow the audit-derived next move',
          detail: executionAuditDoctrine.metrics?.latestNextMove
            ? `Current top order is ${String(executionAuditDoctrine.metrics.latestNextMove).replaceAll('_', ' ')}.`
            : 'Use the latest control event as the next operator order instead of relying on broad mission counts alone.',
          opsPrompt: executionAuditDoctrine.metrics?.latestNextMove
            ? `Follow the latest execution-control order: ${String(executionAuditDoctrine.metrics.latestNextMove).replaceAll('_', ' ')}. Use the current audit trail to decide the shortest safe next move. Context: ${executionAuditDoctrine.detail}`
            : `Review the latest execution-control trail and stage the next operator move from it. Context: ${executionAuditDoctrine.detail}`,
        },
      });
    }

    if (liveControlNarrative.available) {
      recommendations.unshift({
        id: 'derived-live-control-narrative',
        type: 'optimization',
        title: liveControlNarrative.title,
        description: `${liveControlNarrative.detail} Resume posture: ${liveControlNarrative.topControlState?.canAutoResume ? 'safe to auto-resume' : liveControlNarrative.topControlState?.shouldStayHeld ? 'keep held until review' : 'active commander decision required'}.`,
        impact: liveControlNarrative.tone === 'rose' ? 'critical' : liveControlNarrative.tone === 'amber' ? 'high' : 'medium',
        whyNow: liveControlNarrative.nextMove,
        correctiveAction: liveControlNarrative.controlActionDraft
          ? {
              label: liveControlNarrative.actionLabel || 'Stage live control review',
              detail: liveControlNarrative.topControlState?.resolutionLabel || 'Stage the safest next recovery move for the top controlled branch.',
              opsPrompt: liveControlNarrative.controlActionDraft.quickstartPrompt,
              controlActionBrief: liveControlNarrative.controlActionDraft.controlActionBrief,
              executableAction: liveControlExecutableAction?.available
                ? {
                    kind: liveControlExecutableAction.kind,
                    label: liveControlExecutableAction.label,
                    detail: liveControlExecutableAction.detail,
                    taskId: liveControlNarrative.topBranch?.id,
                    redirectAgentId: liveControlRedirectAgent?.id || null,
                    redirectProvider: liveControlRedirectAgent?.provider || null,
                    redirectModel: liveControlRedirectAgent?.model || null,
                  }
                : null,
              controlActionMode: getTaskControlActionMode({
                controlState: liveControlNarrative.topControlState,
                executableAction: liveControlExecutableAction,
                controlActionDraft: liveControlNarrative.controlActionDraft,
              }),
            }
          : null,
      });
    }

    if (decisionNarrative.available) {
      recommendations.unshift({
        id: 'derived-decision-narrative',
        type: 'optimization',
        title: decisionNarrative.title,
        description: `${decisionNarrative.detail} Do next: ${String(decisionNarrative.nextMove || 'keep_flowing').replaceAll('_', ' ')}.`,
        impact: decisionNarrative.tone === 'rose' ? 'critical' : decisionNarrative.tone === 'amber' ? 'high' : 'medium',
        whyNow: decisionNarrative.topNarrative?.approvalLabel || decisionNarrative.topNarrative?.transitionLabel || decisionNarrative.topNarrative?.stateLabel || null,
      });
    }

    if (graphContractPressure.available) {
      recommendations.unshift({
        id: 'derived-graph-contract',
        type: 'optimization',
        title: graphContractPressure.title,
        description: `${graphContractPressure.detail} Do next: ${String(graphContractPressure.nextMove || 'keep_flowing').replaceAll('_', ' ')}.`,
        impact: graphContractPressure.tone === 'rose' ? 'critical' : graphContractPressure.tone === 'amber' ? 'high' : 'medium',
        whyNow: String(graphContractPressure.orderMode || '').replaceAll('_', ' '),
        correctiveAction: {
          label: 'Follow graph contract',
          detail: graphContractPressure.nextMove,
          opsPrompt: `Use the persisted mission graph contract to follow the safest runtime order. ${graphContractPressure.detail} Next move: ${graphContractPressure.nextMove}.`,
          dispatchActionBrief: buildDispatchActionDraft({
            available: graphContractPressure.available,
            title: graphContractPressure.title,
            detail: graphContractPressure.detail,
            nextMove: graphContractPressure.nextMove,
            tone: graphContractPressure.tone,
            topTask: graphContractPressure.topEntry,
            safeParallelCount: graphContractPressure.safeParallelCount,
            serializedCount: graphContractPressure.serializedCount,
            heldUpstreamCount: graphContractPressure.releaseChainCount,
          })?.dispatchActionBrief || null,
        },
      });
    }

    if (graphReasoning.available) {
      recommendations.unshift({
        id: 'derived-graph-reasoning',
        type: 'optimization',
        title: graphReasoning.title,
        description: `${graphReasoning.detail} Do next: ${String(graphReasoning.nextMove || 'keep_flowing').replaceAll('_', ' ')}.`,
        impact: graphReasoning.tone === 'rose' ? 'high' : graphReasoning.tone === 'amber' ? 'high' : 'medium',
        whyNow: graphReasoning.topReasoning?.state || null,
      });
    }

    if (branchConnectorPressure.available && branchConnectorPressure.score > 0) {
      const groupedFix = groupedConnectorBlockers.topGroup;
      recommendations.unshift({
        id: groupedFix?.affectedCount > 1 ? 'derived-grouped-connector-branch-pressure' : 'derived-connector-branch-pressure',
        type: 'optimization',
        title: groupedFix?.affectedCount > 1 ? groupedFix.title : branchConnectorPressure.title,
        description: groupedFix?.affectedCount > 1
          ? `${groupedFix.detail} Do next: ${groupedFix.order} Affected branches: ${groupedFix.affectedBranches.map((branch) => branch.title).join(', ')}.`
          : `${branchConnectorPressure.detail}${branchConnectorPressure.topBranches[0]?.fallbackStrategy ? ` Fallback: ${formatFallbackStrategyLabel(branchConnectorPressure.topBranches[0].fallbackStrategy)}. ${getFallbackStrategyDetail(branchConnectorPressure.topBranches[0].fallbackStrategy)}` : ''}`,
        impact: (groupedFix?.tone || branchConnectorPressure.tone) === 'rose' ? 'critical' : 'high',
        correctiveAction: groupedFix?.correctiveAction || branchConnectorPressure.topCorrectiveAction || null,
      });
    }

    if (missionDispatchPressure.available) {
      recommendations.unshift({
        id: 'derived-dispatch-pressure',
        type: 'optimization',
        title: missionDispatchPressure.title,
        description: missionDispatchPressure.detail,
        impact: missionDispatchPressure.tone === 'rose' ? 'high' : missionDispatchPressure.tone === 'amber' ? 'medium' : 'low',
        whyNow: missionDispatchPressure.nextMove,
        correctiveAction: {
          label: 'Follow the dispatch order',
          detail: missionDispatchPressure.nextMove,
          opsPrompt: `Use the live mission graph to follow the safest dispatch order. ${missionDispatchPressure.detail} Next move: ${missionDispatchPressure.nextMove}`,
          dispatchActionBrief: buildDispatchActionDraft(missionDispatchPressure)?.dispatchActionBrief || null,
        },
      });
    }

    return rankCommanderRecommendations({
      recommendations,
      tasks,
      outcomes,
      interventions,
      logs,
      lifecycleEvents,
      agents,
      learningMemory,
      tradeoffOutcome: topTradeoffOutcome,
      tradeoffCorrectiveAction: topTradeoffCorrectiveAction,
    }).slice(0, 5);
  }, [agents, branchConnectorPressure, decisionNarrative, failureTriage, graphContractPressure, graphReasoning, groupedConnectorBlockers, interventions, learningMemory, lifecycleEvents, liveControlExecutableAction, liveControlNarrative, liveControlRedirectAgent, logs, missionDispatchPressure, outcomes, persistedRecommendations, tasks, topTradeoffOutcome, topTradeoffCorrectiveAction]);

  async function handleExecuteCorrectiveAction(recommendation) {
    const executableAction = recommendation?.correctiveAction?.executableAction;
    if (!executableAction?.taskId) return;
    setExecutingRecommendationId(recommendation.id);
    setActionError('');
    try {
      if (executableAction.kind === 'release') {
        await approveMissionTask(executableAction.taskId);
      } else if (executableAction.kind === 'hold') {
        await stopTask(executableAction.taskId);
      } else if (executableAction.kind === 'reroute') {
        await interruptAndRedirectTask(executableAction.taskId, {
          agentId: executableAction.redirectAgentId || null,
          providerOverride: executableAction.redirectProvider || null,
          modelOverride: executableAction.redirectModel || null,
        }, agents);
      }
    } catch (error) {
      setActionError(error?.message || 'Direct action failed.');
    } finally {
      setExecutingRecommendationId(null);
    }
  }

  const readFirstItems = useMemo(() => {
    const bestReasoner = availableModels.slice().sort((a, b) => b.reliability - a.reliability)[0];
    const fastest = availableModels.slice().sort((a, b) => b.speed - a.speed)[0];
    const cheapest = availableModels.slice().sort((a, b) => b.costDiscipline - a.costDiscipline)[0];
    return [
      ...(commanderNextMove?.available ? [{
        eyebrow: 'Do Next',
        title: commanderNextMove.title,
        detail: `${commanderNextMove.detail} Do next: ${commanderNextMove.nextMove}`,
      }] : []),
      ...(failureTriage.available ? [{
        eyebrow: 'Recovery Signal',
        title: failureTriage.title,
        detail: `${failureTriage.detail} ${failureTriage.resolutionLabel}. Do next: ${failureTriage.nextMove}.${failureTriage.graphContract?.label ? ` Graph contract: ${failureTriage.graphContract.label}.` : ''}`,
      }] : []),
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
      ...(branchConnectorPressure.available && branchConnectorPressure.score > 0 ? [{
        eyebrow: 'Connector Pressure',
        title: groupedConnectorBlockers.topGroup?.affectedCount > 1 ? groupedConnectorBlockers.topGroup.title : branchConnectorPressure.title,
        detail: groupedConnectorBlockers.topGroup?.affectedCount > 1
          ? `${groupedConnectorBlockers.topGroup.detail} Do next: ${groupedConnectorBlockers.topGroup.order} Top branches: ${groupedConnectorBlockers.topGroup.affectedBranches.map((branch) => branch.title).join(', ')}.`
          : `${branchConnectorPressure.detail} Top branches: ${branchConnectorPressure.topBranches.map((branch) => branch.title).join(', ')}.${branchConnectorPressure.topBranches[0]?.fallbackStrategy ? ` Fallback: ${formatFallbackStrategyLabel(branchConnectorPressure.topBranches[0].fallbackStrategy)}.` : ''}`,
      }] : []),
      ...(missionDispatchPressure.available ? [{
        eyebrow: 'Dispatch Order',
        title: missionDispatchPressure.title,
        detail: `${missionDispatchPressure.detail} Do next: ${missionDispatchPressure.nextMove}`,
      }] : []),
      ...(graphContractPressure.available ? [{
        eyebrow: 'Graph Contract',
        title: graphContractPressure.title,
        detail: `${graphContractPressure.detail} Do next: ${String(graphContractPressure.nextMove || 'keep_flowing').replaceAll('_', ' ')}.`,
      }] : []),
      ...(liveControlNarrative.available ? [{
        eyebrow: 'Control Narrative',
        title: liveControlNarrative.title,
        detail: `${liveControlNarrative.detail} Resume posture: ${liveControlNarrative.topControlState?.canAutoResume ? 'safe to auto-resume' : liveControlNarrative.topControlState?.shouldStayHeld ? 'keep held until review' : 'active commander decision required'}.`,
      }] : []),
      ...(decisionNarrative.available ? [{
        eyebrow: 'Decision Narrative',
        title: decisionNarrative.title,
        detail: `${decisionNarrative.detail} Do next: ${String(decisionNarrative.nextMove || 'keep_flowing').replaceAll('_', ' ')}.`,
      }] : []),
      ...(graphReasoning.available ? [{
        eyebrow: 'Graph Narrative',
        title: graphReasoning.title,
        detail: `${graphReasoning.detail} Do next: ${String(graphReasoning.nextMove || 'keep_flowing').replaceAll('_', ' ')}.`,
      }] : []),
    ];
  }, [availableModels, branchConnectorPressure, commanderNextMove, decisionNarrative, failureTriage, graphContractPressure, graphReasoning, groupedConnectorBlockers, liveControlNarrative, missionDispatchPressure]);

  return (
    <div className="relative flex h-full flex-col overflow-y-auto pb-10">
      <Motion.div variants={container} initial="hidden" animate="show" className="relative space-y-5">
        <Motion.div variants={item}>
          <IntelligenceHeader
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            systemSummary={systemSummary}
            availableModels={availableModels}
            truth={truth}
          />
        </Motion.div>

        <Motion.section variants={item} className="grid grid-cols-1 gap-3.5 xl:grid-cols-3">
          <StrategicKpi
            label="Models Online"
            valueNode={<AnimatedNumber value={availableModels.length} />}
            detail="Live model lanes currently available to Commander."
            tone="teal"
            icon={Cpu}
          />
          <StrategicKpi
            label="Active Directives"
            valueNode={<AnimatedNumber value={sharedDirectives.length} />}
            detail="Shared rules shaping routing, memory, and execution behavior."
            tone="amber"
            icon={ShieldCheck}
          />
          <StrategicKpi
            label="Connected Systems"
            valueNode={<AnimatedNumber value={truth.connectedSystemsCount} />}
            detail="External systems wired into the live dock and available to the stack."
            tone="blue"
            icon={Database}
          />
        </Motion.section>

        <Motion.section variants={item} className="space-y-5">
          <div className="space-y-5">
            <div className="ui-panel p-2">
              <div className="ui-segmented flex flex-wrap gap-2 rounded-[20px] p-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`ui-chip flex flex-1 items-center justify-center gap-2 rounded-[16px] px-3 py-2.5 text-[12px] font-semibold transition-all ${
                      activeTab === tab.id
                        ? 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ui-panel p-4">
              {activeTab === 'models' && <ModelRegistryTab availableModels={availableModels} agents={agents} tasks={tasks} logs={logs} interventions={interventions} learningMemory={learningMemory} />}
              {activeTab === 'routing' && <RoutingDoctrineTab routingPolicies={routingPolicies} tasks={tasks} agents={agents} logs={logs} interventions={interventions} lifecycleEvents={lifecycleEvents} skills={skills} upsertPolicy={upsertPolicy} ensureDefaultPolicy={ensureDefaultPolicy} routeState={effectiveRouteState} onConsumeRouteState={() => {
                if (localRouteState) setLocalRouteState(null);
                else onConsumeRouteState?.();
              }} />}
              {activeTab === 'knowledge' && <KnowledgeMapTab namespaces={knowledgeNamespaces} />}
              {activeTab === 'directives' && <DirectivesTab directives={sharedDirectives} agents={agents} tasks={tasks} recommendations={derivedRecommendations} />}
            </div>

            <div className="ui-panel p-4">
              <CommandSectionHeader
                eyebrow="Doctrine Delta"
                title="What is rising or losing trust"
                description="Confidence movement from persisted doctrine history so you can see which beliefs are strengthening or slipping."
                icon={TrendingUp}
                tone="blue"
              />
              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                {doctrineDeltas.map((entry) => (
                  <div key={entry.id} className="ui-stat p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-[12px] font-semibold text-text-primary">{entry.title}</div>
                      <span className={cn(
                        'rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]',
                        entry.trend === 'up'
                          ? 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal'
                          : entry.trend === 'down'
                            ? 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose'
                            : 'text-text-muted'
                      )}>
                        {entry.trend === 'up' ? `+${entry.delta}` : entry.delta}
                      </span>
                    </div>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-text-muted">{entry.owner}</div>
                    <div className="mt-3 text-[11px] leading-relaxed text-text-body">{entry.changeSummary}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Motion.section>

        <Motion.section variants={item}>
          <SystemsOperatorTable models={availableModels} />
        </Motion.section>

        <Motion.section variants={item}>
          <CollapsedPanel
            eyebrow="Details"
            title="Audit and system insights"
            summary="Open only when you need doctrine, recommendations, economics, and validation."
          >
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-[0.55fr_1.45fr]">
              <div className="space-y-3">
                {actionError ? (
                  <div className="ui-panel border border-aurora-rose/20 bg-aurora-rose/10 p-4 text-[11px] leading-relaxed text-aurora-rose">
                    {actionError}
                  </div>
                ) : null}
                <div className="ui-panel p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Use first</div>
                    <div className="mt-2 text-[15px] font-semibold text-text-primary">{readFirstItems[0]?.title}</div>
                    <p className="mt-2 text-[11px] leading-5 text-text-muted">{readFirstItems[0]?.detail}</p>
                  </div>
                  <div className="ui-panel p-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Economics snapshot</div>
                    <div className="mt-2 text-[15px] font-semibold text-text-primary">Human vs agent</div>
                    <div className="mt-3 grid gap-2">
                      <div className="ui-panel-soft px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Human equivalent</div>
                        <div className="mt-1 text-lg font-semibold text-text-primary"><AnimatedNumber value={economics.humanCost} prefix="$" decimals={2} /></div>
                      </div>
                      <div className="ui-panel-soft px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Agent spend</div>
                        <div className="mt-1 text-lg font-semibold text-text-primary"><AnimatedNumber value={economics.agentCost} prefix="$" decimals={2} /></div>
                      </div>
                      <div className="ui-panel-soft px-3 py-2.5">
                        <div className="text-[10px] uppercase tracking-[0.16em] text-text-muted">Efficiency</div>
                        <div className="mt-1 text-lg font-semibold text-text-primary"><AnimatedNumber value={economics.multiplier} decimals={1} suffix="x" /></div>
                      </div>
                    </div>
                  </div>
                </div>
                <StrategyRail
                  derivedRecommendations={derivedRecommendations}
                  learningMemory={learningMemory}
                  humanHourlyRate={humanHourlyRate}
                  economics={economics}
                  logs={logs}
                  executingRecommendationId={executingRecommendationId}
                  onExecuteCorrectiveAction={handleExecuteCorrectiveAction}
                  onStageCorrectiveAction={(correctiveAction) => {
                    if (correctiveAction?.routeState && topPolicy?.id) {
                      setActiveTab('routing');
                      setLocalRouteState({
                        tab: 'routing',
                        selectedPolicyId: topPolicy.id,
                        actionContext: correctiveAction,
                        ...correctiveAction.routeState,
                      });
                      return;
                    }
                    if (correctiveAction?.opsPrompt) {
                      const groupedFix = groupedConnectorBlockers.topGroup;
                      const failureDraft = correctiveAction?.controlActionBrief && correctiveAction?.label === (failureTriage.actionLabel || 'Run top triage order')
                        ? buildFailureTriageActionDraft(failureTriage)
                        : null;
                      if (failureDraft) {
                        onNavigate?.('managedOps', {
                          managedOpsRouteState: failureDraft,
                        });
                        return;
                      }
                      const dispatchDraft = correctiveAction?.dispatchActionBrief
                        ? buildDispatchActionDraft(missionDispatchPressure)
                        : null;
                      if (dispatchDraft) {
                        onNavigate?.('managedOps', {
                          managedOpsRouteState: dispatchDraft,
                        });
                        return;
                      }
                      const connectorDraft = groupedFix?.correctiveAction?.opsPrompt ? buildConnectorActionDraft(correctiveAction, {
                        title: groupedFix?.affectedCount > 1 ? groupedFix.title : correctiveAction.label,
                        connectorLabel: groupedFix?.connectorLabel,
                        affectedBranches: groupedFix?.affectedBranches?.map((branch) => branch.title) || [],
                      }) : null;
                      if (!connectorDraft) {
                        onNavigate?.('managedOps', {
                          managedOpsRouteState: {
                            tab: 'create',
                            quickstartPrompt: correctiveAction.opsPrompt,
                            notice: `Commander staged the next control move from Intelligence: ${correctiveAction.label}.`,
                            controlActionBrief: correctiveAction.controlActionBrief || null,
                          },
                        });
                        return;
                      }
                      onNavigate?.('managedOps', {
                        managedOpsRouteState: {
                          tab: 'create',
                          ...connectorDraft,
                        },
                      });
                    }
                  }}
                />
              </div>
              <TruthAuditStrip truth={truth} />
            </div>
          </CollapsedPanel>
        </Motion.section>
      </Motion.div>
    </div>
  );
}
