import { useState } from "react";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const fmtUsd = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function QuoteCalculator({ onRefresh }) {
  const [form, setForm] = useState({
    name: "",
    rate_per_mile: "",
    miles: "",
    fuel_surcharge_pct: "15",
    accessorials: [],
    monthly_shipments: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const linehaul  = (parseFloat(form.rate_per_mile) || 0) * (parseFloat(form.miles) || 0);
  const fuelCharge = linehaul * ((parseFloat(form.fuel_surcharge_pct) || 0) / 100);
  const accessTotal = form.accessorials.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const total = linehaul + fuelCharge + accessTotal;
  const monthlyShipments = parseFloat(form.monthly_shipments) || 0;
  const monthly_cost = total * monthlyShipments;
  const annual_projection = monthly_cost * 12;

  function addAccessorial() {
    setForm(v => ({ ...v, accessorials: [...v.accessorials, { name: "", amount: "" }] }));
  }
  function removeAccessorial(i) {
    setForm(v => ({ ...v, accessorials: v.accessorials.filter((_, idx) => idx !== i) }));
  }
  function updateAccessorial(i, field, val) {
    setForm(v => {
      const next = [...v.accessorials];
      next[i] = { ...next[i], [field]: val };
      return { ...v, accessorials: next };
    });
  }

  async function saveProposal() {
    if (!supabase || !form.name.trim()) return;
    setSaving(true);
    const pricing = {
      rate_per_mile: parseFloat(form.rate_per_mile) || 0,
      miles: parseFloat(form.miles) || 0,
      fuel_surcharge_pct: parseFloat(form.fuel_surcharge_pct) || 0,
      accessorials: form.accessorials,
      total_per_shipment: total,
      monthly_shipments: monthlyShipments,
      monthly_cost,
      annual_projection,
    };
    await supabase.from("proposals").insert({ name: form.name.trim(), status: "draft", pricing });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onRefresh?.();
  }

  return (
    <div className="glass p-4 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Calculator size={13} className="text-jarvis-muted" />
        <span className="label">Quote Calculator</span>
      </div>

      {/* Name */}
      <input
        className="bg-white/[0.02] border border-jarvis-border rounded-lg px-3 py-1.5 text-xs text-jarvis-ink placeholder-jarvis-ghost outline-none focus:border-blue-400/50 transition-colors"
        placeholder="Quote name / prospect"
        value={form.name}
        onChange={e => setForm(v => ({ ...v, name: e.target.value }))}
      />

      {/* Rate & Miles */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="label mb-1">Rate / Mile</div>
          <div className="relative">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-jarvis-muted text-xs">$</span>
            <input
              type="number" min="0" step="0.01"
              className="w-full bg-white/[0.02] border border-jarvis-border rounded-lg pl-5 pr-2 py-1.5 text-xs text-jarvis-ink outline-none focus:border-blue-400/50 transition-colors"
              value={form.rate_per_mile}
              onChange={e => setForm(v => ({ ...v, rate_per_mile: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <div className="label mb-1">Miles</div>
          <input
            type="number" min="0"
            className="w-full bg-white/[0.02] border border-jarvis-border rounded-lg px-2 py-1.5 text-xs text-jarvis-ink outline-none focus:border-blue-400/50 transition-colors"
            value={form.miles}
            onChange={e => setForm(v => ({ ...v, miles: e.target.value }))}
          />
        </div>
      </div>

      {/* Fuel surcharge */}
      <div>
        <div className="label mb-1">Fuel Surcharge %</div>
        <input
          type="number" min="0" max="100" step="0.5"
          className="w-full bg-white/[0.02] border border-jarvis-border rounded-lg px-2 py-1.5 text-xs text-jarvis-ink outline-none focus:border-blue-400/50 transition-colors"
          value={form.fuel_surcharge_pct}
          onChange={e => setForm(v => ({ ...v, fuel_surcharge_pct: e.target.value }))}
        />
      </div>

      {/* Accessorials */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="label">Accessorials</span>
          <button onClick={addAccessorial} className="text-jarvis-muted hover:text-jarvis-primary">
            <Plus size={11} />
          </button>
        </div>
        {form.accessorials.map((a, i) => (
          <div key={i} className="flex gap-2 mb-1">
            <input
              className="flex-1 bg-white/[0.02] border border-jarvis-border rounded px-2 py-1 text-[11px] text-jarvis-ink placeholder-jarvis-ghost outline-none"
              placeholder="Name"
              value={a.name}
              onChange={e => updateAccessorial(i, "name", e.target.value)}
            />
            <div className="relative w-24">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-jarvis-muted text-[11px]">$</span>
              <input
                type="number" min="0"
                className="w-full bg-white/[0.02] border border-jarvis-border rounded pl-4 pr-2 py-1 text-[11px] text-jarvis-ink outline-none"
                value={a.amount}
                onChange={e => updateAccessorial(i, "amount", e.target.value)}
              />
            </div>
            <button onClick={() => removeAccessorial(i)} className="text-jarvis-danger/60 hover:text-jarvis-danger">
              <Trash2 size={11} />
            </button>
          </div>
        ))}
      </div>

      {/* Breakdown */}
      <div className="bg-white/[0.02] rounded-lg p-3 border border-jarvis-border space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-jarvis-muted">Linehaul</span>
          <span className="text-jarvis-body">{fmtUsd(linehaul)}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-jarvis-muted">Fuel ({form.fuel_surcharge_pct}%)</span>
          <span className="text-jarvis-body">{fmtUsd(fuelCharge)}</span>
        </div>
        {form.accessorials.filter(a => a.amount).map((a, i) => (
          <div key={i} className="flex justify-between text-[11px]">
            <span className="text-jarvis-muted">{a.name || "Accessorial"}</span>
            <span className="text-jarvis-body">{fmtUsd(a.amount)}</span>
          </div>
        ))}
        <div className="border-t border-jarvis-border/50 pt-1 flex justify-between">
          <span className="text-xs font-semibold text-jarvis-ink">Total / Shipment</span>
          <span className="text-sm font-bold text-blue-400">{fmtUsd(total)}</span>
        </div>
      </div>

      {/* Monthly Projection */}
      <div>
        <div className="label mb-1">Monthly Projection</div>
        <div className="flex items-center gap-2 mb-2">
          <input
            type="number" min="0"
            className="w-full bg-white/[0.02] border border-jarvis-border rounded-lg px-2 py-1.5 text-xs text-jarvis-ink placeholder-jarvis-ghost outline-none focus:border-blue-400/50 transition-colors"
            placeholder="Est. monthly shipments"
            value={form.monthly_shipments}
            onChange={e => setForm(v => ({ ...v, monthly_shipments: e.target.value }))}
          />
        </div>
        {monthlyShipments > 0 && (
          <div className="bg-white/[0.02] rounded-lg p-3 border border-jarvis-border/50 space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-jarvis-muted">Monthly Cost</span>
              <span className="text-jarvis-body tabular-nums">{fmtUsd(monthly_cost)}</span>
            </div>
            <div className="flex justify-between text-[11px]">
              <span className="text-jarvis-muted">Annual Projection</span>
              <span className="text-blue-400 font-semibold tabular-nums">{fmtUsd(annual_projection)}</span>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={saveProposal}
        disabled={saving || !form.name.trim()}
        className="w-full py-2 rounded-lg text-xs font-semibold transition-all
          bg-blue-500/15 border border-blue-500/30 text-blue-400
          hover:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saved ? "Saved!" : saving ? "Saving…" : "Save as Proposal"}
      </button>
    </div>
  );
}
