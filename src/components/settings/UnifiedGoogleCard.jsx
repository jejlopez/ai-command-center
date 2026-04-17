import { useEffect, useRef, useState } from "react";
import { Check, Loader2, ExternalLink, ChevronDown, ChevronRight, Copy, Mail, Calendar, HardDrive } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const REDIRECT_URI = "http://127.0.0.1:8787/connectors/google/unified/callback";

// Renders one big "Link all Google data with one sign-in" card. Stores a
// single client_id/secret in the vault and mirrors the resulting refresh
// token into gmail/gcal/drive slots so all three adapters light up at once.
export function UnifiedGoogleCard({ status, onLinked }) {
 const [open, setOpen] = useState(false);
 const [clientId, setClientId] = useState("");
 const [clientSecret, setClientSecret] = useState("");
 const [credsInVault, setCredsInVault] = useState(false);
 const [busy, setBusy] = useState(false);
 const [polling, setPolling] = useState(false);
 const [err, setErr] = useState(null);
 const [copied, setCopied] = useState(false);
 const pollTimer = useRef(null);

 const allLinked =
 status?.gmail?.linked && status?.gcal?.linked && status?.drive?.linked;
 const anyLinked =
 status?.gmail?.linked || status?.gcal?.linked || status?.drive?.linked;

 // Check if creds already exist in vault
 useEffect(() => {
   jarvis.googleUnifiedStatus?.().then(s => {
     if (s?.credsSet) setCredsInVault(true);
   }).catch(() => {});
 }, []);

 useEffect(() => () => {
 if (pollTimer.current) clearInterval(pollTimer.current);
 }, []);

 const startPolling = () => {
 setPolling(true);
 const start = Date.now();
 pollTimer.current = setInterval(async () => {
 try {
 await onLinked?.();
 } catch {}
 if (Date.now() - start > 5 * 60 * 1000) {
 clearInterval(pollTimer.current);
 pollTimer.current = null;
 setPolling(false);
 setErr("Timed out waiting for Google sign-in. Try again.");
 }
 }, 2000);
 };

 // Stop polling when all three are linked.
 useEffect(() => {
 if (allLinked && pollTimer.current) {
 clearInterval(pollTimer.current);
 pollTimer.current = null;
 setPolling(false);
 setOpen(false);
 }
 }, [allLinked]);

 const handleSubmit = async () => {
 if (!clientId.trim() || !clientSecret.trim()) return;
 setBusy(true);
 setErr(null);
 try {
 const { authUrl } = await jarvis.googleUnifiedSetCreds({
 client_id: clientId.trim(),
 client_secret: clientSecret.trim(),
 });
 window.open(authUrl, "_blank", "noreferrer,noopener");
 startPolling();
 } catch (e) {
 setErr(String(e.message ?? e));
 } finally {
 setBusy(false);
 }
 };

 // Quick re-auth using creds already in vault
 const handleQuickAuth = async () => {
 setBusy(true);
 setErr(null);
 try {
 window.open("http://127.0.0.1:8787/connectors/google/unified/start", "_blank", "noreferrer,noopener");
 startPolling();
 } catch (e) {
 setErr(String(e.message ?? e));
 } finally {
 setBusy(false);
 }
 };

 const unlinkAll = async () => {
 if (!confirm("Unlink Gmail, Calendar, and Drive?")) return;
 try {
 await jarvis.googleUnifiedUnlink();
 await onLinked?.();
 } catch (e) {
 setErr(String(e.message ?? e));
 }
 };

 const copyRedirect = async () => {
 try {
 await navigator.clipboard.writeText(REDIRECT_URI);
 setCopied(true);
 setTimeout(() => setCopied(false), 1500);
 } catch {}
 };

 return (
 <div className="rounded-2xl border border-jarvis-primary/25 bg-gradient-to-b from-jarvis-primary/[0.04] to-transparent p-5 relative overflow-hidden">
 <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[420px] h-[180px] rounded-full bg-jarvis-primary/10 blur-[80px] pointer-events-none" />

 <div className="relative flex items-start justify-between gap-3 mb-4">
 <div>
 <div className="label text-jarvis-primary">One-click setup</div>
 <h4 className="font-display text-lg text-jarvis-ink mt-1">
 Link Gmail, Calendar, and Drive together
 </h4>
 <p className="text-[12px] text-jarvis-body mt-1 max-w-md leading-relaxed">
 One sign-in links all three data connectors at once. JARVIS uses them to
 read your inbox, today's calendar, and relevant drive files.
 </p>
 </div>
 {allLinked && (
 <span className="chip bg-jarvis-green/10 text-jarvis-green shrink-0">
 <Check size={12} /> All linked
 </span>
 )}
 {!allLinked && anyLinked && (
 <span className="chip bg-jarvis-amber/10 text-jarvis-amber shrink-0">
 Partial
 </span>
 )}
 </div>

 {/* Status grid */}
 <div className="relative grid grid-cols-3 gap-2 mb-4">
 <ServiceChip Icon={Mail} label="Gmail" linked={status?.gmail?.linked} />
 <ServiceChip Icon={Calendar} label="Calendar" linked={status?.gcal?.linked} />
 <ServiceChip Icon={HardDrive} label="Drive" linked={status?.drive?.linked} />
 </div>

 {allLinked ? (
 <button
 onClick={unlinkAll}
 className="relative w-full py-2 rounded-lg bg-jarvis-red/10 text-jarvis-red hover:bg-jarvis-red/20 text-[12px] font-semibold transition"
 >
 Unlink all Google services
 </button>
 ) : credsInVault && !open ? (
 /* Creds already in vault — one-click re-auth */
 <div className="relative space-y-2">
 <button
 onClick={handleQuickAuth}
 disabled={busy || polling}
 className="w-full py-2.5 rounded-xl bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25 text-[13px] font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
 >
 {busy || polling ? <Loader2 size={13} className="animate-spin" /> : (
 <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
 <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.5-5.9 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"/>
 <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13a12 12 0 0 1 7.9 3L38 10A20 20 0 0 0 6.3 14.7z"/>
 <path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
 <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C41 34.5 44 29.7 44 24c0-1.2-.1-2.4-.4-3.5z"/>
 </svg>
 )}
 {polling ? "Waiting for Google sign-in…" : busy ? "Opening…" : "Sign in with Google"}
 </button>
 <button
 onClick={() => { setCredsInVault(false); setOpen(true); }}
 className="w-full text-[10px] text-jarvis-muted hover:text-jarvis-body"
 >
 Enter different credentials
 </button>
 {err && <div className="text-[11px] text-jarvis-red">{err}</div>}
 </div>
 ) : !open ? (
 <button
 onClick={() => setOpen(true)}
 className="relative w-full py-2.5 rounded-xl bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25 text-[13px] font-semibold transition flex items-center justify-center gap-2"
 >
 <svg width="14" height="14" viewBox="0 0 48 48" aria-hidden="true">
 <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.5-5.9 8-11.3 8a12 12 0 1 1 7.9-21l5.7-5.7A20 20 0 1 0 44 24c0-1.2-.1-2.4-.4-3.5z"/>
 <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13a12 12 0 0 1 7.9 3L38 10A20 20 0 0 0 6.3 14.7z"/>
 <path fill="#4CAF50" d="M24 44a20 20 0 0 0 13.4-5.2l-6.2-5.2A12 12 0 0 1 12.7 28l-6.5 5A20 20 0 0 0 24 44z"/>
 <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C41 34.5 44 29.7 44 24c0-1.2-.1-2.4-.4-3.5z"/>
 </svg>
 Sign in with Google
 </button>
 ) : (
 <div className="relative space-y-3">
 <div className="rounded-lg border border-jarvis-amber/25 bg-jarvis-amber/5 p-3 text-[11px] text-jarvis-body leading-relaxed">
 JARVIS is local-first, so Google OAuth needs <em>your</em> Google Cloud OAuth
 client (one-time 2-minute setup). After this, every future sign-in is
 actually one-click.
 </div>

 <a
 href="https://console.cloud.google.com/apis/credentials"
 target="_blank"
 rel="noreferrer noopener"
 className="w-full py-2 px-3 rounded-lg bg-jarvis-primary/10 text-jarvis-primary hover:bg-jarvis-primary/20 text-[12px] font-semibold transition flex items-center justify-center gap-2"
 >
 <ExternalLink size={12} /> Open Google Cloud Console → Credentials
 </a>

 <div className="flex items-center gap-2 text-[10px] text-jarvis-muted bg-black/40 rounded-lg px-3 py-2">
 <span className="shrink-0">Redirect URI:</span>
 <code className="text-jarvis-primary truncate flex-1">{REDIRECT_URI}</code>
 <button
 onClick={copyRedirect}
 title="Copy"
 className="text-jarvis-muted hover:text-jarvis-primary shrink-0"
 >
 {copied ? <Check size={12} /> : <Copy size={12} />}
 </button>
 </div>

 <div className="pt-1 border-t border-jarvis-border" />

 <input
 type="password"
 placeholder="client_id (from Google Cloud)"
 value={clientId}
 onChange={(e) => setClientId(e.target.value)}
 className="w-full rounded-lg bg-black/40 border border-jarvis-border px-3 py-2 text-xs text-jarvis-ink placeholder:text-jarvis-muted outline-none focus:border-jarvis-primary/50"
 />
 <input
 type="password"
 placeholder="client_secret (from Google Cloud)"
 value={clientSecret}
 onChange={(e) => setClientSecret(e.target.value)}
 className="w-full rounded-lg bg-black/40 border border-jarvis-border px-3 py-2 text-xs text-jarvis-ink placeholder:text-jarvis-muted outline-none focus:border-jarvis-primary/50"
 />

 <button
 onClick={handleSubmit}
 disabled={busy || polling || !clientId.trim() || !clientSecret.trim()}
 className="w-full py-2.5 px-3 rounded-xl bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25 text-[13px] font-semibold transition flex items-center justify-center gap-2 disabled:opacity-50"
 >
 {busy || polling ? <Loader2 size={13} className="animate-spin" /> : null}
 {polling
 ? "Waiting for Google sign-in…"
 : busy
 ? "Opening…"
 : "Save & Open Google sign-in"}
 </button>

 <button
 onClick={() => setOpen(false)}
 className="w-full text-[11px] text-jarvis-muted hover:text-jarvis-body"
 >
 Cancel
 </button>

 {err && <div className="text-[11px] text-jarvis-red">{err}</div>}

 <HelpExpander />
 </div>
 )}
 </div>
 );
}

function ServiceChip({ Icon, label, linked }) {
 return (
 <div
 className={[
 "flex items-center gap-2 rounded-lg border px-3 py-2",
 linked
 ? "border-jarvis-green/30 bg-jarvis-green/5 text-jarvis-green"
 : "border-jarvis-border bg-white/[0.02] text-jarvis-muted",
 ].join(" ")}
 >
 <Icon size={14} />
 <span className="text-[12px] font-medium flex-1">{label}</span>
 {linked && <Check size={12} />}
 </div>
 );
}

function HelpExpander() {
 const [open, setOpen] = useState(true);
 return (
 <div>
 <button
 onClick={() => setOpen((v) => !v)}
 className="text-[11px] text-jarvis-muted hover:text-jarvis-primary flex items-center gap-1"
 >
 {open ? <ChevronDown size={11} /> : <ChevronRight size={11} />} Step-by-step setup
 </button>
 {open && (
 <ol className="mt-2 text-[11px] text-jarvis-body list-decimal pl-5 space-y-1.5">
 <li>
 Open{" "}
 <a
 href="https://console.cloud.google.com/apis/credentials/consent"
 target="_blank"
 rel="noreferrer noopener"
 className="text-jarvis-primary hover:text-jarvis-ink inline-flex items-center gap-1"
 >
 OAuth consent screen <ExternalLink size={10} />
 </a>{" "}
 → External → fill basics → Save.
 </li>
 <li>
 Then{" "}
 <a
 href="https://console.cloud.google.com/apis/credentials"
 target="_blank"
 rel="noreferrer noopener"
 className="text-jarvis-primary hover:text-jarvis-ink inline-flex items-center gap-1"
 >
 Credentials <ExternalLink size={10} />
 </a>{" "}
 → Create credentials → OAuth client ID → <strong>Web application</strong>.
 </li>
 <li>Add the redirect URI above to "Authorized redirect URIs".</li>
 <li>
 Enable these APIs for your project:{" "}
 <a
 href="https://console.cloud.google.com/apis/library/gmail.googleapis.com"
 target="_blank"
 rel="noreferrer noopener"
 className="text-jarvis-primary hover:text-jarvis-ink inline-flex items-center gap-1"
 >
 Gmail <ExternalLink size={10} />
 </a>
 ,{" "}
 <a
 href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
 target="_blank"
 rel="noreferrer noopener"
 className="text-jarvis-primary hover:text-jarvis-ink inline-flex items-center gap-1"
 >
 Calendar <ExternalLink size={10} />
 </a>
 ,{" "}
 <a
 href="https://console.cloud.google.com/apis/library/drive.googleapis.com"
 target="_blank"
 rel="noreferrer noopener"
 className="text-jarvis-primary hover:text-jarvis-ink inline-flex items-center gap-1"
 >
 Drive <ExternalLink size={10} />
 </a>
 .
 </li>
 <li>Copy client_id and client_secret, paste them above.</li>
 <li>One sign-in and all three are linked.</li>
 </ol>
 )}
 </div>
 );
}
