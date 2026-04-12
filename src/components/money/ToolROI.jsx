import { useState } from "react";
import { Wrench, Plus, Scissors } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const roiColor = (roi) => roi >= 2 ? "text-jarvis-green" : roi >= 1 ? "text-jarvis-amber" : "text-jarvis-red";

export function ToolROI({ tools = [], onRefresh }) {
  const [form, setForm] = useState({ name: "", monthly_cost: "", monthly_value: "", category: "tool" });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const totalCost = tools.reduce((s, t) => s + (t.monthly_cost ?? 0), 0);
  const totalValue = tools.reduce((s, t) => s + (t.monthly_value ?? 0), 0);
  const overallRoi = totalCost > 0 ? ((totalValue / totalCost) * 100).toFixed(0) : 0;
  const cuts = tools.filter((t) => (t.monthly_cost > 0) && (t.monthly_value / t.monthly_cost) < 1);

  const save = async () => {
    if (!supabase || !form.name || !form.monthly_cost) return;
    setSaving(true);
    await supabase.from("tool_roi").insert({ name: form.name, monthly_cost: parseFloat(form.monthly_cost), monthly_value: parseFloat(form.monthly_value) || 0, category: form.category });
    setSaving(false);
    setForm({ name: "", monthly_cost: "", monthly_value: "", category: "tool" });
    onRefresh?.();
  };

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4"><Wrench size={14} className="text-jarvis-cyan" /><span className="label">Tool ROI</span></div>
      {tools.length === 0 ? (
        <p className="text-sm text-jarvis-muted mb-4">No tools tracked yet. Add your first subscription below.</p>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {tools.map((t) => {
              const roi = t.monthly_cost > 0 ? t.monthly_value / t.monthly_cost : 0;
              return (
                <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
                  <span className="text-sm text-jarvis-body flex-1 truncate">{t.name}</span>
                  <span className="text-xs text-jarvis-muted tabular-nums">${t.monthly_cost}/mo</span>
                  <span className={`text-xs font-semibold tabular-nums ${roiColor(roi)}`}>{roi.toFixed(1)}x</span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between py-2 border-t border-jarvis-border mb-3 text-xs">
            <span className="text-jarvis-muted">${totalCost.toLocaleString()}/mo spent · ${totalValue.toLocaleString()}/mo value</span>
            <span className={`font-semibold ${roiColor(totalValue / Math.max(totalCost, 1))}`}>{overallRoi}% ROI</span>
          </div>
          {cuts.length > 0 && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-jarvis-red/10 border border-jarvis-red/20">
              <Scissors size={12} className="text-jarvis-red" />
              <span className="text-xs text-jarvis-red">Cut candidates: {cuts.map((t) => t.name).join(", ")}</span>
            </div>
          )}
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <input type="text" placeholder="Tool name" value={form.name} onChange={set("name")} className="col-span-2 bg-white/5 border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-body placeholder-jarvis-muted focus:outline-none focus:border-jarvis-cyan" />
        <input type="number" placeholder="Cost/mo ($)" value={form.monthly_cost} onChange={set("monthly_cost")} className="bg-white/5 border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-body placeholder-jarvis-muted focus:outline-none focus:border-jarvis-cyan" />
        <input type="number" placeholder="Value/mo ($)" value={form.monthly_value} onChange={set("monthly_value")} className="bg-white/5 border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-body placeholder-jarvis-muted focus:outline-none focus:border-jarvis-cyan" />
        <button onClick={save} disabled={saving || !form.name} className="col-span-2 flex items-center justify-center gap-2 py-2 rounded-xl bg-jarvis-cyan/10 border border-jarvis-cyan/30 text-jarvis-cyan text-xs font-semibold hover:bg-jarvis-cyan/20 transition-colors disabled:opacity-40">
          <Plus size={12} />{saving ? "Saving…" : "Add Tool"}
        </button>
      </div>
    </div>
  );
}
