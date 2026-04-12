import { useState } from "react";
import { Timer, Plus, Trash2 } from "lucide-react";

function toMonthlyHours(hours, freq) {
  return freq === "weekly" ? hours * 4.33 : hours;
}

export function TimeSavingsCalculator() {
  const [tasks, setTasks] = useState([
    { id: 1, name: "Grocery shopping", hours: 1.5, freq: "weekly" },
    { id: 2, name: "House cleaning", hours: 2.0, freq: "weekly" },
  ]);
  const [form, setForm] = useState({ name: "", hours: "", freq: "weekly" });

  function addTask() {
    if (!form.name.trim() || !form.hours) return;
    setTasks(t => [...t, { id: Date.now(), name: form.name, hours: parseFloat(form.hours), freq: form.freq }]);
    setForm({ name: "", hours: "", freq: "weekly" });
  }

  function removeTask(id) {
    setTasks(t => t.filter(x => x.id !== id));
  }

  const totalMonthly = tasks.reduce((s, t) => s + toMonthlyHours(t.hours, t.freq), 0);
  const totalAnnual = totalMonthly * 12;

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4">
        <Timer size={14} className="text-jarvis-purple" />
        <div className="label">Time Savings Calculator</div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          className="input-sm flex-1"
          placeholder="Task name"
          value={form.name}
          onChange={e => setForm(f => ({...f, name: e.target.value}))}
          onKeyDown={e => e.key === "Enter" && addTask()}
        />
        <input
          className="input-sm w-20"
          type="number"
          placeholder="Hours"
          value={form.hours}
          onChange={e => setForm(f => ({...f, hours: e.target.value}))}
          min="0.1" step="0.5"
        />
        <select className="input-sm" value={form.freq} onChange={e => setForm(f => ({...f, freq: e.target.value}))}>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <button onClick={addTask} className="chip bg-jarvis-purple/10 border border-jarvis-purple/20 text-jarvis-purple hover:bg-jarvis-purple/20 transition cursor-pointer">
          <Plus size={11} />
        </button>
      </div>

      <div className="space-y-1 mb-4">
        {tasks.map((t) => {
          const mo = toMonthlyHours(t.hours, t.freq);
          return (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-border bg-jarvis-surface/20">
              <div className="flex-1 text-sm text-jarvis-ink">{t.name}</div>
              <div className="text-xs text-jarvis-muted">{t.hours}h/{t.freq}</div>
              <div className="text-xs font-semibold text-jarvis-purple">{mo.toFixed(1)} hrs/mo</div>
              <button onClick={() => removeTask(t.id)} className="text-jarvis-muted hover:text-red-400 transition">
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="p-3 rounded-xl bg-jarvis-purple/10 border border-jarvis-purple/20 text-center">
        <div className="text-xl font-bold text-jarvis-purple">{totalMonthly.toFixed(1)} hrs/mo</div>
        <div className="text-[11px] text-jarvis-muted mt-0.5">{totalAnnual.toFixed(0)} hours per year recoverable</div>
        <div className="text-[10px] text-jarvis-muted mt-1 italic">That's {(totalAnnual / 8).toFixed(0)} full work-days back.</div>
      </div>
    </div>
  );
}
