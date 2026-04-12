import { Briefcase, TrendingUp, Code } from "lucide-react";

const MODES = [
  { id: "sales",   label: "Sales",   icon: Briefcase,  accent: "text-blue-400",   ring: "border-blue-400/40",   bg: "bg-blue-400/10"  },
  { id: "trading", label: "Trading", icon: TrendingUp,  accent: "text-jarvis-purple", ring: "border-jarvis-purple/40", bg: "bg-jarvis-purple/10" },
  { id: "build",   label: "Build",   icon: Code,        accent: "text-cyan-400",   ring: "border-cyan-400/40",   bg: "bg-cyan-400/10"  },
];

export function ModeBar({ mode, setMode, badges = {} }) {
  return (
    <div className="flex items-center gap-2 px-6 py-3 border-b border-jarvis-border bg-jarvis-surface shrink-0">
      <span className="label mr-3">Operations Hub</span>
      <div className="flex items-center gap-1">
        {MODES.map(({ id, label, icon: Icon, accent, ring, bg }) => {
          const active = mode === id;
          const count = badges[id];
          return (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={[
                "relative flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200",
                active
                  ? `${bg} border ${ring} ${accent}`
                  : "text-jarvis-muted hover:text-jarvis-body hover:bg-white/5 border border-transparent",
              ].join(" ")}
            >
              <Icon size={13} />
              {label}
              {count > 0 && (
                <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center
                  ${active ? "bg-white/20" : "bg-jarvis-primary/80 text-black"}`}>
                  {count > 9 ? "9+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
