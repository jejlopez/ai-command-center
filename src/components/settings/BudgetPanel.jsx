import { useCallback, useEffect, useState } from "react";
import { DollarSign, Save, Check } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const PRESETS = [5, 10, 20, 50, 100];
const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "JPY"];

export function BudgetPanel() {
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState({ dailyBudgetUsd: 10, currency: "USD", preferredCloudModel: "" });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const c = await jarvis.getConfig();
      setCfg(c);
      setForm({
        dailyBudgetUsd: c?.dailyBudgetUsd ?? 10,
        currency: c?.currency ?? "USD",
        preferredCloudModel: c?.preferredCloudModel ?? "",
      });
    } catch (e) {
      setError(String(e.message ?? e));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setBusy(true); setError(null); setSaved(false);
    try {
      const c = await jarvis.setConfig({
        dailyBudgetUsd: Number(form.dailyBudgetUsd) || 0,
        currency: form.currency,
        preferredCloudModel: form.preferredCloudModel || undefined,
      });
      setCfg(c);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <div className="label">Budget</div>
        <h3 className="font-display text-2xl text-jarvis-ink mt-1">Spend controls</h3>
        <p className="text-jarvis-body text-sm mt-1">
          Set your daily ceiling and preferred cloud model. JARVIS stops before it overspends.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-jarvis-red/30 bg-jarvis-red/5 px-4 py-3 text-xs text-jarvis-red">
          {error}
        </div>
      )}

      <div className="space-y-5 max-w-xl">
        <div>
          <label className="label">Daily ceiling</label>
          <div className="relative mt-2">
            <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-jarvis-muted" />
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.dailyBudgetUsd}
              onChange={(e) => setForm((f) => ({ ...f, dailyBudgetUsd: e.target.value }))}
              className="w-full rounded-xl bg-black/40 border border-jarvis-border pl-9 pr-4 py-3 text-xl font-display text-jarvis-ink outline-none focus:border-jarvis-cyan/50"
            />
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {PRESETS.map((p) => {
              const active = Number(form.dailyBudgetUsd) === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, dailyBudgetUsd: p }))}
                  className={[
                    "px-3 py-1.5 rounded-full text-xs font-semibold transition",
                    active
                      ? "bg-jarvis-cyan/15 text-jarvis-cyan shadow-glow-cyan"
                      : "bg-white/5 text-jarvis-body hover:bg-white/10 hover:text-jarvis-ink",
                  ].join(" ")}
                >
                  ${p}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="label">Currency</label>
          <select
            value={form.currency}
            onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
            className="mt-2 w-full rounded-xl bg-black/40 border border-jarvis-border px-3 py-2.5 text-sm text-jarvis-ink outline-none focus:border-jarvis-cyan/50"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c} className="bg-jarvis-panel">{c}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="label">Preferred cloud model</label>
          <input
            type="text"
            placeholder="claude-sonnet-4-5"
            value={form.preferredCloudModel}
            onChange={(e) => setForm((f) => ({ ...f, preferredCloudModel: e.target.value }))}
            className="mt-2 w-full rounded-xl bg-black/40 border border-jarvis-border px-3 py-2.5 text-sm text-jarvis-ink placeholder:text-jarvis-muted outline-none focus:border-jarvis-cyan/50 font-mono"
          />
          <div className="text-[11px] text-jarvis-muted mt-1.5">
            Leave blank to let JARVIS choose automatically.
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className={[
              "px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2",
              busy
                ? "bg-white/5 text-jarvis-muted cursor-not-allowed"
                : "bg-jarvis-cyan/15 text-jarvis-cyan hover:bg-jarvis-cyan/25 shadow-glow-cyan",
            ].join(" ")}
          >
            <Save size={14} /> {busy ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span className="chip bg-jarvis-green/10 text-jarvis-green">
              <Check size={12} /> Saved
            </span>
          )}
          {cfg && (
            <span className="ml-auto text-[11px] text-jarvis-muted">
              Current: ${cfg.dailyBudgetUsd} {cfg.currency}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
