import { Star } from "lucide-react";

export default function AnnualKnowledgeReview({ nodes = [], decisions = [], mistakes = [], readings = [], models = [] }) {
  const year = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01`);

  const learned = nodes.filter((n) => new Date(n.createdAt ?? n.created_at ?? 0) >= yearStart).length;
  const decided = decisions.filter((d) => new Date(d.decided_at ?? 0) >= yearStart).length;
  const prevented = mistakes.filter((m) => m.prevented_next && new Date(m.occurred_at ?? 0) >= yearStart).length;
  const booksRead = readings.filter((r) => new Date(r.created_at ?? 0) >= yearStart).length;
  const modelsUsed = models.filter((m) => (m.times_used ?? 0) > 0).length;

  const stats = [
    { label: "Learned", value: learned, sub: "memory nodes" },
    { label: "Decided", value: decided, sub: "decisions logged" },
    { label: "Wisdom", value: prevented, sub: "mistakes turned to wisdom" },
    { label: "Read", value: booksRead, sub: "books & articles" },
    { label: "Models", value: modelsUsed, sub: "mental models used" },
  ];

  return (
    <div className="surface p-5 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-jarvis-purple/10 border border-jarvis-purple/20 grid place-items-center">
          <Star size={15} className="text-jarvis-purple" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-jarvis-muted">Annual Knowledge Review</div>
          <div className="text-xs text-jarvis-muted">{year} so far</div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        {stats.map(({ label, value, sub }) => (
          <div key={label} className="rounded-xl bg-jarvis-surface/40 border border-jarvis-border p-3 text-center">
            <div className="text-2xl font-bold text-jarvis-purple tabular-nums">{value}</div>
            <div className="text-[10px] font-semibold text-jarvis-ink mt-0.5">{label}</div>
            <div className="text-[9px] text-jarvis-muted">{sub}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
