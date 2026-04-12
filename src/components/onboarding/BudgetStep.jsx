import { useCallback, useEffect, useState } from "react";
import { DollarSign } from "lucide-react";
import { StepLayout } from "./StepLayout.jsx";
import { jarvis } from "../../lib/jarvis.js";

const PRESETS = [5, 10, 20, 50, 100];

export function BudgetStep({ stepIndex, totalSteps, onNext, onBack }) {
 const [value, setValue] = useState(10);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState(null);

 const load = useCallback(async () => {
 try {
 const cfg = await jarvis.getConfig();
 if (typeof cfg?.dailyBudgetUsd === "number") setValue(cfg.dailyBudgetUsd);
 } catch (e) {
 setError(String(e.message ?? e));
 }
 }, []);

 useEffect(() => { load(); }, [load]);

 const save = async () => {
 setBusy(true);
 setError(null);
 try {
 await jarvis.setConfig({ dailyBudgetUsd: Number(value) || 0 });
 onNext();
 } catch (e) {
 setError(String(e.message ?? e));
 } finally {
 setBusy(false);
 }
 };

 return (
 <StepLayout
 stepIndex={stepIndex}
 totalSteps={totalSteps}
 title="Daily budget ceiling"
 description="Set the maximum JARVIS can spend on cloud inference in a single day. JARVIS will warn you before crossing the line and stop before overspending."
 primaryLabel="Save & continue"
 onPrimary={save}
 primaryLoading={busy}
 secondaryLabel="Back"
 onSecondary={onBack}
 error={error}
 >
 <div className="space-y-5 max-w-md">
 <div className="relative">
 <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-jarvis-muted" />
 <input
 type="number"
 min="0"
 step="0.5"
 value={value}
 onChange={(e) => setValue(e.target.value)}
 className="w-full rounded-xl bg-black/40 border border-jarvis-border pl-9 pr-4 py-3 text-2xl font-display text-jarvis-ink outline-none focus:border-jarvis-primary/50"
 />
 <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-[0.18em] text-jarvis-muted">
 USD / day
 </div>
 </div>

 <div className="flex flex-wrap gap-2">
 {PRESETS.map((p) => {
 const active = Number(value) === p;
 return (
 <button
 type="button"
 key={p}
 onClick={() => setValue(p)}
 className={[
 "px-3 py-1.5 rounded-full text-xs font-semibold transition",
 active
 ? "bg-jarvis-primary/15 text-jarvis-primary"
 : "bg-white/5 text-jarvis-body hover:bg-white/10 hover:text-jarvis-ink",
 ].join(" ")}
 >
 ${p}
 </button>
 );
 })}
 </div>

 <div className="text-[11px] text-jarvis-muted leading-relaxed">
 Tip: start conservative. You can raise or lower this any time in Settings → Budget.
 </div>
 </div>
 </StepLayout>
 );
}
