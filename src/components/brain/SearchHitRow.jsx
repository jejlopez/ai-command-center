import {
  User,
  Folder,
  ListTodo,
  Sparkles,
  CalendarDays,
  Settings2,
} from "lucide-react";

const KIND_META = {
  person:  { Icon: User,         tone: "cyan" },
  project: { Icon: Folder,       tone: "blue" },
  task:    { Icon: ListTodo,     tone: "amber" },
  fact:    { Icon: Sparkles,     tone: "purple" },
  event:   { Icon: CalendarDays, tone: "green" },
  pref:    { Icon: Settings2,    tone: "blue" },
};

const TONE = {
  cyan:   "text-jarvis-cyan",
  blue:   "text-jarvis-blue",
  amber:  "text-jarvis-amber",
  purple: "text-jarvis-purple",
  green:  "text-jarvis-green",
};

const VIA_STYLE = {
  vector: "bg-jarvis-cyan/10   text-jarvis-cyan   border-jarvis-cyan/30",
  fts:    "bg-jarvis-blue/10   text-jarvis-blue   border-jarvis-blue/30",
  graph:  "bg-jarvis-purple/10 text-jarvis-purple border-jarvis-purple/30",
  hybrid: "bg-jarvis-green/10  text-jarvis-green  border-jarvis-green/30",
};

function scorePillClasses(score) {
  if (score > 0.8) return "bg-jarvis-green/10 text-jarvis-green border-jarvis-green/30";
  if (score > 0.5) return "bg-jarvis-amber/10 text-jarvis-amber border-jarvis-amber/30";
  return "bg-white/5 text-jarvis-muted border-jarvis-border";
}

export default function SearchHitRow({ node, score, via, selected, onClick }) {
  if (!node) return null;
  const meta = KIND_META[node.kind] ?? KIND_META.fact;
  const Icon = meta.Icon;
  const hasScore = typeof score === "number" && Number.isFinite(score);

  return (
    <button
      type="button"
      onClick={onClick}
      title={node.label}
      className={[
        "w-full text-left px-2 py-1.5 rounded-lg flex items-center gap-2 transition",
        selected
          ? "bg-jarvis-cyan/10 text-jarvis-cyan"
          : "text-jarvis-body hover:text-jarvis-ink hover:bg-white/5",
      ].join(" ")}
    >
      <Icon size={12} className={TONE[meta.tone] ?? "text-jarvis-cyan"} />
      <span className="text-[12px] truncate flex-1">{node.label}</span>
      {via && (
        <span
          className={[
            "text-[9px] uppercase tracking-[0.12em] font-semibold px-1.5 py-[1px] rounded-md border",
            VIA_STYLE[via] ?? "bg-white/5 text-jarvis-muted border-jarvis-border",
          ].join(" ")}
        >
          {via}
        </span>
      )}
      {hasScore && (
        <span
          className={[
            "text-[10px] tabular-nums px-1.5 py-[1px] rounded-md border",
            scorePillClasses(score),
          ].join(" ")}
        >
          {(score * 100).toFixed(0)}%
        </span>
      )}
    </button>
  );
}
