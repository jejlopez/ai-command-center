import { useState, useMemo } from "react";
import { FileText, X, Link, Eye, Loader2, Sparkles, TrendingUp, DollarSign } from "lucide-react";
import { supabase } from "../../lib/supabase.js";
import { jarvis } from "../../lib/jarvis.js";

function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), b => b.toString(36)).join('').slice(0, 12);
}

const DEFAULTS = {
  storage: {
    small_30x36x24: 6.00,
    standard_40x48x60: 14.75,
    tall_40x48x72: 25.00,
    oversized_40x48xover72: 40.00,
  },
  receiving_palletized: {
    single_sku: 13.50,
    two_sku: 35.00,
    mixed_sku: 75.00,
  },
  receiving_loose: {
    per_carton: 2.50,
    count_per_piece: 0.50,
  },
  container_unloading: {
    twenty_ft: 425.00,
    forty_ft: 650.00,
    fortyfive_ft: 700.00,
    additional_250_packages: 45.00,
    additional_10_skus: 45.00,
  },
  outbound_parcel: {
    order_processing: 3.50,
    per_pick: 0.75,
    rush_order: 30.00,
  },
  outbound_pallet: {
    per_pallet: 13.50,
    per_pick: 0.75,
    bol: 4.50,
    rush_order: 30.00,
  },
  special_projects: {
    man_hour: 40.00,
    man_hour_forklift: 45.00,
    man_hour_manager: 55.00,
    label: 0.50,
    serial_scan: 0.50,
  },
  integrations: {
    prebuilt: 750.00,
    monthly: 125.00,
    custom_per_hour: 150.00,
    edi: "TBD",
  },
  rebill_per_tracking: 7.50,
  minimums: {
    handling: 2500,
    storage: 1000,
  },
};

const LABOR_RATE_DEFAULT = 22; // $ per hour for margin estimate

function RateInput({ value, onChange, prefix = "$", step = "0.01", disabled = false }) {
  return (
    <div className="flex items-center gap-1">
      {prefix && <span className="text-[10px] text-jarvis-muted">{prefix}</span>}
      <input
        type={disabled ? "text" : "number"}
        value={value}
        onChange={disabled ? undefined : e => onChange(e.target.value)}
        readOnly={disabled}
        step={step}
        min="0"
        className="w-20 px-2 py-1 rounded-lg bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink text-right outline-none focus:border-jarvis-primary/50 transition-colors disabled:opacity-50"
      />
    </div>
  );
}

function SectionTable({ title, rows }) {
  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-widest text-jarvis-muted mb-1 font-medium">{title}</div>
      <div className="border border-jarvis-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <tbody>
            {rows.map(([label, ...inputs], i) => (
              <tr key={i} className={i % 2 === 0 ? "bg-jarvis-ghost/30" : "bg-jarvis-ghost/10"}>
                <td className="px-3 py-1.5 text-jarvis-body flex-1">{label}</td>
                <td className="px-3 py-1.5 text-right">{inputs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProposalGenerator({ deal, onClose, onSaved }) {
  // Client Info
  const [companyName, setCompanyName] = useState(deal?.company ?? '');
  const [contactName, setContactName] = useState(deal?.contact_name ?? '');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [acctContact, setAcctContact] = useState('');
  const [acctPhone, setAcctPhone] = useState('');
  const [acctEmail, setAcctEmail] = useState('');

  // Pricing state — deeply nested
  const [rates, setRates] = useState(DEFAULTS);

  // Volume estimate
  const [volPallets, setVolPallets] = useState('');
  const [volOrders, setVolOrders] = useState('');
  const [volPicks, setVolPicks] = useState('');

  // Revenue impact
  const [laborRate, setLaborRate] = useState(String(LABOR_RATE_DEFAULT));

  // UI state
  const [summary, setSummary] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState(null);

  const setRate = (section, key, val) => {
    setRates(prev => ({
      ...prev,
      [section]: typeof prev[section] === 'object' && !Array.isArray(prev[section])
        ? { ...prev[section], [key]: val }
        : val,
    }));
  };

  const setTopRate = (key, val) => {
    setRates(prev => ({ ...prev, [key]: val }));
  };

  // ── Monthly estimate ──────────────────────────────────────────────────────
  const estimates = useMemo(() => {
    const pallets = parseFloat(volPallets) || 0;
    const orders = parseFloat(volOrders) || 0;
    const picks = parseFloat(volPicks) || 0;

    const storageRevenue = pallets * (parseFloat(rates.storage.standard_40x48x60) || 0);
    const storageActual = Math.max(storageRevenue, parseFloat(rates.minimums.storage) || 0);

    const orderRevenue = orders * (parseFloat(rates.outbound_parcel.order_processing) || 0);
    const pickRevenue = picks * (parseFloat(rates.outbound_parcel.per_pick) || 0);
    const handlingRevenue = orderRevenue + pickRevenue;
    const handlingActual = Math.max(handlingRevenue, parseFloat(rates.minimums.handling) || 0);

    const monthlyRevenue = storageActual + handlingActual;
    const annualRevenue = monthlyRevenue * 12;

    // Margin: assume labor hours = picks / 30 picks/hr
    const labor = parseFloat(laborRate) || LABOR_RATE_DEFAULT;
    const estLaborHours = (picks || orders * 3) / 30;
    const estLaborCost = estLaborHours * labor;
    const monthlyMargin = monthlyRevenue - estLaborCost;
    const marginPct = monthlyRevenue > 0 ? (monthlyMargin / monthlyRevenue) * 100 : 0;

    return { monthlyRevenue, annualRevenue, monthlyMargin, marginPct, estLaborCost };
  }, [volPallets, volOrders, volPicks, rates, laborRate]);

  const generateSummary = async () => {
    setGenerating(true);
    try {
      const result = await jarvis.ask(
        `Write a 2-3 sentence executive summary for a 3PL warehousing & fulfillment agreement proposal to ${companyName || 'the client'}. ` +
        `Estimated monthly volume: ${volPallets || 0} pallets stored, ${volOrders || 0} orders/month, ${volPicks || 0} picks/month. ` +
        `Estimated monthly cost: $${estimates.monthlyRevenue.toLocaleString()}. ` +
        `Company: 3PL Center LLC, NJ. Keep it professional and compelling. No markdown.`,
        { kind: 'summary' }
      );
      setSummary(result.text);
    } catch {
      setSummary(`We are pleased to present our warehousing and fulfillment agreement to ${companyName || 'your organization'}. 3PL Center LLC offers competitive rates, 99% inventory accuracy, and end-to-end logistics support from our New Jersey facility.`);
    }
    setGenerating(false);
  };

  const save = async () => {
    if (!supabase) return;
    setSaving(true);
    try {
      const token = generateToken();
      const pricing = {
        ...rates,
        estimated_monthly_volume: {
          pallets: parseFloat(volPallets) || 0,
          orders: parseFloat(volOrders) || 0,
          picks: parseFloat(volPicks) || 0,
        },
        monthly_estimate: estimates.monthlyRevenue,
        annual_estimate: estimates.annualRevenue,
        // Legacy compat
        monthly_cost: estimates.monthlyRevenue,
        annual_projection: estimates.annualRevenue,
      };

      const { error } = await supabase.from('proposals').insert({
        deal_id: deal?.id ?? null,
        name: `Warehousing Agreement — ${companyName}`,
        version: 1,
        status: 'draft',
        pricing,
        company_name: companyName,
        client_name: contactName,
        client_email: contactEmail,
        client_phone: contactPhone,
        business_address: businessAddress,
        accounting_contact: { name: acctContact, phone: acctPhone, email: acctEmail },
        executive_summary: summary,
        share_token: token,
      });

      if (error) throw error;

      const url = `http://127.0.0.1:8787/proposal/${token}`;
      setShareUrl(url);
      onSaved?.();
    } catch (e) {
      console.error('Save failed:', e);
    }
    setSaving(false);
  };

  const inputCls = "px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-jarvis-primary/50 transition-colors";

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col glass border border-jarvis-border overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-jarvis-border">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-jarvis-primary" />
            <span className="text-lg font-semibold text-jarvis-ink">3PL Center — Warehousing Agreement</span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-jarvis-muted hover:text-jarvis-ink hover:bg-jarvis-ghost transition">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* ── Client Info ── */}
          <div>
            <div className="label mb-2">Client Information</div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Company name *" className={inputCls} />
              <input value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Contact name" className={inputCls} />
              <input value={contactEmail} onChange={e => setContactEmail(e.target.value)} placeholder="Contact email" type="email" className={inputCls} />
              <input value={contactPhone} onChange={e => setContactPhone(e.target.value)} placeholder="Contact phone" type="tel" className={inputCls} />
            </div>
            <input value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} placeholder="Business address" className={`${inputCls} w-full mb-3`} />
            <div className="text-[10px] uppercase tracking-widest text-jarvis-muted mb-1.5 font-medium">Accounting Contact</div>
            <div className="grid grid-cols-3 gap-3">
              <input value={acctContact} onChange={e => setAcctContact(e.target.value)} placeholder="Name" className={inputCls} />
              <input value={acctPhone} onChange={e => setAcctPhone(e.target.value)} placeholder="Phone" type="tel" className={inputCls} />
              <input value={acctEmail} onChange={e => setAcctEmail(e.target.value)} placeholder="Email" type="email" className={inputCls} />
            </div>
          </div>

          {/* ── Storage Rates ── */}
          <SectionTable
            title="Monthly Storage"
            rows={[
              ["30×36×24 (small pallet)", <RateInput value={rates.storage.small_30x36x24} onChange={v => setRate('storage','small_30x36x24',v)} />],
              ["40×48×60 (standard)", <RateInput value={rates.storage.standard_40x48x60} onChange={v => setRate('storage','standard_40x48x60',v)} />],
              ["40×48×72 (tall)", <RateInput value={rates.storage.tall_40x48x72} onChange={v => setRate('storage','tall_40x48x72',v)} />],
              ["40×48×over 72 (oversized)", <RateInput value={rates.storage.oversized_40x48xover72} onChange={v => setRate('storage','oversized_40x48xover72',v)} />],
            ]}
          />

          {/* ── Receiving Palletized ── */}
          <SectionTable
            title="Receiving — Palletized"
            rows={[
              ["Per pallet (1 SKU)", <RateInput value={rates.receiving_palletized.single_sku} onChange={v => setRate('receiving_palletized','single_sku',v)} />],
              ["Per pallet (2 SKUs)", <RateInput value={rates.receiving_palletized.two_sku} onChange={v => setRate('receiving_palletized','two_sku',v)} />],
              ["Per pallet (Mixed SKU)", <RateInput value={rates.receiving_palletized.mixed_sku} onChange={v => setRate('receiving_palletized','mixed_sku',v)} />],
            ]}
          />

          {/* ── Receiving Loose ── */}
          <SectionTable
            title="Receiving — Loose Cartons"
            rows={[
              ["Per carton", <RateInput value={rates.receiving_loose.per_carton} onChange={v => setRate('receiving_loose','per_carton',v)} />],
              ["Counting pieces (per piece)", <RateInput value={rates.receiving_loose.count_per_piece} onChange={v => setRate('receiving_loose','count_per_piece',v)} />],
            ]}
          />

          {/* ── Container Unloading ── */}
          <SectionTable
            title="Container Unloading (floor loaded, incl. 10 SKUs)"
            rows={[
              ["20' container (incl. 500 cartons)", <RateInput value={rates.container_unloading.twenty_ft} onChange={v => setRate('container_unloading','twenty_ft',v)} />],
              ["40' container (incl. 1000 cartons)", <RateInput value={rates.container_unloading.forty_ft} onChange={v => setRate('container_unloading','forty_ft',v)} />],
              ["45' container (incl. 1000 cartons)", <RateInput value={rates.container_unloading.fortyfive_ft} onChange={v => setRate('container_unloading','fortyfive_ft',v)} />],
              ["Each additional 250 packages", <RateInput value={rates.container_unloading.additional_250_packages} onChange={v => setRate('container_unloading','additional_250_packages',v)} />],
              ["Each additional 10 SKUs", <RateInput value={rates.container_unloading.additional_10_skus} onChange={v => setRate('container_unloading','additional_10_skus',v)} />],
            ]}
          />

          {/* ── Outbound Small Parcel ── */}
          <SectionTable
            title="Outbound — Small Parcel (FedEx / UPS / USPS)"
            rows={[
              ["Order processing", <RateInput value={rates.outbound_parcel.order_processing} onChange={v => setRate('outbound_parcel','order_processing',v)} />],
              ["Per pick (under 30 lbs)", <RateInput value={rates.outbound_parcel.per_pick} onChange={v => setRate('outbound_parcel','per_pick',v)} />],
              ["Rush order fee", <RateInput value={rates.outbound_parcel.rush_order} onChange={v => setRate('outbound_parcel','rush_order',v)} />],
            ]}
          />

          {/* ── Outbound Palletization ── */}
          <SectionTable
            title="Outbound — Palletization (LTL / FTL)"
            rows={[
              ["Per pallet", <RateInput value={rates.outbound_pallet.per_pallet} onChange={v => setRate('outbound_pallet','per_pallet',v)} />],
              ["Per pick (under 30 lbs)", <RateInput value={rates.outbound_pallet.per_pick} onChange={v => setRate('outbound_pallet','per_pick',v)} />],
              ["Bill of lading", <RateInput value={rates.outbound_pallet.bol} onChange={v => setRate('outbound_pallet','bol',v)} />],
              ["Rush order fee", <RateInput value={rates.outbound_pallet.rush_order} onChange={v => setRate('outbound_pallet','rush_order',v)} />],
            ]}
          />

          {/* ── Special Projects ── */}
          <SectionTable
            title="Special Projects"
            rows={[
              ["Per man hour (standard)", <RateInput value={rates.special_projects.man_hour} onChange={v => setRate('special_projects','man_hour',v)} />],
              ["Per man hour (forklift)", <RateInput value={rates.special_projects.man_hour_forklift} onChange={v => setRate('special_projects','man_hour_forklift',v)} />],
              ["Per man hour (manager)", <RateInput value={rates.special_projects.man_hour_manager} onChange={v => setRate('special_projects','man_hour_manager',v)} />],
              ["Per carton / pallet label", <RateInput value={rates.special_projects.label} onChange={v => setRate('special_projects','label',v)} />],
              ["Scanning serial #", <RateInput value={rates.special_projects.serial_scan} onChange={v => setRate('special_projects','serial_scan',v)} />],
            ]}
          />

          {/* ── Integrations ── */}
          <SectionTable
            title="Integrations"
            rows={[
              ["Pre-built (Amazon, Shopify, etc.) — one-time", <RateInput value={rates.integrations.prebuilt} onChange={v => setRate('integrations','prebuilt',v)} />],
              ["Monthly integration fee", <RateInput value={rates.integrations.monthly} onChange={v => setRate('integrations','monthly',v)} />],
              ["Custom integration (per hour)", <RateInput value={rates.integrations.custom_per_hour} onChange={v => setRate('integrations','custom_per_hour',v)} />],
              ["EDI", <RateInput value={rates.integrations.edi} onChange={v => setRate('integrations','edi',v)} prefix="" disabled={rates.integrations.edi === 'TBD'} />],
            ]}
          />

          {/* ── Re-Bill & Minimums ── */}
          <SectionTable
            title="3PL Re-Bill & Monthly Minimums"
            rows={[
              ["Re-bill per tracking (FedEx/UPS/USPS/DHL)", <RateInput value={rates.rebill_per_tracking} onChange={v => setTopRate('rebill_per_tracking',v)} />],
              ["Monthly handling minimum", <RateInput value={rates.minimums.handling} onChange={v => setRate('minimums','handling',v)} step="1" />],
              ["Monthly storage minimum", <RateInput value={rates.minimums.storage} onChange={v => setRate('minimums','storage',v)} step="1" />],
            ]}
          />

          {/* ── Estimated Monthly Volume ── */}
          <div>
            <div className="label mb-2">Estimated Monthly Volume</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-jarvis-muted mb-1">Pallets stored</div>
                <input value={volPallets} onChange={e => setVolPallets(e.target.value)} type="number" min="0" placeholder="0" className={inputCls} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-jarvis-muted mb-1">Orders / month</div>
                <input value={volOrders} onChange={e => setVolOrders(e.target.value)} type="number" min="0" placeholder="0" className={inputCls} />
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-jarvis-muted mb-1">Total picks / month</div>
                <input value={volPicks} onChange={e => setVolPicks(e.target.value)} type="number" min="0" placeholder="0" className={inputCls} />
              </div>
            </div>
          </div>

          {/* ── Revenue Impact ── */}
          {(volPallets || volOrders || volPicks) && (
            <div className="rounded-2xl border border-jarvis-primary/20 bg-jarvis-primary/5 p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-jarvis-primary" />
                <div className="label">Revenue Impact</div>
              </div>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="text-center">
                  <div className="text-[10px] text-jarvis-muted uppercase tracking-wider mb-1">Monthly Revenue</div>
                  <div className="text-base font-semibold text-jarvis-primary tabular-nums">${estimates.monthlyRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-jarvis-muted uppercase tracking-wider mb-1">Annual Projection</div>
                  <div className="text-base font-semibold text-emerald-400 tabular-nums">${estimates.annualRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-jarvis-muted uppercase tracking-wider mb-1">Est. Margin</div>
                  <div className="text-base font-semibold text-jarvis-ink tabular-nums">${estimates.monthlyMargin.toLocaleString(undefined, { maximumFractionDigits: 0 })}/mo</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-jarvis-muted uppercase tracking-wider mb-1">Margin %</div>
                  <div className={`text-base font-semibold tabular-nums ${estimates.marginPct >= 50 ? 'text-emerald-400' : estimates.marginPct >= 30 ? 'text-yellow-400' : 'text-red-400'}`}>{estimates.marginPct.toFixed(1)}%</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-[10px] text-jarvis-muted uppercase tracking-wider">Labor rate for margin calc:</div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-jarvis-muted">$</span>
                  <input value={laborRate} onChange={e => setLaborRate(e.target.value)} type="number" min="0" step="1" className="w-16 px-2 py-1 rounded-lg bg-jarvis-ghost border border-jarvis-border text-xs text-jarvis-ink text-right outline-none focus:border-jarvis-primary/50" />
                  <span className="text-[10px] text-jarvis-muted">/hr</span>
                </div>
              </div>
            </div>
          )}

          {/* ── AI Summary ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="label">Executive Summary</div>
              <button
                onClick={generateSummary}
                disabled={generating || !companyName}
                className="text-[11px] text-jarvis-primary flex items-center gap-1 hover:underline disabled:opacity-40 disabled:no-underline transition"
              >
                {generating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                {generating ? 'Generating…' : 'AI Generate'}
              </button>
            </div>
            <textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Executive summary for this agreement…"
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted outline-none focus:border-jarvis-primary/50 transition-colors resize-none"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-jarvis-border flex items-center gap-3">
          {shareUrl ? (
            <>
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-jarvis-ghost border border-jarvis-border overflow-hidden">
                <Link size={14} className="text-jarvis-primary flex-shrink-0" />
                <span className="text-xs text-jarvis-body truncate">{shareUrl}</span>
              </div>
              <button
                onClick={() => { navigator.clipboard.writeText(shareUrl); }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-jarvis-primary/15 text-jarvis-primary hover:bg-jarvis-primary/25 transition-colors flex-shrink-0"
              >
                Copy Link
              </button>
              <button
                onClick={() => window.open(shareUrl, '_blank')}
                className="px-3 py-2 rounded-xl text-xs font-semibold border border-jarvis-border text-jarvis-body hover:bg-jarvis-ghost transition-colors flex-shrink-0 flex items-center gap-1"
              >
                <Eye size={12} /> Preview
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-jarvis-muted border border-jarvis-border hover:bg-jarvis-ghost transition-colors">
                Cancel
              </button>
              <button
                onClick={save}
                disabled={saving || !companyName}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-jarvis-primary/15 text-jarvis-primary border border-jarvis-primary/20 hover:bg-jarvis-primary/25 disabled:opacity-40 transition-colors"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {saving ? 'Saving…' : 'Save & Generate Link'}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
