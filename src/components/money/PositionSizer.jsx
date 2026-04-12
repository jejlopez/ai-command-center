import { useState } from "react";
import { Calculator } from "lucide-react";

export function PositionSizer() {
  const [form, setForm] = useState({ account: "", riskPct: "1", entry: "", stop: "", target: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const account = parseFloat(form.account) || 0;
  const riskPct = parseFloat(form.riskPct) || 1;
  const entry = parseFloat(form.entry) || 0;
  const stop = parseFloat(form.stop) || 0;
  const target = parseFloat(form.target) || 0;

  const riskPerShare = entry > 0 && stop > 0 ? Math.abs(entry - stop) : 0;
  const dollarRisk = account * (riskPct / 100);
  const shares = riskPerShare > 0 ? Math.floor(dollarRisk / riskPerShare) : 0;
  const reward = target > 0 && entry > 0 ? Math.abs(target - entry) : 0;
  const rr = riskPerShare > 0 && reward > 0 ? (reward / riskPerShare).toFixed(2) : null;
  const kelly = rr ? ((parseFloat(rr) - 1) / parseFloat(rr) * 0.5 * 100).toFixed(1) : null;

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calculator size={14} className="text-jarvis-cyan" />
        <span className="label">Position Sizer</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          ["account", "Account Size ($)"],
          ["riskPct", "Risk % per Trade"],
          ["entry", "Entry Price"],
          ["stop", "Stop Loss"],
          ["target", "Target (optional)"],
        ].map(([k, label]) => (
          <div key={k} className={k === "target" ? "col-span-2" : ""}>
            <label className="text-[10px] text-jarvis-muted block mb-1">{label}</label>
            <input
              type="number"
              value={form[k]}
              onChange={set(k)}
              className="w-full bg-white/5 border border-jarvis-border rounded-lg px-3 py-1.5 text-sm text-jarvis-body placeholder-jarvis-muted focus:outline-none focus:border-jarvis-cyan"
              placeholder="0"
            />
          </div>
        ))}
      </div>
      {shares > 0 ? (
        <div className="space-y-2 pt-3 border-t border-jarvis-border">
          <Row label="Shares" value={shares.toLocaleString()} />
          <Row label="Dollar Risk" value={`$${dollarRisk.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="text-jarvis-red" />
          {rr && <Row label="R:R Ratio" value={`1 : ${rr}`} color={parseFloat(rr) >= 2 ? "text-jarvis-green" : "text-jarvis-amber"} />}
          {kelly && <Row label="Kelly Suggestion" value={`${kelly}% of capital`} color="text-jarvis-muted" />}
        </div>
      ) : (
        <p className="text-xs text-jarvis-muted pt-2">Enter account size, entry, and stop to calculate.</p>
      )}
    </div>
  );
}

function Row({ label, value, color = "text-jarvis-body" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-jarvis-muted">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>{value}</span>
    </div>
  );
}
