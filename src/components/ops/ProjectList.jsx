import { Layers, Plus, ExternalLink } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../lib/supabase.js";

const STATUS_STYLE = {
  active:    "bg-jarvis-success/15 text-jarvis-success",
  paused:    "bg-jarvis-warning/15 text-jarvis-warning",
  completed: "bg-jarvis-ghost text-jarvis-muted",
};

const fmtDate = (s) => s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";

export function ProjectList({ projects = [], onRefresh }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", repo_url: "", notes: "" });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!supabase || !form.name.trim()) return;
    setSaving(true);
    await supabase.from("projects").insert({
      name: form.name.trim(),
      repo_url: form.repo_url || null,
      notes: form.notes || null,
      status: "active",
    });
    setSaving(false);
    setAdding(false);
    setForm({ name: "", repo_url: "", notes: "" });
    onRefresh?.();
  }

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers size={13} className="text-jarvis-muted" />
          <span className="label">Active Projects</span>
        </div>
        <button onClick={() => setAdding(v => !v)} className="text-jarvis-muted hover:text-cyan-400 transition-colors">
          <Plus size={13} />
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 bg-white/[0.02] rounded-lg p-3 border border-jarvis-border">
          <input
            className="bg-transparent text-xs text-jarvis-ink placeholder-jarvis-ghost outline-none border-b border-jarvis-border pb-1"
            placeholder="Project name"
            value={form.name}
            onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
            autoFocus
          />
          <input
            className="bg-transparent text-xs text-jarvis-muted placeholder-jarvis-ghost outline-none border-b border-jarvis-border pb-1"
            placeholder="Repo URL (optional)"
            value={form.repo_url}
            onChange={e => setForm(v => ({ ...v, repo_url: e.target.value }))}
          />
          <div className="flex gap-2 mt-1">
            <button type="submit" disabled={saving} className="chip bg-cyan-400/15 text-cyan-400 border border-cyan-400/30">
              {saving ? "Saving…" : "Add"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="chip bg-white/5 text-jarvis-muted">Cancel</button>
          </div>
        </form>
      )}

      {projects.length === 0 && !adding && (
        <p className="text-xs text-jarvis-ghost py-2">No projects yet. Hit + to add one.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {projects.map((p) => (
          <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-jarvis-border/50 last:border-0">
            <div className="flex-1 min-w-0">
              <div className="text-xs text-jarvis-ink font-medium truncate">{p.name}</div>
              <div className="text-[10px] text-jarvis-muted mt-0.5">Updated {fmtDate(p.updated_at)}</div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`chip ${STATUS_STYLE[p.status] ?? STATUS_STYLE.active}`}>{p.status}</span>
              {p.repo_url && (
                <a href={p.repo_url} target="_blank" rel="noopener noreferrer" className="text-jarvis-ghost hover:text-cyan-400 transition-colors">
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
