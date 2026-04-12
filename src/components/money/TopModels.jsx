import { Cpu } from "lucide-react";

export default function TopModels({ topModels = [] }) {
  const rows = Array.isArray(topModels) ? topModels : [];
  const max = Math.max(0.0001, ...rows.map((r) => Number(r.costUsd) || 0));

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-3">
        <Cpu size={13} className="text-jarvis-purple" />
        <div className="label text-jarvis-purple">Top models</div>
      </div>
      {rows.length === 0 ? (
        <div className="text-[12px] text-jarvis-muted italic">
          No model activity yet.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => {
            const pct = Math.round(((Number(r.costUsd) || 0) / max) * 100);
            return (
              <div
                key={`${r.model}-${i}`}
                className="rounded-xl bg-jarvis-panel/30 border border-jarvis-border px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="text-[13px] font-mono text-jarvis-ink truncate">
                    {r.model || "unknown"}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="chip text-jarvis-cyan border-jarvis-cyan/30 bg-jarvis-cyan/5 tabular-nums">
                      ${Number(r.costUsd ?? 0).toFixed(4)}
                    </span>
                    <span className="chip text-jarvis-body border-jarvis-border bg-white/5 tabular-nums">
                      {r.runs ?? 0} {r.runs === 1 ? "run" : "runs"}
                    </span>
                  </div>
                </div>
                <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-jarvis-purple/80"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
