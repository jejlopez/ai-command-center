import { useEffect, useState } from "react";
import { Check, Loader2, Pencil, X } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

export default function BudgetEditor({ onSaved }) {
 const [config, setConfig] = useState(null);
 const [loading, setLoading] = useState(true);
 const [editing, setEditing] = useState(false);
 const [value, setValue] = useState("");
 const [busy, setBusy] = useState(false);
 const [saved, setSaved] = useState(false);
 const [err, setErr] = useState(null);

 const load = async () => {
 try {
 const c = await jarvis.getConfig();
 setConfig(c ?? null);
 setValue(c?.dailyBudgetUsd != null ? String(c.dailyBudgetUsd) : "");
 } catch (e) {
 setErr(e?.message ?? "Couldn't load config");
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => { load(); }, []);

 useEffect(() => {
 if (!saved) return;
 const t = setTimeout(() => setSaved(false), 1600);
 return () => clearTimeout(t);
 }, [saved]);

 const start = () => {
 setValue(config?.dailyBudgetUsd != null ? String(config.dailyBudgetUsd) : "");
 setErr(null);
 setEditing(true);
 };

 const cancel = () => {
 setEditing(false);
 setErr(null);
 };

 const save = async (e) => {
 e?.preventDefault?.();
 const n = Number.parseFloat(value);
 if (!Number.isFinite(n) || n < 0) {
 setErr("Enter a non-negative number");
 return;
 }
 setBusy(true);
 setErr(null);
 try {
 const next = await jarvis.setConfig({ dailyBudgetUsd: n });
 setConfig(next ?? { ...(config ?? {}), dailyBudgetUsd: n });
 setEditing(false);
 setSaved(true);
 onSaved?.(n);
 } catch (e) {
 setErr(e?.message ?? "Failed to save");
 } finally {
 setBusy(false);
 }
 };

 const currency = config?.currency || "USD";
 const current = config?.dailyBudgetUsd ?? 0;

 return (
 <div className="surface p-5">
 <div className="flex items-center justify-between mb-3">
 <div className="label text-jarvis-primary">Daily Budget</div>
 {saved && (
 <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] font-semibold text-jarvis-green">
 <Check size={11} /> Saved
 </span>
 )}
 </div>

 {loading ? (
 <div className="flex items-center gap-2 text-[12px] text-jarvis-muted">
 <Loader2 size={12} className="animate-spin" /> Loading…
 </div>
 ) : editing ? (
 <form onSubmit={save} className="flex items-center gap-2">
 <div className="flex-1 flex items-center gap-2 bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2">
 <span className="text-jarvis-muted text-[12px]">{currency}</span>
 <input
 type="number"
 min="0"
 step="0.01"
 value={value}
 onChange={(e) => setValue(e.target.value)}
 autoFocus
 className="flex-1 bg-transparent outline-none text-sm text-jarvis-ink placeholder:text-jarvis-muted tabular-nums"
 />
 </div>
 <button
 type="submit"
 disabled={busy}
 className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/30 hover:bg-jarvis-primary/20 disabled:opacity-40 transition"
 >
 {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
 Save
 </button>
 <button
 type="button"
 onClick={cancel}
 className="p-2 rounded-xl text-jarvis-muted hover:text-jarvis-ink hover:bg-white/5 transition"
 >
 <X size={13} />
 </button>
 </form>
 ) : (
 <div className="flex items-center justify-between">
 <div className="flex items-baseline gap-2">
 <span className="text-2xl font-semibold text-jarvis-ink tabular-nums">
 ${current.toFixed(2)}
 </span>
 <span className="text-[11px] text-jarvis-muted uppercase tracking-wide">
 {currency} / day
 </span>
 </div>
 <button
 type="button"
 onClick={start}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-surface/40 text-jarvis-body border border-jarvis-border hover:text-jarvis-ink hover:bg-white/5 transition"
 >
 <Pencil size={12} /> Edit
 </button>
 </div>
 )}

 {err && <div className="mt-2 text-[11px] text-jarvis-red">{err}</div>}
 </div>
 );
}
