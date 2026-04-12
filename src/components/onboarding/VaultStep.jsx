import { useCallback, useEffect, useState } from "react";
import { KeyRound, Lock, Unlock } from "lucide-react";
import { StepLayout } from "./StepLayout.jsx";
import { jarvis } from "../../lib/jarvis.js";

export function VaultStep({ stepIndex, totalSteps, onNext }) {
  const [locked, setLocked] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const h = await jarvis.health();
      setLocked(h?.vaultLocked ?? true);
    } catch (e) {
      setError(String(e.message ?? e));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const unlock = async () => {
    setBusy(true);
    setError(null);
    try {
      await jarvis.vaultUnlock();
      await refresh();
    } catch (e) {
      setError(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const isUnlocked = locked === false;

  return (
    <StepLayout
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      title="Unlock the vault"
      description="JARVIS stores every credential in your macOS Keychain. Nothing touches disk in plaintext. Unlock the vault once per session so JARVIS can reach your providers."
      primaryLabel={isUnlocked ? "Continue" : "Unlock vault"}
      onPrimary={isUnlocked ? onNext : unlock}
      primaryLoading={busy}
      error={error}
    >
      <div className="space-y-4">
        <div className="rounded-2xl border border-jarvis-border bg-white/[0.02] p-5 flex items-start gap-4">
          <div className="mt-0.5">
            {isUnlocked ? (
              <div className="w-10 h-10 rounded-full bg-jarvis-green/15 grid place-items-center shadow-glow-green">
                <Unlock size={18} className="text-jarvis-green" />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-jarvis-amber/15 grid place-items-center shadow-glow-amber">
                <Lock size={18} className="text-jarvis-amber" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <div className="text-sm text-jarvis-ink font-semibold">
              Vault status:{" "}
              <span className={isUnlocked ? "text-jarvis-green" : "text-jarvis-amber"}>
                {locked === null ? "Checking…" : isUnlocked ? "Unlocked" : "Locked"}
              </span>
            </div>
            <div className="text-[11px] text-jarvis-body mt-1 leading-relaxed">
              Credentials are stored under the Keychain entry{" "}
              <code className="text-jarvis-cyan">jarvisd.vault</code>. macOS will prompt for your login password the first time.
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 text-[11px] text-jarvis-muted">
          <KeyRound size={14} className="mt-0.5 text-jarvis-cyan/70" />
          <div>
            If the vault fails to unlock, open Keychain Access and make sure the entry exists and is readable by{" "}
            <code>jarvisd</code>.
          </div>
        </div>
      </div>
    </StepLayout>
  );
}
