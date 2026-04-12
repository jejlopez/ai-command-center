import { Eye, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../lib/supabase.js";

const DIR_STYLE = {
  above: "text-jarvis-success",
  below: "text-jarvis-danger",
};

export function WatchlistPanel({ watchlist = [], onRefresh }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ ticker: "", alert_price: "", direction: "above", notes: "" });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!supabase || !form.ticker.trim()) return;
    setSaving(true);
    await supabase.from("watchlist").insert({
      ticker: form.ticker.trim().toUpperCase(),
      alert_price: parseFloat(form.alert_price) || null,
      direction: form.direction,
      notes: form.notes || null,
    });
    setSaving(false);
    setAdding(false);
    setForm({ ticker: "", alert_price: "", direction: "above", notes: "" });
    onRefresh?.();
  }

  async function handleRemove(id) {
    if (!supabase) return;
    await supabase.from("watchlist").delete().eq("id", id);
    onRefresh?.();
  }

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={13} className="text-jarvis-muted" />
          <span className="label">Watchlist</span>
        </div>
        <button onClick={() => setAdding(v => !v)} className="text-jarvis-muted hover:text-jarvis-primary transition-colors">
          <Plus size={13} />
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 bg-white/[0.02] rounded-lg p-3 border border-jarvis-border">
          <div className="flex gap-2">
            <input
              className="w-24 bg-transparent text-xs font-mono font-bold text-jarvis-ink placeholder-jarvis-ghost outline-none border-b border-jarvis-border pb-1 uppercase"
              placeholder="TICKER"
              value={form.ticker}
              onChange={e => setForm(v => ({ ...v, ticker: e.target.value.toUpperCase() }))}
              autoFocus
            />
            <input
              type="number" min="0" step="0.01"
              className="flex-1 bg-transparent text-xs text-jarvis-ink placeholder-jarvis-ghost outline-none border-b border-jarvis-border pb-1"
              placeholder="Alert price"
              value={form.alert_price}
              onChange={e => setForm(v => ({ ...v, alert_price: e.target.value }))}
            />
            <select
              className="bg-jarvis-surface text-xs text-jarvis-body rounded border border-jarvis-border px-1.5 py-1"
              value={form.direction}
              onChange={e => setForm(v => ({ ...v, direction: e.target.value }))}
            >
              <option value="above">Above</option>
              <option value="below">Below</option>
            </select>
          </div>
          <div className="flex gap-2 mt-1">
            <button type="submit" disabled={saving} className="chip bg-jarvis-purple/15 text-jarvis-purple border border-jarvis-purple/30">
              {saving ? "Saving…" : "Add"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="chip bg-white/5 text-jarvis-muted">Cancel</button>
          </div>
        </form>
      )}

      {watchlist.length === 0 && !adding && (
        <p className="text-xs text-jarvis-ghost py-2">No tickers on watch. Hit + to add.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {watchlist.map((w) => (
          <div key={w.id} className="flex items-center gap-2 py-1 border-b border-jarvis-border/50 last:border-0 group">
            <span className="font-mono font-bold text-xs text-jarvis-ink w-16 shrink-0">{w.ticker}</span>
            <div className="flex-1 flex items-center gap-1.5">
              {w.alert_price && (
                <>
                  <span className="text-[10px] text-jarvis-muted">{w.direction}</span>
                  <span className={`text-xs font-mono font-semibold ${DIR_STYLE[w.direction] ?? "text-jarvis-body"}`}>
                    ${Number(w.alert_price).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </>
              )}
            </div>
            {w.notes && <span className="text-[10px] text-jarvis-ghost truncate max-w-24">{w.notes}</span>}
            <button
              onClick={() => handleRemove(w.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-jarvis-danger/60 hover:text-jarvis-danger"
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
