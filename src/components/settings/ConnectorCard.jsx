import { useEffect, useRef, useState } from "react";
import {
 Check,
 Loader2,
 Eye,
 EyeOff,
 AlertTriangle,
 ExternalLink,
 ChevronDown,
 ChevronRight,
 Copy,
} from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const BASE = import.meta.env.VITE_JARVIS_URL ?? "http://127.0.0.1:8787";

function statusOf(c) {
 if (!c) return "none";
 if (c.lastError) return "error";
 if (c.linked && c.available) return "verified";
 if (c.linked) return "linked";
 return "none";
}

function Pill({ status, lastError }) {
 if (status === "verified") {
 return (
 <span className="chip bg-jarvis-green/10 text-jarvis-green">
 <Check size={12} /> Linked + verified
 </span>
 );
 }
 if (status === "linked") {
 return <span className="chip bg-jarvis-amber/10 text-jarvis-amber">Linked</span>;
 }
 if (status === "error") {
 return (
 <span
 className="chip bg-jarvis-red/10 text-jarvis-red"
 title={lastError || "Error"}
 >
 <AlertTriangle size={12} /> Error
 </span>
 );
 }
 return <span className="chip bg-white/5 text-jarvis-muted">Not linked</span>;
}

export function ConnectorCard({ id, title, Icon, state, onRefresh }) {
 const [clientId, setClientId] = useState("");
 const [clientSecret, setClientSecret] = useState("");
 const [showSecret, setShowSecret] = useState(false);
 const [busy, setBusy] = useState(false);
 const [err, setErr] = useState(null);
 const [polling, setPolling] = useState(false);
 const [helpOpen, setHelpOpen] = useState(false);
 const pollRef = useRef(null);

 const redirectUri = `${BASE}/connectors/${id}/callback`;
 const status = statusOf(state);

 useEffect(() => {
 return () => {
 if (pollRef.current) clearInterval(pollRef.current);
 };
 }, []);

 // Stop polling once linked.
 useEffect(() => {
 if (state?.linked && pollRef.current) {
 clearInterval(pollRef.current);
 pollRef.current = null;
 setPolling(false);
 }
 }, [state?.linked]);

 const startPolling = () => {
 if (pollRef.current) clearInterval(pollRef.current);
 setPolling(true);
 const start = Date.now();
 pollRef.current = setInterval(async () => {
 if (Date.now() - start > 5 * 60 * 1000) {
 clearInterval(pollRef.current);
 pollRef.current = null;
 setPolling(false);
 return;
 }
 try { await onRefresh?.(); } catch {}
 }, 2000);
 };

 const saveAndOpen = async () => {
 if (!clientId.trim() || !clientSecret.trim()) return;
 setBusy(true); setErr(null);
 try {
 const res = await jarvis.setConnectorCreds(id, {
 client_id: clientId.trim(),
 client_secret: clientSecret.trim(),
 });
 const authUrl = res?.authUrl ?? jarvis.startConnector(id);
 window.open(authUrl, "_blank", "noopener,noreferrer");
 setClientSecret("");
 startPolling();
 await onRefresh?.();
 } catch (e) {
 setErr(String(e.message ?? e));
 } finally {
 setBusy(false);
 }
 };

 const test = async () => {
 setBusy(true); setErr(null);
 try {
 const r = await jarvis.testConnector(id);
 if (r && r.ok === false && r.error) setErr(r.error);
 await onRefresh?.();
 } catch (e) {
 setErr(String(e.message ?? e));
 } finally {
 setBusy(false);
 }
 };

 const unlink = async () => {
 if (!window.confirm(`Unlink ${title}?`)) return;
 setBusy(true); setErr(null);
 try {
 await jarvis.unlinkConnector(id);
 await onRefresh?.();
 } catch (e) {
 setErr(String(e.message ?? e));
 } finally {
 setBusy(false);
 }
 };

 const copyRedirect = async () => {
 try { await navigator.clipboard?.writeText(redirectUri); } catch {}
 };

 return (
 <div className="rounded-2xl border border-jarvis-border bg-white/[0.02] p-4 flex flex-col gap-3">
 <div className="flex items-center justify-between gap-3">
 <div className="flex items-center gap-2.5">
 <div className="grid place-items-center w-8 h-8 rounded-xl bg-jarvis-primary/10 text-jarvis-primary">
 <Icon size={16} strokeWidth={1.8} />
 </div>
 <div>
 <div className="text-sm text-jarvis-ink font-semibold">{title}</div>
 {state?.account && (
 <div className="text-[11px] text-jarvis-muted">{state.account}</div>
 )}
 </div>
 </div>
 <Pill status={status} lastError={state?.lastError} />
 </div>

 {!state?.linked ? (
 <div className="flex flex-col gap-2">
 <div>
 <div className="label mb-1">Client ID</div>
 <input
 type="password"
 placeholder="xxxx.apps.googleusercontent.com"
 value={clientId}
 onChange={(e) => setClientId(e.target.value)}
 className="w-full rounded-xl bg-black/40 border border-jarvis-border px-3 py-2 text-sm text-jarvis-ink placeholder:text-jarvis-muted outline-none focus:border-jarvis-primary/50"
 />
 </div>
 <div>
 <div className="label mb-1">Client secret</div>
 <div className="relative">
 <input
 type={showSecret ? "text" : "password"}
 placeholder="GOCSPX-…"
 value={clientSecret}
 onChange={(e) => setClientSecret(e.target.value)}
 className="w-full rounded-xl bg-black/40 border border-jarvis-border px-3 py-2 pr-9 text-sm text-jarvis-ink placeholder:text-jarvis-muted outline-none focus:border-jarvis-primary/50"
 />
 <button
 type="button"
 onClick={() => setShowSecret((s) => !s)}
 className="absolute inset-y-0 right-2 grid place-items-center text-jarvis-muted hover:text-jarvis-primary"
 >
 {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
 </button>
 </div>
 </div>
 <button
 type="button"
 onClick={saveAndOpen}
 disabled={busy || !clientId.trim() || !clientSecret.trim()}
 className={[
 "mt-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition",
 busy || !clientId.trim() || !clientSecret.trim()
 ? "bg-white/5 text-jarvis-muted cursor-not-allowed"
 : "bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25",
 ].join(" ")}
 >
 {busy
 ? <Loader2 size={14} className="animate-spin" />
 : <ExternalLink size={14} />}
 <span>Save & Open OAuth</span>
 </button>
 {polling && (
 <div className="text-[11px] text-jarvis-primary flex items-center gap-1.5">
 <Loader2 size={12} className="animate-spin" /> Waiting for Google to complete linking…
 </div>
 )}
 </div>
 ) : (
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={test}
 disabled={busy}
 className={[
 "flex-1 px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-1.5",
 busy
 ? "bg-white/5 text-jarvis-muted cursor-not-allowed"
 : "bg-white/5 text-jarvis-body hover:bg-white/10 hover:text-jarvis-ink",
 ].join(" ")}
 >
 {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
 <span>Test</span>
 </button>
 <button
 type="button"
 onClick={unlink}
 disabled={busy}
 className={[
 "px-3 py-2 rounded-xl text-xs font-semibold transition",
 busy
 ? "bg-white/5 text-jarvis-muted cursor-not-allowed"
 : "bg-jarvis-red/10 text-jarvis-red hover:bg-jarvis-red/20",
 ].join(" ")}
 >
 Unlink
 </button>
 </div>
 )}

 {(err || state?.lastError) && (
 <div className="text-[11px] text-jarvis-red flex items-start gap-1.5">
 <AlertTriangle size={12} className="mt-0.5 shrink-0" />
 <span>{err ?? state.lastError}</span>
 </div>
 )}

 {!state?.linked && <div className="rounded-xl border border-jarvis-border/60 bg-black/30 px-3 py-2 text-[11px] text-jarvis-muted flex items-center gap-2">
 <span className="shrink-0">Redirect URI:</span>
 <code className="text-jarvis-primary truncate">{redirectUri}</code>
 <button
 type="button"
 onClick={copyRedirect}
 title="Copy"
 className="ml-auto text-jarvis-muted hover:text-jarvis-primary shrink-0"
 >
 <Copy size={12} />
 </button>
 </div>}

 {!state?.linked && <><button
 type="button"
 onClick={() => setHelpOpen((v) => !v)}
 className="flex items-center gap-1 text-[11px] text-jarvis-muted hover:text-jarvis-primary self-start"
 >
 {helpOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />} Setup help
 </button>
 {helpOpen && (
 <ol className="text-[11px] text-jarvis-body list-decimal pl-5 space-y-1">
 <li>
 <a
 href="https://console.cloud.google.com/apis/credentials"
 target="_blank"
 rel="noreferrer noopener"
 className="text-jarvis-primary hover:text-jarvis-ink inline-flex items-center gap-1"
 >
 Open Google Cloud Console → Credentials <ExternalLink size={10} />
 </a>{" "}
 and create an OAuth client (Web app).
 </li>
 <li>Add the redirect URI above to "Authorized redirect URIs".</li>
 <li>
 Enable the{" "}
 <a
 href={
 id === "gmail"
 ? "https://console.cloud.google.com/apis/library/gmail.googleapis.com"
 : id === "gcal"
 ? "https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
 : "https://console.cloud.google.com/apis/library/drive.googleapis.com"
 }
 target="_blank"
 rel="noreferrer noopener"
 className="text-jarvis-primary hover:text-jarvis-ink inline-flex items-center gap-1"
 >
 {id === "gmail" ? "Gmail API" : id === "gcal" ? "Google Calendar API" : "Google Drive API"}{" "}
 <ExternalLink size={10} />
 </a>
 .
 </li>
 <li>Paste the client_id and client_secret here, then click Save & Open OAuth.</li>
 </ol>
 )}</>}
 </div>
 );
}
