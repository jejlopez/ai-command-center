import { useState, useCallback } from "react";
import { Wrench, Plus, Loader2, Calendar } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

function daysUntil(isoDate) {
  if (!isoDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(isoDate + "T00:00:00");
  return Math.ceil((due - today) / 86_400_000);
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function urgencyClasses(days) {
  if (days === null) return { row: "border-transparent", badge: "text-jarvis-muted", text: "—" };
  if (days < 0)  return { row: "border-red-500/20 bg-red-500/5", badge: "text-red-400", text: `${Math.abs(days)}d overdue` };
  if (days === 0) return { row: "border-amber-400/20 bg-amber-400/5", badge: "text-amber-400", text: "today" };
  if (days <= 7)  return { row: "border-amber-400/20 bg-amber-400/5", badge: "text-amber-400", text: `in ${days}d` };
  if (days <= 30) return { row: "border-jarvis-purple/20 bg-jarvis-purple/5", badge: "text-jarvis-purple", text: `in ${days}d` };
  return { row: "border-transparent", badge: "text-jarvis-muted", text: `in ${days}d` };
}

function MaintenanceRow({ node, onRemove, removing }) {
  // body may hold due date as ISO string
  const days = daysUntil(node.body?.trim() || null);
  const { row, badge, text } = urgencyClasses(days);

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${row} transition`}>
      <Wrench size={13} className="text-jarvis-purple shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-jarvis-ink truncate">{node.label}</div>
        {node.body && (
          <div className="text-[10px] text-jarvis-muted">{fmtDate(node.body.trim())}</div>
        )}
      </div>
      {days !== null && (
        <span className={`chip bg-jarvis-panel/40 border border-jarvis-border text-[10px] ${badge}`}>
          <Calendar size={9} />
          {text}
        </span>
      )}
      <button
        type="button"
        onClick={() => onRemove(node.id)}
        disabled={removing}
        className="ml-1 text-jarvis-muted hover:text-red-400 transition disabled:opacity-40"
        title="Remove"
      >
        {removing ? <Loader2 size={11} className="animate-spin" /> : "×"}
      </button>
    </div>
  );
}

export function MaintenanceCalendar({ nodes, loading, refresh }) {
  const [removingId, setRemovingId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [label, setLabel] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);

  // Filter to maintenance nodes
  const items = nodes.filter((n) => {
    const l = (n.label ?? "").toLowerCase();
    return n.kind === "event" || l.includes("maintenance") || l.includes("service") || l.includes("oil") || l.includes("hvac") || l.includes("filter") || l.includes("lawn");
  }).sort((a, b) => {
    const da = daysUntil(a.body?.trim()) ?? 9999;
    const db = daysUntil(b.body?.trim()) ?? 9999;
    return da - db;
  });

  const handleRemove = useCallback(async (id) => {
    setRemovingId(id);
    try {
      await jarvis.memoryForget(id);
      await refresh();
    } finally {
      setRemovingId(null);
    }
  }, [refresh]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    try {
      await jarvis.memoryRemember({
        kind: "event",
        label: label.trim(),
        body: dueDate || undefined,
        trust: 0.9,
      });
      setLabel("");
      setDueDate("");
      setShowAdd(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="label">Maintenance Calendar</div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-jarvis-purple/10 border border-jarvis-purple/20 text-jarvis-purple hover:bg-jarvis-purple/20 transition"
        >
          <Plus size={11} />
          Add Item
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-jarvis-muted py-4">
          <Loader2 size={12} className="animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <p className="text-[12px] text-jarvis-muted py-3">
          Add maintenance reminders to stay ahead. Oil changes, HVAC filters, lawn care — anything with a due date.
        </p>
      ) : (
        <div className="space-y-1">
          {items.map((n) => (
            <MaintenanceRow
              key={n.id}
              node={n}
              onRemove={handleRemove}
              removing={removingId === n.id}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="mt-3 space-y-2">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Oil change, HVAC filter…"
            className="w-full bg-jarvis-panel/40 border border-jarvis-border rounded-xl px-3 py-1.5 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-purple/50 outline-none"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 bg-jarvis-panel/40 border border-jarvis-border rounded-xl px-3 py-1.5 text-sm text-jarvis-ink focus:border-jarvis-purple/50 outline-none"
            />
            <button
              type="submit"
              disabled={saving || !label.trim()}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-purple/20 border border-jarvis-purple/30 text-jarvis-purple hover:bg-jarvis-purple/30 transition disabled:opacity-40"
            >
              {saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
