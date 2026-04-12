import { MessageSquare, Phone, Mail, Users, Plus } from "lucide-react";
import { useState } from "react";
import { supabase } from "../../lib/supabase.js";

const TYPE_META = {
  call:    { icon: Phone,        style: "bg-jarvis-primary/15 text-jarvis-primary" },
  email:   { icon: Mail,         style: "bg-blue-500/15 text-blue-400" },
  meeting: { icon: Users,        style: "bg-jarvis-purple/15 text-jarvis-purple" },
  note:    { icon: MessageSquare, style: "bg-jarvis-ghost text-jarvis-muted" },
};

const fmtAgo = (s) => {
  if (!s) return "";
  const diff = Date.now() - new Date(s).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

export function CommunicationLog({ comms = [], onRefresh }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ type: "note", subject: "", body: "" });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!supabase || !form.body.trim()) return;
    setSaving(true);
    await supabase.from("communications").insert({
      type: form.type,
      subject: form.subject || null,
      body: form.body.trim(),
    });
    setSaving(false);
    setAdding(false);
    setForm({ type: "note", subject: "", body: "" });
    onRefresh?.();
  }

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={13} className="text-jarvis-muted" />
          <span className="label">Communication Log</span>
        </div>
        <button onClick={() => setAdding(v => !v)} className="text-jarvis-muted hover:text-jarvis-primary transition-colors">
          <Plus size={13} />
        </button>
      </div>

      {adding && (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 bg-white/[0.02] rounded-lg p-3 border border-jarvis-border">
          <div className="flex gap-2">
            <select
              className="bg-jarvis-surface text-xs text-jarvis-body rounded border border-jarvis-border px-1.5 py-1"
              value={form.type}
              onChange={e => setForm(v => ({ ...v, type: e.target.value }))}
            >
              {["note","call","email","meeting"].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              className="flex-1 bg-transparent text-xs text-jarvis-ink placeholder-jarvis-ghost outline-none border-b border-jarvis-border pb-1"
              placeholder="Subject (optional)"
              value={form.subject}
              onChange={e => setForm(v => ({ ...v, subject: e.target.value }))}
            />
          </div>
          <textarea
            rows={2}
            className="bg-transparent text-xs text-jarvis-ink placeholder-jarvis-ghost outline-none resize-none border-b border-jarvis-border pb-1"
            placeholder="Notes…"
            value={form.body}
            onChange={e => setForm(v => ({ ...v, body: e.target.value }))}
            autoFocus
          />
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="chip bg-jarvis-primary/15 text-jarvis-primary border border-jarvis-primary/30">
              {saving ? "Saving…" : "Log"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="chip bg-white/5 text-jarvis-muted">Cancel</button>
          </div>
        </form>
      )}

      {comms.length === 0 && !adding && (
        <p className="text-xs text-jarvis-ghost py-2">No logged communications. Hit + to add a note.</p>
      )}

      <div className="flex flex-col gap-1.5">
        {comms.slice(0, 5).map((c) => {
          const meta = TYPE_META[c.type] ?? TYPE_META.note;
          const Icon = meta.icon;
          return (
            <div key={c.id} className="flex items-start gap-2 py-1.5 border-b border-jarvis-border/50 last:border-0">
              <span className={`chip mt-0.5 ${meta.style}`}><Icon size={9} /></span>
              <div className="flex-1 min-w-0">
                {c.subject && <div className="text-xs font-medium text-jarvis-ink truncate">{c.subject}</div>}
                <div className="text-[11px] text-jarvis-body line-clamp-2">{c.body}</div>
              </div>
              <span className="text-[9px] text-jarvis-ghost shrink-0 mt-0.5">{fmtAgo(c.occurred_at)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
