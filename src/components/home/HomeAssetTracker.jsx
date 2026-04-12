import { useState } from "react";
import { Package, Plus, Loader2 } from "lucide-react";

const CATEGORIES = ["appliance", "vehicle", "electronics", "furniture", "tool", "other"];

function warrantyStatus(warrantyEnd) {
  if (!warrantyEnd) return null;
  const days = Math.ceil((new Date(warrantyEnd) - new Date()) / 86_400_000);
  if (days < 0) return { label: "expired", style: "bg-red-500/10 border-red-500/30 text-red-400" };
  if (days < 60) return { label: `${days}d left`, style: "bg-amber-400/10 border-amber-400/30 text-amber-400" };
  return { label: "active", style: "bg-green-500/10 border-green-500/30 text-green-400" };
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function HomeAssetTracker({ assets = [], loading = false, onAdd }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", category: "appliance", purchase_price: "", warranty_end: "" });
  const [saving, setSaving] = useState(false);

  const sorted = [...assets].sort((a, b) => {
    if (!a.replacement_date) return 1;
    if (!b.replacement_date) return -1;
    return new Date(a.replacement_date) - new Date(b.replacement_date);
  });

  const totalValue = assets.reduce((s, a) => s + (a.purchase_price ?? 0), 0);

  async function handleAdd(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await onAdd?.({ ...form, purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null });
      setForm({ name: "", category: "appliance", purchase_price: "", warranty_end: "" });
      setOpen(false);
    } finally { setSaving(false); }
  }

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-1">
        <Package size={14} className="text-jarvis-purple" />
        <div className="label">Asset Tracker</div>
        <button onClick={() => setOpen(!open)} className="ml-auto chip bg-jarvis-purple/10 border border-jarvis-purple/20 text-jarvis-purple text-[10px] hover:bg-jarvis-purple/20 transition cursor-pointer">
          <Plus size={10} /> Add
        </button>
      </div>
      {totalValue > 0 && (
        <div className="text-[11px] text-jarvis-muted mb-3">Total tracked value: <span className="text-jarvis-ink font-semibold">${totalValue.toLocaleString()}</span></div>
      )}

      {open && (
        <form onSubmit={handleAdd} className="grid grid-cols-2 gap-2 mb-4 p-3 rounded-xl bg-jarvis-surface/40 border border-jarvis-border">
          <input className="input-sm col-span-2" placeholder="Asset name *" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          <select className="input-sm" value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input className="input-sm" type="number" placeholder="Purchase price ($)" value={form.purchase_price} onChange={e => setForm(f => ({...f, purchase_price: e.target.value}))} />
          <div className="col-span-2 flex items-center gap-2">
            <span className="text-[10px] text-jarvis-muted">Warranty ends:</span>
            <input className="input-sm flex-1" type="date" value={form.warranty_end} onChange={e => setForm(f => ({...f, warranty_end: e.target.value}))} />
            <button type="submit" disabled={saving} className="px-3 py-1 rounded-lg text-[11px] font-semibold bg-jarvis-purple/20 text-jarvis-purple hover:bg-jarvis-purple/30 transition disabled:opacity-40">
              {saving ? <Loader2 size={10} className="animate-spin" /> : "Save"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-jarvis-muted py-4"><Loader2 size={12} className="animate-spin" /> Loading…</div>
      ) : sorted.length === 0 ? (
        <p className="text-[12px] text-jarvis-muted py-3">Track appliances, vehicles, and electronics here.</p>
      ) : (
        <div className="space-y-1">
          {sorted.map((a) => {
            const ws = warrantyStatus(a.warranty_end);
            return (
              <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent hover:border-jarvis-border transition">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-jarvis-ink">{a.name}</span>
                    <span className="chip text-[9px] capitalize bg-jarvis-surface/40 border border-jarvis-border">{a.category}</span>
                  </div>
                  <div className="text-[10px] text-jarvis-muted">
                    {a.purchase_date && `Bought ${fmtDate(a.purchase_date)}`}
                    {a.replacement_date && ` · Replace ${fmtDate(a.replacement_date)}`}
                  </div>
                </div>
                {ws && <span className={`chip text-[9px] border ${ws.style}`}>{ws.label}</span>}
                {a.purchase_price && <span className="text-xs text-jarvis-muted">${a.purchase_price.toLocaleString()}</span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
