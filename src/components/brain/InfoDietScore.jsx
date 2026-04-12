import { BookOpen } from "lucide-react";

const TYPE_LABELS = { book: "Books", article: "Articles", podcast: "Podcasts", video: "Videos" };

export default function InfoDietScore({ readings = [] }) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5);
  const recent = readings.filter((r) => new Date(r.created_at ?? 0) >= thirtyDaysAgo);

  const signal = recent.filter((r) => (r.rating ?? 0) >= 4).length;
  const noise = recent.filter((r) => (r.rating ?? 0) <= 2 && r.rating != null).length;
  const score = recent.length > 0 ? Math.round((signal / recent.length) * 100) : null;

  const byType = {};
  for (const r of recent) {
    const t = r.type ?? "book";
    byType[t] = (byType[t] ?? 0) + 1;
  }

  return (
    <div className="surface p-4 flex items-center gap-6">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-xl bg-jarvis-purple/10 border border-jarvis-purple/20 grid place-items-center shrink-0">
          <BookOpen size={16} className="text-jarvis-purple" />
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-jarvis-muted">Info Diet Score</div>
          {score !== null ? (
            <div className="text-sm font-semibold text-jarvis-ink">
              {score}% signal
              <span className="ml-2 text-[11px] font-normal text-jarvis-muted">
                {signal} useful · {noise} noise · {recent.length} total (30d)
              </span>
            </div>
          ) : (
            <div className="text-sm text-jarvis-muted">No readings logged in 30 days</div>
          )}
        </div>
      </div>

      {Object.keys(byType).length > 0 && (
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {Object.entries(byType).map(([t, n]) => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-jarvis-purple/10 text-jarvis-purple font-semibold uppercase tracking-[0.1em]">
              {TYPE_LABELS[t] ?? t} {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
