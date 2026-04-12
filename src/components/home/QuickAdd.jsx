import { useState } from "react";
import { Plus, Loader2, X } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

function TaskForm({ onClose, onSaved }) {
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await jarvis.memoryRemember({ kind: "task", label: `home: ${label.trim()}`, trust: 0.8 });
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-jarvis-purple">New Task</span>
        <button type="button" onClick={onClose} className="text-jarvis-muted hover:text-jarvis-ink transition">
          <X size={13} />
        </button>
      </div>
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Task description…"
        className="bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-1.5 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-purple/50 outline-none"
      />
      {err && <p className="text-[11px] text-red-400">{err}</p>}
      <button
        type="submit"
        disabled={saving || !label.trim()}
        className="self-end px-4 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-purple/20 border border-jarvis-purple/30 text-jarvis-purple hover:bg-jarvis-purple/30 transition disabled:opacity-40"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : "Add Task"}
      </button>
    </form>
  );
}

function ExpenseForm({ onClose, onSaved, addExpense }) {
  const [name, setName]     = useState("");
  const [amount, setAmount] = useState("");
  const [freq, setFreq]     = useState("monthly");
  const [nextDue, setNextDue] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !amount) return;
    setSaving(true);
    setErr(null);
    try {
      await addExpense({
        name: name.trim(),
        amount_usd: parseFloat(amount),
        frequency: freq,
        next_due: nextDue || null,
        category: "household",
      });
      onSaved?.();
      onClose();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-jarvis-purple">New Expense</span>
        <button type="button" onClick={onClose} className="text-jarvis-muted hover:text-jarvis-ink transition">
          <X size={13} />
        </button>
      </div>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Expense name (e.g. Electric bill)"
        className="bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-1.5 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-purple/50 outline-none"
      />
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount ($)"
          className="flex-1 bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-1.5 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-purple/50 outline-none"
        />
        <select
          value={freq}
          onChange={(e) => setFreq(e.target.value)}
          className="bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-1.5 text-sm text-jarvis-ink focus:border-jarvis-purple/50 outline-none"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="quarterly">Quarterly</option>
          <option value="annual">Annual</option>
        </select>
      </div>
      <input
        type="date"
        value={nextDue}
        onChange={(e) => setNextDue(e.target.value)}
        className="bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-1.5 text-sm text-jarvis-ink focus:border-jarvis-purple/50 outline-none"
      />
      {err && <p className="text-[11px] text-red-400">{err}</p>}
      <button
        type="submit"
        disabled={saving || !name.trim() || !amount}
        className="self-end px-4 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-purple/20 border border-jarvis-purple/30 text-jarvis-purple hover:bg-jarvis-purple/30 transition disabled:opacity-40"
      >
        {saving ? <Loader2 size={12} className="animate-spin" /> : "Add Expense"}
      </button>
    </form>
  );
}

export function QuickAdd({ addExpense, onSaved }) {
  const [active, setActive] = useState(null); // null | "task" | "expense"

  const close = () => setActive(null);

  return (
    <div className="sticky bottom-0 z-10">
      <div className="bg-jarvis-surface/80 backdrop-blur-xl border-t border-jarvis-border px-6 py-3">
        {active ? (
          <div className="max-w-lg mx-auto">
            {active === "task" && (
              <TaskForm onClose={close} onSaved={onSaved} />
            )}
            {active === "expense" && (
              <ExpenseForm onClose={close} onSaved={onSaved} addExpense={addExpense} />
            )}
          </div>
        ) : (
          <div className="flex items-center gap-3 justify-center">
            <button
              type="button"
              onClick={() => setActive("task")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-jarvis-purple/10 border border-jarvis-purple/20 text-jarvis-purple hover:bg-jarvis-purple/20 transition"
            >
              <Plus size={12} /> Task
            </button>
            <button
              type="button"
              onClick={() => setActive("expense")}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-jarvis-surface/20 border border-jarvis-border text-jarvis-body hover:text-jarvis-ink hover:bg-white/5 transition"
            >
              <Plus size={12} /> Expense
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
