import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Trash2, AlertTriangle, ExternalLink } from "lucide-react";
import { GoogleSignInButton } from "../GoogleSignInButton.jsx";
import { jarvis } from "../../lib/jarvis.js";

const BRAND_ICONS = {
  anthropic: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M13.827 3L21 21h-4.31L9.517 3h4.31zm-7.654 0L12 18.454 8.173 21 3 3h3.173z" fill="currentColor"/>
    </svg>
  ),
  openai: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 0011.5.5a6.04 6.04 0 00-5.753 4.218 5.97 5.97 0 00-3.997 2.9 6.05 6.05 0 00.754 7.09 5.98 5.98 0 00.516 4.911 6.05 6.05 0 006.51 2.9A6.04 6.04 0 0013.5 23.5a6.04 6.04 0 005.753-4.218 5.97 5.97 0 003.997-2.9 6.04 6.04 0 00-.968-6.561zM13.5 21.95a4.49 4.49 0 01-2.885-1.045l.143-.082 4.79-2.765a.78.78 0 00.394-.678v-6.745l2.025 1.17a.07.07 0 01.038.052v5.586a4.504 4.504 0 01-4.505 4.507zM4.155 17.976a4.487 4.487 0 01-.538-3.017l.143.085 4.79 2.766a.78.78 0 00.787 0l5.85-3.377v2.34a.07.07 0 01-.028.06l-4.843 2.797a4.504 4.504 0 01-6.161-1.654zM3.087 8.152a4.49 4.49 0 012.348-1.972V12a.78.78 0 00.392.676l5.85 3.377-2.025 1.169a.07.07 0 01-.066.006l-4.844-2.8A4.504 4.504 0 013.087 8.153zM19.1 11.324l-5.85-3.377 2.025-1.169a.07.07 0 01.066-.006l4.844 2.8a4.503 4.503 0 01-.694 8.108V12a.78.78 0 00-.39-.676zm2.015-3.028l-.143-.085-4.79-2.766a.78.78 0 00-.787 0l-5.85 3.377V6.482a.07.07 0 01.028-.06l4.843-2.796a4.504 4.504 0 016.699 4.67zM9.272 13.294l-2.025-1.17a.07.07 0 01-.038-.051V6.487a4.504 4.504 0 017.39-3.462l-.143.082-4.79 2.766a.78.78 0 00-.394.677v6.744zm1.1-2.372l2.605-1.504 2.606 1.504v3.008l-2.606 1.504-2.605-1.504V10.922z" fill="currentColor"/>
    </svg>
  ),
  google: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  groq: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" fill="currentColor"/>
    </svg>
  ),
};

const CLOUD_PROVIDERS = [
  { id: "anthropic", label: "Anthropic", hint: "Claude family", keyUrl: "https://console.anthropic.com/settings/keys" },
  { id: "openai", label: "OpenAI", hint: "GPT family", keyUrl: "https://platform.openai.com/api-keys" },
  { id: "google", label: "Google", hint: "Gemini family", keyUrl: "https://aistudio.google.com/app/apikey" },
  { id: "groq", label: "Groq", hint: "Fast inference", keyUrl: "https://console.groq.com/keys" },
];

function statusOf(p) {
  if (!p) return "none";
  if (p.available) return "verified";
  if (p.linked) return "linked";
  return "none";
}

function Row({ provider, state, onSave, onRemove, onRefresh }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const status = statusOf(state);
  const connected = status === "verified" || status === "linked";

  const save = async () => {
    if (!value.trim()) return;
    setBusy(true); setErr(null);
    try { await onSave(provider.id, value.trim()); setValue(""); }
    catch (e) { setErr(String(e.message ?? e)); }
    finally { setBusy(false); }
  };

  const remove = async () => {
    setBusy(true); setErr(null);
    try { await onRemove(provider.id); }
    catch (e) { setErr(String(e.message ?? e)); }
    finally { setBusy(false); }
  };

  if (connected) {
    return (
      <div className="rounded-2xl border border-jarvis-border bg-jarvis-surface p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-jarvis-primary/10 grid place-items-center text-jarvis-primary shrink-0">
            {BRAND_ICONS[provider.id]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm text-jarvis-ink font-semibold">{provider.label}</div>
            <div className="text-[11px] text-jarvis-muted">{provider.hint}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="chip bg-jarvis-success/10 text-jarvis-success">
              <Check size={10} /> Connected
            </span>
            <button
              onClick={remove}
              disabled={busy}
              className="p-1.5 rounded-lg text-jarvis-muted hover:text-jarvis-danger hover:bg-jarvis-danger/10 transition"
              title="Disconnect"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        </div>
        {err && (
          <div className="mt-2 text-[11px] text-jarvis-danger flex items-center gap-1.5">
            <AlertTriangle size={12} /> {err}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-jarvis-border bg-jarvis-surface p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-jarvis-ghost grid place-items-center text-jarvis-muted shrink-0">
          {BRAND_ICONS[provider.id]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-jarvis-ink font-semibold">{provider.label}</div>
          <div className="text-[11px] text-jarvis-muted">{provider.hint}</div>
        </div>
        <a
          href={provider.keyUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] text-jarvis-primary hover:text-jarvis-ink flex items-center gap-1 transition shrink-0"
        >
          Get a key <ExternalLink size={10} />
        </a>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="password"
          placeholder="sk-…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 rounded-xl bg-jarvis-ghost border border-jarvis-border px-3 py-2 text-sm text-jarvis-ink placeholder:text-jarvis-muted outline-none focus:border-jarvis-primary/50"
        />
        <button
          onClick={save}
          disabled={busy || !value.trim()}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
            busy || !value.trim()
              ? "bg-jarvis-ghost text-jarvis-muted cursor-not-allowed"
              : "bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25"
          }`}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : "Connect"}
        </button>
      </div>
      {provider.id === "google" && !state?.linked && (
        <div className="mt-3">
          <GoogleSignInButton onLinked={onRefresh} />
        </div>
      )}
      {err && (
        <div className="mt-2 text-[11px] text-jarvis-danger flex items-center gap-1.5">
          <AlertTriangle size={12} /> {err}
        </div>
      )}
    </div>
  );
}

export function ProvidersPanel() {
  const [providerMap, setProviderMap] = useState({});
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const list = await jarvis.getProviders();
      const map = {};
      for (const p of list ?? []) map[p.id] = p;
      setProviderMap(map);
    } catch (e) {
      setError(String(e.message ?? e));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const saveKey = async (id, key) => {
    await jarvis.setProviderKey(id, key);
    try {
      const result = await jarvis.testProvider(id);
      setProviderMap((m) => ({
        ...m,
        [id]: { ...(m[id] ?? { id }), linked: true, available: !!result?.ok, lastError: result?.ok ? undefined : result?.error },
      }));
    } catch (e) {
      setProviderMap((m) => ({
        ...m,
        [id]: { ...(m[id] ?? { id }), linked: true, available: false, lastError: String(e.message ?? e) },
      }));
    }
  };

  const removeKey = async (id) => {
    await jarvis.removeProviderKey(id);
    setProviderMap((m) => ({
      ...m,
      [id]: { ...(m[id] ?? { id }), linked: false, available: false, lastError: undefined },
    }));
  };

  return (
    <div>
      <div className="mb-5">
        <div className="label">Providers</div>
        <h3 className="font-display text-2xl text-jarvis-ink mt-1">AI model providers</h3>
        <p className="text-jarvis-body text-sm mt-1">
          Which brains JARVIS thinks with. Keys live in the macOS Keychain. Remove to fully wipe.
        </p>
      </div>
      <div className="mb-4 rounded-xl border border-jarvis-primary/25 bg-jarvis-primary/5 px-3 py-2.5 text-[11px] text-jarvis-body flex items-start gap-2">
        <AlertTriangle size={13} className="text-jarvis-primary mt-0.5 shrink-0" />
        <div>
          This is separate from <strong className="text-jarvis-ink">Connectors → Google data</strong>.
          Providers = AI models (Gemini API key). Connectors = your inbox/calendar/files (OAuth).
        </div>
      </div>
      {error && (
        <div className="mb-4 rounded-xl border border-jarvis-danger/30 bg-jarvis-danger/5 px-4 py-3 text-xs text-jarvis-danger">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CLOUD_PROVIDERS.map((p) => (
          <Row
            key={p.id}
            provider={p}
            state={providerMap[p.id]}
            onSave={saveKey}
            onRemove={removeKey}
            onRefresh={refresh}
          />
        ))}
      </div>
    </div>
  );
}
