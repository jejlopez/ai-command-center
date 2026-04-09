import { motion } from 'framer-motion';

const latticeNodes = [
  { id: 'qa', label: 'QA', x: 16, y: 22, tone: 'bg-aurora-violet', state: 'monitoring' },
  { id: 'ui', label: 'UI', x: 82, y: 20, tone: 'bg-aurora-blue', state: 'active' },
  { id: 'ops', label: 'Ops', x: 78, y: 77, tone: 'bg-aurora-amber', state: 'blocked' },
  { id: 'res', label: 'Research', x: 16, y: 76, tone: 'bg-aurora-teal', state: 'idle' },
];

function nodeAccent(state) {
  if (state === 'blocked') return 'text-aurora-rose border-aurora-rose/25 bg-aurora-rose/8';
  if (state === 'active') return 'text-aurora-teal border-aurora-teal/25 bg-aurora-teal/8';
  return 'text-text-muted border-white/10 bg-white/[0.03]';
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
      <div className="absolute inset-[18px] rounded-[2rem] border border-white/[0.05]" />
      <div className="absolute inset-[38px] rounded-[1.7rem] border border-white/[0.05]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_56%,rgba(0,217,200,0.18),transparent_24%),radial-gradient(circle_at_78%_16%,rgba(96,165,250,0.14),transparent_22%),radial-gradient(circle_at_18%_74%,rgba(167,139,250,0.12),transparent_22%)]" />
      <div className="absolute inset-0 opacity-30 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="absolute inset-x-[16%] top-[16%] h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      <div className="absolute inset-x-[14%] bottom-[17%] h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="routeIdle" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.26)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
          <linearGradient id="routeActive" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(0,217,200,0.95)" />
            <stop offset="55%" stopColor="rgba(96,165,250,0.45)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
          <linearGradient id="routeBlocked" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(251,113,133,0.95)" />
            <stop offset="55%" stopColor="rgba(251,191,36,0.35)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </linearGradient>
        </defs>

        {routes.map((node) => (
          <g key={`route-${node.id}`}>
            <path
              d={`M ${center.x} ${center.y} C ${center.x + (node.x > center.x ? 10 : -10)} ${center.y - 9}, ${node.x + (node.x > center.x ? -8 : 8)} ${node.y + (node.y < center.y ? 9 : -9)}, ${node.x} ${node.y}`}
              fill="none"
              stroke={`url(#${node.routeState === 'blocked' ? 'routeBlocked' : node.routeState === 'active' ? 'routeActive' : 'routeIdle'})`}
              strokeWidth="0.34"
              strokeLinecap="round"
              strokeDasharray={node.routeState === 'active' ? '1.2 1' : undefined}
              className={node.routeState === 'active' ? 'animate-[dash-flow_5s_linear_infinite]' : ''}
            />
            {node.routeState !== 'idle' && (
              <motion.circle
                r="0.8"
                fill={node.routeState === 'blocked' ? 'rgba(251,113,133,0.92)' : 'rgba(0,217,200,0.95)'}
                initial={{ offsetDistance: '0%' }}
                animate={{ offsetDistance: ['0%', '100%'] }}
                transition={{ duration: node.routeState === 'blocked' ? 3.2 : 2.5, repeat: Infinity, ease: 'linear' }}
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
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        <motion.div
          className="absolute inset-[-16px] rounded-full border border-white/10"
          animate={{ rotate: 360 }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute inset-[-38px] rounded-full border border-white/[0.06]"
          animate={{ rotate: -360 }}
          transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
        />
        <div className="relative flex h-full w-full flex-col items-center justify-center">
          <div className="text-[10px] font-medium uppercase tracking-[0.32em] text-text-muted">Core</div>
          <div className="mt-2 text-sm font-semibold uppercase tracking-[0.24em] text-white">Commander</div>
        </div>
      </motion.div>

      {routes.map((node, index) => (
        <motion.div
          key={node.id}
          className="absolute"
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
          animate={{ y: [0, index % 2 === 0 ? -5 : 5, 0] }}
          transition={{ duration: 6 + index, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div className="relative -translate-x-1/2 -translate-y-1/2">
            <div className={`mb-3 h-4 w-4 rounded-full ${node.tone} shadow-[0_0_18px_rgba(255,255,255,0.24)]`} />
            <div className="command-node-card min-w-[92px] px-3 py-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-text-primary">{node.label}</div>
              <div className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] ${nodeAccent(node.routeState)}`}>
                {node.routeState}
              </div>
            </div>
          </div>
        </motion.div>
      ))}

      {summary?.lateSchedules > 0 && (
        <div className="absolute bottom-7 left-7">
          <div className="rounded-full border border-aurora-amber/20 bg-black/30 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-aurora-amber backdrop-blur-sm">
            {summary.lateSchedules} late schedule{summary.lateSchedules > 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
