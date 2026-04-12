import { useState } from "react";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { StepLayout } from "./StepLayout.jsx";
import { jarvis } from "../../lib/jarvis.js";

export function DoneStep({ stepIndex, totalSteps, steps, onComplete, onBack }) {
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState(null);

 const enter = async () => {
 setBusy(true);
 setError(null);
 try {
 await jarvis.completeOnboarding();
 onComplete();
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
 title="You're ready"
 description="JARVIS is calibrated to your budget, privacy, and providers. Review below, then step inside."
 primaryLabel="Enter JARVIS"
 onPrimary={enter}
 primaryLoading={busy}
 secondaryLabel="Back"
 onSecondary={onBack}
 error={error}
 >
 <div className="rounded-2xl border border-jarvis-border bg-white/[0.02] p-5">
 <div className="label mb-3 flex items-center gap-1.5">
 <Sparkles size={12} className="text-jarvis-primary" /> Configured
 </div>
 <ul className="space-y-2.5">
 {(steps ?? []).map((s) => (
 <li key={s.id} className="flex items-center gap-2.5 text-sm">
 {s.done ? (
 <CheckCircle2 size={16} className="text-jarvis-green" />
 ) : (
 <Circle size={16} className="text-jarvis-muted" />
 )}
 <span className={s.done ? "text-jarvis-ink" : "text-jarvis-body"}>
 {s.title}
 </span>
 {!s.required && (
 <span className="text-[10px] uppercase tracking-[0.18em] text-jarvis-muted">optional</span>
 )}
 </li>
 ))}
 </ul>
 </div>
 </StepLayout>
 );
}
