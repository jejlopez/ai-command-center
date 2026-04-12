import { useState } from "react";
import { Users, Star, Trash2, Plus, Loader2 } from "lucide-react";

const CATEGORIES = ["plumber", "electrician", "landscaping", "cleaning", "hvac", "general", "pest control", "handyman"];

function daysUntil(iso) {
  if (!iso) return null;
  return Math.ceil((new Date(iso) - new Date()) / 86_400_000);
}

function StarRating({ rating }) {
  return (
    <span className="flex gap-0.5">
      {[1,2,3,4,5].map((s) => (
        <Star key={s} size={10} className={s <= (rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-jarvis-border"} />
      ))}
    </span>
  );
}

export function VendorManager({ vendors = [], loading = false, onAdd, onDelete }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "general", phone: "", rating: 5 });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try { await onAdd?.(form); setForm({ name: "", category: "general", phone: "", rating: 5 }); setOpen(false); }
    finally { setSaving(false); }
  }

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4">
        <Users size={14} className="text-jarvis-purple" />
        <div className="label">Vendor Manager</div>
        <button onClick={() => setOpen(!open)} className="ml-auto chip bg-jarvis-purple/10 border border-jarvis-purple/20 text-jarvis-purple text-[10px] hover:bg-jarvis-purple/20 transition cursor-pointer">
          <Plus size={10} /> Add
        </button>
      </div>

      {open && (
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-2 mb-4 p-3 rounded-xl bg-jarvis-surface/40 border border-jarvis-border">
          <input className="col-span-2 input-sm" placeholder="Vendor name *" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          <select className="input-sm" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="input-sm" placeholder="Phone" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} />
          <div className="col-span-2 flex items-center gap-2">
            <span className="text-[11px] text-jarvis-muted">Rating:</span>
            {[1,2,3,4,5].map(s => (
              <button key={s} type="button" onClick={() => setForm(f => ({...f, rating: s}))}>
                <Star size={12} className={s <= form.rating ? "text-amber-400 fill-amber-400" : "text-jarvis-border"} />
              </button>
            ))}
            <button type="submit" disabled={saving} className="ml-auto px-3 py-1 rounded-lg text-[11px] font-semibold bg-jarvis-purple/20 text-jarvis-purple hover:bg-jarvis-purple/30 transition disabled:opacity-40">
              {saving ? <Loader2 size={10} className="animate-spin" /> : "Save"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-jarvis-muted py-4"><Loader2 size={12} className="animate-spin" /> Loading…</div>
      ) : vendors.length === 0 ? (
        <p className="text-[12px] text-jarvis-muted py-3">Track your service providers here.</p>
      ) : (
        <div className="space-y-2">
          {vendors.map((v) => {
            const days = daysUntil(v.contract_end);
            const expiring = days !== null && days <= 30;
            return (
              <div key={v.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition ${expiring ? "border-amber-400/30 bg-amber-400/5" : "border-jarvis-border"}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-jarvis-ink">{v.name}</span>
                    <span className="chip text-[9px] capitalize bg-jarvis-surface/40 border border-jarvis-border">{v.category}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <StarRating rating={v.rating} />
                    {v.phone && <span className="text-[10px] text-jarvis-muted">{v.phone}</span>}
                    {expiring && <span className="text-[10px] text-amber-400">contract in {days}d</span>}
                  </div>
                </div>
                <button onClick={() => onDelete?.(v.id)} className="text-jarvis-muted hover:text-red-400 transition shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
