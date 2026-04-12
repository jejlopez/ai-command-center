import { useState, useCallback } from "react";
import { CheckSquare, Plus, Loader2, Trash2, Clock } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

function daysSince(createdAt) {
  if (!createdAt) return null;
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.floor(diff / 86_400_000);
}

function TaskRow({ node, onDone, forgetting }) {
  const age = daysSince(node.created_at);
  const isOverdue = age !== null && age > 7;

  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-jarvis-border/50 last:border-0`}>
      <button
        type="button"
        onClick={() => onDone(node.id)}
        disabled={forgetting}
        className="mt-0.5 shrink-0 w-5 h-5 rounded border border-jarvis-border hover:border-jarvis-purple/60 hover:bg-jarvis-purple/10 grid place-items-center transition disabled:opacity-40"
        title="Mark done"
      >
        {forgetting ? <Loader2 size={10} className="animate-spin text-jarvis-purple" /> : <CheckSquare size={10} className="text-jarvis-muted" />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-sm text-jarvis-ink truncate">{node.label}</div>
        {node.body && <div className="text-[11px] text-jarvis-muted mt-0.5 truncate">{node.body}</div>}
      </div>

      {age !== null && (
        <div className={`chip shrink-0 text-[10px] ${isOverdue ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-jarvis-panel/40 border-jarvis-border text-jarvis-muted"}`}>
          <Clock size={9} />
          {age === 0 ? "today" : `${age}d ago`}
        </div>
      )}
    </div>
  );
}

export function TaskQueue({ nodes, loading, refresh }) {
  const [forgettingId, setForgettingId] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);

  const handleDone = useCallback(async (id) => {
    setForgettingId(id);
    try {
      await jarvis.memoryForget(id);
      await refresh();
    } finally {
      setForgettingId(null);
    }
  }, [refresh]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setSaving(true);
    try {
      await jarvis.memoryRemember({ kind: "task", label: `home: ${newLabel.trim()}`, trust: 0.8 });
      setNewLabel("");
      setShowAdd(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  };

  // Filter to home tasks
  const homeTasks = nodes.filter((n) => {
    const l = (n.label ?? "").toLowerCase();
    const b = (n.body ?? "").toLowerCase();
    return n.kind === "task" && (l.includes("home") || l.includes("household") || b.includes("home"));
  });

  return (
    <div className="glass p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="label">Task Queue</div>
        <button
          type="button"
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-jarvis-purple/10 border border-jarvis-purple/20 text-jarvis-purple hover:bg-jarvis-purple/20 transition"
        >
          <Plus size={11} />
          Add Task
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-jarvis-muted py-4">
          <Loader2 size={12} className="animate-spin" /> Loading tasks…
        </div>
      ) : homeTasks.length === 0 ? (
        <p className="text-[12px] text-jarvis-muted py-3">
          No home tasks. Add tasks tagged with "home:" to track them here.
        </p>
      ) : (
        <div>
          {homeTasks.map((n) => (
            <TaskRow
              key={n.id}
              node={n}
              onDone={handleDone}
              forgetting={forgettingId === n.id}
            />
          ))}
        </div>
      )}

      {showAdd && (
        <form onSubmit={handleAdd} className="mt-3 flex gap-2">
          <input
            autoFocus
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Task description…"
            className="flex-1 bg-jarvis-panel/40 border border-jarvis-border rounded-xl px-3 py-1.5 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-purple/50 outline-none"
          />
          <button
            type="submit"
            disabled={saving || !newLabel.trim()}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-purple/20 border border-jarvis-purple/30 text-jarvis-purple hover:bg-jarvis-purple/30 transition disabled:opacity-40"
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : "Save"}
          </button>
        </form>
      )}
    </div>
  );
}
