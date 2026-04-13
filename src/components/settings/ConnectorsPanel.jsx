import { useCallback, useEffect, useState } from "react";
import { Mail, Calendar, HardDrive, ChevronDown, ChevronRight, Info } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";
import { ConnectorCard } from "./ConnectorCard.jsx";
import { UnifiedGoogleCard } from "./UnifiedGoogleCard.jsx";
import { AppleConnectCard } from "./AppleConnectCard.jsx";
import { PipedriveCard } from "./PipedriveCard.jsx";

const CONNECTORS = [
 { id: "gmail", title: "Gmail", Icon: Mail },
 { id: "gcal", title: "Google Calendar", Icon: Calendar },
 { id: "drive", title: "Google Drive", Icon: HardDrive },
];

export function ConnectorsPanel() {
 const [status, setStatus] = useState(null);
 const [error, setError] = useState(null);
 const [advancedOpen, setAdvancedOpen] = useState(false);

 const refresh = useCallback(async () => {
 try {
 const s = await jarvis.getConnectors();
 setStatus(s ?? {});
 setError(null);
 } catch (e) {
 setError(String(e.message ?? e));
 }
 }, []);

 useEffect(() => { refresh(); }, [refresh]);

 return (
 <div>
 <div className="mb-5">
 <div className="label">Connectors</div>
 <h3 className="font-display text-2xl text-jarvis-ink mt-1">
 Mail & Calendar
 </h3>
 <p className="text-jarvis-body text-sm mt-1">
 Let JARVIS read your inbox and today's schedule. Two paths: native macOS
 (zero setup) or Google OAuth (cross-device).
 </p>
 </div>

 <div className="mb-4 rounded-xl border border-jarvis-primary/25 bg-jarvis-primary/5 px-3 py-2.5 text-[11px] text-jarvis-body flex items-start gap-2">
 <Info size={13} className="text-jarvis-primary mt-0.5 shrink-0" />
 <div>
 This is separate from the <strong className="text-jarvis-ink">Providers → Google</strong> panel.
 Providers = which AI models JARVIS thinks with (Gemini API key). Connectors =
 which data JARVIS can read (your email, calendar, files via OAuth).
 </div>
 </div>

 {error && (
 <div className="mb-4 rounded-xl border border-jarvis-red/30 bg-jarvis-red/5 px-4 py-3 text-xs text-jarvis-red">
 {error}
 </div>
 )}

 {/* Easy path first */}
 <AppleConnectCard />

 <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-jarvis-muted">
 <div className="flex-1 h-px bg-jarvis-border" />
 or use Google OAuth
 <div className="flex-1 h-px bg-jarvis-border" />
 </div>

 <UnifiedGoogleCard status={status} onLinked={refresh} />

 <div className="mt-6">
 <button
 onClick={() => setAdvancedOpen((v) => !v)}
 className="flex items-center gap-1.5 text-[11px] text-jarvis-muted hover:text-jarvis-primary"
 >
 {advancedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
 Advanced: per-service Google OAuth clients
 </button>
 {advancedOpen && (
 <div className="mt-3">
 <p className="text-[11px] text-jarvis-muted mb-3">
 Use separate OAuth clients per service — only needed if you want different
 Google accounts for Gmail / Calendar / Drive, or different scopes.
 </p>
 <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
 {CONNECTORS.map((c) => (
 <ConnectorCard
 key={c.id}
 id={c.id}
 title={c.title}
 Icon={c.Icon}
 state={status?.[c.id]}
 onRefresh={refresh}
 />
 ))}
 </div>
 </div>
 )}
 </div>

 <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-jarvis-muted">
  <div className="flex-1 h-px bg-jarvis-border" />
  CRM
  <div className="flex-1 h-px bg-jarvis-border" />
 </div>

 <PipedriveCard />
 </div>
 );
}
