import { useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

function coldBadge(days) {
  if (days >= 10) return <span className="chip text-jarvis-red">Cold {days}d</span>;
  if (days >= 5) return <span className="chip text-jarvis-amber">Cooling {days}d</span>;
  return <span className="chip text-jarvis-green">{days}d</span>;
}

export function ContactsPanel({ contactsSummary }) {
  const [form, setForm] = useState({ open: false, name: "", company: "", role: "" });
  const [saving, setSaving] = useState(false);

  const list = Array.isArray(contactsSummary) ? contactsSummary.slice(0, 8) : [];

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("contacts").insert({
          user_id: user?.id,
          name: form.name.trim(),
          company: form.company.trim() || null,
          role: form.role.trim() || null,
        });
      }
      setForm({ open: false, name: "", company: "", role: "" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass p-6 border border-jarvis-border flex flex-col">
      <div className="label mb-3">Key Contacts</div>
      {list.length === 0 ? (
        <p className="text-sm text-jarvis-muted mb-3">Add contacts to track your key relationships.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {list.map((c, i) => (
            <div key={c.id ?? i} className="flex items-center justify-between gap-2 py-1.5 border-b border-jarvis-border/50 last:border-0">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-jarvis-ink font-semibold truncate">{c.name}</div>
                <div className="text-[10px] text-jarvis-muted truncate">
                  {c.company}
                  {c.company && c.role && " · "}
                  {c.role && <span className="chip">{c.role}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {coldBadge(c.last_interaction_days ?? 0)}
                {c.deal_value > 0 && (
                  <span className="text-[10px] text-jarvis-primary tabular-nums font-semibold">
                    ${c.deal_value.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {!form.open && (
        <button
          type="button"
          onClick={() => setForm((f) => ({ ...f, open: true }))}
          className="flex items-center gap-1.5 text-[11px] text-jarvis-muted hover:text-jarvis-primary transition mt-auto"
        >
          <Plus size={12} /> Add contact
        </button>
      )}

      {form.open && (
        <form onSubmit={handleAdd} className="mt-2 space-y-2 border-t border-jarvis-border pt-3">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Name *"
            className="w-full bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-1.5 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-primary/50 outline-none"
          />
          <input
            value={form.company}
            onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            placeholder="Company"
            className="w-full bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-1.5 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-primary/50 outline-none"
          />
          <input
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            placeholder="Role"
            className="w-full bg-jarvis-surface/40 border border-jarvis-border rounded-xl px-3 py-1.5 text-sm text-jarvis-ink placeholder:text-jarvis-muted focus:border-jarvis-primary/50 outline-none"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/30 hover:bg-jarvis-primary/20 disabled:opacity-40 transition"
            >
              {saving ? "Saving…" : "Add"}
            </button>
            <button
              type="button"
              onClick={() => setForm({ open: false, name: "", company: "", role: "" })}
              className="px-3 py-1.5 rounded-xl text-xs text-jarvis-muted hover:text-jarvis-ink transition"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
