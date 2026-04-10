/**
 * STATIC MOCKUP — Mission Control V4
 * Warm command center inspired by Leadly/SOLAR design language
 * + all V3 functionality: Operations, Planner, Approvals, Intelligence, Attention
 *
 * ALL DATA IS STATIC. No hooks, no Supabase.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target, Clock, Zap, ShieldCheck, AlertTriangle, X,
  StopCircle, RotateCcw, Copy, CheckCircle2, XCircle,
  FileText, Brain, TrendingUp, Calendar, Repeat, Ban,
  DollarSign, Timer, GitBranch, Sparkles, ChevronRight,
  Radio, Lock, Send, Archive, Eye, AlarmClock,
  ChevronDown, Bookmark, ChevronLeft, MoreHorizontal,
  Plus, Cpu, Activity,
} from 'lucide-react';
import { cn } from '../utils/cn';

// ═══════════════════════════════════════════════════════════════
// AGENTS
// ═══════════════════════════════════════════════════════════════

const AG = {
  atlas: { n: 'Atlas', c: '#00D9C8', m: 'Claude Opus', ic: '⬡', r: 'Commander' },
  orion: { n: 'Orion', c: '#60a5fa', m: 'Claude Sonnet', ic: '◈', r: 'Researcher' },
  vega:  { n: 'Vega',  c: '#a78bfa', m: 'Gemini 3.1', ic: '◇', r: 'UI Agent' },
  lyra:  { n: 'Lyra',  c: '#fb7185', m: 'Hermes', ic: '△', r: 'Researcher' },
  nova:  { n: 'Nova',  c: '#a78bfa', m: 'Claude Sonnet', ic: '◎', r: 'QA' },
  sol:   { n: 'Sol',   c: '#60a5fa', m: 'Llama 3 70B', ic: '☉', r: 'Local Ops' },
};

function AgentAvatar({ agentKey, size = 'sm' }) {
  const a = AG[agentKey] || AG.atlas;
  const big = size === 'lg';
  return (
    <div className="flex items-center gap-2">
      <div className={cn(
        "rounded-full flex items-center justify-center font-bold shrink-0 relative",
        big ? 'w-9 h-9 text-sm' : 'w-6 h-6 text-[10px]'
      )} style={{ backgroundColor: `${a.c}20`, color: a.c, border: `1.5px solid ${a.c}40` }}>
        {a.ic}
        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2" style={{ backgroundColor: a.c, borderColor: '#080808' }} />
      </div>
      {big && (
        <div>
          <span className="text-sm font-semibold text-[#e8e8ed]">{a.n}</span>
          <span className="text-[10px] text-[#71717a] block font-mono">{a.r}</span>
        </div>
      )}
      {!big && <span className="text-[11px] font-medium text-[#a1a1aa]">{a.n}</span>}
    </div>
  );
}

function ModelChip({ m }) {
  return <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold bg-[#161616] text-[#a1a1aa] border border-[rgba(255,255,255,0.14)]">{m}</span>;
}

function CostChip({ mode }) {
  const c = { local: '#34d399', sub: '#60a5fa', payg: '#fbbf24' };
  return <span className="text-[9px] font-mono font-bold uppercase" style={{ color: c[mode] || c.payg }}>{mode}</span>;
}

// ═══════════════════════════════════════════════════════════════
// INTELLIGENCE
// ═══════════════════════════════════════════════════════════════

function PriBadge({ v }) {
  const c = v >= 8 ? '#fb7185' : v >= 5 ? '#fbbf24' : '#34d399';
  return (
    <div className="flex items-center gap-1">
      <div className="w-8 h-1.5 rounded-full bg-[#161616] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${v * 10}%`, backgroundColor: c }} />
      </div>
      <span className="text-[9px] font-mono font-bold" style={{ color: c }}>{v}</span>
    </div>
  );
}

function ConfBadge({ v }) {
  const c = v >= 90 ? '#34d399' : v >= 70 ? '#fbbf24' : '#fb7185';
  return <span className="text-[10px] font-mono font-bold" style={{ color: c }}>{v}%</span>;
}

// ═══════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════

const OPS = [
  { id: 'o1', name: 'Scrape Broadway lottery sites', agent: 'atlas', status: 'running', time: '2m 14s', model: 'Claude Opus', cost: 'sub', pri: 9, conf: 94, next: 'Parse results next', price: '$0.12' },
  { id: 'o2', name: 'Parse 3PL shipment data', agent: 'orion', status: 'running', time: '48s', model: 'Claude Sonnet', cost: 'sub', pri: 7, conf: 88, next: 'Validate schema', price: '$0.03' },
  { id: 'o3', name: 'QA review — lottery pipeline', agent: 'nova', status: 'running', time: '1m 38s', model: 'Claude Sonnet', cost: 'sub', pri: 7, conf: 96, next: 'Submit approval', price: '$0.02' },
  { id: 'o4', name: 'Vector embedding batch', agent: 'lyra', status: 'failed', time: '34s', model: 'Hermes', cost: 'local', pri: 8, conf: 12, next: 'Reassign to Sol', anomaly: 'OOM — 743MB / 512MB limit', price: '$0.00' },
  { id: 'o5', name: 'Privacy scan — outbound messages', agent: 'sol', status: 'completed', time: '12s', model: 'Llama 3 70B', cost: 'local', pri: 5, conf: 99, price: '$0.00' },
];

const APPROVALS = [
  { id: 'a1', name: 'Agent Crashed — OOMKilled', agent: 'lyra', urg: 'crit', wait: '7m', reason: 'Memory limit exceeded. 3/3 recovery attempts failed.', rec: 'Reassign to Sol with 1GB limit', blk: 'intervention', conf: 12, imp: 9 },
  { id: 'a2', name: 'Send iMessage to 2 contacts', agent: 'atlas', urg: 'high', wait: '4m', reason: 'Outbound message requires human approval.', rec: 'Approve — matches prior pattern', blk: 'policy', conf: 94, imp: 3 },
  { id: 'a3', name: 'Close 14 stale Pipedrive quotes', agent: 'atlas', urg: 'high', wait: '2m', reason: 'Bulk CRM action. Cost check passed.', rec: 'Approve with sales notification', blk: 'policy', conf: 88, imp: 7 },
  { id: 'a4', name: 'QA Report — Lottery Pipeline', agent: 'nova', urg: 'norm', wait: '1m', reason: 'Standard QA pass. All checks passed.', rec: 'Auto-approve eligible', conf: 96, imp: 2 },
  { id: 'a5', name: 'Rush margin analysis — budget hold', agent: 'orion', urg: 'high', wait: '—', reason: 'Cost $0.22 exceeds per-task budget $0.15.', rec: 'Raise budget or use Sonnet', blk: 'budget', imp: 8 },
];

const PLAN_Q = [
  { id: 'p1', name: 'Morning cost digest', agent: 'orion', sched: '09:00 AM', pri: 6, approve: false, est: '~2 min', estC: '$0.04' },
  { id: 'p2', name: 'Close 14 stale Pipedrive quotes', agent: 'atlas', sched: '10:00 AM', pri: 9, approve: true, est: '~5 min', estC: '$0.18' },
  { id: 'p3', name: 'Weekly fleet report', agent: 'nova', sched: '11:00 AM', pri: 5, approve: false, est: '~3 min', estC: '$0.06' },
  { id: 'p4', name: 'Rush shipment margin analysis', agent: 'orion', sched: '02:00 PM', pri: 8, approve: true, est: '~8 min', estC: '$0.22' },
];

const ROUTINES = [
  { id: 'r1', name: 'Broadway lottery entries', cad: 'Daily 9 AM', agent: 'atlas', st: 'enabled', last: 'success' },
  { id: 'r2', name: 'Cost digest email', cad: 'Weekdays 8:30 AM', agent: 'orion', st: 'enabled', last: 'success' },
  { id: 'r3', name: 'Vector index compaction', cad: 'Weekly Sun 2 AM', agent: 'sol', st: 'enabled', last: 'success' },
  { id: 'r4', name: 'Stale data cleanup', cad: 'Monthly 1st', agent: 'sol', st: 'paused', last: 'failed' },
];

const COMPLETED = [
  { id: 'c1', name: 'Generate NavRail component', agent: 'vega', completedAt: '3m ago', cost: '$0.08', dur: '1m 02s', seen: false },
  { id: 'c2', name: 'Privacy scan — outbound msgs', agent: 'sol', completedAt: '5m ago', cost: '$0.00', dur: '12s', seen: false },
  { id: 'c3', name: 'Morning cost digest', agent: 'orion', completedAt: '32m ago', cost: '$0.04', dur: '1m 48s', seen: true },
  { id: 'c4', name: 'Broadway lottery scrape', agent: 'atlas', completedAt: '1h ago', cost: '$0.11', dur: '1m 58s', seen: true },
];

const TIMELINE = [
  { t: '10:04:12', tp: 'SYS', msg: 'Task dispatched to Atlas (Claude Opus)' },
  { t: '10:04:14', tp: 'NET', msg: 'Connecting to broadwaydirect.com', ms: 890 },
  { t: '10:04:15', tp: 'OK', msg: 'Firecrawl scrape — 3 shows found', tk: 340, ms: 620 },
  { t: '10:04:18', tp: 'OK', msg: 'Parsed: Hamilton, Wicked, Dear Evan Hansen' },
  { t: '10:04:20', tp: 'SYS', msg: 'Submitting for QA review (Nova)' },
];

const HISTORY = [
  { dt: 'Today 10:04', st: 'running', cost: '$0.12', dur: '2m 14s' },
  { dt: 'Yesterday', st: 'completed', cost: '$0.11', dur: '1m 58s' },
  { dt: 'Apr 6', st: 'completed', cost: '$0.13', dur: '2m 22s' },
  { dt: 'Apr 5', st: 'failed', cost: '$0.04', dur: '34s' },
];

const INTEL = [
  { type: 'anomaly', text: 'Lyra crashed 3x this week on batches >1000. Switch vector jobs to Sol.', imp: 'high' },
  { type: 'cost', text: 'Atlas routes 34% of research through Opus. Redirect to Sonnet — save ~$18/mo.', imp: 'med' },
  { type: 'bottleneck', text: 'Approval queue wait 4.2m avg — was 1.8m last week. Add auto-approve rules.', imp: 'high' },
];

const unseenCount = COMPLETED.filter(c => !c.seen).length + APPROVALS.length;

// ═══════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════

const stColor = {
  running: { bg: 'bg-[#fbbf24]/10', tx: 'text-[#fbbf24]', lb: 'Running' },
  completed: { bg: 'bg-[#34d399]/10', tx: 'text-[#34d399]', lb: 'Done' },
  failed: { bg: 'bg-[#fb7185]/10', tx: 'text-[#fb7185]', lb: 'Failed' },
  pending: { bg: 'bg-[#60a5fa]/10', tx: 'text-[#60a5fa]', lb: 'Queued' },
  review: { bg: 'bg-[#fbbf24]/10', tx: 'text-[#fbbf24]', lb: 'Review' },
  enabled: { bg: 'bg-[#34d399]/10', tx: 'text-[#34d399]', lb: 'Active' },
  paused: { bg: 'bg-[#71717a]/10', tx: 'text-[#71717a]', lb: 'Paused' },
  success: { bg: 'bg-[#34d399]/10', tx: 'text-[#34d399]', lb: 'Pass' },
};

const urgColors = { crit: '#fb7185', high: '#fbbf24', norm: '#34d399' };
const blkMeta = { policy: { ic: Lock, lb: 'Policy' }, budget: { ic: DollarSign, lb: 'Budget' }, intervention: { ic: AlertTriangle, lb: 'Needs Me' } };

// ═══════════════════════════════════════════════════════════════
// CARD WRAPPER (warm panel style)
// ═══════════════════════════════════════════════════════════════

function Card({ children, className, onClick, selected, urgent }) {
  return (
    <button onClick={onClick} className={cn(
      "w-full text-left rounded-2xl border transition-all duration-200 relative overflow-hidden",
      selected
        ? "bg-[#161616] border-[#fbbf24]/30 shadow-[0_0_20px_rgba(0,217,200,0.08)] ring-1 ring-[#fbbf24]/20"
        : "bg-[#111111] border-[rgba(255,255,255,0.08)] hover:bg-[#141414] hover:border-[rgba(255,255,255,0.14)] hover:-translate-y-[1px]",
      urgent && "border-l-[3px]",
      className
    )}>
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// HEADER
// ═══════════════════════════════════════════════════════════════

function Header({ tab, setTab }) {
  const now = new Date();
  const day = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="shrink-0 mb-5">
      {/* Greeting */}
      <div className="flex items-end justify-between mb-4">
        <div>
          <p className="text-[13px] text-[#71717a] font-mono">{day}</p>
          <h1 className="text-3xl font-bold text-[#e8e8ed] tracking-tight mt-1">{greeting}, Commander</h1>
          <p className="text-[14px] text-[#71717a] mt-1">What needs your attention today?</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-aurora-teal text-black text-sm font-semibold hover:bg-[#00ebd8] transition-colors">
            <Plus className="w-4 h-4" /> New Task
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-[#111111] rounded-2xl p-1 border border-[rgba(255,255,255,0.08)]">
        {[
          { id: 'ops', lb: 'Operations', ic: Radio, ct: OPS.filter(o => o.status === 'running').length },
          { id: 'plan', lb: 'Planner', ic: Calendar, ct: PLAN_Q.length },
          { id: 'app', lb: 'Approvals', ic: ShieldCheck, ct: APPROVALS.length },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} className={cn(
            "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold transition-all",
            tab === t.id
              ? "bg-[#161616] text-[#e8e8ed] shadow-sm"
              : "text-[#71717a] hover:text-[#a1a1aa]"
          )}>
            <t.ic className="w-4 h-4" />
            {t.lb}
            {t.ct > 0 && <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", tab === t.id ? "bg-[#fbbf24]/15 text-[#fbbf24]" : "bg-[#161616] text-[#71717a]")}>{t.ct}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// PULSE STRIP
// ═══════════════════════════════════════════════════════════════

function Pulse() {
  const items = [
    { lb: 'Active', v: 3, c: '#fbbf24' },
    { lb: 'Blocked', v: 3, c: '#fb7185' },
    { lb: 'Approvals', v: 5, c: '#fbbf24' },
    { lb: 'Done Today', v: 4, c: '#34d399' },
    { lb: 'Unseen', v: unseenCount, c: '#a78bfa' },
  ];
  return (
    <div className="flex items-center gap-2 mb-4">
      {items.map(s => (
        <div key={s.lb} className="flex-1 px-3 py-2.5 rounded-2xl bg-[#111111] border border-[rgba(255,255,255,0.08)] flex items-center gap-2">
          <span className="text-xl font-bold font-mono" style={{ color: s.c }}>{s.v}</span>
          <span className="text-[10px] font-medium text-[#71717a] uppercase">{s.lb}</span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// CRITICAL LANE
// ═══════════════════════════════════════════════════════════════

function Critical({ onSelect }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-[#fb7185] animate-pulse" />
        <span className="text-[11px] font-bold uppercase text-[#fb7185] tracking-wider">Critical — Needs You Now</span>
      </div>
      <div className="flex gap-3">
        <Card onClick={() => onSelect(APPROVALS[0])} className="flex-1 p-4" urgent style={{ borderLeftColor: '#fb7185' }}>
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#fb7185] rounded-l-2xl" />
          <div className="flex items-center gap-2 mb-2">
            <AgentAvatar agentKey="lyra" />
            <span className="text-[12px] font-semibold text-[#e8e8ed] flex-1 truncate">Agent Crashed — OOMKilled</span>
            <span className="text-[10px] font-mono text-[#fb7185]">7m stalled</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono text-[#a78bfa] flex items-center gap-1"><Sparkles className="w-3 h-3" />Reassign to Sol</span>
          </div>
        </Card>
        <Card onClick={() => onSelect(APPROVALS[1])} className="flex-1 p-4" urgent>
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#fbbf24] rounded-l-2xl" />
          <div className="flex items-center gap-2 mb-2">
            <AgentAvatar agentKey="atlas" />
            <span className="text-[12px] font-semibold text-[#e8e8ed] flex-1 truncate">Send iMessage — 2 contacts</span>
            <span className="text-[10px] font-mono text-[#fbbf24]">4m waiting</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-3 h-3 text-[#fbbf24]" />
            <span className="text-[10px] font-mono text-[#fbbf24]">Policy</span>
            <span className="text-[10px] font-mono text-[#a78bfa] flex items-center gap-1 ml-2"><Sparkles className="w-3 h-3" />Approve — matches pattern</span>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TASK ROW
// ═══════════════════════════════════════════════════════════════

function TaskRow({ item, selected, onClick }) {
  const cfg = stColor[item.status] || stColor.pending;
  const isRun = item.status === 'running';
  const isUnseen = item.seen === false;
  const urgC = item.urg ? urgColors[item.urg] : null;

  return (
    <Card onClick={onClick} selected={selected} className={cn("p-4", urgC && "border-l-[3px]")} style={urgC ? { borderLeftColor: urgC } : undefined}>
      {urgC && <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl" style={{ backgroundColor: urgC }} />}
      {isRun && <div className="absolute right-4 top-4"><span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-[#fbbf24] opacity-75" /><span className="relative rounded-full h-2 w-2 bg-[#fbbf24]" /></span></div>}
      {isUnseen && <div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#a78bfa] ring-2 ring-[#080808]" />}

      <div className="flex items-center gap-3 mb-2">
        <AgentAvatar agentKey={item.agent} />
        <span className="text-[13px] font-semibold text-[#e8e8ed] flex-1 truncate">{item.name}</span>
        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-bold", cfg.bg, cfg.tx)}>{cfg.lb}</span>
      </div>

      <div className="flex items-center gap-3 ml-8">
        {item.model && <ModelChip m={item.model} />}
        {item.cost && <CostChip mode={item.cost} />}
        {item.time && <span className="text-[10px] font-mono text-[#71717a] flex items-center gap-1"><Timer className="w-3 h-3" />{item.time}</span>}
        {item.wait && <span className="text-[10px] font-mono text-[#71717a] flex items-center gap-1"><Clock className="w-3 h-3" />{item.wait}</span>}
        {item.price && <span className="text-[10px] font-mono text-[#71717a]">{item.price}</span>}
        {item.blk && (() => { const b = blkMeta[item.blk]; const I = b?.ic || AlertTriangle; return <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-[#fb7185]"><I className="w-3 h-3" />{b?.lb}</span>; })()}
      </div>

      {(item.pri != null || item.conf != null || item.next || item.rec) && (
        <div className="flex items-center gap-3 ml-8 mt-2">
          {item.pri != null && <PriBadge v={item.pri} />}
          {item.conf != null && <ConfBadge v={item.conf} />}
          {(item.next || item.rec) && <span className="text-[10px] font-mono text-[#a78bfa] flex items-center gap-1"><Sparkles className="w-3 h-3" />{item.next || item.rec}</span>}
        </div>
      )}

      {item.anomaly && (
        <div className="ml-8 mt-2 px-3 py-2 bg-[#fb7185]/8 border border-[#fb7185]/15 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-[#fb7185] shrink-0" />
          <span className="text-[10px] font-mono text-[#fb7185]">{item.anomaly}</span>
        </div>
      )}

      {item.reason && !item.anomaly && (
        <p className="text-[10px] text-[#71717a] mt-2 ml-8 leading-relaxed line-clamp-1">{item.reason}</p>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPLETED
// ═══════════════════════════════════════════════════════════════

function CompletedSection({ onSelect }) {
  const [open, setOpen] = useState(true);
  const unseen = COMPLETED.filter(c => !c.seen).length;
  return (
    <div className="mt-5">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 mb-2 w-full text-left">
        <ChevronDown className={cn("w-3 h-3 text-[#71717a] transition-transform", !open && "-rotate-90")} />
        <Archive className="w-3 h-3 text-[#71717a]" />
        <span className="text-[11px] font-bold uppercase text-[#71717a] tracking-wider">Recently Completed</span>
        {unseen > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#a78bfa]/15 text-[#a78bfa]">{unseen} unseen</span>}
      </button>
      {open && (
        <div className="space-y-1.5">
          {COMPLETED.map(c => (
            <button key={c.id} onClick={() => onSelect(c)} className={cn(
              "w-full text-left px-4 py-3 rounded-2xl border bg-[#111111]/60 border-[rgba(255,255,255,0.08)]/60 hover:bg-[#141414] transition-all flex items-center gap-3",
              !c.seen && "border-l-[3px] border-l-[#a78bfa]"
            )}>
              {!c.seen && <div className="w-2.5 h-2.5 rounded-full bg-[#a78bfa] shrink-0" />}
              <AgentAvatar agentKey={c.agent} />
              <span className="text-[12px] text-[#a1a1aa] flex-1 truncate">{c.name}</span>
              <span className="text-[10px] font-mono text-[#71717a]">{c.dur}</span>
              <span className="text-[10px] font-mono text-[#71717a]">{c.cost}</span>
              <span className="text-[10px] font-mono text-[#71717a]">{c.completedAt}</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#34d399] shrink-0" />
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

function OpsTab({ sel, onSel }) {
  return (<div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pr-1">
    {OPS.map(o => <TaskRow key={o.id} item={o} selected={sel?.id === o.id} onClick={() => onSel(o)} />)}
    <CompletedSection onSelect={onSel} />
  </div>);
}

function PlanTab({ sel, onSel }) {
  return (<div className="flex-1 overflow-y-auto no-scrollbar pr-1">
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3"><Calendar className="w-3.5 h-3.5 text-[#fbbf24]" /><span className="text-[11px] font-bold uppercase text-[#71717a] tracking-wider">Queued for Today</span></div>
      <div className="space-y-2">
        {PLAN_Q.map(j => (
          <Card key={j.id} onClick={() => onSel({ ...j, status: 'pending' })} className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <AgentAvatar agentKey={j.agent} />
              <span className="text-[13px] font-semibold text-[#e8e8ed] flex-1 truncate">{j.name}</span>
              <span className="text-[11px] font-mono text-[#60a5fa]">{j.sched}</span>
              {j.approve && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#fbbf24]/15 text-[#fbbf24]">Approval</span>}
            </div>
            <div className="flex items-center gap-3 ml-8">
              <span className="text-[10px] font-mono text-[#71717a] flex items-center gap-1"><Timer className="w-3 h-3" />{j.est}</span>
              <span className="text-[10px] font-mono text-[#71717a] flex items-center gap-1"><DollarSign className="w-3 h-3" />{j.estC}</span>
              <PriBadge v={j.pri} />
            </div>
          </Card>
        ))}
      </div>
    </div>
    <div>
      <div className="flex items-center gap-2 mb-3"><Repeat className="w-3.5 h-3.5 text-[#a78bfa]" /><span className="text-[11px] font-bold uppercase text-[#71717a] tracking-wider">Automations</span></div>
      <div className="space-y-2">
        {ROUTINES.map(r => {
          const cfg = stColor[r.st] || stColor.paused;
          const lCfg = stColor[r.last] || stColor.completed;
          return (
            <Card key={r.id} onClick={() => onSel(r)} className="p-3.5">
              <div className="flex items-center gap-3">
                <AgentAvatar agentKey={r.agent} />
                <span className="text-[12px] font-semibold text-[#e8e8ed] flex-1 truncate">{r.name}</span>
                <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold", cfg.bg, cfg.tx)}>{cfg.lb}</span>
              </div>
              <div className="flex items-center gap-4 mt-1.5 ml-8 text-[10px] font-mono text-[#71717a]">
                <span className="flex items-center gap-1"><Repeat className="w-3 h-3" />{r.cad}</span>
                <span>Last: <span className={lCfg.tx}>{r.last}</span></span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  </div>);
}

function AppTab({ sel, onSel }) {
  const blocked = APPROVALS.filter(a => a.blk);
  const pending = APPROVALS.filter(a => !a.blk);
  return (<div className="flex-1 overflow-y-auto no-scrollbar pr-1">
    {blocked.length > 0 && <div className="mb-5">
      <div className="flex items-center gap-2 mb-3"><Ban className="w-3.5 h-3.5 text-[#fb7185]" /><span className="text-[11px] font-bold uppercase text-[#71717a] tracking-wider">Blocked ({blocked.length})</span></div>
      <div className="space-y-2">{blocked.map(a => <TaskRow key={a.id} item={a} selected={sel?.id === a.id} onClick={() => onSel(a)} />)}</div>
    </div>}
    <div>
      <div className="flex items-center gap-2 mb-3"><ShieldCheck className="w-3.5 h-3.5 text-[#fbbf24]" /><span className="text-[11px] font-bold uppercase text-[#71717a] tracking-wider">Pending ({pending.length})</span></div>
      <div className="space-y-2">{pending.map(a => <TaskRow key={a.id} item={a} selected={sel?.id === a.id} onClick={() => onSel(a)} />)}</div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// INTEL SIDEBAR
// ═══════════════════════════════════════════════════════════════

function IntelSidebar() {
  return (<div className="flex flex-col gap-4">
    {/* Goals / KPIs */}
    <div className="p-4 rounded-2xl bg-[#111111] border border-[rgba(255,255,255,0.08)]">
      <div className="flex items-center gap-2 mb-3"><Target className="w-3.5 h-3.5 text-[#fbbf24]" /><span className="text-[11px] font-bold uppercase text-[#71717a] tracking-wider">Mission Goals</span></div>
      {[
        { lb: 'Reduce approval queue to < 2m avg', pct: 43, c: '#fbbf24' },
        { lb: 'Zero OOM crashes this week', pct: 60, c: '#fb7185' },
        { lb: 'Automate 5 recurring tasks', pct: 80, c: '#34d399' },
        { lb: 'Cut Opus spend by 30%', pct: 22, c: '#60a5fa' },
      ].map(g => (
        <div key={g.lb} className="mb-3 last:mb-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-[#a1a1aa]">{g.lb}</span>
            <span className="text-[11px] font-mono font-bold" style={{ color: g.c }}>{g.pct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#161616] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${g.pct}%`, backgroundColor: g.c }} />
          </div>
        </div>
      ))}
    </div>

    {/* Recommendations */}
    <div className="p-4 rounded-2xl bg-[#111111] border border-[rgba(255,255,255,0.08)]">
      <div className="flex items-center gap-2 mb-3"><Sparkles className="w-3.5 h-3.5 text-[#a78bfa]" /><span className="text-[11px] font-bold uppercase text-[#71717a] tracking-wider">AI Recommendations</span></div>
      <div className="space-y-2">
        {INTEL.map((r, i) => (
          <div key={i} className={cn("p-3 rounded-xl border border-[rgba(255,255,255,0.08)]", r.imp === 'high' ? 'bg-[#fb7185]/5 border-l-[3px] border-l-[#fb7185]' : 'bg-[#fbbf24]/5 border-l-[3px] border-l-[#fbbf24]')}>
            <span className={cn("text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded-full mb-1.5 inline-block",
              r.type === 'anomaly' ? 'bg-[#fb7185]/15 text-[#fb7185]' : r.type === 'cost' ? 'bg-[#fbbf24]/15 text-[#fbbf24]' : 'bg-[#a78bfa]/15 text-[#a78bfa]'
            )}>{r.type}</span>
            <p className="text-[11px] text-[#a1a1aa] leading-relaxed">{r.text}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Daily Digest */}
    <div className="p-4 rounded-2xl bg-[#111111] border border-[rgba(255,255,255,0.08)]">
      <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-3.5 h-3.5 text-[#34d399]" /><span className="text-[11px] font-bold uppercase text-[#71717a] tracking-wider">Today's Digest</span></div>
      <div className="space-y-1.5 text-[11px] font-mono">
        {[
          { lb: 'Completed', v: '4', c: '#34d399' },
          { lb: 'Approved', v: '2', c: '#34d399' },
          { lb: 'Blocked', v: '3', c: '#fb7185' },
          { lb: 'Waiting', v: '5', c: '#fbbf24' },
          { lb: 'Total cost', v: '$0.40', c: '#a1a1aa' },
        ].map(d => (
          <div key={d.lb} className="flex justify-between">
            <span className="text-[#71717a]">{d.lb}</span>
            <span style={{ color: d.c }}>{d.v}</span>
          </div>
        ))}
      </div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════
// DRAWER
// ═══════════════════════════════════════════════════════════════

function Drawer({ item, onClose }) {
  const [tab, setTab] = useState('timeline');
  if (!item) return null;
  const a = AG[item.agent] || AG.atlas;
  const cfg = stColor[item.status] || stColor.pending;
  const isApp = item.urg != null;
  const isDone = item.completedAt != null;

  return (<>
    <motion.div key="dbg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />
    <motion.div key="dpn" initial={{ x: '100%' }} animate={{ x: '0%' }} exit={{ x: '100%' }} transition={{ type: 'spring', stiffness: 300, damping: 35 }}
      className="fixed top-0 right-0 bottom-0 w-[480px] bg-[#080808] border-l border-[rgba(255,255,255,0.08)] z-50 flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.6)]">

      <div className="p-5 border-b border-[rgba(255,255,255,0.08)] shrink-0">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <AgentAvatar agentKey={item.agent} size="lg" />
              <ModelChip m={item.model || a.m} />
              {item.cost && <CostChip mode={item.cost} />}
            </div>
            <h3 className="text-lg font-semibold text-[#e8e8ed] truncate">{item.name}</h3>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn("text-xs font-mono font-bold", cfg.tx)}>{cfg.lb}</span>
              {(item.time || item.dur) && <span className="text-xs text-[#71717a] font-mono flex items-center gap-1"><Clock className="w-3 h-3" />{item.time || item.dur}</span>}
              {item.price && <span className="text-xs text-[#71717a] font-mono">{item.price}</span>}
            </div>
            {item.pri != null && <div className="mt-2 flex items-center gap-3"><PriBadge v={item.pri} />{item.conf != null && <ConfBadge v={item.conf} />}</div>}
          </div>
          <button onClick={onClose} className="p-2 text-[#71717a] hover:text-[#e8e8ed] hover:bg-[#161616] rounded-xl transition-colors"><X className="w-5 h-5" /></button>
        </div>
      </div>

      {item.reason && <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.08)]/60">
        <p className="text-[12px] text-[#a1a1aa] leading-relaxed">{item.reason}</p>
        {item.rec && <div className="flex items-center gap-1.5 mt-2 text-[11px] font-mono text-[#a78bfa]"><Sparkles className="w-3 h-3" />{item.rec}</div>}
      </div>}

      <div className="flex border-b border-[rgba(255,255,255,0.08)] px-5 shrink-0">
        {['timeline', 'history', 'notes'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn("px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize",
            tab === t ? "border-[#fbbf24] text-[#fbbf24]" : "border-transparent text-[#71717a] hover:text-[#a1a1aa]"
          )}>{t}</button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar p-5">
        {tab === 'timeline' && <div className="space-y-0">
          {TIMELINE.map((l, i) => {
            const dc = { OK: '#34d399', SYS: '#71717a', NET: '#60a5fa', ERR: '#fb7185' };
            return (<div key={i} className="flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center shrink-0"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: dc[l.tp] || '#71717a' }} />{i < TIMELINE.length - 1 && <div className="w-px flex-1 bg-[rgba(255,255,255,0.08)] mt-1" />}</div>
              <div className="min-w-0 -mt-1">
                <div className="flex items-center gap-2 mb-0.5"><span className="text-[10px] font-mono text-[#71717a]">{l.t}</span><span className="text-[9px] font-mono font-bold uppercase text-[#71717a]">{l.tp}</span></div>
                <p className="text-[12px] text-[#a1a1aa] font-mono leading-relaxed">{l.msg}</p>
                {(l.tk || l.ms) && <div className="flex gap-3 mt-1 text-[10px] font-mono text-[#71717a]">{l.tk && <span>{l.tk} tok</span>}{l.ms && <span>{l.ms}ms</span>}</div>}
              </div>
            </div>);
          })}
        </div>}
        {tab === 'history' && <div className="space-y-2">
          {HISTORY.map((h, i) => {
            const hc = stColor[h.st] || stColor.completed;
            return (<div key={i} className="flex items-center justify-between py-2.5 px-3.5 rounded-xl bg-[#111111] border border-[rgba(255,255,255,0.08)]">
              <span className="text-[11px] font-mono text-[#71717a]">{h.dt}</span>
              <span className={cn("text-[10px] font-mono font-bold", hc.tx)}>{h.st}</span>
              <span className="text-[10px] font-mono text-[#71717a]">{h.dur}</span>
              <span className="text-[10px] font-mono text-[#71717a]">{h.cost}</span>
            </div>);
          })}
        </div>}
        {tab === 'notes' && <div className="space-y-3">
          <div className="p-3.5 rounded-xl bg-[#111111] border border-[rgba(255,255,255,0.08)]">
            <div className="flex items-center gap-2 mb-1.5"><span className="text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full bg-[#fbbf24]/15 text-[#fbbf24]">Atlas</span><span className="text-[10px] font-mono text-[#71717a]">10:04</span></div>
            <p className="text-[12px] text-[#a1a1aa] leading-relaxed">Scraped 3 shows — all lottery windows confirmed open.</p>
          </div>
          <textarea placeholder="Add a note..." rows={2} className="w-full bg-[#111111] border border-[rgba(255,255,255,0.08)] rounded-xl px-3.5 py-3 text-xs font-mono text-[#e8e8ed] resize-none focus:border-[#fbbf24]/40 outline-none transition-colors placeholder:text-[#71717a]/50" />
        </div>}
      </div>

      <div className="shrink-0 border-t border-[rgba(255,255,255,0.08)] p-4 flex gap-2">
        {isDone ? (<>
          <button className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold text-[#34d399] bg-[#34d399]/8 border border-[#34d399]/20 rounded-xl"><Eye className="w-3.5 h-3.5" />Acknowledge</button>
          <button className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold text-[#fbbf24] bg-[#fbbf24]/8 border border-[#fbbf24]/20 rounded-xl"><RotateCcw className="w-3.5 h-3.5" />Reopen</button>
          <button className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold text-[#a78bfa] bg-[#a78bfa]/8 border border-[#a78bfa]/20 rounded-xl"><Bookmark className="w-3.5 h-3.5" />Playbook</button>
        </>) : isApp ? (<>
          <button className="flex-1 h-11 flex items-center justify-center gap-2 border border-[#fb7185]/30 bg-[#fb7185]/5 text-[#fb7185] rounded-xl font-bold uppercase text-[11px]"><XCircle className="w-4 h-4" />Reject</button>
          <button className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-[#71717a] bg-[#161616] border border-[rgba(255,255,255,0.14)] rounded-xl"><AlarmClock className="w-3.5 h-3.5" />Snooze</button>
          <button className="flex-[2] h-11 flex items-center justify-center gap-2 bg-aurora-teal text-black rounded-xl font-bold uppercase text-[11px] shadow-[0_0_20px_rgba(0,217,200,0.2)]"><CheckCircle2 className="w-4 h-4" />Approve</button>
        </>) : (<>
          {item.status === 'running' && <button className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-[#fb7185] bg-[#fb7185]/8 border border-[#fb7185]/20 rounded-xl"><StopCircle className="w-3.5 h-3.5" />Stop</button>}
          <button className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-[#fbbf24] bg-[#fbbf24]/8 border border-[#fbbf24]/20 rounded-xl"><RotateCcw className="w-3.5 h-3.5" />Rerun</button>
          <button className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-[#34d399] bg-[#34d399]/8 border border-[#34d399]/20 rounded-xl"><Send className="w-3.5 h-3.5" />Dispatch</button>
          <button className="flex items-center gap-1.5 px-3 py-2.5 text-[11px] font-bold text-[#71717a] bg-[#161616] border border-[rgba(255,255,255,0.14)] rounded-xl ml-auto"><Copy className="w-3.5 h-3.5" />Copy</button>
        </>)}
      </div>
    </motion.div>
  </>);
}

// ═══════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════

export function MissionControlV4() {
  const [tab, setTab] = useState('ops');
  const [sel, setSel] = useState(null);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: '#080808' }}>
      <Header tab={tab} setTab={setTab} />
      <Pulse />
      <Critical onSelect={setSel} />

      <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
        <div className="flex-[3] flex flex-col min-w-0 overflow-hidden">
          {tab === 'ops' && <OpsTab sel={sel} onSel={setSel} />}
          {tab === 'plan' && <PlanTab sel={sel} onSel={setSel} />}
          {tab === 'app' && <AppTab sel={sel} onSel={setSel} />}
        </div>
        <div className="w-[280px] shrink-0 overflow-y-auto no-scrollbar">
          <IntelSidebar />
        </div>
      </div>

      <AnimatePresence>
        {sel && <Drawer item={sel} onClose={() => setSel(null)} />}
      </AnimatePresence>
    </div>
  );
}
