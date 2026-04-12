import { FolderOpen, ExternalLink, Plus } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../lib/supabase.js";

const TYPE_STYLE = {
  proposal:   "bg-blue-500/15 text-blue-400",
  contract:   "bg-jarvis-success/15 text-jarvis-success",
  sow:        "bg-jarvis-primary/15 text-jarvis-primary",
  invoice:    "bg-jarvis-warning/15 text-jarvis-warning",
  rate_sheet: "bg-jarvis-purple/15 text-jarvis-purple",
  other:      "bg-jarvis-ghost text-jarvis-muted",
};

const STATUS_STYLE = {
  draft:   "text-jarvis-muted",
  sent:    "text-blue-400",
  signed:  "text-jarvis-success",
  expired: "text-jarvis-ghost",
};

const fmtDate = (s) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

export function DocumentVault({ docs = [], onRefresh }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", type: "other", file_url: "", status: "draft" });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!supabase || !form.name.trim()) return;
    setSaving(true);
    await supabase.from("documents").insert({
      name: form.name.trim(),
      type: form.type,
      file_url: form.file_url || null,
      status: form.status,
    });
    setSaving(false);
    setAdding(false);
    setForm({ name: "", type: "other", file_url: "", status: "draft" });
    onRefresh?.();
  }

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen size={13} className="text-jarvis-muted" />
          <span className="label">Document Vault</span>
        </div>
        <button onClick={() => setAdding(v => !v)} className="text-jarvis-muted hover:text-jarvis-primary transition-colors">
          <Plus size={13} />
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 bg-white/[0.02] rounded-lg p-3 border border-jarvis-border">
          <input
            className="bg-transparent text-xs text-jarvis-ink placeholder-jarvis-ghost outline-none border-b border-jarvis-border pb-1"
            placeholder="Document name"
            value={form.name}
            onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
            autoFocus
          />
          <div className="flex gap-2">
            <select
              className="bg-jarvis-surface text-xs text-jarvis-body rounded border border-jarvis-border px-1.5 py-1"
              value={form.type}
              onChange={e => setForm(v => ({ ...v, type: e.target.value }))}
            >
              {["proposal","contract","sow","invoice","rate_sheet","other"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              className="bg-jarvis-surface text-xs text-jarvis-body rounded border border-jarvis-border px-1.5 py-1"
              value={form.status}
              onChange={e => setForm(v => ({ ...v, status: e.target.value }))}
            >
              {["draft","sent","signed","expired"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <input
            className="bg-transparent text-xs text-jarvis-muted placeholder-jarvis-ghost outline-none border-b border-jarvis-border pb-1"
            placeholder="URL (optional)"
            value={form.file_url}
            onChange={e => setForm(v => ({ ...v, file_url: e.target.value }))}
          />
          <div className="flex gap-2 mt-1">
            <button type="submit" disabled={saving} className="chip bg-jarvis-primary/15 text-jarvis-primary border border-jarvis-primary/30">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="chip bg-white/5 text-jarvis-muted">Cancel</button>
          </div>
        </form>
      )}

      {docs.length === 0 && !adding && (
        <p className="text-xs text-jarvis-ghost py-2">No documents. Hit + to add one.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {docs.slice(0, 5).map((d) => (
          <div key={d.id} className="flex items-center gap-2 py-1 border-b border-jarvis-border/50 last:border-0">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-jarvis-ink font-medium truncate">{d.name}</div>
              <div className="text-[10px] text-jarvis-muted mt-0.5">{fmtDate(d.created_at)}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`chip ${TYPE_STYLE[d.type] ?? TYPE_STYLE.other}`}>{d.type.replace("_", " ")}</span>
              <span className={`text-[10px] ${STATUS_STYLE[d.status] ?? "text-jarvis-muted"}`}>{d.status}</span>
              {d.file_url && (
                <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-jarvis-ghost hover:text-jarvis-primary transition-colors">
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
