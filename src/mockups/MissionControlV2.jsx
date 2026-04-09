/**
 * STATIC MOCKUP — Mission Control V2
 * Unified command center: Operations / Planner / Approvals
 * Intelligence embedded as a decision-support layer throughout.
 *
 * ALL DATA IS STATIC. No hooks, no Supabase, no production wiring.
 * DO NOT import into production routes until approved.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Clock, Zap, ShieldCheck, AlertTriangle, X, Play, Pause,
  StopCircle, RotateCcw, Copy, CheckCircle2, XCircle, CornerDownLeft,
  FileText, Code2, MessageSquare, Database, Brain, TrendingUp,
  Calendar, Repeat, ArrowRight, Shield, Cpu, Eye, Ban,
  DollarSign, Timer, GitBranch, Sparkles, ChevronRight,
  Activity, Radio, Lock, Unlock, Send, BarChart3,
} from 'lucide-react';
import { cn } from '../utils/cn';

// ═══════════════════════════════════════════════════════════════
// AGENT AVATARS
// ═══════════════════════════════════════════════════════════════

const AGENTS = {
  atlas:  { name: 'Atlas',  color: '#00D9C8', model: 'Claude Opus',   icon: '⬡', role: 'Commander' },
  orion:  { name: 'Orion',  color: '#60a5fa', model: 'Claude Sonnet', icon: '◈', role: 'Researcher' },
  vega:   { name: 'Vega',   color: '#a78bfa', model: 'Gemini 3.1',   icon: '◇', role: 'UI Agent' },
  lyra:   { name: 'Lyra',   color: '#fb7185', model: 'Hermes',       icon: '△', role: 'Researcher' },
  nova:   { name: 'Nova',   color: '#a78bfa', model: 'Claude Sonnet', icon: '◎', role: 'QA' },
  sol:    { name: 'Sol',    color: '#60a5fa', model: 'Llama 3 70B',  icon: '☉', role: 'Local' },
};

function AgentChip({ agentKey, size = 'sm' }) {
  const a = AGENTS[agentKey] || AGENTS.atlas;
  const sz = size === 'lg' ? 'w-8 h-8 text-sm' : 'w-5 h-5 text-[9px]';
  return (
    <div className="flex items-center gap-1.5">
      <div
        className={cn("rounded-lg flex items-center justify-center font-bold shrink-0 relative", sz)}
        style={{ backgroundColor: `${a.color}15`, border: `1px solid ${a.color}30`, color: a.color }}
      >
        {a.icon}
        {/* Status halo */}
        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface" style={{ backgroundColor: a.color }} />
      </div>
      {size === 'lg' && <span className="text-xs font-semibold text-text-primary">{a.name}</span>}
      {size === 'sm' && <span className="text-[10px] font-mono text-text-muted">{a.name}</span>}
    </div>
  );
}

function ModelBadge({ model }) {
  const colors = {
    'Claude Opus': 'bg-aurora-teal/10 text-aurora-teal border-aurora-teal/20',
    'Claude Sonnet': 'bg-aurora-blue/10 text-aurora-blue border-aurora-blue/20',
    'Gemini 3.1': 'bg-aurora-violet/10 text-aurora-violet border-aurora-violet/20',
    'Hermes': 'bg-aurora-rose/10 text-aurora-rose border-aurora-rose/20',
    'Llama 3 70B': 'bg-aurora-amber/10 text-aurora-amber border-aurora-amber/20',
    'Codex': 'bg-aurora-green/10 text-aurora-green border-aurora-green/20',
  };
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border", colors[model] || 'bg-white/5 text-text-muted border-white/10')}>
      {model}
    </span>
  );
}

function CostModeBadge({ mode }) {
  const styles = {
    local: 'bg-aurora-green/10 text-aurora-green',
    subscription: 'bg-aurora-blue/10 text-aurora-blue',
    payg: 'bg-aurora-amber/10 text-aurora-amber',
  };
  return (
    <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase", styles[mode] || styles.payg)}>
      {mode}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// INTELLIGENCE BADGES
// ═══════════════════════════════════════════════════════════════

function ScoreBadge({ label, value, color }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[8px] font-mono text-text-disabled uppercase">{label}</span>
      <span className={cn("text-[10px] font-mono font-bold", color)}>{value}</span>
    </div>
  );
}

function RiskFlag({ level }) {
  if (!level || level === 'none') return null;
  const styles = {
    low: 'text-aurora-green',
    medium: 'text-aurora-amber',
    high: 'text-aurora-rose',
    critical: 'text-aurora-rose animate-pulse',
  };
  return (
    <span className={cn("flex items-center gap-0.5 text-[9px] font-mono font-bold uppercase", styles[level])}>
      <AlertTriangle className="w-2.5 h-2.5" /> {level}
    </span>
  );
}

function IntelligenceStrip({ priority, confidence, risk, nextAction }) {
  return (
    <div className="flex items-center gap-3 mt-1.5">
      {priority && <ScoreBadge label="PRI" value={priority} color={priority >= 8 ? 'text-aurora-rose' : priority >= 5 ? 'text-aurora-amber' : 'text-aurora-teal'} />}
      {confidence && <ScoreBadge label="CONF" value={`${confidence}%`} color={confidence >= 90 ? 'text-aurora-green' : confidence >= 70 ? 'text-aurora-amber' : 'text-aurora-rose'} />}
      {risk && <RiskFlag level={risk} />}
      {nextAction && (
        <span className="text-[9px] font-mono text-aurora-violet flex items-center gap-0.5">
          <Sparkles className="w-2.5 h-2.5" /> {nextAction}
        </span>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STATIC DATA
// ═══════════════════════════════════════════════════════════════

const OPS_TASKS = [
  { id: 'op1', name: 'Scrape Broadway lottery sites', agent: 'atlas', status: 'running', elapsed: '2m 14s', model: 'Claude Opus', costMode: 'subscription', priority: 9, confidence: 94, risk: 'none', nextAction: 'Parse results next', anomaly: null, cost: '$0.12' },
  { id: 'op2', name: 'Parse 3PL shipment data', agent: 'orion', status: 'running', elapsed: '48s', model: 'Claude Sonnet', costMode: 'subscription', priority: 7, confidence: 88, risk: 'low', nextAction: 'Validate schema', anomaly: null, cost: '$0.03' },
  { id: 'op3', name: 'Generate NavRail component', agent: 'vega', status: 'completed', elapsed: '1m 02s', model: 'Gemini 3.1', costMode: 'payg', priority: 6, confidence: 91, risk: 'none', nextAction: null, anomaly: null, cost: '$0.08' },
  { id: 'op4', name: 'Vector embedding batch', agent: 'lyra', status: 'failed', elapsed: '34s', model: 'Hermes', costMode: 'local', priority: 8, confidence: 12, risk: 'critical', nextAction: 'Reassign to Sol', anomaly: 'OOM — 743MB peak vs 512MB limit', cost: '$0.00' },
  { id: 'op5', name: 'QA review — lottery pipeline', agent: 'nova', status: 'running', elapsed: '1m 38s', model: 'Claude Sonnet', costMode: 'subscription', priority: 7, confidence: 96, risk: 'none', nextAction: 'Submit approval', anomaly: null, cost: '$0.02' },
  { id: 'op6', name: 'Privacy scan — outbound messages', agent: 'sol', status: 'completed', elapsed: '12s', model: 'Llama 3 70B', costMode: 'local', priority: 5, confidence: 99, risk: 'none', nextAction: null, anomaly: null, cost: '$0.00' },
];

const PLANNER_QUEUE = [
  { id: 'pq1', name: 'Morning cost digest', agent: 'orion', scheduledFor: '09:00 AM', priority: 6, approvalRequired: false, reason: 'Daily routine — runs every weekday', estTime: '~2 min', estCost: '$0.04' },
  { id: 'pq2', name: 'Pipedrive stale quote cleanup', agent: 'atlas', scheduledFor: '10:00 AM', priority: 9, approvalRequired: true, reason: 'High-impact: will close 14 quotes automatically', estTime: '~5 min', estCost: '$0.18' },
  { id: 'pq3', name: 'Weekly fleet performance report', agent: 'nova', scheduledFor: '11:00 AM', priority: 5, approvalRequired: false, reason: 'Weekly routine — every Monday', estTime: '~3 min', estCost: '$0.06' },
  { id: 'pq4', name: 'Rush shipment margin analysis', agent: 'orion', scheduledFor: '02:00 PM', priority: 8, approvalRequired: true, reason: 'Founder priority: margin leak on rush jobs > 8 pallets', estTime: '~8 min', estCost: '$0.22' },
];

const PLANNER_ROUTINES = [
  { id: 'rt1', name: 'Broadway lottery entries', cadence: 'Daily 9:00 AM', agent: 'atlas', status: 'enabled', nextRun: 'Tomorrow 9:00 AM', lastResult: 'success', lastRun: 'Today 9:02 AM' },
  { id: 'rt2', name: 'Cost digest email', cadence: 'Weekdays 8:30 AM', agent: 'orion', status: 'enabled', nextRun: 'Tomorrow 8:30 AM', lastResult: 'success', lastRun: 'Today 8:31 AM' },
  { id: 'rt3', name: 'Vector index compaction', cadence: 'Weekly Sun 2:00 AM', agent: 'sol', status: 'enabled', nextRun: 'Sunday 2:00 AM', lastResult: 'success', lastRun: 'Last Sun 2:01 AM' },
  { id: 'rt4', name: 'Stale data cleanup', cadence: 'Monthly 1st 3:00 AM', agent: 'sol', status: 'paused', nextRun: 'Paused', lastResult: 'failed', lastRun: 'Mar 1 3:00 AM' },
];

const APPROVALS = [
  { id: 'ap1', name: 'Agent Crashed — OOMKilled', type: 'failed_run', agent: 'lyra', urgency: 'critical', waitTime: '7m', reason: 'Memory limit exceeded. 3/3 recovery attempts exhausted.', recommendation: 'Reassign to Sol with 1GB limit', blocked: 'intervention', confidence: 12, impact: 9 },
  { id: 'ap2', name: 'Send iMessage to 2 contacts', type: 'approval', agent: 'atlas', urgency: 'high', waitTime: '4m', reason: 'Outbound message requires human approval per Safety Guardrails directive.', recommendation: 'Approve — matches prior approved pattern', blocked: 'policy', confidence: 94, impact: 3 },
  { id: 'ap3', name: 'Close 14 stale Pipedrive quotes', type: 'approval', agent: 'atlas', urgency: 'high', waitTime: '2m', reason: 'Bulk action on CRM data. Cost ceiling check passed ($0.18).', recommendation: 'Approve with notification to sales team', blocked: 'policy', confidence: 88, impact: 7 },
  { id: 'ap4', name: 'QA Report — Lottery Pipeline', type: 'approval', agent: 'nova', urgency: 'normal', waitTime: '1m', reason: 'Standard QA pass. All assertions passed. No anomalies.', recommendation: 'Auto-approve eligible (add rule)', blocked: null, confidence: 96, impact: 2 },
  { id: 'ap5', name: 'Deploy NavRail component update', type: 'approval', agent: 'vega', urgency: 'normal', waitTime: '30s', reason: 'Code review pending. Output matches spec.', recommendation: 'Approve', blocked: null, confidence: 91, impact: 4 },
  { id: 'ap6', name: 'Rush margin analysis — budget hold', type: 'blocked', agent: 'orion', urgency: 'high', waitTime: '—', reason: 'Estimated cost $0.22 exceeds per-task budget of $0.15.', recommendation: 'Raise task budget or use Sonnet instead of Opus', blocked: 'budget', confidence: null, impact: 8 },
];

const INTEL_RECOMMENDATIONS = [
  { id: 'ir1', type: 'optimization', text: 'Lyra has crashed 3x this week on batches >1000. Switch vector jobs to Sol.', impact: 'high' },
  { id: 'ir2', type: 'cost', text: 'Atlas routes 34% of research through Opus. Redirect to Sonnet to save ~$18/mo.', impact: 'medium' },
  { id: 'ir3', type: 'anomaly', text: 'QA approval queue averaging 4.2m wait — was 1.8m last week. Consider auto-approve rules.', impact: 'high' },
];

const DRAWER_TIMELINE = [
  { time: '10:04:12', type: 'SYS', msg: 'Task dispatched to Atlas (Claude Opus)' },
  { time: '10:04:14', type: 'NET', msg: 'Connecting to broadwaydirect.com' },
  { time: '10:04:15', type: 'OK', msg: 'Firecrawl scrape complete — 3 shows found', tokens: 340, ms: 620 },
  { time: '10:04:18', type: 'OK', msg: 'Parsed lottery windows: Hamilton, Wicked, Dear Evan Hansen' },
  { time: '10:04:20', type: 'SYS', msg: 'Submitting for QA review (Nova)' },
];

const DRAWER_HISTORY = [
  { date: 'Today 10:04', status: 'running', cost: '$0.12', duration: '2m 14s' },
  { date: 'Yesterday 09:02', status: 'completed', cost: '$0.11', duration: '1m 58s' },
  { date: 'Apr 6 09:01', status: 'completed', cost: '$0.13', duration: '2m 22s' },
  { date: 'Apr 5 09:03', status: 'failed', cost: '$0.04', duration: '34s' },
];

// ═══════════════════════════════════════════════════════════════
// STATUS STYLES
// ═══════════════════════════════════════════════════════════════

const statusCfg = {
  running:   { accent: '#fbbf24', label: 'RUNNING', bg: 'bg-aurora-amber/10', text: 'text-aurora-amber' },
  completed: { accent: '#00D9C8', label: 'DONE',    bg: 'bg-aurora-teal/10',  text: 'text-aurora-teal' },
  failed:    { accent: '#fb7185', label: 'FAILED',  bg: 'bg-aurora-rose/10',  text: 'text-aurora-rose' },
  pending:   { accent: '#60a5fa', label: 'QUEUED',  bg: 'bg-aurora-blue/10',  text: 'text-aurora-blue' },
  enabled:   { accent: '#00D9C8', label: 'ACTIVE',  bg: 'bg-aurora-teal/10',  text: 'text-aurora-teal' },
  paused:    { accent: '#71717a', label: 'PAUSED',  bg: 'bg-white/5',         text: 'text-text-muted' },
  success:   { accent: '#00D9C8', label: 'PASS',    bg: 'bg-aurora-teal/10',  text: 'text-aurora-teal' },
};

const urgencyStyles = {
  critical: 'border-l-aurora-rose',
  high: 'border-l-aurora-amber',
  normal: 'border-l-aurora-teal',
};

const blockIcons = {
  policy: { icon: Lock, label: 'Policy', color: 'text-aurora-amber' },
  budget: { icon: DollarSign, label: 'Budget', color: 'text-aurora-rose' },
  intervention: { icon: AlertTriangle, label: 'Intervention', color: 'text-aurora-rose' },
  dependency: { icon: GitBranch, label: 'Dependency', color: 'text-aurora-blue' },
};

// ═══════════════════════════════════════════════════════════════
// OPERATIONS TAB
// ═══════════════════════════════════════════════════════════════

function OperationsTab({ onSelect }) {
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-1">
      {OPS_TASKS.map((task, i) => {
        const cfg = statusCfg[task.status] || statusCfg.pending;
        const a = AGENTS[task.agent];
        const isRunning = task.status === 'running';

        return (
          <button
            key={task.id}
            onClick={() => onSelect(task)}
            className="w-full text-left px-4 py-3.5 rounded-lg border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] hover:-translate-y-[1px] transition-all duration-150 group relative overflow-hidden"
          >
            {/* Left accent */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg" style={{ backgroundColor: cfg.accent }} />

            {/* Running pulse */}
            {isRunning && (
              <div className="absolute right-3 top-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute h-full w-full rounded-full opacity-75" style={{ backgroundColor: cfg.accent }} />
                  <span className="relative rounded-full h-2 w-2" style={{ backgroundColor: cfg.accent }} />
                </span>
              </div>
            )}

            {/* Row 1: Agent + Name + Status */}
            <div className="flex items-center gap-3">
              <AgentChip agentKey={task.agent} />
              <span className="text-[12px] font-semibold text-text-primary flex-1 truncate">{task.name}</span>
              <span className={cn("px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase", cfg.bg, cfg.text)}>{cfg.label}</span>
            </div>

            {/* Row 2: Metadata */}
            <div className="flex items-center gap-3 mt-2 ml-[26px]">
              <ModelBadge model={task.model} />
              <CostModeBadge mode={task.costMode} />
              <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Timer className="w-2.5 h-2.5" /> {task.elapsed}</span>
              <span className="text-[10px] font-mono text-text-disabled">{task.cost}</span>
            </div>

            {/* Row 3: Intelligence strip */}
            <div className="ml-[26px]">
              <IntelligenceStrip priority={task.priority} confidence={task.confidence} risk={task.risk} nextAction={task.nextAction} />
            </div>

            {/* Anomaly alert */}
            {task.anomaly && (
              <div className="ml-[26px] mt-2 px-2.5 py-1.5 bg-aurora-rose/5 border border-aurora-rose/15 rounded-md flex items-center gap-2">
                <AlertTriangle className="w-3 h-3 text-aurora-rose shrink-0" />
                <span className="text-[10px] font-mono text-aurora-rose">{task.anomaly}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PLANNER TAB
// ═══════════════════════════════════════════════════════════════

function PlannerTab({ onSelect }) {
  return (
    <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
      {/* Queued Jobs */}
      <div className="mb-6">
        <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-3 flex items-center gap-2">
          <Calendar className="w-3 h-3 text-aurora-teal" /> Queued for Today
        </div>
        <div className="space-y-1.5">
          {PLANNER_QUEUE.map(job => (
            <button
              key={job.id}
              onClick={() => onSelect({ ...job, status: 'pending' })}
              className="w-full text-left px-4 py-3.5 rounded-lg border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] hover:-translate-y-[1px] transition-all"
            >
              <div className="flex items-center gap-3">
                <AgentChip agentKey={job.agent} />
                <span className="text-[12px] font-semibold text-text-primary flex-1 truncate">{job.name}</span>
                <span className="text-[10px] font-mono text-aurora-blue">{job.scheduledFor}</span>
                {job.approvalRequired && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-aurora-amber/10 text-aurora-amber border border-aurora-amber/20">APPROVAL</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-2 ml-[26px]">
                <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Timer className="w-2.5 h-2.5" /> {job.estTime}</span>
                <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><DollarSign className="w-2.5 h-2.5" /> {job.estCost}</span>
                <ScoreBadge label="PRI" value={job.priority} color={job.priority >= 8 ? 'text-aurora-rose' : 'text-aurora-amber'} />
              </div>
              <div className="ml-[26px] mt-1.5">
                <span className="text-[9px] font-mono text-aurora-violet flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" /> {job.reason}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Recurring Routines */}
      <div>
        <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-3 flex items-center gap-2">
          <Repeat className="w-3 h-3 text-aurora-violet" /> Recurring Automations
        </div>
        <div className="space-y-1.5">
          {PLANNER_ROUTINES.map(rt => {
            const cfg = statusCfg[rt.status] || statusCfg.paused;
            const lastCfg = statusCfg[rt.lastResult] || statusCfg.completed;
            return (
              <button
                key={rt.id}
                onClick={() => onSelect({ ...rt })}
                className="w-full text-left px-4 py-3 rounded-lg border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] hover:-translate-y-[1px] transition-all"
              >
                <div className="flex items-center gap-3">
                  <AgentChip agentKey={rt.agent} />
                  <span className="text-[12px] font-semibold text-text-primary flex-1 truncate">{rt.name}</span>
                  <span className={cn("px-2 py-0.5 rounded text-[9px] font-mono font-bold", cfg.bg, cfg.text)}>{cfg.label}</span>
                </div>
                <div className="flex items-center gap-4 mt-2 ml-[26px] text-[10px] font-mono text-text-disabled">
                  <span className="flex items-center gap-1"><Repeat className="w-2.5 h-2.5" /> {rt.cadence}</span>
                  <span>Next: {rt.nextRun}</span>
                  <span className="flex items-center gap-1">
                    Last: <span className={lastCfg.text}>{rt.lastResult}</span> {rt.lastRun}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// APPROVALS TAB
// ═══════════════════════════════════════════════════════════════

function ApprovalsTab({ onSelect }) {
  const blocked = APPROVALS.filter(a => a.blocked);
  const pending = APPROVALS.filter(a => !a.blocked);

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar pr-1">
      {/* Blocked Items */}
      {blocked.length > 0 && (
        <div className="mb-6">
          <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-3 flex items-center gap-2">
            <Ban className="w-3 h-3 text-aurora-rose" /> Blocked ({blocked.length})
          </div>
          <div className="space-y-1.5">
            {blocked.map(ap => {
              const blk = blockIcons[ap.blocked];
              const BlkIcon = blk?.icon || AlertTriangle;
              return (
                <button
                  key={ap.id}
                  onClick={() => onSelect(ap)}
                  className={cn(
                    "w-full text-left px-4 py-3.5 rounded-lg border-l-[3px] border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] transition-all",
                    urgencyStyles[ap.urgency]
                  )}
                >
                  <div className="flex items-center gap-3">
                    <AgentChip agentKey={ap.agent} />
                    <span className="text-[12px] font-semibold text-text-primary flex-1 truncate">{ap.name}</span>
                    <span className={cn("flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold", blk?.color || 'text-aurora-rose')}>
                      <BlkIcon className="w-3 h-3" /> {blk?.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted mt-1.5 ml-[26px] leading-relaxed">{ap.reason}</p>
                  <div className="flex items-center gap-3 mt-1.5 ml-[26px]">
                    <span className="text-[9px] font-mono text-aurora-violet flex items-center gap-0.5">
                      <Sparkles className="w-2.5 h-2.5" /> {ap.recommendation}
                    </span>
                    {ap.impact && <ScoreBadge label="IMPACT" value={ap.impact} color={ap.impact >= 7 ? 'text-aurora-rose' : 'text-aurora-amber'} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Decisions */}
      <div>
        <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-3 flex items-center gap-2">
          <ShieldCheck className="w-3 h-3 text-aurora-amber" /> Pending Decisions ({pending.length})
        </div>
        <div className="space-y-1.5">
          {pending.map(ap => (
            <button
              key={ap.id}
              onClick={() => onSelect(ap)}
              className={cn(
                "w-full text-left px-4 py-3.5 rounded-lg border-l-[3px] border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] transition-all",
                urgencyStyles[ap.urgency]
              )}
            >
              <div className="flex items-center gap-3">
                <AgentChip agentKey={ap.agent} />
                <span className="text-[12px] font-semibold text-text-primary flex-1 truncate">{ap.name}</span>
                <span className="text-[10px] font-mono text-text-disabled">{ap.waitTime}</span>
              </div>
              <p className="text-[10px] text-text-muted mt-1.5 ml-[26px] leading-relaxed">{ap.reason}</p>
              <div className="flex items-center gap-3 mt-1.5 ml-[26px]">
                <span className="text-[9px] font-mono text-aurora-violet flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" /> {ap.recommendation}
                </span>
                {ap.confidence && <ScoreBadge label="CONF" value={`${ap.confidence}%`} color={ap.confidence >= 90 ? 'text-aurora-green' : 'text-aurora-amber'} />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════

function DetailDrawer({ item, onClose }) {
  const [tab, setTab] = useState('timeline');
  if (!item) return null;
  const a = AGENTS[item.agent] || AGENTS.atlas;
  const cfg = statusCfg[item.status] || statusCfg.pending;
  const isApproval = item.type === 'approval' || item.type === 'failed_run' || item.type === 'blocked';

  const tabs = [
    { id: 'timeline', label: 'Timeline' },
    { id: 'history', label: 'History' },
    { id: 'notes', label: 'Notes' },
  ];

  return (
    <>
      <motion.div key="d-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div
        key="d-panel"
        initial={{ x: '100%' }} animate={{ x: '0%' }} exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 35 }}
        className="fixed top-0 right-0 bottom-0 w-[480px] bg-surface border-l border-border z-50 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)]"
      >
        {/* Header */}
        <div className="p-5 border-b border-border bg-canvas/30 backdrop-blur shrink-0">
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3 mb-2">
                <AgentChip agentKey={item.agent} size="lg" />
                <ModelBadge model={item.model || a.model} />
                {item.costMode && <CostModeBadge mode={item.costMode} />}
              </div>
              <h3 className="text-lg font-semibold text-text-primary truncate">{item.name}</h3>
              <div className="flex items-center gap-3 mt-1">
                <span className={cn("text-xs font-mono font-bold uppercase", cfg.text)}>{cfg.label}</span>
                {item.elapsed && <span className="text-xs text-text-disabled font-mono flex items-center gap-1"><Clock className="w-3 h-3" /> {item.elapsed}</span>}
                {item.cost && <span className="text-xs text-text-disabled font-mono">{item.cost}</span>}
              </div>
              {/* Intelligence in drawer */}
              <IntelligenceStrip priority={item.priority} confidence={item.confidence} risk={item.risk} nextAction={item.nextAction} />
            </div>
            <button onClick={onClose} className="p-2 text-text-muted hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Reason / Recommendation */}
        {item.reason && (
          <div className="px-5 py-3 border-b border-white/[0.05] bg-white/[0.01]">
            <p className="text-[11px] text-text-body leading-relaxed">{item.reason}</p>
            {item.recommendation && (
              <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-aurora-violet">
                <Sparkles className="w-3 h-3" /> {item.recommendation}
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-border px-5 shrink-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("px-4 py-3 text-sm font-medium border-b-2 transition-colors",
                tab === t.id ? "border-aurora-teal text-aurora-teal" : "border-transparent text-text-muted hover:text-text-primary"
              )}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-5">
          {tab === 'timeline' && (
            <div className="space-y-0">
              {DRAWER_TIMELINE.map((log, i) => {
                const colors = { OK: 'bg-aurora-teal', SYS: 'bg-white/40', NET: 'bg-aurora-blue', ERR: 'bg-aurora-rose' };
                return (
                  <div key={i} className="flex gap-3 pb-4 last:pb-0">
                    <div className="flex flex-col items-center shrink-0">
                      <div className={cn("w-2 h-2 rounded-full", colors[log.type] || 'bg-white/40')} />
                      {i < DRAWER_TIMELINE.length - 1 && <div className="w-px flex-1 bg-white/[0.06] mt-1" />}
                    </div>
                    <div className="min-w-0 -mt-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-[10px] font-mono text-text-disabled">{log.time}</span>
                        <span className="text-[9px] font-mono font-bold uppercase text-text-disabled">{log.type}</span>
                      </div>
                      <p className="text-[12px] text-text-body font-mono leading-relaxed">{log.msg}</p>
                      {(log.tokens || log.ms) && (
                        <div className="flex gap-3 mt-1 text-[10px] font-mono text-text-disabled">
                          {log.tokens && <span>{log.tokens} tok</span>}
                          {log.ms && <span>{log.ms}ms</span>}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'history' && (
            <div className="space-y-2">
              {DRAWER_HISTORY.map((h, i) => {
                const hCfg = statusCfg[h.status] || statusCfg.completed;
                return (
                  <div key={i} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                    <span className="text-[11px] font-mono text-text-muted">{h.date}</span>
                    <span className={cn("text-[10px] font-mono font-bold", hCfg.text)}>{h.status}</span>
                    <span className="text-[10px] font-mono text-text-disabled">{h.duration}</span>
                    <span className="text-[10px] font-mono text-text-disabled">{h.cost}</span>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'notes' && (
            <div className="space-y-3">
              <div className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-aurora-amber/10 text-aurora-amber">Atlas</span>
                  <span className="text-[10px] font-mono text-text-disabled">10:04</span>
                </div>
                <p className="text-[12px] text-text-body leading-relaxed">Scraped 3 shows — all lottery windows confirmed open.</p>
              </div>
              <textarea placeholder="Add a note..." rows={2}
                className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-xs font-mono text-text-primary resize-none focus:border-aurora-teal/40 outline-none transition-colors placeholder:text-text-disabled" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-border p-4 bg-canvas/30 flex gap-2">
          {isApproval ? (
            <>
              <button className="flex-1 h-10 flex items-center justify-center gap-2 border border-aurora-rose/30 bg-aurora-rose/5 text-aurora-rose hover:bg-aurora-rose/10 rounded-xl font-bold uppercase text-[11px] transition-all">
                <XCircle className="w-4 h-4" /> Reject
              </button>
              <button className="flex-[2] h-10 flex items-center justify-center gap-2 bg-aurora-teal text-black hover:bg-[#00ebd8] rounded-xl font-bold uppercase text-[11px] transition-all shadow-[0_0_20px_rgba(0,217,200,0.3)]">
                <CheckCircle2 className="w-4 h-4" /> Approve
              </button>
            </>
          ) : (
            <>
              {item.status === 'running' && (
                <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-aurora-rose bg-aurora-rose/5 border border-aurora-rose/20 rounded-lg hover:bg-aurora-rose/10 transition-colors">
                  <StopCircle className="w-3.5 h-3.5" /> Stop
                </button>
              )}
              <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-aurora-amber bg-aurora-amber/5 border border-aurora-amber/20 rounded-lg hover:bg-aurora-amber/10 transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Rerun
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-aurora-teal bg-aurora-teal/5 border border-aurora-teal/20 rounded-lg hover:bg-aurora-teal/10 transition-colors">
                <Send className="w-3.5 h-3.5" /> Dispatch
              </button>
              <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-text-muted bg-white/[0.03] border border-white/[0.07] rounded-lg hover:bg-white/[0.06] transition-colors ml-auto">
                <Copy className="w-3.5 h-3.5" /> Copy
              </button>
            </>
          )}
        </div>
      </motion.div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// INTELLIGENCE SIDEBAR
// ═══════════════════════════════════════════════════════════════

function IntelSidebar() {
  return (
    <div className="flex flex-col gap-4">
      {/* System Pulse */}
      <div className="p-3.5 bg-white/[0.015] rounded-lg border border-white/[0.04]">
        <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-3 flex items-center gap-2">
          <Brain className="w-3 h-3 text-aurora-violet" /> System Intelligence
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-white/[0.02] rounded-lg text-center">
            <div className="text-lg font-mono font-bold text-aurora-teal">3</div>
            <div className="text-[8px] font-mono text-text-disabled uppercase">Running</div>
          </div>
          <div className="p-2 bg-white/[0.02] rounded-lg text-center">
            <div className="text-lg font-mono font-bold text-aurora-rose">2</div>
            <div className="text-[8px] font-mono text-text-disabled uppercase">Blocked</div>
          </div>
          <div className="p-2 bg-white/[0.02] rounded-lg text-center">
            <div className="text-lg font-mono font-bold text-aurora-amber">5</div>
            <div className="text-[8px] font-mono text-text-disabled uppercase">Pending</div>
          </div>
          <div className="p-2 bg-white/[0.02] rounded-lg text-center">
            <div className="text-lg font-mono font-bold text-text-primary">$0.25</div>
            <div className="text-[8px] font-mono text-text-disabled uppercase">Burn</div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div>
        <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-3 flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-aurora-violet" /> Recommendations
        </div>
        <div className="space-y-2">
          {INTEL_RECOMMENDATIONS.map(rec => {
            const impactColor = rec.impact === 'high' ? 'border-l-aurora-rose' : 'border-l-aurora-amber';
            return (
              <div key={rec.id} className={cn("p-3 bg-white/[0.015] rounded-lg border border-white/[0.04] border-l-[3px]", impactColor)}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn("text-[8px] font-mono font-bold uppercase px-1 py-0.5 rounded",
                    rec.type === 'anomaly' ? 'bg-aurora-rose/10 text-aurora-rose' :
                    rec.type === 'cost' ? 'bg-aurora-amber/10 text-aurora-amber' :
                    'bg-aurora-teal/10 text-aurora-teal'
                  )}>{rec.type}</span>
                </div>
                <p className="text-[10px] text-text-body leading-relaxed">{rec.text}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottleneck Detection */}
      <div className="p-3.5 bg-aurora-rose/[0.03] rounded-lg border border-aurora-rose/10">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-3 h-3 text-aurora-rose" />
          <span className="text-[9px] font-mono font-bold uppercase text-aurora-rose">Bottleneck Detected</span>
        </div>
        <p className="text-[10px] text-text-body leading-relaxed">Approval queue wait time is 2.3x above normal. 3 items blocked on human decision.</p>
        <button className="mt-2 text-[9px] font-mono font-bold text-aurora-teal hover:text-aurora-teal/80 flex items-center gap-1 transition-colors">
          <Sparkles className="w-2.5 h-2.5" /> Configure auto-approve rules
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN VIEW
// ═══════════════════════════════════════════════════════════════

const TABS = [
  { id: 'operations', label: 'Operations', icon: Radio, count: OPS_TASKS.filter(t => t.status === 'running').length },
  { id: 'planner', label: 'Planner', icon: Calendar, count: PLANNER_QUEUE.length },
  { id: 'approvals', label: 'Approvals', icon: ShieldCheck, count: APPROVALS.length },
];

export function MissionControlV2() {
  const [activeTab, setActiveTab] = useState('operations');
  const [selectedItem, setSelectedItem] = useState(null);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 mb-4">
        <div className="flex items-end justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-aurora-teal/10 border border-aurora-teal/20 flex items-center justify-center">
                <Target className="w-4 h-4 text-aurora-teal" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-primary tracking-tight">Mission Control</h2>
                <p className="text-[11px] text-text-muted mt-0.5">Operations, scheduling, approvals, and intelligence — one cockpit.</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-border">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 text-[11px] font-medium rounded-md transition-all",
                  activeTab === t.id
                    ? "bg-white/[0.08] text-text-primary"
                    : "text-text-muted hover:text-text-primary hover:bg-white/[0.04]"
                )}
              >
                <t.icon className="w-3.5 h-3.5" />
                {t.label}
                <span className={cn(
                  "px-1.5 py-0.5 rounded text-[9px] font-mono font-bold",
                  activeTab === t.id ? "bg-aurora-teal/10 text-aurora-teal" : "bg-white/5 text-text-disabled"
                )}>{t.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main: Content + Intelligence Sidebar */}
      <div className="flex-1 flex gap-5 overflow-hidden min-h-0">
        {/* Main content area */}
        <div className="flex-[3] flex flex-col min-w-0 overflow-hidden">
          {activeTab === 'operations' && <OperationsTab onSelect={setSelectedItem} />}
          {activeTab === 'planner' && <PlannerTab onSelect={setSelectedItem} />}
          {activeTab === 'approvals' && <ApprovalsTab onSelect={setSelectedItem} />}
        </div>

        {/* Intelligence sidebar */}
        <div className="w-[280px] shrink-0 overflow-y-auto no-scrollbar">
          <IntelSidebar />
        </div>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedItem && <DetailDrawer item={selectedItem} onClose={() => setSelectedItem(null)} />}
      </AnimatePresence>
    </div>
  );
}
