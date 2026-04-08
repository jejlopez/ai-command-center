import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { cn } from '../utils/cn';
import { useAnimatedCounter } from '../utils/useAnimatedCounter';
import { Crown, ArrowUpRight, AlertTriangle, RotateCcw, Square } from 'lucide-react';
import { agents as defaultAgents, activityLog as defaultLog } from '../utils/mockData';

function getThresholdColor(val) {
  if (val < 60) return '#00D9C8';
  if (val < 85) return '#fbbf24';
  return '#fb7185';
}

function SegmentedArc({ completion, tokenBurnRate, baseColor }) {
  const SEGS = 16;
  const ARC = 240;
  const START = -120;

  return (
    <div className="relative w-[80px] h-[80px]">
      <svg className="w-full h-full" viewBox="0 0 100 100">
        {/* Outer track — token burn rate */}
        {[...Array(SEGS)].map((_, i) => {
          const angle = START + (i / (SEGS - 1)) * ARC;
          const isFilled = (i / (SEGS - 1)) * 100 <= tokenBurnRate;
          const color = isFilled ? getThresholdColor(tokenBurnRate) : 'rgba(255,255,255,0.06)';
          return (
            <line
              key={`out-${i}`}
              x1="50" y1="8" x2="50" y2="13"
              stroke={color}
              strokeWidth="2"
              strokeLinecap="round"
              transform={`rotate(${angle} 50 50)`}
              style={{ transition: 'stroke 0.4s ease', filter: isFilled ? `drop-shadow(0 0 3px ${color}66)` : 'none' }}
            />
          );
        })}
        {/* Inner track — task completion */}
        {[...Array(SEGS)].map((_, i) => {
          const angle = START + (i / (SEGS - 1)) * ARC;
          const isFilled = (i / (SEGS - 1)) * 100 <= completion;
          const color = isFilled ? baseColor : 'rgba(255,255,255,0.06)';
          return (
            <line
              key={`in-${i}`}
              x1="50" y1="17" x2="50" y2="28"
              stroke={color}
              strokeWidth="3.5"
              strokeLinecap="round"
              transform={`rotate(${angle} 50 50)`}
              style={{ transition: 'stroke 0.4s ease', filter: isFilled ? `drop-shadow(0 0 4px ${baseColor}44)` : 'none' }}
            />
          );
        })}
      </svg>
    </div>
  );
}

export function AgentVitalCard({ agent, onLogClick, allAgents, activityLog }) {
  const agentList = allAgents || defaultAgents;
  const logList = activityLog || defaultLog;

  const isProcessing = agent.status === 'processing';
  const isError = agent.status === 'error';
  const isCommander = agent.role === 'commander';
  const progressAnim = useAnimatedCounter(agent.taskCompletion);
  const parentAgent = agent.parentId ? agentList.find(a => a.id === agent.parentId) : null;

  // Get last error log for error-state agents
  const lastErrorLog = isError
    ? logList.filter(l => l.agentId === agent.id && l.type === 'ERR').pop()
    : null;

  const formattedData = agent.tokenBurn.map((v, i) => ({ val: v, i }));
  const latestBurn = formattedData.length > 0 ? formattedData[formattedData.length - 1].val : 0;
  const burnRatePercent = Math.min(100, Math.max(0, (latestBurn / 300) * 100));

  let latencyColor = 'text-aurora-green';
  if (agent.latencyMs > 2000) latencyColor = 'text-aurora-rose';
  else if (agent.latencyMs > 500) latencyColor = 'text-aurora-amber';

  const statusLabel = { processing: 'Active', idle: 'Idle', error: 'Error' }[agent.status] || agent.status;
  const statusColor = { processing: 'text-aurora-teal', idle: 'text-text-muted', error: 'text-aurora-rose' }[agent.status];

  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -4, transition: { duration: 0.2 } }}
      onClick={onLogClick}
      className={cn(
        "relative p-5 h-full flex flex-col justify-between group cursor-pointer",
        isError
          ? "spatial-panel border-aurora-rose/30 shadow-[0_0_20px_rgba(251,113,133,0.15)] hover:shadow-[0_0_30px_rgba(251,113,133,0.25)] transition-all duration-300"
          : "agent-card-active shadow-[0_0_15px_rgba(96,165,250,0.1)] hover:shadow-[0_0_30px_rgba(167,139,250,0.3)] transition-all duration-300"
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-text-primary flex items-center gap-2">
            {isCommander && <Crown className="w-3.5 h-3.5 text-aurora-amber shrink-0" />}
            <span className="truncate">{agent.name}</span>
            <div className="relative flex items-center justify-center shrink-0">
              {isProcessing && (
                <div className="absolute w-2.5 h-2.5 rounded-full animate-ping" style={{ backgroundColor: agent.color }} />
              )}
              {isError && (
                <div className="absolute w-2.5 h-2.5 rounded-full animate-pulse bg-aurora-rose/50" />
              )}
              <div className="w-1.5 h-1.5 rounded-full z-10" style={{ backgroundColor: agent.color }} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="spatial-panel inline-block px-1.5 py-0.5 font-mono text-[10px] text-text-muted border-none bg-white/[0.02]">
              {agent.model}
            </div>
            {parentAgent && (
              <span className="flex items-center gap-0.5 text-[9px] text-text-disabled font-mono">
                <ArrowUpRight className="w-2.5 h-2.5" />
                {parentAgent.name}
              </span>
            )}
          </div>
        </div>

        <div className="text-right shrink-0 ml-2">
          <div className={cn("font-mono text-xs font-semibold", latencyColor)}>
            {agent.latencyMs}ms
          </div>
          <div className={cn("text-[10px] font-mono font-medium mt-0.5", statusColor)}>
            {statusLabel}
          </div>
        </div>
      </div>

      {/* Error context banner — shown when agent is in error state */}
      <AnimatePresence>
        {isError && lastErrorLog && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-2 px-2.5 py-2 bg-aurora-rose/8 border border-aurora-rose/15 rounded-lg overflow-hidden"
          >
            <div className="flex items-start gap-1.5">
              <AlertTriangle className="w-3 h-3 text-aurora-rose shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-aurora-rose leading-relaxed truncate">
                  {lastErrorLog.message}
                </p>
                <p className="text-[9px] font-mono text-text-disabled mt-0.5">
                  {lastErrorLog.timestamp}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Segmented Arc + Value */}
      <div className="flex items-center justify-center py-2 relative">
        <SegmentedArc
          completion={agent.taskCompletion}
          tokenBurnRate={burnRatePercent}
          baseColor={agent.color}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-mono font-semibold text-lg font-tabular text-text-primary">
            <motion.span>{progressAnim}</motion.span>%
          </span>
        </div>
      </div>

      {/* Sparkline */}
      <div className="h-8 relative w-full mt-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={formattedData}>
            <Line
              type="monotone"
              dataKey="val"
              stroke={agent.color}
              strokeWidth={1.5}
              dot={false}
              isAnimationActive={true}
              animationDuration={800}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Hover overlay — different for error vs healthy agents */}
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-[#111111] via-[#111111]/80 to-transparent flex justify-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity rounded-b-[1rem]">
        {isError ? (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-aurora-amber/15 border border-aurora-amber/30 rounded-lg text-aurora-amber text-[10px] font-semibold uppercase tracking-wider hover:bg-aurora-amber/25 transition-colors"
            >
              <RotateCcw className="w-3 h-3" /> Restart
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-aurora-rose/15 border border-aurora-rose/30 rounded-lg text-aurora-rose text-[10px] font-semibold uppercase tracking-wider hover:bg-aurora-rose/25 transition-colors"
            >
              <Square className="w-3 h-3" /> Terminate
            </button>
          </>
        ) : (
          <span className="text-aurora-teal text-xs font-semibold drop-shadow-[0_0_5px_rgba(0,217,200,0.8)] tracking-wider uppercase">
            Open Telemetry View 
          </span>
        )}
      </div>
    </motion.div>
  );
}
