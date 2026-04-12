import { useCallback, useEffect, useState } from "react";
import { VaultStep } from "../components/onboarding/VaultStep.jsx";
import { ProvidersStep } from "../components/onboarding/ProvidersStep.jsx";
import { LocalStep } from "../components/onboarding/LocalStep.jsx";
import { PrivacyStep } from "../components/onboarding/PrivacyStep.jsx";
import { BudgetStep } from "../components/onboarding/BudgetStep.jsx";
import { DoneStep } from "../components/onboarding/DoneStep.jsx";
import { jarvis } from "../lib/jarvis.js";

const DEFAULT_STEPS = [
 { id: "vault", title: "Unlock vault", done: false, required: true },
 { id: "providers", title: "Cloud providers", done: false, required: true },
 { id: "local", title: "Local intelligence", done: false, required: false },
 { id: "privacy", title: "Privacy domains", done: false, required: true },
 { id: "budget", title: "Daily budget", done: false, required: true },
];

export default function Onboarding({ onComplete }) {
 const [index, setIndex] = useState(0);
 const [steps, setSteps] = useState(DEFAULT_STEPS);

 const refreshStatus = useCallback(async () => {
 try {
 const s = await jarvis.getOnboarding();
 if (Array.isArray(s?.steps) && s.steps.length) setSteps(s.steps);
 } catch {
 // keep defaults
 }
 }, []);

 useEffect(() => { refreshStatus(); }, [refreshStatus]);

 // 6 screens: vault, providers, local, privacy, budget, done
 const total = 6;
 const next = async () => {
 await refreshStatus();
 setIndex((i) => Math.min(i + 1, total - 1));
 };
 const back = () => setIndex((i) => Math.max(i - 1, 0));

 return (
 <div className="h-full w-full overflow-y-auto text-jarvis-ink relative">
 <div className="absolute inset-0 pointer-events-none">
 <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-jarvis-cyan/40 to-transparent" />
 <div className="absolute inset-0 bg-jarvis-grid opacity-[0.05] [background-size:40px_40px]" />
 </div>
 <div className="relative min-h-full">
 {index === 0 && <VaultStep stepIndex={0} totalSteps={total} onNext={next} />}
 {index === 1 && <ProvidersStep stepIndex={1} totalSteps={total} onNext={next} onBack={back} />}
 {index === 2 && <LocalStep stepIndex={2} totalSteps={total} onNext={next} onBack={back} />}
 {index === 3 && <PrivacyStep stepIndex={3} totalSteps={total} onNext={next} onBack={back} />}
 {index === 4 && <BudgetStep stepIndex={4} totalSteps={total} onNext={next} onBack={back} />}
 {index === 5 && <DoneStep stepIndex={5} totalSteps={total} steps={steps} onComplete={onComplete} onBack={back} />}
 </div>
 </div>
 );
}
