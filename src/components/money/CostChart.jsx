// Tiny dependency-free SVG bar chart for cost summary.
// Props: { points: Array<{ day: string, costUsd: number }> }
export default function CostChart({ points = [] }) {
  const height = 180;
  const padTop = 12;
  const padBottom = 28;
  const padLeft = 36;
  const padRight = 8;
  const innerH = height - padTop - padBottom;

  const safe = Array.isArray(points) ? points : [];
  const max = Math.max(0.01, ...safe.map((p) => Number(p.costUsd) || 0));
  const niceMax = Math.ceil(max * 100) / 100 || 0.01;

  if (safe.length === 0) {
    return (
      <div className="h-[180px] grid place-items-center text-[12px] text-jarvis-muted italic">
        No cost history yet.
      </div>
    );
  }

  // chart geometry
  const barGap = 8;
  // Use a viewBox so bar width scales with container width.
  const viewW = 560;
  const innerW = viewW - padLeft - padRight;
  const barW = Math.max(4, (innerW - barGap * (safe.length - 1)) / safe.length);

  const yFor = (v) => padTop + innerH - (Number(v) || 0) / niceMax * innerH;

  const fmtDay = (ymd) => {
    if (!ymd) return "";
    const parts = String(ymd).split("-");
    if (parts.length !== 3) return ymd;
    return `${parts[1]}/${parts[2]}`;
  };

  const fmtUsd = (v) => `$${Number(v).toFixed(2)}`;

  return (
    <svg
      viewBox={`0 0 ${viewW} ${height}`}
      className="w-full h-[180px]"
      preserveAspectRatio="none"
      role="img"
      aria-label="7 day cost chart"
    >
      {/* axes */}
      <line
        x1={padLeft}
        y1={padTop}
        x2={padLeft}
        y2={padTop + innerH}
        stroke="currentColor"
        className="text-jarvis-border"
        strokeWidth="1"
      />
      <line
        x1={padLeft}
        y1={padTop + innerH}
        x2={viewW - padRight}
        y2={padTop + innerH}
        stroke="currentColor"
        className="text-jarvis-border"
        strokeWidth="1"
      />

      {/* y-axis labels: 0, mid, max */}
      {[0, 0.5, 1].map((frac, i) => {
        const v = niceMax * frac;
        const y = padTop + innerH - frac * innerH;
        return (
          <g key={i}>
            <line
              x1={padLeft - 3}
              y1={y}
              x2={padLeft}
              y2={y}
              stroke="currentColor"
              className="text-jarvis-border"
              strokeWidth="1"
            />
            <text
              x={padLeft - 6}
              y={y + 3}
              textAnchor="end"
              className="fill-jarvis-muted"
              style={{ fontSize: 9 }}
            >
              {fmtUsd(v)}
            </text>
          </g>
        );
      })}

      {/* bars */}
      {safe.map((p, i) => {
        const x = padLeft + i * (barW + barGap);
        const y = yFor(p.costUsd);
        const h = padTop + innerH - y;
        return (
          <g key={`${p.day}-${i}`}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={Math.max(0, h)}
              rx={2}
              className="fill-jarvis-primary/70"
            >
              <title>{`${p.day}: ${fmtUsd(p.costUsd ?? 0)}`}</title>
            </rect>
            <text
              x={x + barW / 2}
              y={height - 10}
              textAnchor="middle"
              className="fill-jarvis-muted"
              style={{ fontSize: 9 }}
            >
              {fmtDay(p.day)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
