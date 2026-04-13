import { useEffect, useState } from "react";
import { Check, Loader2, ExternalLink, RefreshCw, Unlink, Info } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const WEBHOOK_NOTE = "Set this in Pipedrive → Settings → Webhooks";
const PIPEDRIVE_DOCS = "https://pipedrive.readme.io/docs/core-api-concepts-webhooks";

export function PipedriveCard() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [err, setErr] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const checkStatus = async () => {
    try {
      const list = await jarvis.vaultList();
      // vaultList returns an array of key names or an object — handle both
      const keys = Array.isArray(list) ? list : Object.keys(list ?? {});
      setConnected(keys.includes("pipedrive_api_token"));
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { checkStatus(); }, []);

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSaveTest = async () => {
    if (!token.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await jarvis.setProviderKey("pipedrive", token.trim());
      setToken("");
      await checkStatus();
      flash("Token saved.");
    } catch (e) {
      setErr(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setErr(null);
    try {
      await jarvis.crmSync();
      flash("Sync started.");
    } catch (e) {
      setErr(String(e.message ?? e));
    } finally {
      setSyncing(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm("Remove Pipedrive API token?")) return;
    setErr(null);
    try {
      await jarvis.removeProviderKey("pipedrive");
      await checkStatus();
    } catch (e) {
      setErr(String(e.message ?? e));
    }
  };

  return (
    <div className="surface rounded-2xl border border-jarvis-border p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {/* Pipedrive wordmark icon */}
          <div className="w-9 h-9 rounded-xl bg-[#1a1a1a] border border-jarvis-border flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none" aria-hidden="true">
              <circle cx="16" cy="16" r="16" fill="#017737" />
              <path
                d="M13 8h3.5a7 7 0 1 1 0 14H13V8z"
                fill="white"
              />
              <circle cx="16.5" cy="15" r="4" fill="#017737" />
            </svg>
          </div>
          <div>
            <div className="label text-jarvis-primary">CRM</div>
            <h4 className="font-display text-base text-jarvis-ink mt-0.5">Pipedrive</h4>
          </div>
        </div>
        {!loading && (
          connected ? (
            <span className="chip bg-jarvis-green/10 text-jarvis-green shrink-0">
              <Check size={12} /> Connected
            </span>
          ) : (
            <span className="chip bg-jarvis-border/60 text-jarvis-muted shrink-0">
              Not connected
            </span>
          )
        )}
      </div>

      <p className="text-[12px] text-jarvis-body mb-4 leading-relaxed">
        Sync deals, leads, and pipeline data into JARVIS. Requires a Pipedrive API token — no OAuth needed.
      </p>

      {/* Webhook info */}
      <div className="mb-4 rounded-lg border border-jarvis-primary/20 bg-jarvis-primary/5 px-3 py-2.5 flex items-start gap-2">
        <Info size={12} className="text-jarvis-primary mt-0.5 shrink-0" />
        <div className="text-[11px] text-jarvis-body leading-relaxed">
          {WEBHOOK_NOTE}.{" "}
          <a
            href={PIPEDRIVE_DOCS}
            target="_blank"
            rel="noreferrer noopener"
            className="text-jarvis-primary hover:text-jarvis-ink inline-flex items-center gap-1"
          >
            Webhook docs <ExternalLink size={10} />
          </a>
        </div>
      </div>

      {/* Feedback */}
      {err && (
        <div className="mb-3 rounded-lg border border-jarvis-red/30 bg-jarvis-red/5 px-3 py-2 text-[11px] text-jarvis-red">
          {err}
        </div>
      )}
      {successMsg && (
        <div className="mb-3 rounded-lg border border-jarvis-green/30 bg-jarvis-green/5 px-3 py-2 text-[11px] text-jarvis-green flex items-center gap-1.5">
          <Check size={11} /> {successMsg}
        </div>
      )}

      {connected ? (
        /* Connected state */
        <div className="flex gap-2">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex-1 py-2 rounded-lg bg-jarvis-primary/10 text-jarvis-primary hover:bg-jarvis-primary/20 text-[12px] font-semibold transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {syncing
              ? <Loader2 size={12} className="animate-spin" />
              : <RefreshCw size={12} />}
            Sync Now
          </button>
          <button
            onClick={handleUnlink}
            className="py-2 px-4 rounded-lg bg-jarvis-red/10 text-jarvis-red hover:bg-jarvis-red/20 text-[12px] font-semibold transition flex items-center gap-1.5"
          >
            <Unlink size={12} /> Unlink
          </button>
        </div>
      ) : (
        /* Not connected — show token input */
        <div className="space-y-2.5">
          <input
            type="password"
            placeholder="Pipedrive API token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveTest()}
            className="w-full rounded-lg bg-black/40 border border-jarvis-border px-3 py-2 text-xs text-jarvis-ink placeholder:text-jarvis-muted outline-none focus:border-jarvis-primary/50 transition"
          />
          <button
            onClick={handleSaveTest}
            disabled={busy || !token.trim()}
            className="w-full py-2.5 rounded-xl bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25 text-[13px] font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : null}
            Save & Test
          </button>
          <a
            href="https://app.pipedrive.com/settings/api"
            target="_blank"
            rel="noreferrer noopener"
            className="w-full py-2 rounded-lg border border-jarvis-border text-jarvis-muted hover:text-jarvis-primary text-[11px] transition flex items-center justify-center gap-1.5"
          >
            <ExternalLink size={11} /> Get API token from Pipedrive Settings
          </a>
        </div>
      )}
    </div>
  );
}
