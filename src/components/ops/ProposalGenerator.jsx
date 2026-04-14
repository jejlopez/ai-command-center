import { useState } from "react";
import { FileText, Plus, X, Link, Eye, Loader2, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { jarvis } from "../../lib/jarvis.js";

function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(36)).join('').slice(0, 12);
}

export function ProposalGenerator({ deal, onClose, onSaved }) {
  const [companyName, setCompanyName] = useState(deal?.company ?? '');
  const [clientName, setClientName] = useState(deal?.contact_name ?? '');
  const [clientEmail, setClientEmail] = useState('');
  const [lanes, setLanes] = useState([{ origin: '', destination: '', rate: '', volume: '', per_shipment: '' }]);
  const [fuelPct, setFuelPct] = useState('15');
  const [accessorials, setAccessorials] = useState([]);
  const [newAcc, setNewAcc] = useState({ name: '', amount: '' });
  const [monthlyShipments, setMonthlyShipments] = useState('');
  const [services, setServices] = useState(['Real-time tracking', 'Dedicated account manager', '24/7 support', 'Claims handling']);
  const [allServices] = useState(['Real-time tracking', 'Dedicated account manager', '24/7 support', 'Claims handling', 'Insurance coverage', 'Customs brokerage', 'Warehousing', 'Cross-docking', 'White glove delivery']);
  const [terms, setTerms] = useState({ valid_until: '', payment: 'Net 30', minimum: '', contract_length: '' });
  const [summary, setSummary] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);

  const totalPerShipment = lanes.reduce((s, l) => s + (parseFloat(l.per_shipment) || 0), 0)
    + accessorials.reduce((s, a) => s + (parseFloat(a.amount) || 0), 0);
  const monthlyCost = totalPerShipment * (parseInt(monthlyShipments) || 0);
  const annualProjection = monthlyCost * 12;

  const addLane = () => setLanes([...lanes, { origin: '', destination: '', rate: '', volume: '', per_shipment: '' }]);
  const removeLane = (i) => setLanes(lanes.filter((_, idx) => idx !== i));
  const updateLane = (i, field, val) => {
    const updated = [...lanes];
    updated[i] = { ...updated[i], [field]: val };
    setLanes(updated);
  };

  const addAccessorial = () => {
    if (newAcc.name && newAcc.amount) {
      setAccessorials([...accessorials, { ...newAcc }]);
      setNewAcc({ name: '', amount: '' });
    }
  };

  const toggleService = (s) => {
    setServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const generateSummary = async () => {
    setGenerating(true);
    try {
      const result = await jarvis.ask(
        `Write a 2-3 sentence executive summary for a 3PL logistics proposal to ${companyName}. They need shipping services for these lanes: ${lanes.map(l => `${l.origin} to ${l.destination}`).join(', ')}. Total monthly volume: ${monthlyShipments} shipments. Monthly cost: $${monthlyCost.toLocaleString()}. Keep it professional and compelling. Do NOT use markdown formatting.`,
        { kind: 'summary' }
      );
      setSummary(result.text);
    } catch (e) {
      setSummary(`We are pleased to present our logistics proposal for ${companyName}. Our competitive rates and comprehensive service offering are designed to optimize your supply chain and reduce total transportation costs.`);
    }
    setGenerating(false);
  };

  const save = async () => {
    if (!supabase) return;
    setSaving(true);
    try {
      const token = generateToken();
      const pricing = {
        rate_per_mile: parseFloat(lanes[0]?.rate) || 0,
        fuel_surcharge_pct: parseFloat(fuelPct) || 0,
        accessorials,
        total_per_shipment: totalPerShipment,
        monthly_shipments: parseInt(monthlyShipments) || 0,
        monthly_cost: monthlyCost,
        annual_projection: annualProjection,
      };

      const { error } = await supabase.from('proposals').insert({
        deal_id: deal?.id ?? null,
        name: `Proposal — ${companyName}`,
        version: 1,
        status: 'draft',
        pricing,
        company_name: companyName,
        client_name: clientName,
        client_email: clientEmail,
        lanes: lanes.filter(l => l.origin || l.destination),
        services,
        terms,
        executive_summary: summary,
        share_token: token,
        valid_until: terms.valid_until || null,
      });

      if (error) throw error;

      const url = `https://bqlmkaapurfxdmqcuvla.supabase.co/functions/v1/proposal-view?token=${token}`;
      setShareUrl(url);
      onSaved?.();
    } catch (e) {
      console.error('Save failed:', e);
    }
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col glass border border-jarvis-border overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-jarvis-primary" />
            <span className="text-lg font-semibold text-jarvis-ink">Create Proposal</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-jarvis-muted hover:text-jarvis-ink hover:bg-jarvis-ghost transition">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* Client Info */}
          <div>
            <div className="label mb-2">Client Information</div>
            <div className="grid grid-cols-3 gap-3">
              <input
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Company name"
                className="px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-jarvis-primary/50 transition-colors"
              />
              <input
                value={clientName}
                onChange={e => setClientName(e.target.value)}
                placeholder="Contact name"
                className="px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-jarvis-primary/50 transition-colors"
              />
              <input
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="Email"
                type="email"
                className="px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-jarvis-primary/50 transition-colors"
              />
            </div>
          </div>

          {/* Shipping Lanes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label">Shipping Lanes</div>
              <button onClick={addLane} className="text-[11px] text-jarvis-primary flex items-center gap-1 hover:underline">
                <Plus size={10} /> Add lane
              </button>
            </div>
            <div className="space-y-2">
              {lanes.map((l, i) => (
                <div key={i} className="grid grid-cols-6 gap-2 items-center">
                  <input
                    value={l.origin}
                    onChange={e => updateLane(i, 'origin', e.target.value)}
                    placeholder="Origin"
                    className="px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink placeholder-jarvis-muted outline-none col-span-1 focus:border-jarvis-primary/50 transition-colors"
                  />
                  <input
                    value={l.destination}
                    onChange={e => updateLane(i, 'destination', e.target.value)}
                    placeholder="Destination"
                    className="px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink placeholder-jarvis-muted outline-none col-span-1 focus:border-jarvis-primary/50 transition-colors"
                  />
                  <input
                    value={l.rate}
                    onChange={e => updateLane(i, 'rate', e.target.value)}
                    placeholder="$/mi"
                    type="number"
                    step="0.01"
                    className="px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-jarvis-primary/50 transition-colors"
                  />
                  <input
                    value={l.volume}
                    onChange={e => updateLane(i, 'volume', e.target.value)}
                    placeholder="Vol/mo"
                    type="number"
                    className="px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-jarvis-primary/50 transition-colors"
                  />
                  <input
                    value={l.per_shipment}
                    onChange={e => updateLane(i, 'per_shipment', e.target.value)}
                    placeholder="$/ship"
                    type="number"
                    className="px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-jarvis-primary/50 transition-colors"
                  />
                  {lanes.length > 1 && (
                    <button onClick={() => removeLane(i)} className="p-1 text-jarvis-muted hover:text-jarvis-danger transition-colors">
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Fuel + Monthly */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="label mb-2">Fuel Surcharge %</div>
              <input
                value={fuelPct}
                onChange={e => setFuelPct(e.target.value)}
                type="number"
                className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-sm text-jarvis-ink outline-none focus:border-jarvis-primary/50 transition-colors"
              />
            </div>
            <div>
              <div className="label mb-2">Monthly Shipments (total)</div>
              <input
                value={monthlyShipments}
                onChange={e => setMonthlyShipments(e.target.value)}
                type="number"
                className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-sm text-jarvis-ink outline-none focus:border-jarvis-primary/50 transition-colors"
              />
            </div>
          </div>

          {/* Accessorials */}
          <div>
            <div className="label mb-2">Accessorial Charges</div>
            <div className="space-y-1 mb-2">
              {accessorials.map((a, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-jarvis-border bg-jarvis-surface text-xs">
                  <span className="text-jarvis-ink">{a.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-jarvis-body">${a.amount}</span>
                    <button onClick={() => setAccessorials(accessorials.filter((_, idx) => idx !== i))} className="text-jarvis-muted hover:text-jarvis-danger transition-colors">
                      <X size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newAcc.name}
                onChange={e => setNewAcc({ ...newAcc, name: e.target.value })}
                placeholder="Service name"
                onKeyDown={e => e.key === 'Enter' && addAccessorial()}
                className="flex-1 px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-jarvis-primary/50 transition-colors"
              />
              <input
                value={newAcc.amount}
                onChange={e => setNewAcc({ ...newAcc, amount: e.target.value })}
                placeholder="$"
                type="number"
                onKeyDown={e => e.key === 'Enter' && addAccessorial()}
                className="w-20 px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-jarvis-primary/50 transition-colors"
              />
              <button
                onClick={addAccessorial}
                className="px-3 py-2 rounded-xl bg-jarvis-primary/15 text-jarvis-primary text-xs font-semibold hover:bg-jarvis-primary/25 transition-colors"
              >
                Add
              </button>
            </div>
          </div>

          {/* Cost Summary */}
          {totalPerShipment > 0 && (
            <div className="rounded-2xl border border-jarvis-primary/20 bg-jarvis-primary/5 p-4">
              <div className="label mb-3">Cost Summary</div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-[10px] text-jarvis-muted uppercase tracking-wider mb-1">Per Shipment</div>
                  <div className="text-lg font-semibold text-jarvis-primary tabular-nums">${totalPerShipment.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-jarvis-muted uppercase tracking-wider mb-1">Monthly</div>
                  <div className="text-lg font-semibold text-jarvis-primary tabular-nums">${monthlyCost.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[10px] text-jarvis-muted uppercase tracking-wider mb-1">Annual</div>
                  <div className="text-lg font-semibold text-jarvis-success tabular-nums">${annualProjection.toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}

          {/* Services */}
          <div>
            <div className="label mb-2">Services Included</div>
            <div className="grid grid-cols-3 gap-2">
              {allServices.map(s => (
                <button
                  key={s}
                  onClick={() => toggleService(s)}
                  className={`px-3 py-2 rounded-xl text-xs text-left transition-all ${
                    services.includes(s)
                      ? 'bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/30'
                      : 'bg-jarvis-ghost text-jarvis-muted border border-jarvis-border hover:bg-jarvis-surface-hover'
                  }`}
                >
                  {services.includes(s) ? '✓ ' : ''}{s}
                </button>
              ))}
            </div>
          </div>

          {/* Terms */}
          <div>
            <div className="label mb-2">Terms</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-jarvis-muted uppercase tracking-wider mb-1">Valid Until</div>
                <input
                  value={terms.valid_until}
                  onChange={e => setTerms({ ...terms, valid_until: e.target.value })}
                  type="date"
                  className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-sm text-jarvis-ink outline-none focus:border-jarvis-primary/50 transition-colors"
                />
              </div>
              <div>
                <div className="text-[10px] text-jarvis-muted uppercase tracking-wider mb-1">Payment Terms</div>
                <input
                  value={terms.payment}
                  onChange={e => setTerms({ ...terms, payment: e.target.value })}
                  placeholder="Net 30"
                  className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-jarvis-primary/50 transition-colors"
                />
              </div>
              <div>
                <div className="text-[10px] text-jarvis-muted uppercase tracking-wider mb-1">Minimum Volume</div>
                <input
                  value={terms.minimum}
                  onChange={e => setTerms({ ...terms, minimum: e.target.value })}
                  placeholder="e.g. 20 shipments/mo"
                  className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-jarvis-primary/50 transition-colors"
                />
              </div>
              <div>
                <div className="text-[10px] text-jarvis-muted uppercase tracking-wider mb-1">Contract Length</div>
                <input
                  value={terms.contract_length}
                  onChange={e => setTerms({ ...terms, contract_length: e.target.value })}
                  placeholder="e.g. 12 months"
                  className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-jarvis-primary/50 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Executive Summary */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label">Executive Summary</div>
              <button
                onClick={generateSummary}
                disabled={generating || !companyName}
                className="text-[11px] text-jarvis-primary flex items-center gap-1 hover:underline disabled:opacity-50 transition-opacity"
              >
                {generating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                {generating ? 'Generating...' : 'AI Generate'}
              </button>
            </div>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              rows={3}
              placeholder="A brief executive summary for the client..."
              className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted outline-none resize-none focus:border-jarvis-primary/50 transition-colors"
            />
          </div>

          {/* Share URL (after save) */}
          {shareUrl && (
            <div className="rounded-2xl border border-jarvis-success/30 bg-jarvis-success/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <Link size={14} className="text-jarvis-success" />
                <span className="text-sm font-semibold text-jarvis-success">Proposal Link Ready</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={shareUrl}
                  readOnly
                  className="flex-1 px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink font-mono"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(shareUrl)}
                  className="px-3 py-2 rounded-xl bg-jarvis-primary/15 text-jarvis-primary text-xs font-semibold hover:bg-jarvis-primary/25 transition-colors whitespace-nowrap"
                >
                  Copy
                </button>
                <button
                  onClick={() => window.open(shareUrl, '_blank')}
                  className="p-2 rounded-xl bg-jarvis-ghost text-jarvis-body text-xs font-semibold hover:bg-jarvis-surface-hover transition-colors"
                  title="Preview"
                >
                  <Eye size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-jarvis-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm text-jarvis-body hover:text-jarvis-ink hover:bg-jarvis-ghost transition"
          >
            {shareUrl ? 'Close' : 'Cancel'}
          </button>
          <button
            onClick={save}
            disabled={saving || !companyName}
            className="px-4 py-2 rounded-xl text-sm font-semibold bg-jarvis-primary/15 text-jarvis-primary border border-jarvis-primary/30 hover:bg-jarvis-primary/25 disabled:opacity-40 transition flex items-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
            {shareUrl ? 'Regenerate Link' : 'Generate Proposal Link'}
          </button>
        </div>
      </div>
    </div>
  );
}
