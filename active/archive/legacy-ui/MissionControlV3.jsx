/**
 * STATIC MOCKUP — Mission Control V3
 * Unified command center: Operations / Planner / Approvals
 * + Attention management, Recently Completed, Intelligence layer
 *
 * ALL DATA IS STATIC. No hooks, no Supabase.
 * DO NOT import into production until approved.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Clock, Zap, ShieldCheck, AlertTriangle, X, Play, Pause,
  StopCircle, RotateCcw, Copy, CheckCircle2, XCircle, CornerDownLeft,
  FileText, Code2, MessageSquare, Brain, TrendingUp,
  Calendar, Repeat, Shield, Eye, Ban, EyeOff,
  DollarSign, Timer, GitBranch, Sparkles, ChevronRight,
  Radio, Lock, Send, Archive, BookMarked, AlarmClock,
  ChevronDown, Bookmark, Bell,
} from 'lucide-react';
import { cn } from '../utils/cn';

// ═══════════════════════════════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════════════════════════════

const AG = {
  atlas: { n: 'Atlas', c: '#00D9C8', m: 'Claude Opus', ic: '⬡', r: 'Commander', cls: 'commander' },
  orion: { n: 'Orion', c: '#60a5fa', m: 'Claude Sonnet', ic: '◈', r: 'Researcher', cls: 'analyst' },
  vega:  { n: 'Vega',  c: '#a78bfa', m: 'Gemini 3.1', ic: '◇', r: 'UI Agent', cls: 'specialist' },
  lyra:  { n: 'Lyra',  c: '#fb7185', m: 'Hermes', ic: '△', r: 'Researcher', cls: 'analyst' },
  nova:  { n: 'Nova',  c: '#a78bfa', m: 'Claude Sonnet', ic: '◎', r: 'QA', cls: 'reviewer' },
  sol:   { n: 'Sol',   c: '#60a5fa', m: 'Llama 3 70B', ic: '☉', r: 'Local Ops', cls: 'operator' },
};

const clsStyle = {
  commander:  'ring-aurora-teal/30',
  analyst:    'ring-aurora-blue/30',
  specialist: 'ring-aurora-violet/30',
  reviewer:   'ring-aurora-amber/30',
  operator:   'ring-aurora-green/30',
};

function Chip({ agentKey, size = 'sm' }) {
  const a = AG[agentKey] || AG.atlas;
  const big = size === 'lg';
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn(
        "rounded-lg flex items-center justify-center font-bold shrink-0 relative ring-1",
        clsStyle[a.cls] || 'ring-white/10',
        big ? 'w-8 h-8 text-sm' : 'w-5 h-5 text-[9px]'
      )} style={{ backgroundColor: `${a.c}12`, color: a.c }}>
        {a.ic}
        <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-surface" style={{ backgroundColor: a.c }} />
      </div>
      <span className={cn("font-mono", big ? 'text-xs font-semibold text-text-primary' : 'text-[10px] text-text-muted')}>{a.n}</span>
    </div>
  );
}

function ModelBadge({ m }) {
  const c = { 'Claude Opus': 'text-aurora-teal border-aurora-teal/20', 'Claude Sonnet': 'text-aurora-blue border-aurora-blue/20', 'Gemini 3.1': 'text-aurora-violet border-aurora-violet/20', 'Hermes': 'text-aurora-rose border-aurora-rose/20', 'Llama 3 70B': 'text-aurora-amber border-aurora-amber/20' };
  return <span className={cn("px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border bg-white/[0.02]", c[m] || 'text-text-muted border-white/10')}>{m}</span>;
}

function CostBadge({ mode }) {
  const s = { local: 'text-aurora-green', sub: 'text-aurora-blue', payg: 'text-aurora-amber' };
  return <span className={cn("text-[8px] font-mono font-bold uppercase", s[mode] || s.payg)}>{mode}</span>;
}

// ═══════════════════════════════════════════════════════════════
// INTELLIGENCE COMPONENTS
// ═══════════════════════════════════════════════════════════════

function Score({ l, v, color }) {
  return <span className="flex items-center gap-0.5"><span className="text-[7px] font-mono text-text-disabled uppercase">{l}</span><span className={cn("text-[10px] font-mono font-bold", color)}>{v}</span></span>;
}

function Risk({ level }) {
  if (!level || level === 'none') return null;
  const s = { low: 'text-aurora-green', med: 'text-aurora-amber', high: 'text-aurora-rose', crit: 'text-aurora-rose animate-pulse' };
  return <span className={cn("flex items-center gap-0.5 text-[9px] font-mono font-bold uppercase", s[level])}><AlertTriangle className="w-2.5 h-2.5" />{level}</span>;
}

function UrgencyMeter({ v }) {
  const w = Math.min(v * 10, 100);
  const c = v >= 8 ? '#fb7185' : v >= 5 ? '#fbbf24' : '#00D9C8';
  return (
    <div className="w-10 h-1 rounded-full bg-white/[0.06] overflow-hidden">
      <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundColor: c }} />
    </div>
  );
}

function IntelStrip({ pri, conf, risk, next }) {
  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      {pri != null && <><UrgencyMeter v={pri} /><Score l="PRI" v={pri} color={pri >= 8 ? 'text-aurora-rose' : pri >= 5 ? 'text-aurora-amber' : 'text-aurora-teal'} /></>}
      {conf != null && <Score l="CONF" v={`${conf}%`} color={conf >= 90 ? 'text-aurora-green' : conf >= 70 ? 'text-aurora-amber' : 'text-aurora-rose'} />}
      {risk && <Risk level={risk} />}
      {next && <span className="text-[9px] font-mono text-aurora-violet flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />{next}</span>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// STATUS SYSTEM
// ═══════════════════════════════════════════════════════════════

const ST = {
  running:   { ac: '#fbbf24', lb: 'RUNNING', bg: 'bg-aurora-amber/10', tx: 'text-aurora-amber' },
  completed: { ac: '#00D9C8', lb: 'DONE',    bg: 'bg-aurora-teal/10',  tx: 'text-aurora-teal' },
  failed:    { ac: '#fb7185', lb: 'FAILED',  bg: 'bg-aurora-rose/10',  tx: 'text-aurora-rose' },
  pending:   { ac: '#60a5fa', lb: 'QUEUED',  bg: 'bg-aurora-blue/10',  tx: 'text-aurora-blue' },
  review:    { ac: '#fbbf24', lb: 'REVIEW',  bg: 'bg-aurora-amber/10', tx: 'text-aurora-amber' },
  blocked:   { ac: '#fb7185', lb: 'BLOCKED', bg: 'bg-aurora-rose/10',  tx: 'text-aurora-rose' },
  enabled:   { ac: '#00D9C8', lb: 'ACTIVE',  bg: 'bg-aurora-teal/10',  tx: 'text-aurora-teal' },
  paused:    { ac: '#71717a', lb: 'PAUSED',  bg: 'bg-white/5',         tx: 'text-text-muted' },
};

const urgBorder = { crit: 'border-l-aurora-rose', high: 'border-l-aurora-amber', norm: 'border-l-aurora-teal', low: 'border-l-white/10' };
const blkMeta = { policy: { ic: Lock, lb: 'Policy', cl: 'text-aurora-amber' }, budget: { ic: DollarSign, lb: 'Budget', cl: 'text-aurora-rose' }, intervention: { ic: AlertTriangle, lb: 'Needs Me', cl: 'text-aurora-rose' }, dep: { ic: GitBranch, lb: 'Dependency', cl: 'text-aurora-blue' } };

// ═══════════════════════════════════════════════════════════════
// STATIC DATA
// ═══════════════════════════════════════════════════════════════

const CRITICAL_LANE = [
  { id: 'cl1', name: 'Lyra OOM — vector batch killed', agent: 'lyra', status: 'failed', time: '7m stalled', urg: 'crit', blk: 'intervention' },
  { id: 'cl2', name: 'iMessage approval — 2 contacts', agent: 'atlas', status: 'review', time: '4m waiting', urg: 'high', blk: 'policy' },
];

const OPS = [
  { id: 'o1', name: 'Scrape Broadway lottery sites', agent: 'atlas', status: 'running', time: '2m 14s', model: 'Claude Opus', cost: 'sub', pri: 9, conf: 94, risk: 'none', next: 'Parse results next', anomaly: null, price: '$0.12', seen: true },
  { id: 'o2', name: 'Parse 3PL shipment data', agent: 'orion', status: 'running', time: '48s', model: 'Claude Sonnet', cost: 'sub', pri: 7, conf: 88, risk: 'low', next: 'Validate schema', anomaly: null, price: '$0.03', seen: true },
  { id: 'o3', name: 'QA review — lottery pipeline', agent: 'nova', status: 'running', time: '1m 38s', model: 'Claude Sonnet', cost: 'sub', pri: 7, conf: 96, risk: 'none', next: 'Submit approval', anomaly: null, price: '$0.02', seen: true },
  { id: 'o4', name: 'Privacy scan — outbound messages', agent: 'sol', status: 'completed', time: '12s', model: 'Llama 3 70B', cost: 'local', pri: 5, conf: 99, risk: 'none', next: null, anomaly: null, price: '$0.00', seen: true },
  { id: 'o5', name: 'Vector embedding batch', agent: 'lyra', status: 'failed', time: '34s', model: 'Hermes', cost: 'local', pri: 8, conf: 12, risk: 'crit', next: 'Reassign to Sol', anomaly: 'OOM — 743MB peak / 512MB limit', price: '$0.00', seen: false },
];

const PLAN_Q = [
  { id: 'pq1', name: 'Morning cost digest', agent: 'orion', sched: '09:00 AM', pri: 6, approve: false, why: 'Daily routine — runs every weekday', est: '~2 min', estC: '$0.04' },
  { id: 'pq2', name: 'Close 14 stale Pipedrive quotes', agent: 'atlas', sched: '10:00 AM', pri: 9, approve: true, why: 'High-impact: will auto-close 14 quotes older than 7 days', est: '~5 min', estC: '$0.18' },
  { id: 'pq3', name: 'Weekly fleet performance report', agent: 'nova', sched: '11:00 AM', pri: 5, approve: false, why: 'Weekly routine — every Monday', est: '~3 min', estC: '$0.06' },
  { id: 'pq4', name: 'Rush shipment margin analysis', agent: 'orion', sched: '02:00 PM', pri: 8, approve: true, why: 'Founder priority: margin leak on rush jobs > 8 pallets', est: '~8 min', estC: '$0.22' },
];

const PLAN_RT = [
  { id: 'r1', name: 'Broadway lottery entries', cad: 'Daily 9 AM', agent: 'atlas', st: 'enabled', nx: 'Tomorrow 9:00 AM', last: 'success', lastT: 'Today 9:02 AM' },
  { id: 'r2', name: 'Cost digest email', cad: 'Weekdays 8:30 AM', agent: 'orion', st: 'enabled', nx: 'Tomorrow 8:30 AM', last: 'success', lastT: 'Today 8:31 AM' },
  { id: 'r3', name: 'Vector index compaction', cad: 'Weekly Sun 2 AM', agent: 'sol', st: 'enabled', nx: 'Sunday 2:00 AM', last: 'success', lastT: 'Last Sun 2:01 AM' },
  { id: 'r4', name: 'Stale data cleanup', cad: 'Monthly 1st 3 AM', agent: 'sol', st: 'paused', nx: 'Paused', last: 'failed', lastT: 'Mar 1 3:00 AM' },
];

const APPROVALS = [
  { id: 'a1', name: 'Agent Crashed — OOMKilled', agent: 'lyra', urg: 'crit', wait: '7m', reason: 'Memory limit exceeded. 3/3 recovery attempts failed.', rec: 'Reassign to Sol with 1GB limit', blk: 'intervention', conf: 12, imp: 9, seen: false },
  { id: 'a2', name: 'Send iMessage to 2 contacts', agent: 'atlas', urg: 'high', wait: '4m', reason: 'Outbound message — requires human approval per Safety directive.', rec: 'Approve — matches prior approved pattern', blk: 'policy', conf: 94, imp: 3, seen: false },
  { id: 'a3', name: 'Close 14 stale Pipedrive quotes', agent: 'atlas', urg: 'high', wait: '2m', reason: 'Bulk CRM action. Cost ceiling check passed ($0.18).', rec: 'Approve with sales team notification', blk: 'policy', conf: 88, imp: 7, seen: false },
  { id: 'a4', name: 'QA Report — Lottery Pipeline', agent: 'nova', urg: 'norm', wait: '1m', reason: 'Standard QA pass. All assertions passed.', rec: 'Auto-approve eligible (add rule)', blk: null, conf: 96, imp: 2, seen: false },
  { id: 'a5', name: 'Deploy NavRail component update', agent: 'vega', urg: 'norm', wait: '30s', reason: 'Code review pending. Output matches spec.', rec: 'Approve', blk: null, conf: 91, imp: 4, seen: false },
  { id: 'a6', name: 'Rush margin analysis — budget hold', agent: 'orion', urg: 'high', wait: '—', reason: 'Estimated cost $0.22 exceeds per-task budget of $0.15.', rec: 'Raise budget or switch to Sonnet', blk: 'budget', conf: null, imp: 8, seen: false },
];

const COMPLETED = [
  { id: 'c1', name: 'Generate NavRail component', agent: 'vega', completedAt: '3m ago', cost: '$0.08', dur: '1m 02s', seen: false },
  { id: 'c2', name: 'Privacy scan — outbound msgs', agent: 'sol', completedAt: '5m ago', cost: '$0.00', dur: '12s', seen: false },
  { id: 'c3', name: 'Morning cost digest', agent: 'orion', completedAt: '32m ago', cost: '$0.04', dur: '1m 48s', seen: true },
  { id: 'c4', name: 'Broadway lottery scrape', agent: 'atlas', completedAt: '1h ago', cost: '$0.11', dur: '1m 58s', seen: true },
];

const INTEL_RECS = [
  { id: 'i1', type: 'anomaly', text: 'Lyra crashed 3x this week on batches >1000. Switch vector jobs to Sol.', imp: 'high' },
  { id: 'i2', type: 'cost', text: 'Atlas routes 34% of research through Opus. Redirect to Sonnet — save ~$18/mo.', imp: 'med' },
  { id: 'i3', type: 'bottleneck', text: 'Approval queue wait 4.2m avg — was 1.8m last week. Consider auto-approve rules.', imp: 'high' },
];

const TIMELINE = [
  { t: '10:04:12', tp: 'SYS', msg: 'Task dispatched to Atlas (Claude Opus)', tk: null, ms: null },
  { t: '10:04:14', tp: 'NET', msg: 'Connecting to broadwaydirect.com', tk: null, ms: 890 },
  { t: '10:04:15', tp: 'OK', msg: 'Firecrawl scrape — 3 shows found', tk: 340, ms: 620 },
  { t: '10:04:18', tp: 'OK', msg: 'Parsed lottery windows: Hamilton, Wicked, Dear Evan Hansen', tk: null, ms: null },
  { t: '10:04:20', tp: 'SYS', msg: 'Submitting for QA review (Nova)', tk: null, ms: null },
];

const HISTORY = [
  { dt: 'Today 10:04', st: 'running', cost: '$0.12', dur: '2m 14s' },
  { dt: 'Yesterday 09:02', st: 'completed', cost: '$0.11', dur: '1m 58s' },
  { dt: 'Apr 6 09:01', st: 'completed', cost: '$0.13', dur: '2m 22s' },
  { dt: 'Apr 5 09:03', st: 'failed', cost: '$0.04', dur: '34s' },
];

// ═══════════════════════════════════════════════════════════════
// ATTENTION COUNTS
// ═══════════════════════════════════════════════════════════════

const needsReviewCount = APPROVALS.filter(a => !a.seen).length;
const unseenCompletedCount = COMPLETED.filter(c => !c.seen).length;
const blockedNeedsMeCount = APPROVALS.filter(a => a.blk === 'intervention').length;
const totalAttention = needsReviewCount + unseenCompletedCount;

// ═══════════════════════════════════════════════════════════════
// COMMAND PULSE STRIP
// ═══════════════════════════════════════════════════════════════

function PulseStrip() {
  const running = OPS.filter(o => o.status === 'running').length;
  const blocked = APPROVALS.filter(a => a.blk).length;
  const approvals = APPROVALS.length;
  const done = COMPLETED.length;
  return (
    <div className="flex items-center gap-4 mb-4">
      {[
        { lb: 'Active', v: running, cl: 'text-aurora-amber', gl: 'shadow-[0_0_8px_rgba(251,191,36,0.15)]' },
        { lb: 'Blocked', v: blocked, cl: 'text-aurora-rose', gl: blocked > 0 ? 'shadow-[0_0_8px_rgba(251,113,133,0.15)]' : '' },
        { lb: 'Approvals', v: approvals, cl: 'text-aurora-amber', gl: '' },
        { lb: 'Done Today', v: done, cl: 'text-aurora-teal', gl: '' },
        { lb: 'Unseen', v: unseenCompletedCount, cl: unseenCompletedCount > 0 ? 'text-aurora-violet' : 'text-text-disabled', gl: unseenCompletedCount > 0 ? 'shadow-[0_0_8px_rgba(167,139,250,0.15)]' : '' },
      ].map(s => (
        <div key={s.lb} className={cn("px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] flex items-center gap-2", s.gl)}>
          <span className={cn("text-lg font-mono font-bold", s.cl)}>{s.v}</span>
          <span className="text-[9px] font-mono text-text-disabled uppercase">{s.lb}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL LANE
// ═══════════════════════════════════════════════════════════════

function CriticalLane({ onSelect }) {
  if (CRITICAL_LANE.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-aurora-rose animate-pulse" />
        <span className="text-[9px] font-mono font-bold uppercase text-aurora-rose tracking-[0.2em]">Critical — Needs You Now</span>
      </div>
      <div className="flex gap-2">
        {CRITICAL_LANE.map(item => {
          const b = blkMeta[item.blk];
          const BlkIc = b?.ic || AlertTriangle;
          return (
            <button key={item.id} onClick={() => onSelect(item)}
              className="flex-1 px-4 py-3 rounded-lg border border-aurora-rose/20 bg-aurora-rose/[0.03] hover:bg-aurora-rose/[0.06] transition-all text-left relative overflow-hidden group">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-aurora-rose rounded-l-lg" />
              <div className="flex items-center gap-2 mb-1">
                <Chip agentKey={item.agent} />
                <span className="text-[11px] font-semibold text-text-primary truncate flex-1">{item.name}</span>
                <span className={cn("flex items-center gap-1 text-[9px] font-mono font-bold", b?.cl)}><BlkIc className="w-3 h-3" />{b?.lb}</span>
              </div>
              <div className="flex items-center gap-3 ml-[26px]">
                <span className="text-[10px] font-mono text-aurora-rose">{item.time}</span>
                <span className="text-[9px] font-mono text-aurora-violet flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />Needs your decision</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ATTENTION FILTERS
// ═══════════════════════════════════════════════════════════════

const ATTN_FILTERS = [
  { id: 'all', lb: 'All Attention', count: totalAttention },
  { id: 'review', lb: 'Needs Review', count: needsReviewCount },
  { id: 'approvals', lb: 'Approvals', count: APPROVALS.length },
  { id: 'blocked', lb: 'Blocked', count: APPROVALS.filter(a => a.blk).length },
  { id: 'completed', lb: 'Recently Completed', count: unseenCompletedCount },
];

// ═══════════════════════════════════════════════════════════════
// TASK ROW
// ═══════════════════════════════════════════════════════════════

function TaskRow({ item, selected, onClick, showIntel = true }) {
  const cfg = ST[item.status] || ST.pending;
  const isRun = item.status === 'running';
  const isUnseen = item.seen === false;
  return (
    <button onClick={onClick} className={cn(
      "w-full text-left px-4 py-3 rounded-lg border transition-all duration-150 group relative overflow-hidden",
      item.urg ? `border-l-[3px] ${urgBorder[item.urg] || 'border-l-white/10'}` : 'border-l-[3px] border-l-transparent',
      selected ? "bg-white/[0.05] border-white/[0.1] shadow-[0_0_20px_rgba(0,217,200,0.06)] ring-1 ring-aurora-teal/20" : "border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] hover:-translate-y-[1px]",
      isUnseen && "border-l-aurora-violet"
    )}>
      {isRun && <div className="absolute right-3 top-3"><span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full opacity-75" style={{ backgroundColor: cfg.ac }} /><span className="relative rounded-full h-2 w-2" style={{ backgroundColor: cfg.ac }} /></span></div>}
      {isUnseen && <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-aurora-violet ring-2 ring-surface" />}

      <div className="flex items-center gap-3">
        <Chip agentKey={item.agent} />
        <span className="text-[12px] font-semibold text-text-primary flex-1 truncate">{item.name}</span>
        <span className={cn("px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase", cfg.bg, cfg.tx)}>{cfg.lb}</span>
      </div>

      <div className="flex items-center gap-3 mt-1.5 ml-[26px]">
        {item.model && <ModelBadge m={item.model} />}
        {item.cost && <CostBadge mode={item.cost} />}
        {item.time && <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Timer className="w-2.5 h-2.5" />{item.time}</span>}
        {item.wait && <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{item.wait}</span>}
        {item.price && <span className="text-[10px] font-mono text-text-disabled">{item.price}</span>}
        {item.blk && (() => { const b = blkMeta[item.blk]; const I = b?.ic || AlertTriangle; return <span className={cn("flex items-center gap-0.5 text-[9px] font-mono font-bold", b?.cl)}><I className="w-3 h-3" />{b?.lb}</span>; })()}
      </div>

      {showIntel && (item.pri != null || item.conf != null || item.risk || item.next || item.rec) && (
        <div className="ml-[26px] mt-1.5">
          <IntelStrip pri={item.pri} conf={item.conf} risk={item.risk} next={item.next || item.rec} />
        </div>
      )}

      {item.anomaly && (
        <div className="ml-[26px] mt-2 px-2.5 py-1.5 bg-aurora-rose/5 border border-aurora-rose/15 rounded-md flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-aurora-rose shrink-0" />
          <span className="text-[10px] font-mono text-aurora-rose">{item.anomaly}</span>
        </div>
      )}

      {item.reason && !item.anomaly && (
        <p className="text-[10px] text-text-muted mt-1.5 ml-[26px] leading-relaxed line-clamp-1">{item.reason}</p>
      )}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPLETED SECTION
// ═══════════════════════════════════════════════════════════════

function CompletedSection({ onSelect }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="mt-5">
      <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 mb-2 w-full text-left">
        <ChevronDown className={cn("w-3 h-3 text-text-disabled transition-transform", !expanded && "-rotate-90")} />
        <Archive className="w-3 h-3 text-text-disabled" />
        <span className="text-[9px] font-mono font-bold uppercase text-text-disabled tracking-[0.2em]">Recently Completed</span>
        {unseenCompletedCount > 0 && <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-aurora-violet/10 text-aurora-violet">{unseenCompletedCount} unseen</span>}
      </button>
      {expanded && (
        <div className="space-y-1 opacity-80">
          {COMPLETED.map(c => (
            <button key={c.id} onClick={() => onSelect(c)} className={cn(
              "w-full text-left px-4 py-2.5 rounded-lg border border-white/[0.03] bg-white/[0.01] hover:bg-white/[0.025] transition-all flex items-center gap-3",
              !c.seen && "border-l-[3px] border-l-aurora-violet"
            )}>
              {!c.seen && <div className="w-2 h-2 rounded-full bg-aurora-violet shrink-0" />}
              <Chip agentKey={c.agent} />
              <span className="text-[11px] text-text-body flex-1 truncate">{c.name}</span>
              <span className="text-[10px] font-mono text-text-disabled">{c.dur}</span>
              <span className="text-[10px] font-mono text-text-disabled">{c.cost}</span>
              <span className="text-[10px] font-mono text-text-disabled">{c.completedAt}</span>
              <CheckCircle2 className="w-3 h-3 text-aurora-teal shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════════════════════════

function OpsTab({ selected, onSelect }) {
  return (<div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 pr-1">
    {OPS.map(o => <TaskRow key={o.id} item={o} selected={selected?.id === o.id} onClick={() => onSelect(o)} />)}
    <CompletedSection onSelect={onSelect} />
  </div>);
}

function PlanTab({ selected, onSelect }) {
  return (<div className="flex-1 overflow-y-auto no-scrollbar pr-1">
    <div className="mb-5">
      <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-2 flex items-center gap-2"><Calendar className="w-3 h-3 text-aurora-teal" />Queued for Today</div>
      <div className="space-y-1.5">
        {PLAN_Q.map(j => (
          <button key={j.id} onClick={() => onSelect({ ...j, status: 'pending' })} className="w-full text-left px-4 py-3 rounded-lg border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] hover:-translate-y-[1px] transition-all">
            <div className="flex items-center gap-3">
              <Chip agentKey={j.agent} />
              <span className="text-[12px] font-semibold text-text-primary flex-1 truncate">{j.name}</span>
              <span className="text-[10px] font-mono text-aurora-blue">{j.sched}</span>
              {j.approve && <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold bg-aurora-amber/10 text-aurora-amber border border-aurora-amber/20">APPROVAL</span>}
            </div>
            <div className="flex items-center gap-3 mt-1.5 ml-[26px]">
              <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><Timer className="w-2.5 h-2.5" />{j.est}</span>
              <span className="text-[10px] font-mono text-text-disabled flex items-center gap-1"><DollarSign className="w-2.5 h-2.5" />{j.estC}</span>
              <UrgencyMeter v={j.pri} />
              <Score l="PRI" v={j.pri} color={j.pri >= 8 ? 'text-aurora-rose' : 'text-aurora-amber'} />
            </div>
            <div className="ml-[26px] mt-1"><span className="text-[9px] font-mono text-aurora-violet flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" />{j.why}</span></div>
          </button>
        ))}
      </div>
    </div>
    <div>
      <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-2 flex items-center gap-2"><Repeat className="w-3 h-3 text-aurora-violet" />Recurring Automations</div>
      <div className="space-y-1.5">
        {PLAN_RT.map(rt => {
          const cfg = ST[rt.st] || ST.paused;
          const lCfg = ST[rt.last] || ST.completed;
          return (
            <button key={rt.id} onClick={() => onSelect(rt)} className="w-full text-left px-4 py-2.5 rounded-lg border border-white/[0.04] bg-white/[0.015] hover:bg-white/[0.03] transition-all">
              <div className="flex items-center gap-3">
                <Chip agentKey={rt.agent} />
                <span className="text-[11px] font-semibold text-text-primary flex-1 truncate">{rt.name}</span>
                <span className={cn("px-2 py-0.5 rounded text-[9px] font-mono font-bold", cfg.bg, cfg.tx)}>{cfg.lb}</span>
              </div>
              <div className="flex items-center gap-4 mt-1.5 ml-[26px] text-[10px] font-mono text-text-disabled">
                <span className="flex items-center gap-1"><Repeat className="w-2.5 h-2.5" />{rt.cad}</span>
                <span>Next: {rt.nx}</span>
                <span className="flex items-center gap-1">Last: <span className={lCfg.tx}>{rt.last}</span> {rt.lastT}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  </div>);
}

function AppTab({ selected, onSelect }) {
  const blocked = APPROVALS.filter(a => a.blk);
  const pending = APPROVALS.filter(a => !a.blk);
  return (<div className="flex-1 overflow-y-auto no-scrollbar pr-1">
    {blocked.length > 0 && <div className="mb-5">
      <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-2 flex items-center gap-2"><Ban className="w-3 h-3 text-aurora-rose" />Blocked ({blocked.length})</div>
      <div className="space-y-1.5">{blocked.map(a => <TaskRow key={a.id} item={a} selected={selected?.id === a.id} onClick={() => onSelect(a)} />)}</div>
    </div>}
    <div>
      <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-2 flex items-center gap-2"><ShieldCheck className="w-3 h-3 text-aurora-amber" />Pending Decisions ({pending.length})</div>
      <div className="space-y-1.5">{pending.map(a => <TaskRow key={a.id} item={a} selected={selected?.id === a.id} onClick={() => onSelect(a)} />)}</div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// INTELLIGENCE SIDEBAR
// ═══════════════════════════════════════════════════════════════

function IntelSidebar() {
  return (<div className="flex flex-col gap-4">
    <div className="p-3 bg-white/[0.015] rounded-lg border border-white/[0.04]">
      <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-2.5 flex items-center gap-2"><Brain className="w-3 h-3 text-aurora-violet" />System Intelligence</div>
      <div className="grid grid-cols-2 gap-1.5">
        {[
          { v: '3', l: 'Running', c: 'text-aurora-amber' },
          { v: '3', l: 'Blocked', c: 'text-aurora-rose' },
          { v: '6', l: 'Approvals', c: 'text-aurora-amber' },
          { v: '$0.25', l: 'Burn', c: 'text-text-primary' },
        ].map(s => (
          <div key={s.l} className="p-2 bg-white/[0.02] rounded-lg text-center">
            <div className={cn("text-base font-mono font-bold", s.c)}>{s.v}</div>
            <div className="text-[7px] font-mono text-text-disabled uppercase">{s.l}</div>
          </div>
        ))}
      </div>
    </div>

    <div>
      <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-2 flex items-center gap-2"><Sparkles className="w-3 h-3 text-aurora-violet" />Recommendations</div>
      <div className="space-y-1.5">
        {INTEL_RECS.map(r => (
          <div key={r.id} className={cn("p-2.5 bg-white/[0.015] rounded-lg border border-white/[0.04] border-l-[3px]", r.imp === 'high' ? 'border-l-aurora-rose' : 'border-l-aurora-amber')}>
            <span className={cn("text-[8px] font-mono font-bold uppercase px-1 py-0.5 rounded mb-1 inline-block", r.type === 'anomaly' ? 'bg-aurora-rose/10 text-aurora-rose' : r.type === 'cost' ? 'bg-aurora-amber/10 text-aurora-amber' : 'bg-aurora-violet/10 text-aurora-violet')}>{r.type}</span>
            <p className="text-[10px] text-text-body leading-relaxed">{r.text}</p>
          </div>
        ))}
      </div>
    </div>

    <div className="p-3 bg-aurora-rose/[0.03] rounded-lg border border-aurora-rose/10">
      <div className="flex items-center gap-2 mb-1.5"><AlertTriangle className="w-3 h-3 text-aurora-rose" /><span className="text-[9px] font-mono font-bold uppercase text-aurora-rose">Bottleneck</span></div>
      <p className="text-[10px] text-text-body leading-relaxed">Approval wait 2.3x above normal. 3 items blocked on human decision.</p>
      <button className="mt-1.5 text-[9px] font-mono font-bold text-aurora-teal flex items-center gap-1"><Sparkles className="w-2.5 h-2.5" />Configure auto-approve</button>
    </div>

    {/* End of day digest */}
    <div className="p-3 bg-white/[0.015] rounded-lg border border-white/[0.04]">
      <div className="text-[9px] uppercase tracking-[0.2em] text-text-disabled font-bold mb-2 flex items-center gap-2"><TrendingUp className="w-3 h-3 text-aurora-teal" />Today's Digest</div>
      <div className="space-y-1 text-[10px] font-mono">
        <div className="flex justify-between"><span className="text-text-muted">Completed</span><span className="text-aurora-teal">{COMPLETED.length}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Approved</span><span className="text-aurora-teal">2</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Blocked</span><span className="text-aurora-rose">3</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Still waiting</span><span className="text-aurora-amber">{APPROVALS.filter(a => !a.seen).length}</span></div>
        <div className="flex justify-between"><span className="text-text-muted">Total cost</span><span className="text-text-primary">$0.40</span></div>
      </div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// DETAIL DRAWER
// ═══════════════════════════════════════════════════════════════

function Drawer({ item, onClose }) {
  const [tab, setTab] = useState('timeline');
  if (!item) return null;
  const a = AG[item.agent] || AG.atlas;
  const cfg = ST[item.status] || ST.pending;
  const isApp = item.urg != null;
  const isCompleted = item.completedAt != null;
  const tabs = isCompleted
    ? [{ id: 'timeline', lb: 'Timeline' }, { id: 'history', lb: 'History' }]
    : [{ id: 'timeline', lb: 'Timeline' }, { id: 'history', lb: 'History' }, { id: 'notes', lb: 'Notes' }];

  return (<>
    <motion.div key="dbg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
    <motion.div key="dpn" initial={{ x: '100%' }} animate={{ x: '0%' }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 35 }} className="fixed top-0 right-0 bottom-0 w-[480px] bg-surface border-l border-border z-50 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
      {/* Header */}
      <div className="p-5 border-b border-border bg-canvas/30 backdrop-blur shrink-0">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Chip agentKey={item.agent} size="lg" />
              <ModelBadge m={item.model || a.m} />
              {item.cost && <CostBadge mode={item.cost} />}
            </div>
            <h3 className="text-lg font-semibold text-text-primary truncate">{item.name}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn("text-xs font-mono font-bold uppercase", cfg.tx)}>{cfg.lb}</span>
              {(item.time || item.dur) && <span className="text-xs text-text-disabled font-mono flex items-center gap-1"><Clock className="w-3 h-3" />{item.time || item.dur}</span>}
              {(item.price || item.cost_val) && <span className="text-xs text-text-disabled font-mono">{item.price || item.cost_val}</span>}
            </div>
            {(item.pri != null || item.conf != null) && <div className="mt-2"><IntelStrip pri={item.pri} conf={item.conf} risk={item.risk} next={item.next || item.rec} /></div>}
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-white hover:bg-white/[0.05] rounded-lg transition-colors"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {item.reason && <div className="px-5 py-3 border-b border-white/[0.05] bg-white/[0.01]">
        <p className="text-[11px] text-text-body leading-relaxed">{item.reason}</p>
        {item.rec && <div className="flex items-center gap-1.5 mt-2 text-[10px] font-mono text-aurora-violet"><Sparkles className="w-3 h-3" />{item.rec}</div>}
      </div>}

      {/* Dependency status */}
      {item.blk && <div className="px-5 py-2 border-b border-white/[0.05] bg-aurora-rose/[0.02] flex items-center gap-2">
        {(() => { const b = blkMeta[item.blk]; const I = b?.ic || AlertTriangle; return <><I className={cn("w-3 h-3", b?.cl)} /><span className={cn("text-[10px] font-mono font-bold", b?.cl)}>{b?.lb} blocked</span></>; })()}
      </div>}

      <div className="flex border-b border-border px-5 shrink-0">
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} className={cn("px-4 py-3 text-sm font-medium border-b-2 transition-colors", tab === t.id ? "border-aurora-teal text-aurora-teal" : "border-transparent text-text-muted hover:text-text-primary")}>{t.lb}</button>)}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-5">
        {tab === 'timeline' && <div className="space-y-0">
          {TIMELINE.map((l, i) => {
            const dc = { OK: 'bg-aurora-teal', SYS: 'bg-white/40', NET: 'bg-aurora-blue', ERR: 'bg-aurora-rose' };
            return (<div key={i} className="flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center shrink-0"><div className={cn("w-2 h-2 rounded-full", dc[l.tp] || 'bg-white/40')} />{i < TIMELINE.length - 1 && <div className="w-px flex-1 bg-white/[0.06] mt-1" />}</div>
              <div className="min-w-0 -mt-1">
                <div className="flex items-center gap-2 mb-0.5"><span className="text-[10px] font-mono text-text-disabled">{l.t}</span><span className="text-[9px] font-mono font-bold uppercase text-text-disabled">{l.tp}</span></div>
                <p className="text-[12px] text-text-body font-mono leading-relaxed">{l.msg}</p>
                {(l.tk || l.ms) && <div className="flex gap-3 mt-1 text-[10px] font-mono text-text-disabled">{l.tk && <span>{l.tk} tok</span>}{l.ms && <span>{l.ms}ms</span>}</div>}
              </div>
            </div>);
          })}
        </div>}
        {tab === 'history' && <div className="space-y-1.5">
          {HISTORY.map((h, i) => {
            const hc = ST[h.st] || ST.completed;
            return (<div key={i} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
              <span className="text-[11px] font-mono text-text-muted">{h.dt}</span>
              <span className={cn("text-[10px] font-mono font-bold", hc.tx)}>{h.st}</span>
              <span className="text-[10px] font-mono text-text-disabled">{h.dur}</span>
              <span className="text-[10px] font-mono text-text-disabled">{h.cost}</span>
            </div>);
          })}
        </div>}
        {tab === 'notes' && <div className="space-y-3">
          <div className="p-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
            <div className="flex items-center gap-2 mb-1.5"><span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-aurora-amber/10 text-aurora-amber">Atlas</span><span className="text-[10px] font-mono text-text-disabled">10:04</span></div>
            <p className="text-[12px] text-text-body leading-relaxed">Scraped 3 shows — all lottery windows confirmed open.</p>
          </div>
          <textarea placeholder="Add a note..." rows={2} className="w-full bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 text-xs font-mono text-text-primary resize-none focus:border-aurora-teal/40 outline-none transition-colors placeholder:text-text-disabled" />
        </div>}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-border p-4 bg-canvas/30 flex gap-2">
        {isCompleted ? (<>
          <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-aurora-teal bg-aurora-teal/5 border border-aurora-teal/20 rounded-lg hover:bg-aurora-teal/10 transition-colors"><Eye className="w-3.5 h-3.5" />Acknowledge</button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-aurora-amber bg-aurora-amber/5 border border-aurora-amber/20 rounded-lg hover:bg-aurora-amber/10 transition-colors"><RotateCcw className="w-3.5 h-3.5" />Reopen</button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-aurora-violet bg-aurora-violet/5 border border-aurora-violet/20 rounded-lg hover:bg-aurora-violet/10 transition-colors"><Bookmark className="w-3.5 h-3.5" />Save Playbook</button>
        </>) : isApp ? (<>
          <button className="flex-1 h-10 flex items-center justify-center gap-2 border border-aurora-rose/30 bg-aurora-rose/5 text-aurora-rose hover:bg-aurora-rose/10 rounded-xl font-bold uppercase text-[11px] transition-all"><XCircle className="w-4 h-4" />Reject</button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-text-muted bg-white/[0.03] border border-white/[0.07] rounded-lg hover:bg-white/[0.06] transition-colors"><AlarmClock className="w-3.5 h-3.5" />Snooze</button>
          <button className="flex-[2] h-10 flex items-center justify-center gap-2 bg-aurora-teal text-black hover:bg-[#00ebd8] rounded-xl font-bold uppercase text-[11px] transition-all shadow-[0_0_20px_rgba(0,217,200,0.3)]"><CheckCircle2 className="w-4 h-4" />Approve</button>
        </>) : (<>
          {(item.status === 'running') && <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-aurora-rose bg-aurora-rose/5 border border-aurora-rose/20 rounded-lg"><StopCircle className="w-3.5 h-3.5" />Stop</button>}
          <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-aurora-amber bg-aurora-amber/5 border border-aurora-amber/20 rounded-lg"><RotateCcw className="w-3.5 h-3.5" />Rerun</button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-aurora-teal bg-aurora-teal/5 border border-aurora-teal/20 rounded-lg"><Send className="w-3.5 h-3.5" />Dispatch</button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold text-text-muted bg-white/[0.03] border border-white/[0.07] rounded-lg ml-auto"><Copy className="w-3.5 h-3.5" />Copy</button>
        </>)}
      </div>
    </motion.div>
  </>);
}

// ═══════════════════════════════════════════════════════════════
// MAIN VIEW
// ═══════════════════════════════════════════════════════════════

const TABS = [
  { id: 'ops', lb: 'Operations', ic: Radio, ct: OPS.filter(t => t.status === 'running').length },
  { id: 'plan', lb: 'Planner', ic: Calendar, ct: PLAN_Q.length },
  { id: 'app', lb: 'Approvals', ic: ShieldCheck, ct: APPROVALS.length },
];

export function MissionControlV3() {
  const [tab, setTab] = useState('ops');
  const [sel, setSel] = useState(null);
  const [attnFilter, setAttnFilter] = useState('all');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 mb-3">
        <div className="flex items-end justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-aurora-teal/10 border border-aurora-teal/20 flex items-center justify-center relative">
              <Target className="w-4.5 h-4.5 text-aurora-teal" />
              {totalAttention > 0 && <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-aurora-rose flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-surface">{totalAttention}</div>}
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary tracking-tight">Mission Control</h2>
              <p className="text-[11px] text-text-muted">Operations, scheduling, approvals — one cockpit.</p>
            </div>
          </div>

          {/* Main tabs */}
          <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-border">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn(
                "flex items-center gap-2 px-4 py-2 text-[11px] font-medium rounded-md transition-all",
                tab === t.id ? "bg-white/[0.08] text-text-primary" : "text-text-muted hover:text-text-primary hover:bg-white/[0.04]"
              )}>
                <t.ic className="w-3.5 h-3.5" />
                {t.lb}
                <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-mono font-bold", tab === t.id ? "bg-aurora-teal/10 text-aurora-teal" : "bg-white/5 text-text-disabled")}>{t.ct}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Attention filters */}
        <div className="flex items-center gap-1.5 mb-1">
          {ATTN_FILTERS.map(f => (
            <button key={f.id} onClick={() => setAttnFilter(f.id)} className={cn(
              "px-2.5 py-1 text-[10px] font-mono rounded-md transition-colors flex items-center gap-1.5",
              attnFilter === f.id ? "bg-white/[0.06] text-text-primary" : "text-text-disabled hover:text-text-muted hover:bg-white/[0.03]"
            )}>
              {f.lb}
              {f.count > 0 && <span className={cn("px-1 py-0.5 rounded text-[8px] font-bold", attnFilter === f.id ? 'bg-aurora-violet/10 text-aurora-violet' : 'bg-white/5 text-text-disabled')}>{f.count}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Pulse strip */}
      <PulseStrip />

      {/* Critical lane */}
      <CriticalLane onSelect={setSel} />

      {/* Main content + intel sidebar */}
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        <div className="flex-[3] flex flex-col min-w-0 overflow-hidden">
          {tab === 'ops' && <OpsTab selected={sel} onSelect={setSel} />}
          {tab === 'plan' && <PlanTab selected={sel} onSelect={setSel} />}
          {tab === 'app' && <AppTab selected={sel} onSelect={setSel} />}
        </div>
        <div className="w-[260px] shrink-0 overflow-y-auto no-scrollbar">
          <IntelSidebar />
        </div>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {sel && <Drawer item={sel} onClose={() => setSel(null)} />}
      </AnimatePresence>
    </div>
  );
}
