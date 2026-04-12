import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Mail, Calendar, AlertTriangle, Apple } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

// Zero-setup macOS Mail + Calendar connector. Uses the accounts the user
// already has configured in System Settings. No OAuth, no API keys.
export function AppleConnectCard() {
 const [status, setStatus] = useState(null);
 const [busy, setBusy] = useState(false);
 const [err, setErr] = useState(null);

 const refresh = useCallback(async () => {
 try {
 const s = await jarvis.appleStatus();
 setStatus(s);
 setErr(null);
 } catch (e) {
 setErr(String(e.message ?? e));
 }
 }, []);

 useEffect(() => { refresh(); }, [refresh]);

 const connect = async () => {
 setBusy(true);
 setErr(null);
 try {
 const s = await jarvis.appleConnect();
 setStatus(s);
 } catch (e) {
 setErr(String(e.message ?? e));
 } finally {
 setBusy(false);
 }
 };

 const platformOk = status?.platform === "darwin";
 const mailOk = status?.mail?.available;
 const calOk = status?.calendar?.available;
 const anyOk = mailOk || calOk;
 const bothOk = mailOk && calOk;

 if (!status) {
 return (
 <div className="rounded-2xl border border-jarvis-border bg-white/[0.02] p-5 text-sm text-jarvis-muted">
 Checking macOS…
 </div>
 );
 }

 if (!platformOk) {
 return null; // hide entirely on non-mac
 }

 return (
 <div className="rounded-2xl border border-jarvis-primary/30 bg-gradient-to-b from-jarvis-primary/[0.05] to-transparent p-5 relative overflow-hidden">
 <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[500px] h-[200px] rounded-full bg-jarvis-primary/10 blur-[80px] pointer-events-none" />

 <div className="relative flex items-start justify-between gap-3 mb-4">
 <div>
 <div className="flex items-center gap-2">
 <span className="label text-jarvis-primary">Recommended · zero setup</span>
 </div>
 <h4 className="font-display text-lg text-jarvis-ink mt-1">
 Connect via macOS Mail & Calendar
 </h4>
 <p className="text-[12px] text-jarvis-body mt-1 max-w-md leading-relaxed">
 Use the accounts already configured in System Settings — Gmail, iCloud,
 Outlook, anything. No OAuth, no API keys, no Google Cloud Console. First
 connect triggers a one-time macOS permission prompt.
 </p>
 </div>
 {bothOk && (
 <span className="chip bg-jarvis-green/10 text-jarvis-green shrink-0">
 <Check size={12} /> Connected
 </span>
 )}
 {!bothOk && anyOk && (
 <span className="chip bg-jarvis-amber/10 text-jarvis-amber shrink-0">Partial</span>
 )}
 </div>

 <div className="relative grid grid-cols-2 gap-2 mb-4">
 <ServiceChip
 Icon={Mail}
 label="Apple Mail"
 linked={mailOk}
 error={status.mail?.error}
 />
 <ServiceChip
 Icon={Calendar}
 label="Apple Calendar"
 linked={calOk}
 error={status.calendar?.error}
 />
 </div>

 {!anyOk ? (
 <button
 onClick={connect}
 disabled={busy}
 className="relative w-full py-2.5 rounded-xl bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25 text-[13px] font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60"
 >
 {busy ? <Loader2 size={14} className="animate-spin" /> : <Apple size={14} />}
 {busy ? "Requesting access…" : "Connect (one click)"}
 </button>
 ) : !bothOk ? (
 <button
 onClick={connect}
 disabled={busy}
 className="relative w-full py-2 rounded-xl bg-jarvis-amber/10 text-jarvis-amber hover:bg-jarvis-amber/20 text-[12px] font-semibold transition flex items-center justify-center gap-2 disabled:opacity-60"
 >
 {busy ? <Loader2 size={12} className="animate-spin" /> : null}
 Retry — grant access to the missing service
 </button>
 ) : (
 <button
 onClick={refresh}
 className="relative w-full py-2 rounded-xl bg-white/5 text-jarvis-body hover:bg-white/10 hover:text-jarvis-ink text-[12px] font-semibold transition"
 >
 Refresh
 </button>
 )}

 {err && (
 <div className="mt-3 text-[11px] text-jarvis-red flex items-start gap-1.5">
 <AlertTriangle size={12} className="mt-0.5 shrink-0" />
 <div>{err}</div>
 </div>
 )}

 {!anyOk && (
 <p className="mt-3 text-[10px] text-jarvis-muted leading-relaxed">
 If the permission prompt doesn't appear, open System Settings → Privacy &
 Security → Automation, and enable Mail and Calendar for JARVIS.
 </p>
 )}
 </div>
 );
}

function ServiceChip({ Icon, label, linked, error }) {
 return (
 <div
 className={[
 "flex items-center gap-2 rounded-lg border px-3 py-2",
 linked
 ? "border-jarvis-green/30 bg-jarvis-green/5 text-jarvis-green"
 : "border-jarvis-border bg-white/[0.02] text-jarvis-muted",
 ].join(" ")}
 title={error ?? undefined}
 >
 <Icon size={14} />
 <span className="text-[12px] font-medium flex-1">{label}</span>
 {linked && <Check size={12} />}
 </div>
 );
}
