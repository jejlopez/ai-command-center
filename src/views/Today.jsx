import { useMemo, useState } from "react";
import {
  CalendarClock,
  Plus,
  Target,
  MapPin,
  AlertTriangle,
  X,
  Loader2,
} from "lucide-react";
import { useToday } from "../hooks/useJarvis.js";
import { jarvis } from "../lib/jarvis.js";

function fmtTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "--:--";
  }
}

function fmtDate(ymd) {
  if (!ymd) return "";
  try {
    const d = new Date(`${ymd}T00:00:00`);
    return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  } catch {
    return ymd;
  }
}

function todayYmd() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localInputToIso(day, hhmm) {
  // hhmm = "HH:MM"
  if (!day || !hhmm) return null;
  const d = new Date(`${day}T${hhmm}:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function TodayCard({ item, allById, onDelete, deleting }) {
  const isFocus = item.kind === "focus";
  const hasConflict = Array.isArray(item.conflictsWith) && item.conflictsWith.length > 0;

  const conflictTitles = (item.conflictsWith ?? [])
    .map((id) => allById[id]?.title)
    .filter(Boolean)
    .join(", ");

  return (
    <div
      className={[
        "glass p-4 relative overflow-hidden transition",
        hasConflict ? "border-l-4 border-l-jarvis-red/70" : "",
      ].join(" ")}
    >
      <div className="flex items-start gap-4">
        <div className="w-24 shrink-0 text-right">
          <div className="text-[13px] font-semibold text-jarvis-ink tabular-nums">
            {fmtTime(item.start)}
          </div>
          <div className="text-[10px] text-jarvis-muted tabular-nums">
            {fmtTime(item.end)}
          </div>
        </div>

        <div className="w-px self-stretch bg-jarvis-border" />

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {isFocus ? (
              <Target size={13} className="text-jarvis-green mt-1 shrink-0" />
            ) : (
              <CalendarClock size={13} className="text-jarvis-cyan mt-1 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold text-jarvis-ink truncate">
                {item.title}
              </div>
              <div className="text-[11px] text-jarvis-muted mt-0.5 flex items-center gap-2 flex-wrap">
                <span className="uppercase tracking-wide">
                  {isFocus ? "Focus" : (item.calendar || "Calendar")}
                </span>
                {item.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={10} />
                    {item.location}
                  </span>
                )}
              </div>
              {item.notes && (
                <div className="text-[12px] text-jarvis-body mt-1.5 leading-snug">
                  {item.notes}
                </div>
              )}
            </div>

            {isFocus && (
              <button
                type="button"
                onClick={() => onDelete(item.id)}
                disabled={deleting}
                title="Delete focus block"
                className="shrink-0 p-1 rounded-lg text-jarvis-muted hover:text-jarvis-red hover:bg-jarvis-red/10 transition disabled:opacity-40"
              >
                {deleting ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
              </button>
            )}
          </div>

          {hasConflict && (
            <div className="mt-3 flex items-start gap-2 px-2 py-1.5 rounded-lg bg-jarvis-red/5 border border-jarvis-red/20 text-[11px] text-jarvis-red">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              <span>
                Conflicts with: <span className="font-semibold">{conflictTitles || item.conflictsWith.join(", ")}</span>
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FocusBlockForm({ day, onCreate }) {
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:30");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    const startIso = localInputToIso(day, start);
    const endIso = localInputToIso(day, end);
    if (!startIso || !endIso) { setErr("Invalid time"); return; }
    if (new Date(endIso) <= new Date(startIso)) { setErr("End must be after start"); return; }
    setBusy(true);
    setErr(null);
    try {
      await onCreate({ title: title.trim(), start: startIso, end: endIso, notes: notes.trim() || undefined });
      setTitle("");
      setNotes("");
    } catch (e) {
      setErr(e?.message ?? "Failed to create focus block");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="glass p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target size={13} className="text-jarvis-green" />
        <span className="label text-jarvis-green">New Focus Block</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto] gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Deep work on…"
          className="bg-jarvis-panel/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-green/50 outline-none"
        />
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="bg-jarvis-panel/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-green/50 outline-none tabular-nums"
        />
        <input
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className="bg-jarvis-panel/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-green/50 outline-none tabular-nums"
        />
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Notes (optional)"
        className="mt-3 w-full bg-jarvis-panel/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-green/50 outline-none resize-none"
      />
      {err && <div className="mt-2 text-[11px] text-jarvis-red">{err}</div>}
      <div className="mt-3 flex items-center justify-end">
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-jarvis-green/10 text-jarvis-green border border-jarvis-green/30 hover:bg-jarvis-green/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Add block
        </button>
      </div>
    </form>
  );
}

export default function Today() {
  const { today, loading, error, refresh } = useToday();
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const items = today?.all ?? [];
  const conflictCount = today?.conflictCount ?? 0;
  const dayYmd = today?.date ?? todayYmd();

  const allById = useMemo(() => {
    const m = {};
    for (const it of items) m[it.id] = it;
    return m;
  }, [items]);

  const handleCreate = async (input) => {
    await jarvis.createFocusBlock(input);
    await refresh();
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await jarvis.deleteFocusBlock(id);
      await refresh();
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-jarvis-cyan/10 border border-jarvis-cyan/20 grid place-items-center">
            <CalendarClock size={16} className="text-jarvis-cyan" />
          </div>
          <div>
            <div className="label text-jarvis-cyan">Today</div>
            <div className="text-[12px] text-jarvis-body">{fmtDate(dayYmd)}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="chip text-jarvis-blue border-jarvis-blue/30 bg-jarvis-blue/5">
            {dayYmd}
          </span>
          <span
            className={[
              "chip",
              conflictCount > 0
                ? "text-jarvis-red border-jarvis-red/30 bg-jarvis-red/5"
                : "text-jarvis-muted border-jarvis-border bg-white/5",
            ].join(" ")}
          >
            {conflictCount} {conflictCount === 1 ? "conflict" : "conflicts"}
          </span>
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-green/10 text-jarvis-green border border-jarvis-green/30 hover:bg-jarvis-green/20 transition"
          >
            <Plus size={14} />
            Focus block
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
          {loading && !today && (
            <div className="glass p-6 text-sm text-jarvis-body flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Loading today…
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-jarvis-red/30 bg-jarvis-red/5 p-4 text-[12px] text-jarvis-red">
              Couldn’t reach Today endpoint. The API worker may not be ready yet.
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div className="glass p-10 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-jarvis-green/10 border border-jarvis-green/20 grid place-items-center">
                <Target size={18} className="text-jarvis-green" />
              </div>
              <div className="text-[14px] text-jarvis-ink font-semibold mb-1">
                Nothing scheduled today
              </div>
              <div className="text-[12px] text-jarvis-body">
                Add a focus block to protect deep work.
              </div>
            </div>
          )}

          {items.map((it) => (
            <TodayCard
              key={`${it.kind}-${it.id}`}
              item={it}
              allById={allById}
              onDelete={handleDelete}
              deleting={deletingId === it.id}
            />
          ))}

          {showForm && (
            <FocusBlockForm day={dayYmd} onCreate={handleCreate} />
          )}
        </div>
      </div>
    </div>
  );
}
