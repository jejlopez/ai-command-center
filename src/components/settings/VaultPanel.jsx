import { useCallback, useEffect, useState } from "react";
import { Lock, Unlock, ShieldAlert, Eye, EyeOff, RefreshCw } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

export function VaultPanel() {
  const [locked, setLocked] = useState(null);
  const [keys, setKeys] = useState([]);
  const [revealed, setRevealed] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [confirmPanic, setConfirmPanic] = useState(false);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const h = await jarvis.health();
      setLocked(h?.vaultLocked ?? true);
      if (h?.vaultLocked === false) {
        try {
          const res = await jarvis.vaultList();
          setKeys(res?.keys ?? []);
        } catch (e) {
          setKeys([]);
          setError(String(e.message ?? e));
        }
      } else {
        setKeys([]);
      }
    } catch (e) {
      setError(String(e.message ?? e));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const unlock = async () => {
    setBusy(true); setError(null);
    try { await jarvis.vaultUnlock(); await refresh(); }
    catch (e) { setError(String(e.message ?? e)); }
    finally { setBusy(false); }
  };
  const lock = async () => {
    setBusy(true); setError(null);
    try { await jarvis.vaultLock(); setRevealed(new Set()); await refresh(); }
    catch (e) { setError(String(e.message ?? e)); }
    finally { setBusy(false); }
  };
  const panic = async () => {
    setConfirmPanic(false);
    setBusy(true); setError(null);
    try { await jarvis.panic("Manual panic from Settings"); setRevealed(new Set()); await refresh(); }
    catch (e) { setError(String(e.message ?? e)); }
    finally { setBusy(false); }
  };

  const toggleReveal = (k) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const isUnlocked = locked === false;

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="label">Vault</div>
          <h3 className="font-display text-2xl text-jarvis-ink mt-1">Credential safe</h3>
          <p className="text-jarvis-body text-sm mt-1">
            Every secret lives in the macOS Keychain under <code className="text-jarvis-cyan">jarvisd.vault</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="px-3 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-jarvis-body hover:text-jarvis-ink flex items-center gap-1.5"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-jarvis-red/30 bg-jarvis-red/5 px-4 py-3 text-xs text-jarvis-red">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-jarvis-border bg-white/[0.02] p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {isUnlocked ? (
            <div className="w-10 h-10 rounded-full bg-jarvis-green/15 shadow-glow-green grid place-items-center">
              <Unlock size={18} className="text-jarvis-green" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-jarvis-amber/15 shadow-glow-amber grid place-items-center">
              <Lock size={18} className="text-jarvis-amber" />
            </div>
          )}
          <div>
            <div className="text-sm text-jarvis-ink font-semibold">
              Status:{" "}
              <span className={isUnlocked ? "text-jarvis-green" : "text-jarvis-amber"}>
                {locked === null ? "Checking…" : isUnlocked ? "Unlocked" : "Locked"}
              </span>
            </div>
            <div className="text-[11px] text-jarvis-muted mt-0.5">
              {isUnlocked ? "JARVIS can reach your credentials." : "Unlock to reach providers."}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isUnlocked ? (
            <button
              type="button"
              onClick={lock}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 text-jarvis-body hover:bg-white/10 hover:text-jarvis-ink transition"
            >
              Lock now
            </button>
          ) : (
            <button
              type="button"
              onClick={unlock}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-jarvis-cyan/15 text-jarvis-cyan hover:bg-jarvis-cyan/25 shadow-glow-cyan transition"
            >
              Unlock vault
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmPanic(true)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-jarvis-red/15 text-jarvis-red hover:bg-jarvis-red/25 flex items-center gap-1.5 transition"
          >
            <ShieldAlert size={14} /> Panic lock
          </button>
        </div>
      </div>

      {confirmPanic && (
        <div className="mt-3 rounded-2xl border border-jarvis-red/30 bg-jarvis-red/5 p-4">
          <div className="text-sm text-jarvis-ink font-semibold">Panic lock the vault?</div>
          <div className="text-xs text-jarvis-body mt-1">
            JARVIS will immediately drop all in-memory credentials. In-flight calls will fail.
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={panic}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-jarvis-red/20 text-jarvis-red hover:bg-jarvis-red/30 transition"
            >
              Yes, panic lock
            </button>
            <button
              type="button"
              onClick={() => setConfirmPanic(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 text-jarvis-body hover:bg-white/10 hover:text-jarvis-ink transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="mt-6">
        <div className="label mb-2">Stored keys</div>
        {!isUnlocked && (
          <div className="text-[11px] text-jarvis-muted">Unlock the vault to list stored keys.</div>
        )}
        {isUnlocked && keys.length === 0 && (
          <div className="text-[11px] text-jarvis-muted">No keys stored yet.</div>
        )}
        {isUnlocked && keys.length > 0 && (
          <ul className="space-y-1.5">
            {keys.map((k) => {
              const shown = revealed.has(k);
              return (
                <li
                  key={k}
                  className="flex items-center justify-between gap-3 rounded-xl border border-jarvis-border bg-white/[0.02] px-3 py-2"
                >
                  <span className="text-xs font-mono text-jarvis-body truncate">
                    {shown ? k : k.replace(/(.{3}).*(.{3})/, "$1•••••$2")}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleReveal(k)}
                    className="text-jarvis-muted hover:text-jarvis-cyan"
                  >
                    {shown ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
