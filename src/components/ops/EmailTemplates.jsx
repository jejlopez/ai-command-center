// EmailTemplates — reads from `templates` table, shows usage and allows inline edit.

import { useEffect, useState } from "react";
import { FileText, Plus, Edit2, Check, X } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const TYPE_COLORS = {
  follow_up:      "bg-blue-500/10 text-blue-400",
  intro:          "bg-jarvis-primary/10 text-jarvis-primary",
  proposal_send:  "bg-jarvis-purple/10 text-jarvis-purple",
  thank_you:      "bg-jarvis-success/10 text-jarvis-success",
  check_in:       "bg-jarvis-warning/10 text-jarvis-warning",
};

const TYPES = ["follow_up", "intro", "proposal_send", "thank_you", "check_in"];

function TemplateRow({ tpl, onUse, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ name: tpl.name, content: tpl.content ?? "" });
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!supabase || !draft.name.trim()) return;
    setSaving(true);
    await supabase.from("templates").update({ name: draft.name, content: draft.content }).eq("id", tpl.id);
    setSaving(false);
    setEditing(false);
    onSaved?.();
  }

  return (
    <div className="border-b border-jarvis-border/50 last:border-0 py-2">
      {!editing ? (
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-medium text-jarvis-ink">{tpl.name}</span>
              {tpl.type && (
                <span className={`chip text-[8px] ${TYPE_COLORS[tpl.type] ?? "bg-jarvis-ghost text-jarvis-muted"}`}>
                  {tpl.type.replace(/_/g, " ")}
                </span>
              )}
              {tpl.times_used > 0 && (
                <span className="text-[9px] text-jarvis-ghost">used {tpl.times_used}x</span>
              )}
            </div>
            {tpl.content && (
              <p className="text-[10px] text-jarvis-ghost truncate mt-0.5">{tpl.content.slice(0, 80)}</p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="p-1 text-jarvis-ghost hover:text-jarvis-muted transition"
              title="Edit"
            >
              <Edit2 size={10} />
            </button>
            <button
              onClick={() => onUse?.(tpl)}
              className="btn-ghost text-[10px] px-1.5 py-0.5"
            >
              Use
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <input
            className="input w-full text-xs"
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
          />
          <textarea
            className="input w-full text-xs h-20 resize-none"
            value={draft.content}
            onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
          />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="btn-primary text-[10px]">
              {saving ? "Saving…" : <><Check size={9} /> Save</>}
            </button>
            <button onClick={() => setEditing(false)} className="btn-ghost text-[10px]">
              <X size={9} /> Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function EmailTemplates({ onUseTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", type: "follow_up", content: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase
      .from("templates")
      .select("*")
      .order("times_used", { ascending: false })
      .limit(20);
    setTemplates(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!supabase || !form.name.trim()) return;
    setSaving(true);
    await supabase.from("templates").insert({
      name: form.name,
      type: form.type,
      content: form.content,
      times_used: 0,
    });
    setSaving(false);
    setAdding(false);
    setForm({ name: "", type: "follow_up", content: "" });
    load();
  }

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <FileText size={13} className="text-jarvis-muted" />
        <span className="label flex-1">Email Templates</span>
        <button
          onClick={() => setAdding(v => !v)}
          className="text-jarvis-ghost hover:text-jarvis-primary transition"
          title="Add template"
        >
          <Plus size={12} />
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="space-y-2 border border-jarvis-border rounded-lg p-3">
          <input
            className="input w-full text-xs"
            placeholder="Template name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            required
          />
          <select
            className="input w-full text-xs"
            value={form.type}
            onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
          >
            {TYPES.map(t => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
          <textarea
            className="input w-full text-xs h-20 resize-none"
            placeholder="Template content… use {{name}}, {{company}} for variables"
            value={form.content}
            onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
          />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="btn-primary text-[10px]">
              {saving ? "Saving…" : "Add Template"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="btn-ghost text-[10px]">Cancel</button>
          </div>
        </form>
      )}

      {loading && <div className="text-xs text-jarvis-ghost animate-pulse">Loading templates…</div>}

      {!loading && templates.length === 0 && !adding && (
        <div className="text-xs text-jarvis-ghost py-1">
          No templates yet. Add your first email template to get started.
        </div>
      )}

      {!loading && templates.length > 0 && (
        <div>
          {templates.map(tpl => (
            <TemplateRow key={tpl.id} tpl={tpl} onUse={onUseTemplate} onSaved={load} />
          ))}
        </div>
      )}
    </div>
  );
}
