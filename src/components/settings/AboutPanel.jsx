import { useCallback, useEffect, useState } from "react";
import { Activity, ShieldCheck, ShieldAlert, Scroll, Cpu, Layers, Database, Globe } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

function formatUptime(seconds) {
 if (!Number.isFinite(seconds)) return "—";
 const s = Math.floor(seconds);
 const d = Math.floor(s / 86400);
 const h = Math.floor((s % 86400) / 3600);
 const m = Math.floor((s % 3600) / 60);
 const parts = [];
 if (d) parts.push(`${d}d`);
 if (h) parts.push(`${h}h`);
 parts.push(`${m}m`);
 return parts.join(" ");
}

function InfoRow({ label, value, mono }) {
 return (
 <div className="flex justify-between py-1">
 <dt className="text-jarvis-muted text-[12px]">{label}</dt>
 <dd className={`text-jarvis-ink text-[12px] ${mono ? "font-mono" : ""}`}>{value}</dd>
 </div>
 );
}

function Card({ icon: Icon, iconColor, glowClass, title, subtitle, children }) {
 return (
 <div className="rounded-2xl border border-jarvis-border bg-white/[0.02] p-5">
 <div className="flex items-center gap-3 mb-4">
 <div className={`w-10 h-10 rounded-full grid place-items-center ${iconColor} ${glowClass}`}>
 <Icon size={18} />
 </div>
 <div>
 <div className="text-sm text-jarvis-ink font-semibold">{title}</div>
 <div className="text-[11px] text-jarvis-muted">{subtitle}</div>
 </div>
 </div>
 {children}
 </div>
 );
}

export function AboutPanel() {
 const [health, setHealth] = useState(null);
 const [audit, setAudit] = useState(null);
 const [skills, setSkills] = useState([]);
 const [providers, setProviders] = useState([]);
 const [embedStatus, setEmbedStatus] = useState(null);
 const [error, setError] = useState(null);

 const refresh = useCallback(async () => {
 setError(null);
 try {
 const [h, a, s, p, e] = await Promise.all([
 jarvis.health().catch(() => null),
 jarvis.auditVerify().catch(() => ({ ok: false, error: "unavailable" })),
 jarvis.listSkills().catch(() => []),
 jarvis.getProviders().catch(() => []),
 jarvis.memoryEmbedStatus().catch(() => null),
 ]);
 setHealth(h);
 setAudit(a);
 setSkills(Array.isArray(s) ? s : []);
 setProviders(Array.isArray(p) ? p : []);
 setEmbedStatus(e);
 } catch (e) {
 setError(String(e.message ?? e));
 }
 }, []);

 useEffect(() => { refresh(); }, [refresh]);

 const auditOk = audit?.ok === true;
 const linkedProviders = providers.filter(p => p.linked);
 const cronSkills = skills.filter(s => s.triggers?.some(t => t.kind === "cron"));

 return (
 <div>
 <div className="mb-6">
 <div className="label">About</div>
 <h3 className="font-display text-2xl text-jarvis-ink mt-1">JARVIS OS</h3>
 <p className="text-jarvis-body text-sm mt-1">
 Personal operating system — local-first, multi-model, graph memory.
 </p>
 </div>

 {error && (
 <div className="mb-4 rounded-xl border border-jarvis-red/30 bg-jarvis-red/5 px-4 py-3 text-xs text-jarvis-red">
 {error}
 </div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {/* Daemon */}
 <Card icon={Activity} iconColor="text-jarvis-primary bg-jarvis-primary/15" glowClass="" title="Daemon" subtitle="jarvisd">
 <dl className="space-y-0.5">
 <InfoRow label="Status" value={health?.status ?? "—"} />
 <InfoRow label="Version" value={health?.version ?? "—"} mono />
 <InfoRow label="Uptime" value={formatUptime(health?.uptimeSec)} mono />
 <InfoRow label="Vault" value={health?.vaultLocked ? "Locked" : "Unlocked"} />
 <InfoRow label="Platform" value="Tauri + Fastify + SQLite" />
 </dl>
 </Card>

 {/* Audit */}
 <Card
 icon={auditOk ? ShieldCheck : ShieldAlert}
 iconColor={auditOk ? "text-jarvis-green bg-jarvis-green/15" : "text-jarvis-amber bg-jarvis-amber/15"}
 glowClass={auditOk ? "" : ""}
 title="Audit Log"
 subtitle="Hash-chained ledger"
 >
 <span className={`chip ${auditOk ? "bg-jarvis-green/10 text-jarvis-green" : "bg-jarvis-amber/10 text-jarvis-amber"}`}>
 {auditOk ? "Chain verified" : audit?.error ?? "Unverified"}
 </span>
 {typeof audit?.count === "number" && (
 <div className="text-[11px] text-jarvis-muted mt-2">
 {audit.count.toLocaleString()} entries
 </div>
 )}
 </Card>

 {/* Skills */}
 <Card icon={Layers} iconColor="text-jarvis-purple bg-jarvis-purple/15" glowClass="" title="Skills" subtitle="Registered capabilities">
 <dl className="space-y-0.5">
 <InfoRow label="Total skills" value={skills.length} />
 <InfoRow label="Cron scheduled" value={cronSkills.length} />
 <InfoRow label="Manual" value={skills.length - cronSkills.length} />
 </dl>
 {skills.length > 0 && (
 <div className="mt-3 flex flex-wrap gap-1">
 {skills.slice(0, 8).map(s => (
 <span key={s.name} className="chip bg-jarvis-purple/8 text-jarvis-purple border border-jarvis-purple/20">
 {s.name}
 </span>
 ))}
 {skills.length > 8 && (
 <span className="chip bg-white/5 text-jarvis-muted">+{skills.length - 8}</span>
 )}
 </div>
 )}
 </Card>

 {/* Providers + Memory */}
 <Card icon={Cpu} iconColor="text-jarvis-primary bg-jarvis-primary/15" glowClass="" title="Intelligence" subtitle="Models + memory">
 <dl className="space-y-0.5">
 <InfoRow label="Linked providers" value={`${linkedProviders.length} / ${providers.length}`} />
 {linkedProviders.map(p => (
 <InfoRow key={p.id} label={` ${p.id}`} value={p.authMode ?? "key"} />
 ))}
 <InfoRow label="Embeddings" value={embedStatus?.ok ? `${embedStatus.model} (${embedStatus.dims}d)` : "offline"} />
 </dl>
 </Card>
 </div>

 {/* Architecture */}
 <div className="mt-4 rounded-2xl border border-jarvis-border bg-white/[0.02] p-5">
 <div className="flex items-center gap-2 mb-3">
 <Database size={14} className="text-jarvis-muted" />
 <span className="text-[12px] font-semibold text-jarvis-ink">Architecture</span>
 </div>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
 <div>
 <div className="text-jarvis-muted mb-1">Shell</div>
 <div className="text-jarvis-ink">Tauri v2 (Rust)</div>
 </div>
 <div>
 <div className="text-jarvis-muted mb-1">Daemon</div>
 <div className="text-jarvis-ink">Fastify + TypeScript</div>
 </div>
 <div>
 <div className="text-jarvis-muted mb-1">Database</div>
 <div className="text-jarvis-ink">SQLite + WAL + FTS5</div>
 </div>
 <div>
 <div className="text-jarvis-muted mb-1">Security</div>
 <div className="text-jarvis-ink">AES-256-GCM + Keychain</div>
 </div>
 </div>
 </div>

 <div className="mt-4 text-center text-[11px] text-jarvis-muted">
 Built with purpose. Local-first. Your data stays yours.
 </div>
 </div>
 );
}
