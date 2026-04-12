import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";

const DEFAULT_KINDS = ["fact", "task", "event"];

export default function QuickNoteForm({
 kinds = DEFAULT_KINDS,
 onSave,
 title = "Quick log",
 placeholder = "e.g. home: wifi router IP",
 bodyPlaceholder = "Optional details",
 suggestedPrefix = null,
 defaultKind = null,
}) {
 const initialKind = defaultKind && kinds.includes(defaultKind) ? defaultKind : kinds[0];
 const [kind, setKind] = useState(initialKind);
 const [label, setLabel] = useState("");
 const [body, setBody] = useState("");
 const [trust, setTrust] = useState(0.7);
 const [busy, setBusy] = useState(false);
 const [err, setErr] = useState(null);

 useEffect(() => {
 if (!kinds.includes(kind)) setKind(kinds[0]);
 }, [kinds, kind]);

 const submit = async (e) => {
 e.preventDefault();
 if (!label.trim()) return;
 setBusy(true);
 setErr(null);
 try {
 let finalLabel = label.trim();
 if (suggestedPrefix && !finalLabel.toLowerCase().includes(suggestedPrefix.toLowerCase())) {
 finalLabel = `${suggestedPrefix}${finalLabel}`;
 }
 await onSave({
 kind,
 label: finalLabel,
 body: body.trim() || undefined,
 trust,
 });
 setLabel("");
 setBody("");
 } catch (e) {
 setErr(e?.message ?? "Failed to save");
 } finally {
 setBusy(false);
 }
 };

 return (
 <form onSubmit={submit} className="surface p-4">
 <div className="flex items-center gap-2 mb-3">
 <Plus size={13} className="text-jarvis-primary" />
 <span className="label text-jarvis-primary">{title}</span>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-2 mb-2">
 <select
 value={kind}
 onChange={(e) => setKind(e.target.value)}
 className="bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink focus:border-jarvis-primary/50 outline-none"
 >
 {kinds.map((k) => (
 <option key={k} value={k}>{k}</option>
 ))}
 </select>
 <input
 value={label}
 onChange={(e) => setLabel(e.target.value)}
 placeholder={placeholder}
 className="bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-primary/50 outline-none"
 />
 </div>
 <textarea
 value={body}
 onChange={(e) => setBody(e.target.value)}
 rows={2}
 placeholder={bodyPlaceholder}
 className="w-full bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-2 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-primary/50 outline-none resize-none"
 />
 <div className="mt-3 flex items-center gap-3">
 <label className="text-[10px] uppercase tracking-[0.14em] text-jarvis-muted font-semibold">
 Trust
 </label>
 <input
 type="range"
 min={0}
 max={1}
 step={0.05}
 value={trust}
 onChange={(e) => setTrust(parseFloat(e.target.value))}
 className="flex-1 accent-jarvis-primary"
 />
 <span className="text-[11px] text-jarvis-primary tabular-nums w-10 text-right">
 {trust.toFixed(2)}
 </span>
 <button
 type="submit"
 disabled={busy || !label.trim()}
 className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/30 hover:bg-jarvis-primary/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
 >
 {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
 Save
 </button>
 </div>
 {suggestedPrefix && (
 <div className="mt-2 text-[10px] text-jarvis-muted">
 Tip: labels will be prefixed with <code className="text-jarvis-primary">{suggestedPrefix}</code> if missing.
 </div>
 )}
 {err && <div className="mt-2 text-[11px] text-jarvis-red">{err}</div>}
 </form>
 );
}
