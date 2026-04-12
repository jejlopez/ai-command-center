import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Trash2, Eye, EyeOff, AlertTriangle, ExternalLink } from "lucide-react";
import { GoogleSignInButton } from "../GoogleSignInButton.jsx";
import { jarvis } from "../../lib/jarvis.js";

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

function Pill({ status }) {
 if (status === "verified") {
 return (
 <span className="chip bg-jarvis-green/10 text-jarvis-green ">
 <Check size={12} /> Verified
 </span>
 );
 }
 if (status === "linked") {
 return <span className="chip bg-jarvis-amber/10 text-jarvis-amber ">Linked</span>;
 }
 return <span className="chip bg-white/5 text-jarvis-muted">Not linked</span>;
}

function Row({ provider, state, onSave, onTest, onRemove, onRefresh }) {
 const [value, setValue] = useState("");
 const [show, setShow] = useState(false);
 const [busy, setBusy] = useState(false);
 const [err, setErr] = useState(null);

 const status = statusOf(state);

 const save = async () => {
 if (!value.trim()) return;
 setBusy(true); setErr(null);
 try { await onSave(provider.id, value.trim()); setValue(""); }
 catch (e) { setErr(String(e.message ?? e)); }
 finally { setBusy(false); }
 };
 const test = async () => {
 setBusy(true); setErr(null);
 try { await onTest(provider.id); }
 catch (e) { setErr(String(e.message ?? e)); }
 finally { setBusy(false); }
 };
 const remove = async () => {
 setBusy(true); setErr(null);
 try { await onRemove(provider.id); }
 catch (e) { setErr(String(e.message ?? e)); }
 finally { setBusy(false); }
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
 className="mt-1 inline-flex items-center gap-1 text-[11px] text-jarvis-primary hover:text-jarvis-ink transition"
 >
 Get a key <ExternalLink size={10} />
 </a>
 )}
 </div>
 <Pill status={status} />
 </div>

 {provider.id === "google" && (
 <div className="mt-3">
 {state?.authMode === "oauth" ? (
 <div className="text-[11px] text-jarvis-green flex items-center gap-2">
 <Check size={12} /> Signed in with Google
 </div>
 ) : state?.linked ? null : (
 <>
 <GoogleSignInButton onLinked={onRefresh} />
 <div className="mt-2 text-[10px] text-jarvis-muted uppercase tracking-wider text-center">or paste an API key</div>
 </>
 )}
 </div>
 )}

 <div className="mt-3 flex items-center gap-2">
 <div className="flex-1 relative">
 <input
 type={show ? "text" : "password"}
 placeholder={state?.linked ? "•••••••••••• (replace)" : "sk-…"}
 value={value}
 onChange={(e) => setValue(e.target.value)}
 className="w-full rounded-xl bg-black/40 border border-jarvis-border px-3 py-2 pr-9 text-sm text-jarvis-ink placeholder:text-jarvis-muted outline-none focus:border-jarvis-primary/50"
 />
 <button
 type="button"
 onClick={() => setShow((s) => !s)}
 className="absolute inset-y-0 right-2 grid place-items-center text-jarvis-muted hover:text-jarvis-primary"
 >
 {show ? <EyeOff size={14} /> : <Eye size={14} />}
 </button>
 </div>
 <button
 type="button"
 onClick={save}
 disabled={busy || !value.trim()}
 className={[
 "px-3 py-2 rounded-xl text-xs font-semibold transition",
 busy || !value.trim()
 ? "bg-white/5 text-jarvis-muted cursor-not-allowed"
 : "bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25",
 ].join(" ")}
 >Save</button>
 <button
 type="button"
 onClick={test}
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
 <button
 type="button"
 onClick={remove}
 disabled={busy || !state?.linked}
 title="Remove key"
 className={[
 "px-3 py-2 rounded-xl text-xs font-semibold transition",
 busy || !state?.linked
 ? "bg-white/5 text-jarvis-muted cursor-not-allowed"
 : "bg-jarvis-red/10 text-jarvis-red hover:bg-jarvis-red/20",
 ].join(" ")}
 >
 <Trash2 size={14} />
 </button>
 </div>
 {(err || state?.lastError) && (
 <div className="mt-2 text-[11px] text-jarvis-red flex items-center gap-1.5">
 <AlertTriangle size={12} /> {err ?? state.lastError}
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
 const testKey = async (id) => {
 const result = await jarvis.testProvider(id);
 setProviderMap((m) => ({
 ...m,
 [id]: { ...(m[id] ?? { id }), linked: true, available: !!result?.ok, lastError: result?.ok ? undefined : result?.error },
 }));
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
 <div className="mb-4 rounded-xl border border-jarvis-red/30 bg-jarvis-red/5 px-4 py-3 text-xs text-jarvis-red">
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
 onTest={testKey}
 onRemove={removeKey}
 onRefresh={refresh}
 />
 ))}
 </div>
 </div>
 );
}
