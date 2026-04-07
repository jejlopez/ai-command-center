import React from 'react';
import { motion } from 'framer-motion';
import { tasks } from '../utils/mockData';

const colors = {
  completed: '#00D9C8',
  running: '#a78bfa',
  pending: '#71717a',
  error: '#fb7185'
};

const avatars = [
  '/core1.png',
  '/core3.png',
  '/core2.png',
  '/core1.png',
  '/core3.png'
];

const nodes = [
  { id: 't1', cx: 80,  cy: 140, r: 28, img: avatars[0], ...tasks[0] },
  { id: 't2', cx: 240, cy: 60,  r: 36, img: avatars[1], ...tasks[1] },
  { id: 't3', cx: 400, cy: 140, r: 28, img: avatars[2], ...tasks[2] },
  { id: 't4', cx: 240, cy: 220, r: 36, img: avatars[1], ...tasks[3] },
  { id: 't5', cx: 560, cy: 140, r: 48, img: avatars[2], ...tasks[4] } 
];

const paths = [
  { id: 'p1', d: 'M 108 140 Q 174 140 204 60' },
  { id: 'p2', d: 'M 108 140 Q 174 140 204 220' },
  { id: 'p3', d: 'M 276 60 Q 306 140 372 140' },
  { id: 'p4', d: 'M 276 220 Q 306 140 372 140' },
  { id: 'p5', d: 'M 428 140 L 512 140' }
];

export function TaskDAG() {
  return (
    <div className="w-full h-full flex justify-center items-center overflow-hidden relative">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />
      <svg className="w-full h-full min-h-[300px]" viewBox="0 0 640 280" style={{ overflow: 'visible' }}>
        <defs>
          <filter id="ultra-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          {nodes.map(node => (
            <pattern key={`pattern-${node.id}`} id={`img-${node.id}`} patternUnits="objectBoundingBox" width="1" height="1">
              <image href={node.img} x="0" y="0" width={node.r * 2} height={node.r * 2} preserveAspectRatio="xMidYMid slice" opacity="0.8" />
            </pattern>
          ))}
          
          <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00D9C8" stopOpacity="0.2" />
            <stop offset="50%" stopColor="#a78bfa" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#00D9C8" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {paths.map((path, i) => (
          <g key={path.id}>
            {/* Background glow path */}
            <path
              d={path.d}
              stroke="url(#lineGrad)"
              strokeWidth="6"
              fill="none"
              filter="url(#ultra-glow)"
              opacity="0.3"
            />
            {/* Animated dashed stream */}
            <path
              d={path.d}
              stroke="url(#lineGrad)"
              strokeWidth="2"
              strokeDasharray="8 6"
              fill="none"
              style={{ animation: 'dash-flow 1.5s linear infinite' }}
            />
          </g>
        ))}

        {nodes.map((node, i) => {
          const color = colors[node.status];
          const isRunning = node.status === 'running';

          return (
            <motion.g 
              key={node.id} 
              initial={{ opacity: 0, scale: 0 }} 
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.15, type: 'spring', stiffness: 200, damping: 20 }}
            >
              {isRunning && (
                <circle 
                  cx={node.cx} cy={node.cy} 
                  r={node.r + 14} 
                  fill="none" 
                  stroke={color} 
                  strokeWidth="2" 
                  filter="url(#ultra-glow)" 
                  opacity="0.6"
                >
                  <animate attributeName="r" values={`${node.r + 4};${node.r + 20};${node.r + 4}`} dur="2s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
                </circle>
              )}
              
              {/* Outer stroke ring */}
              <circle cx={node.cx} cy={node.cy} r={node.r + 2} fill="#111" stroke={color} strokeWidth="3" filter="url(#ultra-glow)" opacity="0.6" />
              
              {/* Avatar circle */}
              <circle cx={node.cx} cy={node.cy} r={node.r} fill={`url(#img-${node.id})`} />
              
              {/* Label Group */}
              <rect x={node.cx - 50} y={node.cy + node.r + 12} width="100" height="24" rx="12" fill="#111" stroke={color} strokeOpacity="0.4" />
              <text x={node.cx} y={node.cy + node.r + 28} textAnchor="middle" className="text-[10px] font-mono fill-text-primary font-bold">{node.name}</text>
              <text x={node.cx} y={node.cy - node.r - 8} textAnchor="middle" className="text-[9px] uppercase tracking-widest font-bold fill-canvas" stroke={color} strokeWidth="2" paintOrder="stroke">{node.agentName}</text>
              <text x={node.cx} y={node.cy - node.r - 8} textAnchor="middle" className="text-[9px] uppercase tracking-widest font-bold" fill={color}>{node.agentName}</text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
