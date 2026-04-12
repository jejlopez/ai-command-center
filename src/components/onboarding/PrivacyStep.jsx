import { useCallback, useEffect, useState } from "react";
import { Wallet, HeartPulse, Briefcase, HouseHeart, ShieldCheck } from "lucide-react";
import { StepLayout } from "./StepLayout.jsx";
import { jarvis } from "../../lib/jarvis.js";

const DOMAINS = [
 { id: "finance", label: "Finance", Icon: Wallet, hint: "Transactions, budgets, net worth" },
 { id: "health", label: "Health", Icon: HeartPulse, hint: "Records, metrics, medications" },
 { id: "work", label: "Work", Icon: Briefcase, hint: "Proprietary work material" },
 { id: "personal", label: "Personal", Icon: HouseHeart, hint: "Family, relationships, journals" },
];

export function PrivacyStep({ stepIndex, totalSteps, onNext, onBack }) {
 const [selected, setSelected] = useState(new Set());
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState(null);

 const load = useCallback(async () => {
 try {
 const cfg = await jarvis.getConfig();
 setSelected(new Set(cfg?.privacyLocalOnly ?? []));
 } catch (e) {
 setError(String(e.message ?? e));
 }
 }, []);

 useEffect(() => { load(); }, [load]);

 const toggle = (id) => {
 setSelected((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 };

 const save = async () => {
 setBusy(true);
 setError(null);
 try {
 await jarvis.setConfig({ privacyLocalOnly: Array.from(selected) });
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
 title="Privacy boundaries"
 description="Choose which domains should never leave your machine. Anything in these domains will route exclusively through local models."
 primaryLabel="Save & continue"
 onPrimary={save}
 primaryLoading={busy}
 secondaryLabel="Back"
 onSecondary={onBack}
 error={error}
 >
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {DOMAINS.map(({ id, label, Icon, hint }) => {
 const on = selected.has(id);
 return (
 <button
 type="button"
 key={id}
 onClick={() => toggle(id)}
 className={[
 "text-left rounded-2xl border p-4 transition relative overflow-hidden",
 on
 ? "border-jarvis-primary/40 bg-jarvis-primary/5"
 : "border-jarvis-border bg-white/[0.02] hover:bg-white/[0.04]",
 ].join(" ")}
 >
 <div className="flex items-start justify-between gap-3">
 <div className="flex items-start gap-3">
 <div className={[
 "w-10 h-10 rounded-xl grid place-items-center shrink-0",
 on ? "bg-jarvis-primary/15 text-jarvis-primary" : "bg-white/5 text-jarvis-body",
 ].join(" ")}>
 <Icon size={18} />
 </div>
 <div>
 <div className="text-sm font-semibold text-jarvis-ink">{label}</div>
 <div className="text-[11px] text-jarvis-muted mt-0.5">{hint}</div>
 </div>
 </div>
 <div className={[
 "shrink-0 w-10 h-6 rounded-full p-[2px] transition",
 on ? "bg-jarvis-primary/70" : "bg-white/10",
 ].join(" ")}>
 <div
 className={[
 "w-[20px] h-[20px] rounded-full bg-jarvis-ink transition-all",
 on ? "translate-x-[16px]" : "translate-x-0",
 ].join(" ")}
 />
 </div>
 </div>
 {on && (
 <div className="mt-3 flex items-center gap-1.5 text-[11px] text-jarvis-primary">
 <ShieldCheck size={12} /> Local only
 </div>
 )}
 </button>
 );
 })}
 </div>
 </StepLayout>
 );
}
