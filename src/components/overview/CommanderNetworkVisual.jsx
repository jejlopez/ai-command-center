import { motion } from 'framer-motion';
import { cn } from "../../utils/cn";

const latticeNodes = [
  { id: 'qa', label: 'QA', x: 16, y: 22, tone: 'bg-aurora-violet', state: 'monitoring' },
  { id: 'ui', label: 'UI', x: 82, y: 20, tone: 'bg-aurora-blue', state: 'active' },
  { id: 'ops', label: 'Ops', x: 78, y: 77, tone: 'bg-aurora-amber', state: 'blocked' },
  { id: 'res', label: 'Research', x: 16, y: 76, tone: 'bg-aurora-teal', state: 'idle' },
];

function nodeAccent(state) {
  if (state === 'blocked') return 'text-aurora-rose border-aurora-rose/35 bg-aurora-rose/10 shadow-sm';
  if (state === 'active') return 'text-aurora-teal border-aurora-teal/35 bg-aurora-teal/10 shadow-sm';
  return 'text-text-dim border-hairline bg-panel-soft shadow-inner';
}

function routeState(summary, nodeState) {
  if (nodeState === 'blocked' && summary?.lateSchedules > 0) return 'blocked';
  if (nodeState === 'active' || summary?.runningTasks > 0) return 'active';
  return 'idle';
}

export function CommanderNetworkVisual({ specialistCount = 0, summary }) {
  const visibleNodes = latticeNodes.slice(0, Math.max(2, Math.min(latticeNodes.length, specialistCount || 4)));
  const routes = visibleNodes.map((node) => ({
    ...node,
    routeState: routeState(summary, node.state),
  }));
  const center = { x: 55, y: 58 };

  return (
    <div className="commander-lattice-frame relative h-[300px] w-full max-w-[360px] sm:h-[360px] sm:max-w-[430px] xl:h-[420px] xl:max-w-[470px]">
      <div className="absolute inset-[18px] rounded-[2rem] border border-hairline opacity-60" />
      <div className="absolute inset-[38px] rounded-[1.7rem] border border-hairline opacity-40" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_56%,var(--color-aurora-teal-soft),transparent_28%),radial-gradient(circle_at_78%_16%,var(--color-aurora-blue-soft),transparent_25%),radial-gradient(circle_at_18%_74%,var(--color-aurora-violet-soft),transparent_25%)]" />
      <div className="absolute inset-0 opacity-[0.03] theme-dark:opacity-[0.05] bg-[linear-gradient(var(--color-text)_1px,transparent_1px),linear-gradient(90deg,var(--color-text)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="absolute inset-x-[16%] top-[16%] h-[1.5px] bg-gradient-to-r from-transparent via-hairline to-transparent" />
      <div className="absolute inset-x-[14%] bottom-[17%] h-[1.5px] bg-gradient-to-r from-transparent via-hairline to-transparent" />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="routeIdle" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-text-dim)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--color-text-dim)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="routeActive" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-aurora-teal)" stopOpacity="0.9" />
            <stop offset="55%" stopColor="var(--color-aurora-blue)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-text-dim)" stopOpacity="0.05" />
          </linearGradient>
          <linearGradient id="routeBlocked" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--color-aurora-rose)" stopOpacity="0.9" />
            <stop offset="55%" stopColor="var(--color-aurora-amber)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--color-text-dim)" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {routes.map((node) => (
          <g key={`route-${node.id}`}>
            <path
              d={`M ${center.x} ${center.y} C ${center.x + (node.x > center.x ? 10 : -10)} ${center.y - 9}, ${node.x + (node.x > center.x ? -8 : 8)} ${node.y + (node.y < center.y ? 9 : -9)}, ${node.x} ${node.y}`}
              fill="none"
              stroke={`url(#${node.routeState === 'blocked' ? 'routeBlocked' : node.routeState === 'active' ? 'routeActive' : 'routeIdle'})`}
              strokeWidth="0.45"
              strokeLinecap="round"
              strokeDasharray={node.routeState === 'active' ? '1.5 1' : undefined}
              className={node.routeState === 'active' ? 'animate-[dash-flow_6s_linear_infinite]' : ''}
            />
            {node.routeState !== 'idle' && (
              <motion.circle
                r="1"
                fill={node.routeState === 'blocked' ? 'var(--color-aurora-rose)' : 'var(--color-aurora-teal)'}
                initial={{ offsetDistance: '0%' }}
                animate={{ offsetDistance: ['0%', '100%'] }}
                transition={{ duration: node.routeState === 'blocked' ? 3.5 : 2.8, repeat: Infinity, ease: 'linear' }}
                style={{
                  offsetPath: `path("M ${center.x} ${center.y} C ${center.x + (node.x > center.x ? 10 : -10)} ${center.y - 9}, ${node.x + (node.x > center.x ? -8 : 8)} ${node.y + (node.y < center.y ? 9 : -9)}, ${node.x} ${node.y}")`,
                }}
              />
            )}
          </g>
        ))}
      </svg>

      <motion.div
        className="command-core absolute left-[55%] top-[58%] -translate-x-1/2 -translate-y-1/2"
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="absolute inset-[-20px] rounded-full border border-aurora-teal/20"
          animate={{ rotate: 360 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-[-42px] rounded-full border border-hairline opacity-60"
          animate={{ rotate: -360 }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        />
        <div className="relative flex h-full w-full flex-col items-center justify-center p-8 bg-panel border-2 border-hairline rounded-full shadow-main">
          <div className="text-[9px] font-black uppercase tracking-[0.4em] text-text-dim">Operational</div>
          <div className="mt-2 text-sm font-black uppercase tracking-[0.2em] text-text">CENTER</div>
        </div>
      </motion.div>

      {routes.map((node, index) => (
        <motion.div
          key={node.id}
          className="absolute"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          animate={{ y: [0, index % 2 === 0 ? -6 : 6, 0] }}
          transition={{ duration: 7 + index, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="relative -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
            <div className={cn("mb-4 h-5 w-5 rounded-full border-2 border-hairline-strong shadow-main animate-pulse", node.tone)} />
            <div className="command-node-card min-w-[100px] px-4 py-3 bg-panel border border-hairline shadow-main rounded-xl backdrop-blur-md">
              <div className="text-[10px] font-black uppercase tracking-widest text-text text-center">{node.label}</div>
              <div className="mt-3 flex justify-center">
                <div className={cn('inline-flex rounded-lg border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.18em]', nodeAccent(node.routeState))}>
                  {node.routeState}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ))}

      {summary?.lateSchedules > 0 && (
        <div className="absolute bottom-6 left-6">
          <div className="rounded-xl border border-aurora-amber/35 bg-panel p-4 text-[10px] font-black uppercase tracking-widest text-aurora-amber shadow-main animate-bounce">
            {summary.lateSchedules} operational drift{summary.lateSchedules > 1 ? 's' : ''} detected
          </div>
        </div>
      )}
    </div>
  );
}
