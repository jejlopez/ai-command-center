import { Wand2 } from "lucide-react";
import { StatusPill } from "./SkillRunResult.jsx";

function timeAgo(iso) {
 if (!iso) return "—";
 const then = new Date(iso).getTime();
 if (!Number.isFinite(then)) return "—";
 const diff = Date.now() - then;
 if (diff < 60_000) return "just now";
 if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
 if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
 return `${Math.floor(diff / 86_400_000)}d ago`;
}

export default function SkillsRailWidget({ runs = [] }) {
 const latest = runs.slice(0, 3);
 return (
 <div className="surface p-4">
 <div className="flex items-center justify-between mb-3">
 <div className="flex items-center gap-2">
 <Wand2 size={14} className="text-jarvis-primary" />
 <span className="label">Recently run</span>
 </div>
 {runs.length > 0 && (
 <span className="text-[11px] text-jarvis-muted font-medium">{runs.length}</span>
 )}
 </div>
 <div className="space-y-2.5">
 {latest.length === 0 && (
 <div className="text-[11px] text-jarvis-muted italic">No skill runs yet.</div>
 )}
 {latest.map((r) => (
 <div
 key={r.id}
 className="rounded-xl bg-jarvis-surface/40 border border-jarvis-border p-2.5"
 >
 <div className="flex items-center justify-between gap-2 mb-1">
 <div className="text-[12px] text-jarvis-ink font-medium truncate">{r.skill}</div>
 <StatusPill status={r.status} />
 </div>
 <div className="text-[10px] text-jarvis-muted">{timeAgo(r.startedAt)}</div>
 </div>
 ))}
 </div>
 </div>
 );
}
