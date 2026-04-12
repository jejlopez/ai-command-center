import { CheckSquare, Square, Plus } from "lucide-react";
import { useState } from "react";

const PRIORITY_STYLE = {
  high:   "text-jarvis-danger",
  medium: "text-jarvis-warning",
  low:    "text-jarvis-muted",
};

export function TaskBoard({ tasks = [] }) {
  const [localTasks, setLocalTasks] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", priority: "medium" });

  const allTasks = [...tasks, ...localTasks];
  const pending = allTasks.filter(t => !t.done);
  const done    = allTasks.filter(t => t.done).slice(0, 3);

  function toggle(id, isLocal) {
    if (isLocal) {
      setLocalTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
    }
  }

  function addLocal(e) {
    e.preventDefault();
    if (!newTask.title.trim()) return;
    setLocalTasks(prev => [...prev, {
      id: `local-${Date.now()}`,
      title: newTask.title.trim(),
      priority: newTask.priority,
      done: false,
      isLocal: true,
    }]);
    setNewTask({ title: "", priority: "medium" });
    setAdding(false);
  }

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckSquare size={13} className="text-jarvis-muted" />
          <span className="label">Task Queue</span>
          {pending.length > 0 && (
            <span className="chip bg-cyan-400/15 text-cyan-400">{pending.length}</span>
          )}
        </div>
        <button onClick={() => setAdding(v => !v)} className="text-jarvis-muted hover:text-cyan-400 transition-colors">
          <Plus size={13} />
        </button>
      </div>

      {adding && (
        <form onSubmit={addLocal} className="flex gap-2 items-center bg-white/[0.02] rounded-lg p-2 border border-jarvis-border">
          <input
            className="flex-1 bg-transparent text-xs text-jarvis-ink placeholder-jarvis-ghost outline-none"
            placeholder="Task title…"
            value={newTask.title}
            onChange={e => setNewTask(v => ({ ...v, title: e.target.value }))}
            autoFocus
          />
          <select
            className="bg-jarvis-surface text-[10px] text-jarvis-muted rounded border border-jarvis-border px-1 py-0.5"
            value={newTask.priority}
            onChange={e => setNewTask(v => ({ ...v, priority: e.target.value }))}
          >
            <option value="high">High</option>
            <option value="medium">Mid</option>
            <option value="low">Low</option>
          </select>
          <button type="submit" className="chip bg-cyan-400/15 text-cyan-400">Add</button>
          <button type="button" onClick={() => setAdding(false)} className="chip bg-white/5 text-jarvis-muted">✕</button>
        </form>
      )}

      {allTasks.length === 0 && !adding && (
        <p className="text-xs text-jarvis-ghost py-2">No build tasks. Hit + to add one.</p>
      )}

      {/* Pending */}
      <div className="flex flex-col gap-1.5">
        {pending.map((t) => (
          <button
            key={t.id}
            onClick={() => t.isLocal && toggle(t.id, true)}
            className="flex items-center gap-2 py-1 border-b border-jarvis-border/50 last:border-0 text-left group w-full"
          >
            <Square size={12} className="text-jarvis-ghost shrink-0 group-hover:text-cyan-400 transition-colors" />
            <span className="text-xs text-jarvis-ink flex-1 truncate">{t.title || t.content}</span>
            {t.priority && (
              <span className={`text-[9px] font-medium shrink-0 ${PRIORITY_STYLE[t.priority] ?? PRIORITY_STYLE.medium}`}>
                {t.priority}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Done */}
      {done.length > 0 && (
        <div className="flex flex-col gap-1.5 opacity-50">
          <div className="label">Done</div>
          {done.map((t) => (
            <div key={t.id} className="flex items-center gap-2 py-1">
              <CheckSquare size={12} className="text-jarvis-success shrink-0" />
              <span className="text-xs text-jarvis-muted line-through truncate">{t.title || t.content}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
