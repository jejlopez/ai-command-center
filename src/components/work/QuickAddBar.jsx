import { useState } from "react";
import { Plus, X } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const STAGES = ["prospect", "quoted", "negotiating", "closed_won"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

function DealForm({ onClose }) {
  const [f, setF] = useState({ company: "", value: "", stage: "prospect", contact: "", close_date: "", notes: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.company.trim()) return;
    setSaving(true);
    try {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("deals").insert({
          user_id: user?.id,
          company: f.company.trim(),
          value_usd: f.value ? parseFloat(f.value) : null,
          stage: f.stage,
          contact_name: f.contact.trim() || null,
          close_date: f.close_date || null,
          notes: f.notes.trim() || null,
          last_touch: new Date().toISOString(),
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 items-end p-3 bg-jarvis-surface/60 border-t border-jarvis-border">
      <input value={f.company} onChange={(e) => setF((v) => ({ ...v, company: e.target.value }))} placeholder="Company *" className="input-sm w-36" />
      <input value={f.value} onChange={(e) => setF((v) => ({ ...v, value: e.target.value }))} placeholder="Value $" type="number" className="input-sm w-24" />
      <select value={f.stage} onChange={(e) => setF((v) => ({ ...v, stage: e.target.value }))} className="input-sm w-32">
        {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
      </select>
      <input value={f.contact} onChange={(e) => setF((v) => ({ ...v, contact: e.target.value }))} placeholder="Contact" className="input-sm w-32" />
      <input value={f.close_date} onChange={(e) => setF((v) => ({ ...v, close_date: e.target.value }))} type="date" className="input-sm w-36" />
      <button type="submit" disabled={saving || !f.company.trim()} className="btn-primary-sm">
        {saving ? "Adding…" : "Add Deal"}
      </button>
      <button type="button" onClick={onClose} className="btn-ghost-sm"><X size={13} /></button>
    </form>
  );
}

function FollowUpForm({ onClose }) {
  const [f, setF] = useState({ action: "", due_date: "", priority: "medium", contact: "", deal_id: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.action.trim()) return;
    setSaving(true);
    try {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("follow_ups").insert({
          user_id: user?.id,
          action: f.action.trim(),
          due_date: f.due_date || null,
          priority: f.priority,
          status: "pending",
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 items-end p-3 bg-jarvis-surface/60 border-t border-jarvis-border">
      <input value={f.action} onChange={(e) => setF((v) => ({ ...v, action: e.target.value }))} placeholder="Action *" className="input-sm w-48" />
      <input value={f.due_date} onChange={(e) => setF((v) => ({ ...v, due_date: e.target.value }))} type="date" className="input-sm w-36" />
      <select value={f.priority} onChange={(e) => setF((v) => ({ ...v, priority: e.target.value }))} className="input-sm w-28">
        {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <button type="submit" disabled={saving || !f.action.trim()} className="btn-primary-sm">
        {saving ? "Adding…" : "Add Follow-Up"}
      </button>
      <button type="button" onClick={onClose} className="btn-ghost-sm"><X size={13} /></button>
    </form>
  );
}

function ContactForm({ onClose }) {
  const [f, setF] = useState({ name: "", company: "", role: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    setSaving(true);
    try {
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from("contacts").insert({
          user_id: user?.id,
          name: f.name.trim(),
          company: f.company.trim() || null,
          role: f.role.trim() || null,
          email: f.email.trim() || null,
          phone: f.phone.trim() || null,
        });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2 items-end p-3 bg-jarvis-surface/60 border-t border-jarvis-border">
      <input value={f.name} onChange={(e) => setF((v) => ({ ...v, name: e.target.value }))} placeholder="Name *" className="input-sm w-36" />
      <input value={f.company} onChange={(e) => setF((v) => ({ ...v, company: e.target.value }))} placeholder="Company" className="input-sm w-36" />
      <input value={f.role} onChange={(e) => setF((v) => ({ ...v, role: e.target.value }))} placeholder="Role" className="input-sm w-28" />
      <input value={f.email} onChange={(e) => setF((v) => ({ ...v, email: e.target.value }))} placeholder="Email" type="email" className="input-sm w-40" />
      <input value={f.phone} onChange={(e) => setF((v) => ({ ...v, phone: e.target.value }))} placeholder="Phone" className="input-sm w-32" />
      <button type="submit" disabled={saving || !f.name.trim()} className="btn-primary-sm">
        {saving ? "Adding…" : "Add Contact"}
      </button>
      <button type="button" onClick={onClose} className="btn-ghost-sm"><X size={13} /></button>
    </form>
  );
}

export function QuickAddBar() {
  const [active, setActive] = useState(null); // 'deal' | 'followup' | 'contact' | null

  const toggle = (name) => setActive((v) => (v === name ? null : name));
  const close = () => setActive(null);

  return (
    <div className="sticky bottom-0 z-20 glass border-t border-jarvis-border">
      {active === "deal" && <DealForm onClose={close} />}
      {active === "followup" && <FollowUpForm onClose={close} />}
      {active === "contact" && <ContactForm onClose={close} />}
      <div className="flex items-center gap-2 px-6 py-3">
        <span className="text-[10px] text-jarvis-muted uppercase tracking-wider mr-1">Quick Add</span>
        {[
          { key: "deal", label: "+ Deal", color: "text-jarvis-primary border-jarvis-primary/30 hover:bg-jarvis-primary/10" },
          { key: "followup", label: "+ Follow-up", color: "text-jarvis-amber border-jarvis-amber/30 hover:bg-jarvis-amber/10" },
          { key: "contact", label: "+ Contact", color: "text-jarvis-primary border-jarvis-primary/30 hover:bg-jarvis-primary/10" },
        ].map(({ key, label, color }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold border transition ${color} ${active === key ? "ring-1 ring-current/40" : ""}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
