// QuickCapture.jsx — floating action button for calls, notes, follow-ups from any page
import { useState, useEffect, useRef } from "react";
import { Plus, Phone, FileText, Clock, X, Check } from "lucide-react";
import { supabase } from "../lib/supabase.js";

const TABS = [
  { id: "call",     label: "Call",      Icon: Phone    },
  { id: "note",     label: "Note",      Icon: FileText },
  { id: "followup", label: "Follow-up", Icon: Clock    },
];

const EMPTY = { contact: "", notes: "", deal: "", text: "", action: "", dueDate: "" };

export function QuickCapture() {
  const [open, setOpen]     = useState(false);
  const [tab, setTab]       = useState("call");
  const [form, setForm]     = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);
  const panelRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSave = async () => {
    if (!supabase) { setSaved(true); setTimeout(() => { setSaved(false); setOpen(false); setForm(EMPTY); }, 1200); return; }
    setSaving(true);
    try {
      if (tab === "call" || tab === "note") {
        await supabase.from("communications").insert({
          type:        tab === "call" ? "call" : "note",
          subject:     tab === "call" ? `Call with ${form.contact}` : `Note${form.deal ? ` on ${form.deal}` : ""}`,
          body:        form.notes || form.text,
          occurred_at: new Date().toISOString(),
          contact_name: form.contact || null,
        });
      } else if (tab === "followup") {
        await supabase.from("follow_ups").insert({
          action:   form.action,
          due_date: form.dueDate || null,
          status:   "pending",
          subject:  form.deal || null,
        });
      }
      setSaved(true);
      setTimeout(() => { setSaved(false); setOpen(false); setForm(EMPTY); }, 1200);
    } catch (e) {
      console.error("QuickCapture save failed:", e);
    }
    setSaving(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40" ref={panelRef}>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="w-12 h-12 rounded-full bg-jarvis-primary shadow-lg grid place-items-center text-white hover:scale-105 transition-transform"
          title="Quick Capture"
        >
          <Plus size={20} />
        </button>
      )}

      {open && (
        <div className="glass w-80 p-4 rounded-2xl border border-jarvis-primary/20 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-jarvis-ink">Quick Capture</span>
            <button onClick={() => { setOpen(false); setForm(EMPTY); }} className="p-1 rounded-lg text-jarvis-muted hover:text-jarvis-ink transition">
              <X size={14} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-jarvis-ghost rounded-xl p-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => { setTab(t.id); setForm(EMPTY); }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition ${tab === t.id ? "bg-jarvis-surface text-jarvis-ink shadow-sm" : "text-jarvis-muted hover:text-jarvis-body"}`}
              >
                <t.Icon size={11} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Form fields */}
          <div className="space-y-2">
            {(tab === "call") && (
              <>
                <input
                  value={form.contact}
                  onChange={e => set("contact", e.target.value)}
                  placeholder="Contact name"
                  className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink outline-none focus:border-jarvis-primary/40 placeholder:text-jarvis-muted"
                />
                <textarea
                  value={form.notes}
                  onChange={e => set("notes", e.target.value)}
                  placeholder="Call notes…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink outline-none focus:border-jarvis-primary/40 placeholder:text-jarvis-muted resize-none"
                />
              </>
            )}
            {tab === "note" && (
              <>
                <input
                  value={form.deal}
                  onChange={e => set("deal", e.target.value)}
                  placeholder="Deal or contact (optional)"
                  className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink outline-none focus:border-jarvis-primary/40 placeholder:text-jarvis-muted"
                />
                <textarea
                  value={form.text}
                  onChange={e => set("text", e.target.value)}
                  placeholder="Note text…"
                  rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink outline-none focus:border-jarvis-primary/40 placeholder:text-jarvis-muted resize-none"
                />
              </>
            )}
            {tab === "followup" && (
              <>
                <input
                  value={form.action}
                  onChange={e => set("action", e.target.value)}
                  placeholder="Action (e.g. Send proposal)"
                  className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink outline-none focus:border-jarvis-primary/40 placeholder:text-jarvis-muted"
                />
                <input
                  value={form.deal}
                  onChange={e => set("deal", e.target.value)}
                  placeholder="Deal or contact (optional)"
                  className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink outline-none focus:border-jarvis-primary/40 placeholder:text-jarvis-muted"
                />
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => set("dueDate", e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink outline-none focus:border-jarvis-primary/40"
                />
              </>
            )}
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={saving || saved}
            className={`mt-3 w-full py-2 rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2 ${saved ? "bg-jarvis-success/15 text-jarvis-success" : "bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25 disabled:opacity-50"}`}
          >
            {saved ? (<><Check size={13} /> Saved</>) : saving ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
