import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BrainCircuit, Cpu, Database, Zap, TrendingUp, ShieldCheck,
  ChevronRight, Sparkles, AlertTriangle, Lock,
  DollarSign, FileJson, CheckCircle, Users, Layers, Search,
  BarChart3, Eye, EyeOff, CircleDot, Server,
} from 'lucide-react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
} from 'recharts';
// TODO: Replace with Supabase tables when model_benchmarks, knowledge_namespaces,
// directives, and recommendations tables are created. All reference/config data.
import {
  modelBenchmarks, knowledgeNamespaces, directiveTemplates,
  systemRecommendations, agents,
} from '../utils/mockData';
import { container, item } from '../utils/variants';

/* ── Sub-tab config ──────────────────────────────────────────── */
const tabs = [
  { id: 'models', label: 'Model Registry', icon: Cpu },
  { id: 'knowledge', label: 'Knowledge Map', icon: Database },
  { id: 'directives', label: 'Directives', icon: ShieldCheck },
];

/* ── Icon map for directive icons ────────────────────────────── */
const iconMap = { ShieldCheck, DollarSign, FileJson, CheckCircle, Lock };

/* ── Stable sparkmap grid (memoized random delays) ───────────── */
const SPARK_CELLS = Array.from({ length: 32 }, (_, i) => ({
  intensity: i < 8 ? 0.6 : i < 18 ? 0.3 : 0.08,
  delay: Math.random() * 2,
}));

function SparkGrid() {
  return (
    <div className="grid grid-cols-8 gap-1">
      {SPARK_CELLS.map((cell, i) => (
        <motion.div
          key={i}
          className="w-full aspect-square rounded-[2px]"
          style={{ backgroundColor: `rgba(0,217,200,${cell.intensity})` }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, delay: cell.delay }}
        />
      ))}
    </div>
  );
}

/* ── Radar chart data from benchmarks ────────────────────────── */
const radarMetrics = ['reasoning', 'codeGen', 'extraction', 'latency', 'costEfficiency'];
const radarLabels = { reasoning: 'Reasoning', codeGen: 'Code Gen', extraction: 'Extraction', latency: 'Speed', costEfficiency: 'Cost Eff.' };
const modelColors = {
  'Claude Opus 4.6': '#00D9C8',
  'Claude Sonnet 4.6': '#60a5fa',
  'GPT-4o': '#a78bfa',
  'Gemini 3.1': '#fbbf24',
  'Llama 3 70B': '#fb7185',
  'DeepSeek Coder': '#34d399',
};

function buildRadarData(selectedModels) {
  return radarMetrics.map((metric) => {
    const point = { metric: radarLabels[metric] };
    selectedModels.forEach((m) => {
      point[m.model] = m[metric];
    });
    return point;
  });
}

/* ── Priority badge ──────────────────────────────────────────── */
function PriorityBadge({ priority }) {
  const styles = {
    critical: 'bg-aurora-rose/15 text-aurora-rose border-aurora-rose/30',
    high: 'bg-aurora-amber/15 text-aurora-amber border-aurora-amber/30',
    normal: 'bg-aurora-teal/15 text-aurora-teal border-aurora-teal/30',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${styles[priority]}`}>
      {priority}
    </span>
  );
}

/* ── Recommendation card ─────────────────────────────────────── */
function RecommendationCard({ rec }) {
  const impactColors = { critical: 'border-l-aurora-rose', high: 'border-l-aurora-amber', normal: 'border-l-aurora-teal' };
  const impactIcons = { optimization: TrendingUp, performance: Zap, directive: Sparkles };
  const Icon = impactIcons[rec.type] || Sparkles;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className={`spatial-panel p-4 border-l-[3px] ${impactColors[rec.impact]} hover:bg-white/[0.02] transition-all group cursor-pointer`}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-aurora-teal" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-text-primary">{rec.title}</span>
            {rec.savings && (
              <span className="text-[10px] font-mono text-aurora-green bg-aurora-green/10 px-1.5 py-0.5 rounded">
                {rec.savings}
              </span>
            )}
          </div>
          <p className="text-xs text-text-body leading-relaxed">{rec.description}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-text-disabled group-hover:text-aurora-teal transition-colors shrink-0 mt-1" />
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MODEL REGISTRY TAB
   ═══════════════════════════════════════════════════════════════ */
function ModelRegistryTab() {
  const [selectedModels, setSelectedModels] = useState(
    modelBenchmarks.filter((m) => ['Claude Opus 4.6', 'Llama 3 70B', 'Gemini 3.1'].includes(m.model))
  );

  const toggleModel = (model) => {
    setSelectedModels((prev) => {
      const exists = prev.find((m) => m.model === model.model);
      if (exists) return prev.filter((m) => m.model !== model.model);
      if (prev.length >= 4) return prev; // max 4 on radar
      return [...prev, model];
    });
  };

  const radarData = buildRadarData(selectedModels);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-6">
      {/* Top: Radar + Model selector */}
      <div className="grid grid-cols-12 gap-6">
        {/* Radar Chart */}
        <motion.div variants={item} className="col-span-5 spatial-panel p-6">
          <h3 className="text-xs uppercase tracking-widest text-text-muted mb-4 flex items-center gap-2">
            <BrainCircuit className="w-4 h-4 text-aurora-purple" /> Capability Radar
          </h3>
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                <PolarGrid stroke="rgba(255,255,255,0.05)" />
                <PolarAngleAxis dataKey="metric" tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                {selectedModels.map((m) => (
                  <Radar
                    key={m.model}
                    name={m.model}
                    dataKey={m.model}
                    stroke={modelColors[m.model]}
                    fill={modelColors[m.model]}
                    fillOpacity={0.15}
                    strokeWidth={2}
                  />
                ))}
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap justify-center gap-4 mt-3">
            {selectedModels.map((m) => (
              <div key={m.model} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: modelColors[m.model] }} />
                <span className="text-[10px] text-text-muted font-mono">{m.model}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Model Cards Grid */}
        <motion.div variants={item} className="col-span-7 grid grid-cols-2 gap-3">
          {modelBenchmarks.map((model) => {
            const isSelected = selectedModels.some((m) => m.model === model.model);
            const color = modelColors[model.model];
            const isLocal = model.provider === 'Ollama';

            return (
              <motion.button
                key={model.model}
                onClick={() => toggleModel(model)}
                aria-pressed={isSelected}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`text-left p-4 rounded-xl border transition-all duration-300 ${
                  isSelected
                    ? 'bg-white/[0.04] border-white/[0.12] shadow-lg'
                    : 'bg-white/[0.015] border-white/[0.04] opacity-60 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CircleDot className="w-3 h-3" style={{ color }} />
                    <span className="text-xs font-semibold text-text-primary">{model.model}</span>
                  </div>
                  {isSelected ? (
                    <Eye className="w-3.5 h-3.5 text-aurora-teal" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 text-text-disabled" />
                  )}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-[10px] text-text-muted">{model.provider}</span>
                  {isLocal && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-aurora-green/10 text-aurora-green border border-aurora-green/20">
                      LOCAL
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-[10px]">
                  <div>
                    <span className="text-text-disabled block">Ctx</span>
                    <span className="text-text-body font-mono">{model.contextWindow}</span>
                  </div>
                  <div>
                    <span className="text-text-disabled block">Tok/s</span>
                    <span className="text-text-body font-mono">{model.tokensPerSec}</span>
                  </div>
                  <div>
                    <span className="text-text-disabled block">$/mo</span>
                    <span className="text-text-body font-mono">
                      {model.monthlyCost === 0 ? 'Free' : `$${model.monthlyCost}`}
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      {/* Agent Token Usage Bar */}
      <motion.div variants={item} className="spatial-panel p-5">
        <h3 className="text-xs uppercase tracking-widest text-text-muted flex items-center justify-between mb-4">
          <span className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-aurora-teal" /> Agent Token Distribution
          </span>
          <span className="text-aurora-teal font-mono">
            {agents.reduce((sum, a) => sum + a.totalTokens, 0).toLocaleString()} total
          </span>
        </h3>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={agents.map((a) => ({ name: a.name, tokens: a.totalTokens, color: a.color }))}
              layout="vertical"
              margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
            >
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#71717a', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}
              />
              <Tooltip
                cursor={false}
                contentStyle={{
                  background: 'rgba(17,17,17,0.95)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '0.5rem',
                  fontSize: 11,
                  fontFamily: 'JetBrains Mono, monospace',
                }}
                formatter={(value) => [`${value.toLocaleString()} tokens`, 'Usage']}
              />
              <Bar
                dataKey="tokens"
                radius={[0, 6, 6, 0]}
                barSize={14}
                shape={(props) => {
                  const { x, y, width, height, payload } = props;
                  return <rect x={x} y={y} width={width} height={height} rx={6} fill={payload.color} />;
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KNOWLEDGE MAP TAB
   ═══════════════════════════════════════════════════════════════ */
function KnowledgeMapTab() {
  const totalVectors = knowledgeNamespaces.reduce((sum, ns) => sum + ns.vectors, 0);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-6">
      {/* Summary strip */}
      <motion.div variants={item} className="grid grid-cols-3 gap-4">
        <div className="spatial-panel p-5 relative overflow-hidden group hover:shadow-glow-blue transition-all">
          <div className="absolute top-0 right-0 p-3 opacity-[0.06]"><Database size={64} /></div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Total Vectors</div>
          <div className="text-3xl font-mono text-aurora-teal font-bold">{totalVectors.toLocaleString()}</div>
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-aurora-teal">
            <span className="w-1.5 h-1.5 rounded-full bg-aurora-teal animate-pulse" /> +1,240 today
          </div>
        </div>
        <div className="spatial-panel p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-[0.06]"><Server size={64} /></div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Memory Footprint</div>
          <div className="text-3xl font-mono text-text-primary font-bold">
            14.2 <span className="text-lg text-text-muted font-normal">GB</span>
          </div>
          <div className="mt-2 w-full h-1 bg-surface-raised rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: '34%' }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              className="h-full rounded-full bg-gradient-to-r from-aurora-teal to-aurora-blue"
            />
          </div>
          <p className="text-[10px] text-text-disabled mt-1.5 text-right">34% of 41.8 GB</p>
        </div>
        <div className="spatial-panel p-5 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-[0.06]"><Layers size={64} /></div>
          <div className="text-[10px] uppercase tracking-widest text-text-muted mb-1">Namespaces</div>
          <div className="text-3xl font-mono text-text-primary font-bold">{knowledgeNamespaces.length}</div>
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {knowledgeNamespaces.slice(0, 3).map((ns) => (
              <span key={ns.id} className="px-1.5 py-0.5 bg-white/[0.04] rounded text-[9px] font-mono text-text-muted">{ns.name}</span>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Namespace cards */}
      <motion.div variants={item} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-widest text-text-muted flex items-center gap-2">
            <Layers className="w-4 h-4 text-aurora-purple" /> Knowledge Namespaces
          </h3>
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-disabled" />
            <input
              type="text"
              placeholder="Search namespaces..."
              aria-label="Search namespaces"
              className="w-full bg-surface border border-border rounded-lg pl-8 pr-3 py-2 text-xs font-mono focus:outline-none focus:border-aurora-teal/50 transition-colors text-text-primary"
            />
          </div>
        </div>

        {knowledgeNamespaces.map((ns, idx) => {
          const pct = Math.round((ns.vectors / totalVectors) * 100);
          return (
            <motion.div
              key={ns.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              className={`spatial-panel p-4 hover:bg-white/[0.02] transition-all cursor-pointer group border-l-[3px] ${
                ns.status === 'stale' ? 'border-l-aurora-amber' : 'border-l-aurora-teal'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    ns.status === 'stale' ? 'bg-aurora-amber/10 text-aurora-amber' : 'bg-aurora-teal/10 text-aurora-teal'
                  }`}>
                    <Database className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-semibold text-text-primary">{ns.name}</span>
                      {ns.status === 'stale' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-aurora-amber/10 text-aurora-amber border border-aurora-amber/20 flex items-center gap-1">
                          <AlertTriangle className="w-2.5 h-2.5" /> STALE
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-text-muted truncate">{ns.description}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6 shrink-0">
                  <div className="text-right">
                    <div className="text-xs font-mono text-text-primary">{ns.vectors.toLocaleString()}</div>
                    <div className="text-[9px] text-text-disabled">vectors</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-mono text-text-primary">{ns.size}</div>
                    <div className="text-[9px] text-text-disabled">size</div>
                  </div>
                  <div className="w-24">
                    <div className="h-1.5 bg-surface-raised rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                        className="h-full rounded-full bg-aurora-teal/60"
                      />
                    </div>
                    <div className="text-[9px] text-text-disabled mt-0.5 text-right">{pct}%</div>
                  </div>
                  <div className="flex -space-x-1.5">
                    {ns.agents.map((name) => (
                      <div key={name} className="w-5 h-5 rounded-full bg-surface-raised border border-border flex items-center justify-center text-[8px] font-bold text-text-muted">
                        {name[0]}
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] text-text-disabled w-16 text-right">{ns.lastSync}</div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DIRECTIVES TAB
   ═══════════════════════════════════════════════════════════════ */
function DirectivesTab() {
  const [expandedId, setExpandedId] = useState(null);

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="flex flex-col gap-6">
      {/* Directive info banner */}
      <motion.div variants={item} className="spatial-panel p-4 border-l-[3px] border-l-aurora-blue flex items-center gap-3">
        <Sparkles className="w-5 h-5 text-aurora-blue shrink-0" />
        <p className="text-xs text-text-body">
          <span className="text-text-primary font-medium">Directives</span> are shared instructions that propagate to agents automatically.
          Write once, apply to many — no more repeating yourself.
        </p>
      </motion.div>

      {/* Directive cards */}
      <motion.div variants={item} className="flex flex-col gap-3">
        {directiveTemplates.map((dir, idx) => {
          const Icon = iconMap[dir.icon] || ShieldCheck;
          const isExpanded = expandedId === dir.id;

          return (
            <motion.div
              key={dir.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06 }}
              onClick={() => setExpandedId(isExpanded ? null : dir.id)}
              className="spatial-panel overflow-hidden cursor-pointer hover:bg-white/[0.02] transition-all"
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center border border-white/[0.06]">
                    <Icon className="w-4 h-4 text-aurora-teal" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">{dir.name}</span>
                      <PriorityBadge priority={dir.priority} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-text-disabled">
                        Scope: <span className="text-text-muted">{dir.scope}</span>
                      </span>
                      <span className="text-text-disabled">·</span>
                      <span className="text-[10px] text-text-disabled">
                        {dir.appliedTo.length} agent{dir.appliedTo.length !== 1 && 's'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex -space-x-1.5">
                    {dir.appliedTo.slice(0, 4).map((name) => (
                      <div key={name} className="w-5 h-5 rounded-full bg-surface-raised border border-border flex items-center justify-center text-[8px] font-bold text-text-muted">
                        {name[0]}
                      </div>
                    ))}
                    {dir.appliedTo.length > 4 && (
                      <div className="w-5 h-5 rounded-full bg-surface-raised border border-border flex items-center justify-center text-[8px] text-text-disabled">
                        +{dir.appliedTo.length - 4}
                      </div>
                    )}
                  </div>
                  <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                    <ChevronRight className="w-4 h-4 text-text-disabled" />
                  </motion.div>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 border-t border-white/[0.04]">
                      <div className="bg-black/30 rounded-lg p-3 mt-2">
                        <p className="text-xs text-text-body leading-relaxed font-mono">{dir.content}</p>
                      </div>
                      <div className="flex items-center gap-2 mt-3">
                        <Users className="w-3 h-3 text-text-disabled" />
                        <span className="text-[10px] text-text-disabled">
                          Applied to: {dir.appliedTo.join(', ')}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN VIEW
   ═══════════════════════════════════════════════════════════════ */
export function IntelligenceView() {
  const [activeTab, setActiveTab] = useState('models');

  return (
    <div className="flex flex-col h-full overflow-y-auto no-scrollbar pb-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-aurora-teal/10 flex items-center justify-center border border-aurora-teal/20">
            <BrainCircuit className="w-5 h-5 text-aurora-teal" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Intelligence</h2>
            <p className="text-xs text-text-muted">Models, knowledge, directives, and system recommendations.</p>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div role="tablist" className="flex items-center gap-1 mb-6 p-1 bg-white/[0.02] rounded-xl border border-white/[0.04] w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="relative px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-2"
          >
            {activeTab === tab.id && (
              <motion.div
                layoutId="intel-tab-bg"
                className="absolute inset-0 bg-white/[0.06] border border-white/[0.08] rounded-lg"
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              />
            )}
            <tab.icon className={`w-3.5 h-3.5 relative z-10 ${activeTab === tab.id ? 'text-aurora-teal' : 'text-text-muted'}`} />
            <span className={`relative z-10 ${activeTab === tab.id ? 'text-text-primary' : 'text-text-muted'}`}>
              {tab.label}
            </span>
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="grid grid-cols-12 gap-6">
        {/* Main tab content */}
        <div className="col-span-9">
          <AnimatePresence mode="wait">
            {activeTab === 'models' && <ModelRegistryTab key="models" />}
            {activeTab === 'knowledge' && <KnowledgeMapTab key="knowledge" />}
            {activeTab === 'directives' && <DirectivesTab key="directives" />}
          </AnimatePresence>
        </div>

        {/* Sidebar: System Recommendations */}
        <div className="col-span-3 flex flex-col gap-3">
          <h3 className="text-xs uppercase tracking-widest text-text-muted flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-aurora-amber" /> Recommendations
          </h3>
          {systemRecommendations.map((rec) => (
            <RecommendationCard key={rec.id} rec={rec} />
          ))}

          {/* Memory sparkmap mini */}
          <div className="spatial-panel p-4 mt-2">
            <h4 className="text-[10px] uppercase tracking-widest text-text-muted mb-3 flex items-center gap-1.5">
              <Database className="w-3 h-3 text-aurora-teal" /> Memory Activity
            </h4>
            <SparkGrid />
          </div>
        </div>
      </div>
    </div>
  );
}
