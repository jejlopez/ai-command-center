import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Trash2, AlertTriangle, ExternalLink, Eye, EyeOff } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";
import { UnifiedGoogleCard } from "./UnifiedGoogleCard.jsx";
import { AppleConnectCard } from "./AppleConnectCard.jsx";
import {
  ClaudeSunburst, CodexCloud, OpenAIIcon, GoogleIcon, GroqIcon,
  GmailIcon, CalendarIcon, DriveIcon, AppleIcon,
  PandaDocIcon, PipedriveIcon, ICON_BG,
} from "./BrandIcons.jsx";

// ─── Provider definitions ───────────────────────────────────────────
const AI_MODELS = [
  { id: "anthropic", label: "Claude", hint: "Anthropic · Claude family", Icon: ClaudeSunburst, keyUrl: "https://console.anthropic.com/settings/keys", iconKey: "claude" },
  { id: "openai", label: "Codex", hint: "OpenAI · GPT family", Icon: CodexCloud, keyUrl: "https://platform.openai.com/api-keys", iconKey: "codex", overlay: ">_" },
  { id: "claude-code", label: "Claude Code", hint: "Anthropic · CLI agent", Icon: ClaudeSunburst, keyUrl: "https://console.anthropic.com/settings/keys", iconKey: "claudeCode" },
  { id: "google", label: "Google", hint: "Gemini family", Icon: GoogleIcon, keyUrl: "https://aistudio.google.com/app/apikey", iconKey: "google" },
  { id: "groq", label: "Groq", hint: "Fast inference", Icon: GroqIcon, keyUrl: "https://console.groq.com/keys", iconKey: "groq" },
];

const SALES_TOOLS = [
  { id: "pandadoc", label: "PandaDoc", hint: "Proposals & contracts", Icon: PandaDocIcon, keyUrl: "https://developers.pandadoc.com/reference/api-key", iconKey: "pandadoc" },
  { id: "pipedrive", label: "Pipedrive", hint: "CRM & deal pipeline", Icon: PipedriveIcon, keyUrl: "https://pipedrive.readme.io/docs/how-to-find-the-api-token", iconKey: "pipedrive" },
];

// ─── Status helper ──────────────────────────────────────────────────
function statusOf(p) {
  if (!p) return "none";
  if (p.available) return "verified";
  if (p.linked) return "linked";
  return "none";
}

// ─── Provider Row (API key card) ────────────────────────────────────
function ProviderRow({ provider, state, onSave, onRemove }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [showKey, setShowKey] = useState(false);

  const status = statusOf(state);
  const connected = status === "verified" || status === "linked";
  const selfContainedIcon = ["pandadoc", "pipedrive"].includes(provider.iconKey);

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

  const iconContent = selfContainedIcon ? (
    <div className="w-10 h-10 rounded-xl overflow-hidden shrink-0">
      <provider.Icon size={40} />
    </div>
  ) : (
    <div className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${ICON_BG[provider.iconKey]} relative`}>
      <provider.Icon />
      {provider.overlay && (
        <span className="absolute text-white text-[10px] font-bold font-mono" style={{ textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}>
          {provider.overlay}
        </span>
      )}
    </div>
  );

  if (connected) {
    return (
      <div className="rounded-2xl border border-jarvis-border bg-jarvis-surface p-4">
        <div className="flex items-center gap-3">
          {iconContent}
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
    <div className="rounded-2xl border border-jarvis-border bg-jarvis-surface p-4 opacity-70 hover:opacity-100 transition-opacity">
      <div className="flex items-center gap-3 mb-3">
        {iconContent}
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
        <div className="relative flex-1">
          <input
            type={showKey ? "text" : "password"}
            placeholder="sk-…"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-xl bg-jarvis-ghost border border-jarvis-border px-3 py-2 pr-9 text-sm text-jarvis-ink placeholder:text-jarvis-muted outline-none focus:border-jarvis-primary/50"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-jarvis-muted hover:text-jarvis-body"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
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
      {err && (
        <div className="mt-2 text-[11px] text-jarvis-danger flex items-center gap-1.5">
          <AlertTriangle size={12} /> {err}
        </div>
      )}
    </div>
  );
}

// ─── Section header ─────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="text-[11px] uppercase tracking-[0.12em] text-jarvis-muted">{children}</span>
      <div className="flex-1 h-px bg-jarvis-border" />
    </div>
  );
}

// ─── Main Panel ─────────────────────────────────────────────────────
export function ConnectionsPanel() {
  const [providerMap, setProviderMap] = useState({});
  const [connectorStatus, setConnectorStatus] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [providers, connectors] = await Promise.all([
        jarvis.getProviders(),
        jarvis.getConnectors(),
      ]);
      const map = {};
      for (const p of providers ?? []) map[p.id] = p;
      setProviderMap(map);
      setConnectorStatus(connectors ?? {});
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

  const allProviders = [...AI_MODELS, ...SALES_TOOLS];
  const connectedCount = allProviders.filter((p) => {
    const s = statusOf(providerMap[p.id]);
    return s === "verified" || s === "linked";
  }).length;
  const availableCount = allProviders.length - connectedCount;

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <div className="label">Settings</div>
        <h3 className="font-display text-2xl text-jarvis-ink mt-1">Connections</h3>
        <p className="text-jarvis-body text-sm mt-1">
          Manage all integrations — AI models, data sources, and sales tools.
        </p>
      </div>

      {/* Status bar */}
      <div className="flex gap-4 mb-6 px-4 py-3 rounded-xl bg-jarvis-ghost border border-jarvis-border">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-jarvis-success" />
          <span className="text-xs text-jarvis-body">
            <strong className="text-jarvis-success">{connectedCount}</strong> connected
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-jarvis-muted" />
          <span className="text-xs text-jarvis-muted">{availableCount} available</span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-jarvis-danger/30 bg-jarvis-danger/5 px-4 py-3 text-xs text-jarvis-danger">
          {error}
        </div>
      )}

      {/* AI Models */}
      <div className="mb-7">
        <SectionLabel>AI Models</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {AI_MODELS.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              state={providerMap[p.id]}
              onSave={saveKey}
              onRemove={removeKey}
            />
          ))}
        </div>
      </div>

      {/* Data Sources */}
      <div className="mb-7">
        <SectionLabel>Data Sources</SectionLabel>
        <AppleConnectCard />
        <div className="mt-3">
          <UnifiedGoogleCard status={connectorStatus} onLinked={refresh} />
        </div>
      </div>

      {/* Sales & CRM Tools */}
      <div className="mb-7">
        <SectionLabel>Sales & CRM Tools</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SALES_TOOLS.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              state={providerMap[p.id]}
              onSave={saveKey}
              onRemove={removeKey}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
