import { useState, useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
// Active parents pass live task data as props.

const statusColors = {
  completed: '#00D9C8',
  running: '#a78bfa',
  pending: '#71717a',
  error: '#fb7185'
};

const statusLabels = {
  completed: 'Done',
  running: 'Running',
  pending: 'Queued',
  error: 'Error'
};

// Each node gets a unique face variant based on index
const faceVariants = [
  { eyeShape: 'round',   antenna: 'single', earType: 'none' },
  { eyeShape: 'wide',    antenna: 'double', earType: 'fins' },
  { eyeShape: 'narrow',  antenna: 'none',   earType: 'round' },
  { eyeShape: 'visor',   antenna: 'single', earType: 'none' },
  { eyeShape: 'dot',     antenna: 'triple', earType: 'fins' },
];

function AgentFace({ cx, cy, r, status, color, variant = 0 }) {
  const face = faceVariants[variant % faceVariants.length];
  const isRunning = status === 'running';
  const isError = status === 'error';
  const isCompleted = status === 'completed';
  const isPending = status === 'pending';
  const s = r / 24; // scale factor relative to base radius of 24

  const eyeColor = isError ? '#fb7185' : isCompleted ? '#00D9C8' : isPending ? '#555' : color;
  const eyeY = cy - 2 * s;
  const eyeSpacing = 6 * s;

  return (
    <g>
      {/* Antenna(s) */}
      {face.antenna === 'single' && (
        <g>
          <line x1={cx} y1={cy - r + 2} x2={cx} y2={cy - r - 6 * s}
            stroke={isPending ? '#333' : color} strokeWidth={1.5 * s} strokeLinecap="round" opacity={isPending ? 0.3 : 0.8}>
            {isRunning && <animate attributeName="y2" values={`${cy - r - 6 * s};${cy - r - 10 * s};${cy - r - 6 * s}`} dur="1.2s" repeatCount="indefinite" />}
          </line>
          <circle cx={cx} cy={cy - r - 7 * s} r={2.5 * s} fill={isPending ? '#333' : color} opacity={isPending ? 0.3 : 1}>
            {isRunning && (
              <>
                <animate attributeName="cy" values={`${cy - r - 7 * s};${cy - r - 11 * s};${cy - r - 7 * s}`} dur="1.2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="1;0.4;1" dur="1.2s" repeatCount="indefinite" />
              </>
            )}
          </circle>
        </g>
      )}
      {face.antenna === 'double' && (
        <g>
          {[-1, 1].map(side => (
            <g key={side}>
              <line x1={cx + side * 4 * s} y1={cy - r + 2} x2={cx + side * 7 * s} y2={cy - r - 5 * s}
                stroke={isPending ? '#333' : color} strokeWidth={1.2 * s} strokeLinecap="round" opacity={isPending ? 0.3 : 0.7} />
              <circle cx={cx + side * 7 * s} cy={cy - r - 5.5 * s} r={1.8 * s} fill={isPending ? '#333' : color} opacity={isPending ? 0.3 : 0.9}>
                {isRunning && <animate attributeName="opacity" values="0.9;0.2;0.9" dur={side === -1 ? "0.8s" : "1.1s"} repeatCount="indefinite" />}
              </circle>
            </g>
          ))}
        </g>
      )}
      {face.antenna === 'triple' && (
        <g>
          {[-1, 0, 1].map(side => (
            <line key={side} x1={cx + side * 4 * s} y1={cy - r + 2} x2={cx + side * 5 * s} y2={cy - r - (side === 0 ? 7 : 4) * s}
              stroke={isPending ? '#333' : color} strokeWidth={1 * s} strokeLinecap="round" opacity={isPending ? 0.3 : 0.6}>
              {isRunning && <animate attributeName="opacity" values="0.6;0.15;0.6" dur={`${0.6 + Math.abs(side) * 0.3}s`} repeatCount="indefinite" />}
            </line>
          ))}
        </g>
      )}

      {/* Ear fins */}
      {face.earType === 'fins' && (
        <g>
          {[-1, 1].map(side => (
            <path key={side}
              d={`M ${cx + side * (r - 2 * s)} ${cy - 4 * s} L ${cx + side * (r + 5 * s)} ${cy - 6 * s} L ${cx + side * (r + 5 * s)} ${cy + 2 * s} Z`}
              fill={isPending ? '#222' : `${color}33`} stroke={isPending ? '#333' : `${color}66`} strokeWidth={0.8 * s} />
          ))}
        </g>
      )}
      {face.earType === 'round' && (
        <g>
          {[-1, 1].map(side => (
            <circle key={side} cx={cx + side * (r + 2 * s)} cy={cy} r={3.5 * s}
              fill={isPending ? '#222' : `${color}22`} stroke={isPending ? '#333' : `${color}55`} strokeWidth={0.8 * s} />
          ))}
        </g>
      )}

      {/* Face plate (slightly lighter inner area) */}
      <ellipse cx={cx} cy={cy + 1 * s} rx={r * 0.65} ry={r * 0.5} fill="rgba(255,255,255,0.03)" />

      {/* Eyes */}
      {isError ? (
        // X-eyes for error
        <g>
          {[-1, 1].map(side => (
            <g key={side}>
              <line x1={cx + side * eyeSpacing - 2.5 * s} y1={eyeY - 2.5 * s} x2={cx + side * eyeSpacing + 2.5 * s} y2={eyeY + 2.5 * s}
                stroke="#fb7185" strokeWidth={1.5 * s} strokeLinecap="round">
                <animate attributeName="opacity" values="1;0.3;1" dur="0.4s" repeatCount="indefinite" />
              </line>
              <line x1={cx + side * eyeSpacing + 2.5 * s} y1={eyeY - 2.5 * s} x2={cx + side * eyeSpacing - 2.5 * s} y2={eyeY + 2.5 * s}
                stroke="#fb7185" strokeWidth={1.5 * s} strokeLinecap="round">
                <animate attributeName="opacity" values="1;0.3;1" dur="0.4s" repeatCount="indefinite" />
              </line>
            </g>
          ))}
        </g>
      ) : isCompleted ? (
        // Happy arc eyes for completed
        <g>
          {[-1, 1].map(side => (
            <path key={side}
              d={`M ${cx + side * eyeSpacing - 3 * s} ${eyeY + 1 * s} Q ${cx + side * eyeSpacing} ${eyeY - 3 * s} ${cx + side * eyeSpacing + 3 * s} ${eyeY + 1 * s}`}
              stroke={eyeColor} strokeWidth={1.5 * s} strokeLinecap="round" fill="none" />
          ))}
        </g>
      ) : isPending ? (
        // Sleepy dash eyes for pending
        <g>
          {[-1, 1].map(side => (
            <line key={side}
              x1={cx + side * eyeSpacing - 2.5 * s} y1={eyeY}
              x2={cx + side * eyeSpacing + 2.5 * s} y2={eyeY}
              stroke="#555" strokeWidth={1.5 * s} strokeLinecap="round" />
          ))}
        </g>
      ) : face.eyeShape === 'round' ? (
        // Round eyes
        <g>
          {[-1, 1].map(side => (
            <g key={side}>
              <circle cx={cx + side * eyeSpacing} cy={eyeY} r={3 * s} fill="none" stroke={eyeColor} strokeWidth={1.2 * s} />
              <circle cx={cx + side * eyeSpacing} cy={eyeY} r={1.5 * s} fill={eyeColor}>
                {isRunning && <animate attributeName="cx" values={`${cx + side * eyeSpacing - 1.5 * s};${cx + side * eyeSpacing + 1.5 * s};${cx + side * eyeSpacing - 1.5 * s}`} dur="1.8s" repeatCount="indefinite" />}
              </circle>
            </g>
          ))}
        </g>
      ) : face.eyeShape === 'wide' ? (
        // Wide rectangular eyes
        <g>
          {[-1, 1].map(side => (
            <g key={side}>
              <rect x={cx + side * eyeSpacing - 3.5 * s} y={eyeY - 2 * s} width={7 * s} height={4 * s} rx={1 * s}
                fill="none" stroke={eyeColor} strokeWidth={1 * s} />
              <rect x={cx + side * eyeSpacing - 1 * s} y={eyeY - 1 * s} width={2 * s} height={2 * s} rx={0.5 * s} fill={eyeColor}>
                {isRunning && <animate attributeName="x" values={`${cx + side * eyeSpacing - 2.5 * s};${cx + side * eyeSpacing + 1 * s};${cx + side * eyeSpacing - 2.5 * s}`} dur="2s" repeatCount="indefinite" />}
              </rect>
            </g>
          ))}
        </g>
      ) : face.eyeShape === 'narrow' ? (
        // Narrow slit eyes
        <g>
          {[-1, 1].map(side => (
            <g key={side}>
              <ellipse cx={cx + side * eyeSpacing} cy={eyeY} rx={3.5 * s} ry={1.5 * s}
                fill="none" stroke={eyeColor} strokeWidth={1 * s} />
              <circle cx={cx + side * eyeSpacing} cy={eyeY} r={1.2 * s} fill={eyeColor}>
                {isRunning && <animate attributeName="cx" values={`${cx + side * eyeSpacing - 2 * s};${cx + side * eyeSpacing + 2 * s};${cx + side * eyeSpacing - 2 * s}`} dur="1.5s" repeatCount="indefinite" />}
              </circle>
            </g>
          ))}
        </g>
      ) : face.eyeShape === 'visor' ? (
        // Single visor band across both eyes
        <g>
          <rect x={cx - eyeSpacing - 3.5 * s} y={eyeY - 2.5 * s} width={(eyeSpacing + 3.5 * s) * 2} height={5 * s} rx={2.5 * s}
            fill="none" stroke={eyeColor} strokeWidth={1 * s} opacity={0.7} />
          {[-1, 1].map(side => (
            <circle key={side} cx={cx + side * eyeSpacing} cy={eyeY} r={1.8 * s} fill={eyeColor}>
              {isRunning && <animate attributeName="r" values={`${1.8 * s};${1.3 * s};${1.8 * s}`} dur="0.8s" repeatCount="indefinite" />}
            </circle>
          ))}
        </g>
      ) : (
        // Dot eyes (default)
        <g>
          {[-1, 1].map(side => (
            <circle key={side} cx={cx + side * eyeSpacing} cy={eyeY} r={2 * s} fill={eyeColor}>
              {isRunning && <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />}
            </circle>
          ))}
        </g>
      )}

      {/* Mouth */}
      {isError ? (
        // Wavy distressed mouth
        <path d={`M ${cx - 4 * s} ${cy + 5 * s} Q ${cx - 2 * s} ${cy + 3 * s} ${cx} ${cy + 5 * s} Q ${cx + 2 * s} ${cy + 7 * s} ${cx + 4 * s} ${cy + 5 * s}`}
          stroke="#fb7185" strokeWidth={1 * s} strokeLinecap="round" fill="none" opacity={0.8}>
          <animate attributeName="opacity" values="0.8;0.3;0.8" dur="0.5s" repeatCount="indefinite" />
        </path>
      ) : isCompleted ? (
        // Smile
        <path d={`M ${cx - 4 * s} ${cy + 4 * s} Q ${cx} ${cy + 8 * s} ${cx + 4 * s} ${cy + 4 * s}`}
          stroke="#00D9C8" strokeWidth={1 * s} strokeLinecap="round" fill="none" opacity={0.7} />
      ) : isPending ? (
        // Flat line mouth
        <line x1={cx - 3 * s} y1={cy + 5 * s} x2={cx + 3 * s} y2={cy + 5 * s}
          stroke="#444" strokeWidth={1 * s} strokeLinecap="round" />
      ) : (
        // Neutral / focused small "o" when running
        <ellipse cx={cx} cy={cy + 5.5 * s} rx={2 * s} ry={1.5 * s}
          fill="none" stroke={color} strokeWidth={0.8 * s} opacity={0.6}>
          {isRunning && <animate attributeName="ry" values={`${1.5 * s};${2.5 * s};${1.5 * s}`} dur="2s" repeatCount="indefinite" />}
        </ellipse>
      )}
    </g>
  );
}

function computeLayout(taskList) {
  const depthMap = {};
  const childrenMap = {};

  taskList.forEach(t => {
    childrenMap[t.id] = [];
  });
  taskList.forEach(t => {
    if (t.parentId && childrenMap[t.parentId]) {
      childrenMap[t.parentId].push(t.id);
    }
  });

  function setDepth(id, depth, visited = new Set()) {
    if (visited.has(id)) return;
    visited.add(id);
    depthMap[id] = depth;
    (childrenMap[id] || []).forEach(childId => setDepth(childId, depth + 1, visited));
  }

  taskList.filter(t => !t.parentId).forEach(t => setDepth(t.id, 0));

  const maxDepth = Math.max(...Object.values(depthMap), 0);
  const depthGroups = {};
  taskList.forEach(t => {
    const d = depthMap[t.id] ?? 0;
    if (!depthGroups[d]) depthGroups[d] = [];
    depthGroups[d].push(t);
  });

  const PADDING_X = 80;
  const PADDING_Y = 60;
  const VIEW_W = 640;
  const VIEW_H = 280;
  const usableW = VIEW_W - PADDING_X * 2;
  const usableH = VIEW_H - PADDING_Y * 2;

  const nodes = [];
  for (let d = 0; d <= maxDepth; d++) {
    const group = depthGroups[d] || [];
    group.forEach((t, i) => {
      const cx = maxDepth === 0
        ? PADDING_X + (i / Math.max(group.length - 1, 1)) * usableW
        : PADDING_X + (d / maxDepth) * usableW;
      const cy = group.length === 1
        ? VIEW_H / 2
        : PADDING_Y + (i / (group.length - 1)) * usableH;
      const isLast = d === maxDepth && group.length === 1;
      nodes.push({ ...t, cx, cy, r: isLast ? 32 : 24 });
    });
  }

  const edges = [];
  const dependencyEdges = [];
  nodes.forEach(node => {
    if (node.parentId) {
      const parent = nodes.find(n => n.id === node.parentId);
      if (parent) {
        const edgeStatus = parent.status;
        const midX = (parent.cx + node.cx) / 2;
        edges.push({
          id: `e-${parent.id}-${node.id}`,
          d: `M ${parent.cx + parent.r + 2} ${parent.cy} Q ${midX} ${(parent.cy + node.cy) / 2} ${node.cx - node.r - 2} ${node.cy}`,
          status: edgeStatus,
        });
      }
    }

    (node.dependsOn || []).forEach((dependencyId) => {
      if (dependencyId === node.parentId) return;
      const dependency = nodes.find((candidate) => candidate.id === dependencyId);
      if (!dependency) return;
      const midX = (dependency.cx + node.cx) / 2;
      dependencyEdges.push({
        id: `d-${dependency.id}-${node.id}`,
        d: `M ${dependency.cx} ${dependency.cy + dependency.r + 4} Q ${midX} ${Math.max(dependency.cy, node.cy) + 28} ${node.cx} ${node.cy - node.r - 4}`,
        status: dependency.status,
        labelX: midX,
        labelY: Math.max(dependency.cy, node.cy) + 18,
      });
    });
  });

  return { nodes, edges, dependencyEdges };
}

function formatDuration(ms) {
  if (ms === 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function TaskDAG({ onNodeClick, tasks }) {
  const [hoveredId, setHoveredId] = useState(null);
  const { nodes, edges, dependencyEdges } = useMemo(() => computeLayout(tasks || []), [tasks]);

  return (
    <div className="w-full h-full flex justify-center items-center overflow-visible relative">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
      <svg className="w-full h-full min-h-[300px]" viewBox="0 0 640 280" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Edges */}
        {edges.map(edge => {
          const isActive = edge.status === 'completed' || edge.status === 'running';
          const color = statusColors[edge.status] || '#71717a';
          return (
            <g key={edge.id}>
              {isActive && (
                <path d={edge.d} stroke={color} strokeWidth="4" fill="none" filter="url(#node-glow)" opacity="0.2" />
              )}
              <path
                d={edge.d}
                stroke={color}
                strokeWidth={isActive ? 2 : 1}
                strokeDasharray={isActive ? "8 6" : "4 8"}
                fill="none"
                opacity={isActive ? 0.8 : 0.2}
                style={isActive ? { animation: 'dash-flow 1.5s linear infinite' } : undefined}
              />
            </g>
          );
        })}

        {dependencyEdges.map((edge) => {
          const color = edge.status === 'completed' ? '#00D9C8' : edge.status === 'running' ? '#60a5fa' : '#64748b';
          return (
            <g key={edge.id}>
              <path
                d={edge.d}
                stroke={color}
                strokeWidth="1.25"
                strokeDasharray="2 6"
                fill="none"
                opacity="0.55"
              />
              <rect x={edge.labelX - 26} y={edge.labelY - 8} width="52" height="16" rx="8" fill="#0f1218" stroke={color} strokeOpacity="0.22" />
              <text
                x={edge.labelX}
                y={edge.labelY + 3}
                textAnchor="middle"
                className="text-[8px] font-mono fill-text-muted"
              >
                DEPENDS
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const color = statusColors[node.status];
          const isRunning = node.status === 'running';
          const isError = node.status === 'error';

          // Floating bob — each node gets a slightly different phase
          const bobDelay = i * 0.4;
          const bobDur = 3 + (i % 3) * 0.5;

          return (
            <Motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.12 }}
              onMouseEnter={() => setHoveredId(node.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={() => onNodeClick?.(node)}
              className="cursor-pointer"
              transition={{ delay: i * 0.12, type: 'spring', stiffness: 200, damping: 20 }}
              style={{ transformOrigin: `${node.cx}px ${node.cy}px` }}
            >
              {/* Floating bob via Framer Motion */}
              <Motion.g
                animate={isError
                  ? { x: [-1.5, 1.5, -1, 1, 0], y: 0 }
                  : { y: [0, -3, 0], x: 0 }
                }
                transition={isError
                  ? { duration: 0.5, repeat: Infinity, ease: 'linear' }
                  : { duration: bobDur, delay: bobDelay, repeat: Infinity, ease: 'easeInOut' }
                }
              >
                {/* Running pulse ring */}
                {isRunning && (
                  <circle cx={node.cx} cy={node.cy} r={node.r + 10} fill="none" stroke={color} strokeWidth="2" filter="url(#node-glow)" opacity="0.5">
                    <animate attributeName="r" values={`${node.r + 4};${node.r + 18};${node.r + 4}`} dur="2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Outer status ring */}
                <circle
                  cx={node.cx} cy={node.cy} r={node.r + 2}
                  fill="none"
                  stroke={color}
                  strokeWidth={isRunning ? 2.5 : 1.5}
                  filter="url(#node-glow)"
                  opacity={node.status === 'pending' ? 0.25 : 0.6}
                  strokeDasharray={node.status === 'pending' ? '3 3' : undefined}
                />

                {/* Body circle */}
                <circle cx={node.cx} cy={node.cy} r={node.r} fill="#161616" stroke="#222" strokeWidth="1" />

                {/* Animated face */}
                <AgentFace
                  cx={node.cx}
                  cy={node.cy}
                  r={node.r}
                  status={node.status}
                  color={color}
                  variant={i}
                />

                {/* Status dot badge */}
                <circle
                  cx={node.cx + node.r - 3} cy={node.cy - node.r + 3} r={3.5}
                  fill={color} stroke="#161616" strokeWidth="2"
                />

                {/* Label pill */}
                <rect
                  x={node.cx - 44} y={node.cy + node.r + 8}
                  width="88" height="22" rx="11"
                  fill="#111" stroke={color} strokeOpacity={node.status === 'pending' ? 0.15 : 0.35}
                />
                <text
                  x={node.cx} y={node.cy + node.r + 22}
                  textAnchor="middle"
                  className="text-[9px] font-mono fill-text-primary font-semibold"
                >
                  {node.name}
                </text>
              </Motion.g>
            </Motion.g>
          );
        })}

        {/* Hover tooltip */}
        <AnimatePresence>
          {hoveredId && (() => {
            const node = nodes.find(n => n.id === hoveredId);
            if (!node) return null;
            const tooltipW = 180;
            const tooltipH = 100;
            let tx = node.cx - tooltipW / 2;
            let ty = node.cy - node.r - tooltipH - 20;
            if (tx < 8) tx = 8;
            if (tx + tooltipW > 632) tx = 632 - tooltipW;
            if (ty < 4) ty = node.cy + node.r + 36;

            return (
              <motion.foreignObject
                key="tooltip"
                x={tx} y={ty}
                width={tooltipW} height={tooltipH}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.15 }}
                style={{ pointerEvents: 'none' }}
              >
                <div className="bg-[#1a1a1a] border border-white/10 rounded-lg p-3 shadow-xl text-[10px]">
                  <div className="font-semibold text-text-primary text-xs mb-2">{node.name}</div>
                  <div className="grid grid-cols-2 gap-y-1.5 gap-x-3 font-mono">
                    <span className="text-text-muted">Agent</span>
                    <span className="text-text-primary">{node.agentName ?? '—'}</span>
                    <span className="text-text-muted">Status</span>
                    <span style={{ color: statusColors[node.status] }}>{statusLabels[node.status]}</span>
                    <span className="text-text-muted">{node.status === 'running' ? 'Elapsed' : 'Duration'}</span>
                    <span className="text-text-primary">{formatDuration(node.durationMs ?? 0)}</span>
                    <span className="text-text-muted">Cost</span>
                    <span className="text-text-primary">${(node.costUsd ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              </motion.foreignObject>
            );
          })()}
        </AnimatePresence>
      </svg>
    </div>
  );
}
