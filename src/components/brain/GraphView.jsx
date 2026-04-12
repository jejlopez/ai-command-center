import { useEffect, useRef, useState } from "react";

const KIND_COLOR = {
  person:  "#22d3ee", // cyan
  project: "#60a5fa", // blue
  task:    "#fbbf24", // amber
  fact:    "#a78bfa", // purple
  event:   "#4ade80", // green
  pref:    "#94a3b8", // slate/muted
};

const DEFAULT_COLOR = "#94a3b8";
const REPULSION     = 3000;
const ATTRACTION    = 0.04;
const CENTER_FORCE  = 0.012;
const ITERATIONS    = 120;

function initPositions(nodes, w, h) {
  const r = Math.min(w, h) * 0.35;
  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / Math.max(nodes.length, 1);
    return {
      id: n.id,
      x:  w / 2 + r * Math.cos(angle) + (Math.random() - 0.5) * 20,
      y:  h / 2 + r * Math.sin(angle) + (Math.random() - 0.5) * 20,
      vx: 0,
      vy: 0,
    };
  });
}

function runSimulation(positions, edgeSet, w, h) {
  const pos = positions.map((p) => ({ ...p }));
  const idx = new Map(pos.map((p, i) => [p.id, i]));

  for (let iter = 0; iter < ITERATIONS; iter++) {
    const cooling = 1 - iter / ITERATIONS;

    // Reset forces
    for (const p of pos) { p.fx = 0; p.fy = 0; }

    // Repulsion between all pairs
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        const dx = pos[j].x - pos[i].x;
        const dy = pos[j].y - pos[i].y;
        const d2 = dx * dx + dy * dy + 0.001;
        const f  = REPULSION / d2;
        const nx = (dx / Math.sqrt(d2)) * f;
        const ny = (dy / Math.sqrt(d2)) * f;
        pos[i].fx -= nx; pos[i].fy -= ny;
        pos[j].fx += nx; pos[j].fy += ny;
      }
    }

    // Attraction along edges
    for (const [src, dst] of edgeSet) {
      const si = idx.get(src);
      const di = idx.get(dst);
      if (si == null || di == null) continue;
      const dx = pos[di].x - pos[si].x;
      const dy = pos[di].y - pos[si].y;
      pos[si].fx += dx * ATTRACTION;
      pos[si].fy += dy * ATTRACTION;
      pos[di].fx -= dx * ATTRACTION;
      pos[di].fy -= dy * ATTRACTION;
    }

    // Centering
    const cx = w / 2, cy = h / 2;
    for (const p of pos) {
      p.fx += (cx - p.x) * CENTER_FORCE;
      p.fy += (cy - p.y) * CENTER_FORCE;
    }

    // Integrate with cooling
    for (const p of pos) {
      p.vx = (p.vx + p.fx) * 0.6 * cooling;
      p.vy = (p.vy + p.fy) * 0.6 * cooling;
      p.x += p.vx;
      p.y += p.vy;
      // Clamp
      p.x = Math.max(24, Math.min(w - 24, p.x));
      p.y = Math.max(24, Math.min(h - 24, p.y));
    }
  }

  return pos;
}

export default function GraphView({ nodes = [], edges = [], onSelect }) {
  const containerRef = useRef(null);
  const [layout, setLayout]     = useState(null);
  const [size, setSize]         = useState({ w: 800, h: 400 });
  const [hoverId, setHoverId]   = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  // Track container width
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({ w: entry.contentRect.width || 800, h: 400 });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Run simulation when nodes/edges/size change
  useEffect(() => {
    if (!nodes.length) { setLayout(null); return; }
    const { w, h } = size;
    const edgeSet = edges.map((e) => [e.src_id, e.dst_id]);
    const initial = initPositions(nodes, w, h);
    const computed = runSimulation(initial, edgeSet, w, h);
    setLayout(computed);
  }, [nodes, edges, size]);

  if (!nodes.length) {
    return (
      <div className="glass flex items-center justify-center h-[400px] text-jarvis-muted text-sm">
        Add memory nodes to see your knowledge graph
      </div>
    );
  }

  if (!layout) return <div className="glass h-[400px]" />;

  const posById = new Map(layout.map((p) => [p.id, p]));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  const handleNodeClick = (id) => {
    setSelectedId(id);
    onSelect?.(id);
  };

  return (
    <div ref={containerRef} className="glass overflow-hidden" style={{ height: 400 }}>
      <svg
        width={size.w}
        height={400}
        className="block"
        style={{ background: "transparent" }}
      >
        {/* Edges */}
        {edges.map((e, i) => {
          const sp = posById.get(e.src_id);
          const dp = posById.get(e.dst_id);
          if (!sp || !dp) return null;
          return (
            <line
              key={i}
              x1={sp.x} y1={sp.y}
              x2={dp.x} y2={dp.y}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={1}
            />
          );
        })}

        {/* Nodes */}
        {layout.map((p) => {
          const n = nodeById.get(p.id);
          if (!n) return null;
          const color     = KIND_COLOR[n.kind] ?? DEFAULT_COLOR;
          const trust     = n.trust ?? 0.5;
          const r         = 5 + trust * 8; // 5–13px
          const isHovered = hoverId === p.id;
          const isSelected = selectedId === p.id;
          const label     = (n.label ?? "").slice(0, 12);
          const opacity   = isHovered || isSelected ? 1 : 0.75;

          return (
            <g
              key={p.id}
              style={{ cursor: "pointer" }}
              onClick={() => handleNodeClick(p.id)}
              onMouseEnter={() => setHoverId(p.id)}
              onMouseLeave={() => setHoverId(null)}
            >
              {isSelected && (
                <circle
                  cx={p.x} cy={p.y}
                  r={r + 5}
                  fill="none"
                  stroke={color}
                  strokeWidth={1.5}
                  opacity={0.4}
                />
              )}
              <circle
                cx={p.x} cy={p.y}
                r={r}
                fill={color}
                opacity={opacity}
                style={{ transition: "opacity 0.15s, r 0.15s" }}
              />
              <text
                x={p.x}
                y={p.y + r + 10}
                textAnchor="middle"
                fill="rgba(255,255,255,0.65)"
                fontSize={9}
                style={{ pointerEvents: "none", userSelect: "none" }}
              >
                {label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
