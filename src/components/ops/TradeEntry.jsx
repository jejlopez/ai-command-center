import { useState } from "react";
import { Zap } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const SIDES = ["long", "short"];

export function TradeEntry({ onRefresh }) {
  const [form, setForm] = useState({
    ticker: "", side: "long", entry_price: "", size: "",
    stop_loss: "", take_profit: "", notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState(null);

  const risk = form.entry_price && form.stop_loss && form.size
    ? Math.abs((parseFloat(form.entry_price) - parseFloat(form.stop_loss)) * parseFloat(form.size)).toFixed(2)
    : null;
  const reward = form.entry_price && form.take_profit && form.size
    ? Math.abs((parseFloat(form.take_profit) - parseFloat(form.entry_price)) * parseFloat(form.size)).toFixed(2)
    : null;
  const rr = risk && reward ? (reward / risk).toFixed(1) : null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!supabase || !form.ticker.trim() || !form.entry_price) return;
    setSaving(true);
    setErr(null);
    const { error } = await supabase.from("positions").insert({
      ticker: form.ticker.trim().toUpperCase(),
      side: form.side,
      entry_price: parseFloat(form.entry_price),
      size: parseFloat(form.size) || 1,
      stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
      take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
      notes: form.notes || null,
      status: "open",
    });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setForm({ ticker: "", side: "long", entry_price: "", size: "", stop_loss: "", take_profit: "", notes: "" });
    onRefresh?.();
  }

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Zap size={13} className="text-jarvis-muted" />
        <span className="label">Trade Entry</span>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Ticker + Side */}
        <div className="flex gap-2">
          <input
            className="w-24 bg-white/[0.02] border border-jarvis-border rounded-lg px-2 py-1.5 text-xs font-mono font-bold text-jarvis-ink placeholder-jarvis-ghost outline-none focus:border-jarvis-purple/50 uppercase transition-colors"
            placeholder="TICKER"
            value={form.ticker}
            onChange={e => setForm(v => ({ ...v, ticker: e.target.value.toUpperCase() }))}
          />
          <div className="flex rounded-lg border border-jarvis-border overflow-hidden">
            {SIDES.map(s => (
              <button
                key={s} type="button"
                onClick={() => setForm(v => ({ ...v, side: s }))}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  form.side === s
                    ? s === "long"
                      ? "bg-jarvis-success/20 text-jarvis-success"
                      : "bg-jarvis-danger/20 text-jarvis-danger"
                    : "text-jarvis-muted hover:text-jarvis-body"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Entry + Size */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="label mb-1">Entry Price</div>
            <input type="number" min="0" step="0.01"
              className="w-full bg-white/[0.02] border border-jarvis-border rounded-lg px-2 py-1.5 text-xs text-jarvis-ink outline-none focus:border-jarvis-purple/50 transition-colors"
              value={form.entry_price}
              onChange={e => setForm(v => ({ ...v, entry_price: e.target.value }))}
            />
          </div>
          <div>
            <div className="label mb-1">Size (shares)</div>
            <input type="number" min="0" step="1"
              className="w-full bg-white/[0.02] border border-jarvis-border rounded-lg px-2 py-1.5 text-xs text-jarvis-ink outline-none focus:border-jarvis-purple/50 transition-colors"
              value={form.size}
              onChange={e => setForm(v => ({ ...v, size: e.target.value }))}
            />
          </div>
        </div>

        {/* Stop + Target */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="label mb-1">Stop Loss</div>
            <input type="number" min="0" step="0.01"
              className="w-full bg-white/[0.02] border border-jarvis-border rounded-lg px-2 py-1.5 text-xs text-jarvis-danger/70 outline-none focus:border-jarvis-danger/40 transition-colors"
              value={form.stop_loss}
              onChange={e => setForm(v => ({ ...v, stop_loss: e.target.value }))}
            />
          </div>
          <div>
            <div className="label mb-1">Take Profit</div>
            <input type="number" min="0" step="0.01"
              className="w-full bg-white/[0.02] border border-jarvis-border rounded-lg px-2 py-1.5 text-xs text-jarvis-success/70 outline-none focus:border-jarvis-success/40 transition-colors"
              value={form.take_profit}
              onChange={e => setForm(v => ({ ...v, take_profit: e.target.value }))}
            />
          </div>
        </div>

        {/* R:R indicator */}
        {rr && (
          <div className="flex items-center gap-3 text-[11px] bg-white/[0.02] rounded px-2 py-1">
            <span className="text-jarvis-muted">Risk</span>
            <span className="text-jarvis-danger font-mono">${risk}</span>
            <span className="text-jarvis-muted">Reward</span>
            <span className="text-jarvis-success font-mono">${reward}</span>
            <span className="text-jarvis-muted ml-auto">R:R</span>
            <span className={`font-bold ${parseFloat(rr) >= 2 ? "text-jarvis-success" : parseFloat(rr) >= 1 ? "text-jarvis-warning" : "text-jarvis-danger"}`}>
              {rr}x
            </span>
          </div>
        )}

        {err && <p className="text-[11px] text-jarvis-danger">{err}</p>}

        <button
          type="submit"
          disabled={saving || !form.ticker.trim() || !form.entry_price}
          className="w-full py-2 rounded-lg text-xs font-semibold transition-all
            bg-jarvis-purple/15 border border-jarvis-purple/30 text-jarvis-purple
            hover:bg-jarvis-purple/25 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {saved ? "Position Added!" : saving ? "Saving…" : `Enter ${form.side.toUpperCase()} ${form.ticker || "Trade"}`}
        </button>
      </form>
    </div>
  );
}
