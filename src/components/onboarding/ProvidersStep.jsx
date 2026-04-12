import { useCallback, useEffect, useState } from "react";
import { Check, AlertTriangle, Loader2, Eye, EyeOff, ExternalLink } from "lucide-react";
import { StepLayout } from "./StepLayout.jsx";
import { GoogleSignInButton } from "../GoogleSignInButton.jsx";
import { jarvis } from "../../lib/jarvis.js";

const CLOUD_PROVIDERS = [
  {
    id: "anthropic",
    label: "Anthropic",
    hint: "Claude family",
    keyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "GPT family",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "google",
    label: "Google",
    hint: "Gemini family",
    keyUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "groq",
    label: "Groq",
    hint: "Fast inference",
    keyUrl: "https://console.groq.com/keys",
  },
];

function StatusPill({ status }) {
  if (status === "verified") {
    return (
      <span className="chip bg-jarvis-green/10 text-jarvis-green shadow-glow-green">
        <Check size={12} /> Linked + verified
      </span>
    );
  }
  if (status === "linked") {
    return (
      <span className="chip bg-jarvis-amber/10 text-jarvis-amber shadow-glow-amber">
        Linked
      </span>
    );
  }
  return (
    <span className="chip bg-white/5 text-jarvis-muted">Not linked</span>
  );
}

function ProviderRow({ provider, state, onSave, onTest, onRefresh }) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState(null);

  const handleSave = async () => {
    if (!value.trim()) return;
    setBusy(true);
    setLocalError(null);
    try {
      await onSave(provider.id, value.trim());
      setValue("");
    } catch (e) {
      setLocalError(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    setBusy(true);
    setLocalError(null);
    try {
      await onTest(provider.id);
    } catch (e) {
      setLocalError(String(e.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-jarvis-border bg-white/[0.02] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm text-jarvis-ink font-semibold">{provider.label}</div>
          <div className="text-[11px] text-jarvis-muted">{provider.hint}</div>
          {provider.keyUrl && (
            <a
              href={provider.keyUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-jarvis-cyan hover:text-jarvis-ink transition"
            >
              Get a key <ExternalLink size={10} />
            </a>
          )}
        </div>
        <StatusPill status={state?.status ?? "none"} />
      </div>

      {provider.id === "google" && !state?.linked && (
        <div className="mt-3">
          <GoogleSignInButton onLinked={onRefresh} />
          <div className="mt-2 text-[10px] text-jarvis-muted uppercase tracking-wider text-center">or paste an API key</div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 relative">
          <input
            type={show ? "text" : "password"}
            placeholder={state?.linked ? "•••••••••••• (saved)" : "sk-…"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-xl bg-black/40 border border-jarvis-border px-3 py-2 pr-9 text-sm text-jarvis-ink placeholder:text-jarvis-muted outline-none focus:border-jarvis-cyan/50"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-2 grid place-items-center text-jarvis-muted hover:text-jarvis-cyan"
          >
            {show ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={busy || !value.trim()}
          className={[
            "px-3 py-2 rounded-xl text-xs font-semibold transition",
            busy || !value.trim()
              ? "bg-white/5 text-jarvis-muted cursor-not-allowed"
              : "bg-jarvis-cyan/15 text-jarvis-cyan hover:bg-jarvis-cyan/25",
          ].join(" ")}
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleTest}
          disabled={busy || !state?.linked}
          className={[
            "px-3 py-2 rounded-xl text-xs font-semibold transition",
            busy || !state?.linked
              ? "bg-white/5 text-jarvis-muted cursor-not-allowed"
              : "bg-white/5 text-jarvis-body hover:bg-white/10 hover:text-jarvis-ink",
          ].join(" ")}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : "Test"}
        </button>
      </div>
      {(localError || state?.lastError) && (
        <div className="mt-2 text-[11px] text-jarvis-red flex items-center gap-1.5">
          <AlertTriangle size={12} /> {localError ?? state.lastError}
        </div>
      )}
    </div>
  );
}

export function ProvidersStep({ stepIndex, totalSteps, onNext, onBack }) {
  const [providerMap, setProviderMap] = useState({});
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const list = await jarvis.getProviders();
      const map = {};
      for (const p of list ?? []) {
        map[p.id] = {
          linked: !!p.linked,
          available: !!p.available,
          lastError: p.lastError,
          status: p.available ? "verified" : p.linked ? "linked" : "none",
        };
      }
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
        [id]: {
          linked: true,
          available: !!result?.ok,
          lastError: result?.ok ? undefined : result?.error,
          status: result?.ok ? "verified" : "linked",
        },
      }));
    } catch (e) {
      setProviderMap((m) => ({
        ...m,
        [id]: { linked: true, available: false, lastError: String(e.message ?? e), status: "linked" },
      }));
    }
  };

  const testKey = async (id) => {
    const result = await jarvis.testProvider(id);
    setProviderMap((m) => ({
      ...m,
      [id]: {
        ...(m[id] ?? {}),
        linked: true,
        available: !!result?.ok,
        lastError: result?.ok ? undefined : result?.error,
        status: result?.ok ? "verified" : "linked",
      },
    }));
  };

  const linkedCount = Object.values(providerMap).filter((p) => p?.linked).length;
  const canContinue = linkedCount >= 1;

  return (
    <StepLayout
      stepIndex={stepIndex}
      totalSteps={totalSteps}
      title="Connect cloud providers"
      description="Link at least one cloud provider. Keys live encrypted in the vault; JARVIS rotates between them based on your budget and privacy rules."
      primaryLabel="Continue"
      onPrimary={onNext}
      primaryDisabled={!canContinue}
      secondaryLabel="Back"
      onSecondary={onBack}
      error={error}
      footNote={linkedCount === 0 ? "Add at least one key to continue" : `${linkedCount} linked`}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {CLOUD_PROVIDERS.map((p) => (
          <ProviderRow
            key={p.id}
            provider={p}
            state={providerMap[p.id]}
            onSave={saveKey}
            onTest={testKey}
            onRefresh={refresh}
          />
        ))}
      </div>
      {!canContinue && (
        <div className="mt-4 flex items-center gap-2 text-[11px] text-jarvis-amber">
          <AlertTriangle size={12} /> JARVIS needs at least one cloud provider to reason.
        </div>
      )}
    </StepLayout>
  );
}
