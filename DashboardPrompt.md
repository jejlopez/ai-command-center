Build a complete, production-quality React dashboard for an AI agent orchestration platform called Nexus — a dark spatial command center that feels like peering into a living neural network. Matte black surfaces, aurora-colored light bleeding through frosted glass panels, every metric animated, every interaction instant. The system should feel alive even when idle.

Tech Stack (Hard Constraints)
React 19 + Vite + Tailwind CSS 3 + Framer Motion 12 + Recharts 3 + Lucide React. No additional packages. All data is mock data in src/utils/mockData.js. Every file must be complete and importable — no // ...rest, no missing imports, no TODO comments. Functional components + hooks throughout.

File Structure

src/
  App.jsx
  index.css
  tailwind.config.js
  components/
    NavRail.jsx
    CommandPalette.jsx
    TimeRangePicker.jsx
    NeuralPulse.jsx
    AgentVitalCard.jsx
    CostBurnWidget.jsx
    ActivityFeed.jsx
    TaskDAG.jsx
    MemorySparkmap.jsx
    HealthRadial.jsx
    TraceWaterfall.jsx
    DetailPanel.jsx
    SpotlightCard.jsx
    ShimmerLoader.jsx
    ProjectSwitcher.jsx
  views/
    OverviewView.jsx
    FleetView.jsx
    AnalyticsView.jsx
    TasksView.jsx
    HiveMemoryView.jsx
  utils/
    mockData.js
    variants.js
    useAnimatedCounter.js
    useTypewriter.js
    useTimeRange.js
Color System — tailwind.config.js

colors: {
  canvas:  '#080808',
  surface: { DEFAULT: '#111111', raised: '#161616', input: '#1c1c1c' },
  text: {
    primary:  '#e8e8ed',
    body:     '#a1a1aa',
    muted:    '#71717a',
    disabled: '#3f3f46',
  },
  border: {
    subtle:  'rgba(255,255,255,0.05)',
    DEFAULT: 'rgba(255,255,255,0.08)',
    strong:  'rgba(255,255,255,0.14)',
  },
  aurora: {
    teal:   '#00D9C8',   // AI activity / processing / healthy
    violet: '#a78bfa',   // memory / intelligence — universal 2026 AI accent
    rose:   '#fb7185',   // errors / critical
    amber:  '#fbbf24',   // warnings / degraded
    blue:   '#60a5fa',   // pipeline / tasks / network
    green:  '#34d399',   // success
  },
},
boxShadow: {
  'glow-teal':   '0 0 0 1px rgba(0,217,200,0.25),   0 0 20px rgba(0,217,200,0.1)',
  'glow-violet': '0 0 0 1px rgba(167,139,250,0.25),  0 0 20px rgba(167,139,250,0.1)',
  'glow-rose':   '0 0 0 1px rgba(251,113,133,0.25),  0 0 20px rgba(251,113,133,0.08)',
  'card':        'inset 0 1px 0 rgba(255,255,255,0.06), 0 4px 8px rgba(0,0,0,0.35)',
},
Semantic color mapping is mandatory throughout — teal = AI running/healthy, violet = anything intelligence/memory/AI-branded, rose = errors, amber = warnings, blue = pipeline/tasks.

index.css
Animated Aurora Background

@property --ax1 { syntax: '<percentage>'; inherits: false; initial-value: 20%; }
@property --ay1 { syntax: '<percentage>'; inherits: false; initial-value: 30%; }
@property --ax2 { syntax: '<percentage>'; inherits: false; initial-value: 75%; }
@property --ay2 { syntax: '<percentage>'; inherits: false; initial-value: 65%; }

@keyframes aurora-drift {
  0%   { --ax1: 20%; --ay1: 30%; --ax2: 75%; --ay2: 65%; }
  33%  { --ax1: 55%; --ay1: 15%; --ax2: 30%; --ay2: 75%; }
  66%  { --ax1: 80%; --ay1: 60%; --ax2: 60%; --ay2: 20%; }
  100% { --ax1: 20%; --ay1: 30%; --ax2: 75%; --ay2: 65%; }
}

body {
  background-color: #080808;
  background-image:
    radial-gradient(ellipse 70% 50% at var(--ax1) var(--ay1), rgba(167,139,250,0.08) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at var(--ax2) var(--ay2), rgba(0,217,200,0.06) 0%, transparent 60%),
    radial-gradient(ellipse 50% 60% at 50% 90%, rgba(96,165,250,0.05) 0%, transparent 50%);
  animation: aurora-drift 40s ease-in-out infinite;
}
Noise Texture Overlay (3% — premium surface grain)

body::after {
  content: '';
  position: fixed; inset: 0; pointer-events: none; z-index: 0; opacity: 0.03;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E");
}
Keyframes

@keyframes shimmer {
  0%   { background-position: 200% center; }
  100% { background-position: -200% center; }
}
@keyframes dash-flow { to { stroke-dashoffset: -28; } }
@keyframes cell-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }

@property --border-angle { syntax: '<angle>'; inherits: false; initial-value: 0deg; }
@keyframes rotate-border { to { --border-angle: 360deg; } }
Utility Classes

.spatial-panel {
  background: rgba(255,255,255,0.03);
  backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 1rem;
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 4px 8px rgba(0,0,0,0.35);
}

/* Rotating conic border — use on active agent cards */
.agent-card-active {
  background: linear-gradient(#111111, #111111) padding-box,
    conic-gradient(from var(--border-angle), #00D9C8, #a78bfa, #60a5fa, #00D9C8) border-box;
  border: 1px solid transparent;
  animation: rotate-border 4s linear infinite;
}

/* Gradient border via ::before mask — use on featured cards */
.gradient-border { position: relative; }
.gradient-border::before {
  content: '';
  position: absolute; inset: 0; border-radius: inherit; padding: 1px;
  background: linear-gradient(135deg, rgba(167,139,250,0.5), rgba(0,217,200,0.2), rgba(255,255,255,0.04));
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask-composite: exclude;
  pointer-events: none;
}

.shimmer {
  background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.04) 50%, rgba(255,255,255,0) 100%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.font-tabular { font-variant-numeric: tabular-nums; }

/* Run table row status borders */
.row-success { border-left: 3px solid #34d399; }
.row-error   { border-left: 3px solid #fb7185; }
.row-running { border-left: 3px solid #fbbf24; }
.row-idle    { border-left: 3px solid rgba(255,255,255,0.08); }
Framer Motion — utils/variants.js

export const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

// The blur entrance is mandatory on every bento cell and list item.
// filter: blur(8px) → blur(0px) creates the "materializing from void" effect.
export const item = {
  hidden: { opacity: 0, y: 28, filter: 'blur(8px)', scale: 0.97 },
  show: {
    opacity: 1, y: 0, filter: 'blur(0px)', scale: 1,
    transition: { type: 'spring', stiffness: 100, damping: 20 },
  },
};
Use <AnimatePresence mode="popLayout"> wrapping every list. Add layout and layoutId={item.id} to every list item so reordering animates automatically.

Custom Hooks
useAnimatedCounter.js
Use useSpring + useTransform — drives DOM updates with zero React re-renders:


import { useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

export function useAnimatedCounter(target, { decimals = 0, stiffness = 80, damping = 25 } = {}) {
  const spring = useSpring(0, { stiffness, damping, restDelta: 0.001 });
  const display = useTransform(spring, v => v.toFixed(decimals));
  useEffect(() => { spring.set(target); }, [target, spring]);
  return display; // render as: <motion.span>{display}</motion.span>
}
useTypewriter.js
Cycles through an array of strings with typing, pause, delete effect. Props: strings[], typeSpeed=40ms, deleteSpeed=20ms, pauseMs=2000. Returns current display string as state.

useTimeRange.js
React context + hook. TimeRangeProvider wraps the app. useTimeRange() returns { range, setRange }. Range values: '15m' | '1h' | '6h' | '24h' | '7d'. Syncs to URL param ?range=1h. All charts and tables consume this hook to filter mock data.

Component Specifications
NavRail.jsx
64px wide, fixed left, full height, bg-canvas/80 backdrop-blur border-r border-border. Items: LayoutGrid (Overview) / Network (Fleet) / BrainCircuit (Memory) / BarChart3 (Intelligence) / GitBranch (Pipeline). Active indicator: 3px × 24px aurora.teal bar on left edge, uses Framer Motion layoutId="nav-indicator" so it physically slides between items on tab change. Hover: tooltip label slides in from x: -4, opacity: 0 → x: 0, opacity: 1. Bottom: 16px system-online pulse ring — two overlapping circles, outer has animate-ping in teal.

TimeRangePicker.jsx
Always visible in top-right header. Button shows active range. Click opens a dropdown: 15m / 1h / 6h / 24h / 7d. Active option in aurora.teal. Dropdown: spatial-panel, enters y: -8 → 0, opacity: 0 → 1. Selecting updates global useTimeRange context and URL param.

SpotlightCard.jsx
Reusable card wrapper. Tracks mousemove with useState for {x, y} and opacity. Renders a radial-gradient(600px circle at {x}px {y}px, rgba(167,139,250,0.12), transparent 40%) overlay div inside the card, opacity transitions 0↔1 on enter/leave. Wraps children. Every bento cell is wrapped in SpotlightCard.

NeuralPulse.jsx
Full-width top widget inside SpotlightCard. Centered layout with a 64px orb: border-radius: 50%, background: rgba(0,217,200,0.4), three layered box-shadow rings at 0 0 20px, 0 0 40px, 0 0 80px decreasing opacity. Orb pulses with scale: [0.95, 1.05] over 3s ease-in-out infinite via Framer Motion. Orb color driven by systemHealth prop: aurora.teal >90%, aurora.amber >70%, aurora.rose ≤70% — applied as inline style. Right of orb: "X agents active" with motion.span rendering useAnimatedCounter result. Below: dark command input bg-white/[0.03] rounded-xl, placeholder cycles via useTypewriter through ["Ask about agent status...", "Search tasks and pipelines...", "Query memory store..."], with a ⌘K spatial-panel pill badge on the right.

AgentVitalCard.jsx
Active agents: .agent-card-active class (rotating conic border). Inactive: .spatial-panel. Contents: top row: agent name font-semibold text-sm text-text-primary + model badge spatial-panel font-mono text-[10px]. Status dot: 6px circle; if status === 'processing', wrap in a relative span and add a second overlapping circle with animate-ping in the agent's color. Center: 80px SVG radial arc — background stroke rgba(255,255,255,0.08), foreground aurora.teal, motion.circle animates strokeDashoffset from full circumference to target (spring: stiffness 60, damping 15), center text font-mono font-semibold text-lg font-tabular. Below arc: Recharts <LineChart> sparkline — height 32px, no axes, no grid, no dots, single <Line> stroke aurora.teal strokeWidth={1.5}, isAnimationActive={true} animationDuration={800}. Latency badge colored by threshold: aurora.green <500ms, aurora.amber <2s, aurora.rose >2s. On whileHover parent: AnimatePresence reveals "View Logs →" and "Inspect →" in aurora.teal text-xs sliding up from y: 8, opacity: 0. Card: whileHover={{ scale: 1.012 }}.

CostBurnWidget.jsx
"COST TODAY" — text-[10px] uppercase tracking-[0.15em] text-text-muted. Large $XX.XX — motion.span with useAnimatedCounter(costData.total, { decimals: 2 }), font-mono text-3xl font-light text-text-primary font-tabular. Three model bars (Claude → violet, GPT-4o → blue, Gemini → amber): label left + font-mono text-[11px] text-text-muted cost right, below: h-1.5 rounded-full bg-white/5 track with motion.div inner bar from width: 0 → target % (duration 1s easeOut, stagger 0.15s each). Bottom: $X.XX/hr in text-aurora-teal font-mono text-sm font-tabular, opacity animates 0.6 → 1 → 0.6 over 2s infinite.

ActivityFeed.jsx
spatial-panel h-72 overflow-hidden. Inner scrollable div with thin custom scrollbar. Smart auto-scroll: use useRef on scroll container and a isUserScrolled ref. On onScroll: if scrollTop + clientHeight < scrollHeight - 20 set isUserScrolled = true. When new entries arrive, if not user-scrolled, scrollRef.current.scrollTop = scrollHeight. Show a sticky bottom-center pill "↓ Jump to latest" in aurora.teal bg when isUserScrolled; clicking sets isUserScrolled = false and scrolls to bottom. Each entry via AnimatePresence + motion.div initial={{ opacity: 0, y: 10 }}. Format: font-mono text-xs — timestamp text-text-disabled, bracket tag ([OK] teal / [ERR] rose / [NET] blue / [SYS] muted), message text-text-body. Top fade mask: mask-image: linear-gradient(to bottom, transparent, black 25%).

TraceWaterfall.jsx
The most important widget. Horizontal Gantt of one agent run's execution. Data: spans[] with { id, name, type, startMs, durationMs, parentId, model, tokens, status }. Types color-coded: llm violet, tool amber, retrieval blue, agent teal, error rose. Each row: label left (indented 16px per depth level from parentId tree), bar right. Bar: motion.div with marginLeft: (startMs/totalMs)*100%, width: 0 → (durationMs/totalMs)*100% (duration 0.8s easeOut, stagger by tree depth). Bar background = type color at 30%, border-left = type color. On hover: spatial-panel tooltip showing name, model, ${durationMs}ms, ${tokens} tok. Click: opens DetailPanel. Render total duration badge top-right. Wrap in SpotlightCard.

DetailPanel.jsx
Slide-in from right, 560px wide, full height, fixed positioned. AnimatePresence + motion.div x: '100%' → '0%' spring (stiffness 300, damping 35). Backdrop: fixed inset-0 bg-black/40 backdrop-blur-sm fades in opacity 0→1. URL updates ?detail={id} on open. Escape key or backdrop click closes. Header: agent name + status + actions (Re-run aurora.amber, Copy ID, Export). Tabs: Overview / Trace / Logs / Metadata — each tab switches with AnimatePresence. Trace tab contains <TraceWaterfall spans={selectedSpans} />. Logs tab contains <ActivityFeed entries={selectedLogs} />. Use useEffect to register Escape keydown listener.

TaskDAG.jsx
SVG DAG. 5 nodes with parent-child relationships forming a linear chain with one branch. Node: <rect rx="12" width="140" height="48" fill="rgba(255,255,255,0.04)"> + stroke in node's status color at 30% opacity. Inside: <text> task name (11px, text-text-body) + <circle r="3"> status dot. Connections: cubic bezier <path> elements, stroke="rgba(0,217,200,0.25)" strokeWidth="1.5" strokeDasharray="6 4", CSS animation: dash-flow 2s linear infinite. Active node: outer glow <rect> + <filter><feGaussianBlur stdDeviation="4"></filter>. All node groups in motion.g with entrance animation.

MemorySparkmap.jsx
36-cell grid, cells 10×10px, 2px gap. Color by recency: 'recent' → rgba(0,217,200,0.6), 'medium' → rgba(167,139,250,0.3), 'old' → rgba(255,255,255,0.05). Each cell inline animationDelay: Math.random() * 3 + 's' with animation: cell-pulse 3s ease-in-out infinite. Framer Motion tooltip on hover showing chunk.key + lastAccessed. Header "MEMORY CORE" text-[10px] uppercase tracking-[0.15em] text-text-muted.

HealthRadial.jsx
Props: label, value, color. 64×64 SVG. Background arc: stroke="rgba(255,255,255,0.06)" strokeWidth="5". Foreground motion.circle in color, strokeDashoffset animates full circumference → target (duration 1.2s easeOut on mount). Center: value font-mono text-sm font-semibold font-tabular. Below: label text-[9px] uppercase tracking-[0.15em] text-text-disabled.

CommandPalette.jsx
Register ⌘K in App.jsx useEffect on keydown. AnimatePresence backdrop bg-black/60 backdrop-blur-sm opacity 0→1. Palette: max-w-lg, centered, top-28, spatial-panel gradient-border, y: -20 → 0, opacity: 0 → 1 spring (stiffness 300, damping 30). Autofocused search input text-base bg-transparent border-none outline-none. Empty input shows "Recent" commands. Results grouped with section headers. Track selectedIndex: arrow keys navigate, highlight bg-white/[0.06] rounded-lg, Enter executes, Escape closes. 10 mock commands covering agent inspection, navigation, and actions.

ShimmerLoader.jsx
<div className={cn('shimmer rounded-xl bg-white/[0.03]', className)} /> — accepts className for sizing. Use as loading placeholder inside every widget while data loads.

OverviewView.jsx — Bento Grid

<motion.div variants={container} initial="hidden" animate="show"
  className="grid grid-cols-12 gap-5 pb-8">

  {/* Row 1: Command header */}
  <motion.div variants={item} className="col-span-12">
    <SpotlightCard><NeuralPulse systemHealth={94} agentCount={4} /></SpotlightCard>
  </motion.div>

  {/* Row 2: Agent vitals — layoutId for smooth reorder */}
  <AnimatePresence mode="popLayout">
    {agents.map(a => (
      <motion.div key={a.id} variants={item} layout layoutId={a.id} className="col-span-3">
        <AgentVitalCard agent={a} onLogClick={() => openDetail(a.id)} />
      </motion.div>
    ))}
  </AnimatePresence>

  {/* Row 3 */}
  <motion.div variants={item} className="col-span-4">
    <SpotlightCard><CostBurnWidget /></SpotlightCard>
  </motion.div>
  <motion.div variants={item} className="col-span-4">
    <SpotlightCard><ActivityFeed /></SpotlightCard>
  </motion.div>
  <motion.div variants={item} className="col-span-4">
    <SpotlightCard><TaskDAG /></SpotlightCard>
  </motion.div>

  {/* Row 4 */}
  <motion.div variants={item} className="col-span-5">
    <SpotlightCard><MemorySparkmap /></SpotlightCard>
  </motion.div>
  <motion.div variants={item} className="col-span-3">
    <div className="spatial-panel p-5 flex gap-6 justify-center items-center h-full">
      <HealthRadial label="CPU" value={72} color="#00D9C8" />
      <HealthRadial label="MEM" value={58} color="#a78bfa" />
      <HealthRadial label="API" value={94} color="#60a5fa" />
    </div>
  </motion.div>
  <motion.div variants={item} className="col-span-4">
    <SpotlightCard><TraceWaterfall spans={mockSpans} /></SpotlightCard>
  </motion.div>
</motion.div>
TasksView.jsx — Run Table
Each run row: spatial-panel mb-2 p-4 flex items-center gap-4 cursor-pointer + one of .row-success, .row-error, .row-running, .row-idle. The 3px left border is the primary status signal — instantly scannable. Columns: timestamp / agent name / model badge / status pill / duration / token count / cost. All rows via AnimatePresence mode="popLayout" + motion.div layout. Click row → opens DetailPanel. Row: whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}. Cost per row shown as $0.023 font-mono text-[11px] text-text-muted. Three-state handling: if loading, show ShimmerLoader rows; if empty, centered empty state with BrainCircuit icon + "No runs yet" + CTA button; if error, rose-tinted panel with retry button.

mockData.js — Complete Required Shape

export const agents = [
  { id: 'a1', name: 'Atlas', model: 'claude-opus-4-6', status: 'processing',
    taskCompletion: 78, tokenBurn: [120,145,132,167,154,189,201,178,195,210,185,220],
    latencyMs: 340, color: '#00D9C8' },
  { id: 'a2', name: 'Orion', model: 'gpt-4o', status: 'idle',
    taskCompletion: 100, tokenBurn: [80,90,85,110,95,100,88,92,87,95,91,98],
    latencyMs: 820, color: '#60a5fa' },
  { id: 'a3', name: 'Vega', model: 'claude-opus-4-6', status: 'processing',
    taskCompletion: 42, tokenBurn: [200,210,195,230,245,220,235,250,240,260,255,270],
    latencyMs: 290, color: '#a78bfa' },
  { id: 'a4', name: 'Lyra', model: 'gemini-1.5', status: 'error',
    taskCompletion: 15, tokenBurn: [50,60,55,40,0,0,0,0,0,0,0,0],
    latencyMs: 4200, color: '#fb7185' },
];

export const activityLog = [
  { id: 1,  timestamp: '09:05:12', type: 'SYS', message: 'Atlas context loaded — 4096 tokens' },
  { id: 2,  timestamp: '09:05:14', type: 'NET', message: 'Connecting to lottery.broadwaydirect.com' },
  { id: 3,  timestamp: '09:05:15', type: 'OK',  message: 'Firecrawl scrape complete — 3 shows found' },
  { id: 4,  timestamp: '09:05:18', type: 'OK',  message: 'iMessage sent to +1 (201) 555-0147' },
  { id: 5,  timestamp: '09:05:20', type: 'SYS', message: 'Polling for reply — timeout 11:00 AM' },
  { id: 6,  timestamp: '09:05:22', type: 'NET', message: 'Vega connecting to my.socialtoaster.com' },
  { id: 7,  timestamp: '09:05:25', type: 'ERR', message: 'Lyra: OOMKilled — memory limit exceeded' },
  { id: 8,  timestamp: '09:05:26', type: 'SYS', message: 'Lyra: Awaiting intervention' },
  { id: 9,  timestamp: '09:06:01', type: 'OK',  message: 'Orion: Q3 analysis complete — $0.84' },
  { id: 10, timestamp: '09:06:12', type: 'NET', message: 'Atlas: DB sync complete — 1204 vectors' },
  { id: 11, timestamp: '09:06:18', type: 'OK',  message: 'Vega: Login session established' },
  { id: 12, timestamp: '09:06:22', type: 'SYS', message: 'Rate limit: 85% on claude-opus-4-6' },
  { id: 13, timestamp: '09:06:30', type: 'NET', message: 'Atlas: Fetching luckyseat.com/shows' },
  { id: 14, timestamp: '09:06:35', type: 'OK',  message: 'Playwright: Cookie banner dismissed' },
  { id: 15, timestamp: '09:06:40', type: 'OK',  message: 'Lottery form submitted — Hamilton' },
  { id: 16, timestamp: '09:06:42', type: 'OK',  message: 'Lottery form submitted — Wicked' },
  { id: 17, timestamp: '09:06:50', type: 'SYS', message: 'Total cost this session: $4.83' },
  { id: 18, timestamp: '09:06:55', type: 'OK',  message: 'Confirmation iMessage sent to both recipients' },
];

export const mockSpans = [
  { id: 's1', name: 'Broadway Lottery Run', type: 'agent',     startMs: 0,    durationMs: 4200, parentId: null, model: 'claude-opus-4-6', tokens: 1240, status: 'success' },
  { id: 's2', name: 'Scrape broadwaydirect', type: 'tool',     startMs: 80,   durationMs: 890,  parentId: 's1', model: null,             tokens: 0,    status: 'success' },
  { id: 's3', name: 'Parse show list',       type: 'llm',      startMs: 970,  durationMs: 620,  parentId: 's1', model: 'claude-opus-4-6', tokens: 340,  status: 'success' },
  { id: 's4', name: 'Scrape luckyseat',      type: 'tool',     startMs: 1590, durationMs: 740,  parentId: 's1', model: null,             tokens: 0,    status: 'success' },
  { id: 's5', name: 'Enter Hamilton lottery',type: 'tool',     startMs: 2330, durationMs: 980,  parentId: 's1', model: null,             tokens: 0,    status: 'success' },
  { id: 's6', name: 'Confirm via iMessage',  type: 'tool',     startMs: 3310, durationMs: 210,  parentId: 's1', model: null,             tokens: 0,    status: 'success' },
];

export const tasks = [
  { id: 't1', name: 'Scrape Sites',    status: 'completed', parentId: null, agentName: 'Atlas' },
  { id: 't2', name: 'Parse Results',  status: 'completed', parentId: 't1', agentName: 'Atlas' },
  { id: 't3', name: 'Send iMessage',  status: 'completed', parentId: 't2', agentName: 'Atlas' },
  { id: 't4', name: 'Wait for Reply', status: 'running',   parentId: 't3', agentName: 'Atlas' },
  { id: 't5', name: 'Enter Lottery',  status: 'pending',   parentId: 't4', agentName: 'Atlas' },
];

export const memoryChunks = Array.from({ length: 36 }, (_, i) => ({
  key: `mem_chunk_${i.toString().padStart(2,'0')}`,
  recency: i < 12 ? 'recent' : i < 24 ? 'medium' : 'old',
  lastAccessed: new Date(Date.now() - i * 180000).toISOString(),
}));

export const costData = {
  total: 4.83,
  burnRate: 0.42,
  models: [
    { name: 'Claude',  cost: 2.91, percentage: 60 },
    { name: 'GPT-4o',  cost: 1.45, percentage: 30 },
    { name: 'Gemini',  cost: 0.47, percentage: 10 },
  ],
};

export const healthMetrics = [
  { label: 'CPU', value: 72, color: '#00D9C8' },
  { label: 'MEM', value: 58, color: '#a78bfa' },
  { label: 'API', value: 94, color: '#60a5fa' },
];

export const commandItems = [
  { id: 'c1', group: 'Agents',     label: 'Inspect Agent Atlas',        icon: 'Cpu' },
  { id: 'c2', group: 'Agents',     label: 'Halt all running agents',    icon: 'Square' },
  { id: 'c3', group: 'Agents',     label: 'Re-run last failed agent',   icon: 'RefreshCw' },
  { id: 'c4', group: 'Navigation', label: 'Go to Fleet View',           icon: 'Network' },
  { id: 'c5', group: 'Navigation', label: 'Go to Memory Core',          icon: 'BrainCircuit' },
  { id: 'c6', group: 'Navigation', label: 'Go to Intelligence',         icon: 'BarChart3' },
  { id: 'c7', group: 'Actions',    label: 'Export logs as JSON',        icon: 'Download' },
  { id: 'c8', group: 'Actions',    label: 'Set spend alert threshold',  icon: 'Bell' },
  { id: 'c9', group: 'Actions',    label: 'Copy session trace ID',      icon: 'Clipboard' },
  { id: 'c10',group: 'Actions',    label: 'Switch to Production env',   icon: 'Globe' },
];
Animation Requirements (Non-Negotiable)
Every bento cell entrance: filter: blur(8px) → blur(0px) + y: 28 → 0 + scale: 0.97 → 1, spring physics, staggered 0.08s
All numeric values rendered via useAnimatedCounter (useSpring + useTransform, zero React re-renders)
Active agent status dots: animate-ping on overlapping circle
Background aurora drifts via CSS @property animation, 40s loop
Task DAG paths: CSS dash-flow animation, 2s linear infinite
Memory cells: cell-pulse keyframes with randomized animationDelay inline style
Health radial arcs: motion.circle strokeDashoffset on mount
Sparklines: isAnimationActive={true} animationDuration={800}
Activity feed entries: AnimatePresence + y: 10 → 0 slide-in
Agent cards: rotating conic gradient border (agent-card-active) on active agents
SpotlightCard mouse-tracking radial glow on every bento cell
AnimatePresence mode="popLayout" + layout + layoutId on all list items
Command palette: spring drop-in + backdrop fade
Detail panel: spring slide-in from right, backdrop fade, URL sync
Trace waterfall bars: width animates from 0 on mount, staggered by span depth
Code Quality
Every file is complete and importable with no truncation. All Tailwind classes are valid v3. Framer Motion: import motion, AnimatePresence, useSpring, useTransform, useMotionValue from "framer-motion". Recharts: LineChart, Line, ResponsiveContainer from "recharts". Lucide: import each icon individually. Custom hooks fully implemented. App renders without errors on first load — zero network dependencies, all data from mockData.js.