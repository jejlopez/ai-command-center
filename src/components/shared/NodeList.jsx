import { Trash2, Loader2 } from "lucide-react";

function TrustBar({ trust }) {
  const pct = Math.round((Number(trust) || 0) * 100);
  return (
    <div className="flex items-center gap-2 w-28">
      <div className="flex-1 h-1 rounded-full bg-white/5 overflow-hidden">
        <div
          className="h-full bg-jarvis-cyan/80"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[9px] text-jarvis-muted tabular-nums">{pct}%</span>
    </div>
  );
}

export default function NodeList({ nodes = [], onForget, onClick, emptyLabel = "Nothing yet", forgettingId = null }) {
  if (!nodes || nodes.length === 0) {
    return (
      <div className="glass p-5 text-[12px] text-jarvis-muted italic text-center">
        {emptyLabel}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {nodes.map((n) => {
        const body = (n.body ?? "").trim();
        const snippet = body.length > 140 ? `${body.slice(0, 140)}…` : body;
        const clickable = typeof onClick === "function";
        return (
          <div
            key={n.id}
            className={[
              "glass p-3 flex items-start gap-3 group",
              clickable ? "cursor-pointer hover:bg-white/5" : "",
            ].join(" ")}
            onClick={clickable ? () => onClick(n) : undefined}
          >
            <span className="chip text-jarvis-cyan border-jarvis-cyan/30 bg-jarvis-cyan/5 shrink-0">
              {n.kind}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-jarvis-ink truncate">
                {n.label}
              </div>
              {snippet && (
                <div className="text-[11px] text-jarvis-body mt-0.5 leading-snug whitespace-pre-wrap">
                  {snippet}
                </div>
              )}
              <div className="mt-2">
                <TrustBar trust={n.trust} />
              </div>
            </div>
            {typeof onForget === "function" && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onForget(n.id); }}
                disabled={forgettingId === n.id}
                className="shrink-0 p-1.5 rounded-lg text-jarvis-muted hover:text-jarvis-red hover:bg-jarvis-red/10 transition disabled:opacity-40"
                title="Forget"
              >
                {forgettingId === n.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
