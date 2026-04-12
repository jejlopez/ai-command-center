import { useState } from "react";
import { Lock, Loader2, AlertTriangle } from "lucide-react";
import { JarvisHalo } from "./JarvisHalo.jsx";
import { jarvis } from "../lib/jarvis.js";

export function VaultLockedOverlay({ onUnlocked }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const unlock = async () => {
    setBusy(true);
    setErr(null);
    try {
      await jarvis.vaultUnlock();
      await onUnlocked?.();
    } catch (e) {
      setErr(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#05070d]/85 backdrop-blur-xl grid place-items-center">
      <div className="glass max-w-md w-[92%] p-8 text-center relative overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full bg-jarvis-cyan/5 blur-[120px] pointer-events-none" />
        <div className="relative flex flex-col items-center gap-4">
          <JarvisHalo size={64} />
          <div className="flex items-center gap-2 text-jarvis-amber">
            <Lock size={14} />
            <span className="label text-jarvis-amber">Vault locked</span>
          </div>
          <h2 className="text-xl font-semibold text-jarvis-ink">Unlock to continue</h2>
          <p className="text-[13px] text-jarvis-body max-w-sm leading-relaxed">
            JARVIS locks the vault whenever the daemon restarts. Your master key lives in the
            macOS Keychain — unlock below to decrypt stored API keys and OAuth tokens.
          </p>
          <button
            onClick={unlock}
            disabled={busy}
            className="mt-2 px-5 py-2.5 rounded-xl bg-jarvis-cyan/15 text-jarvis-cyan hover:bg-jarvis-cyan/25 shadow-glow-cyan text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            {busy ? "Unlocking…" : "Unlock vault"}
          </button>
          {err && (
            <div className="mt-1 text-[12px] text-jarvis-red flex items-center gap-1.5">
              <AlertTriangle size={12} /> {err}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
