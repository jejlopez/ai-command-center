import { PROCESS_COLORS, QUALITY_COLORS, ATTENTION_COLORS, QUALITY_LABELS, ATTENTION_LABELS } from "../../lib/badges.js";

function Badge({ label, colorClass }) {
  if (!label) return null;
  return (
    <span className={`text-[8px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${colorClass}`}>
      {label}
    </span>
  );
}

export function BadgeZone({ record, type = "lead" }) {
  const status = record.status || record.stage || "";
  const statusKey = status.toLowerCase().replace(/\s+/g, "_");

  return (
    <div className="flex gap-1.5 flex-wrap">
      <Badge
        label={status.replace(/_/g, " ")}
        colorClass={PROCESS_COLORS[statusKey] || "bg-white/5 text-jarvis-muted"}
      />
      {record.quality && (
        <Badge
          label={QUALITY_LABELS[record.quality] || record.quality}
          colorClass={record.quality === "whale"
            ? "bg-gradient-to-r from-green-400 to-cyan-400 text-slate-900 font-bold"
            : QUALITY_COLORS[record.quality] || ""}
        />
      )}
      {record.attention && (
        <Badge
          label={ATTENTION_LABELS[record.attention] || record.attention}
          colorClass={ATTENTION_COLORS[record.attention] || ""}
        />
      )}
      {record.strike_count != null && (
        <Badge
          label={`S${record.strike_count}`}
          colorClass={
            record.strike_count >= 4 ? "bg-jarvis-danger/15 text-jarvis-danger" :
            record.strike_count >= 2 ? "bg-jarvis-warning/15 text-jarvis-warning" :
            "bg-blue-500/10 text-blue-400"
          }
        />
      )}
    </div>
  );
}
