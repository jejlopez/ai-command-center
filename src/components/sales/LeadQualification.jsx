// LeadQualification — smart filter questions form. Saves to lead.qualification JSONB.

import { useState } from "react";
import { supabase } from "../../lib/supabase.js";

const QUESTIONS = [
  { key: "daily_orders",            label: "Daily Orders",             type: "text",   placeholder: "e.g. 500" },
  { key: "current_provider",        label: "Current 3PL / Provider",   type: "text",   placeholder: "e.g. ShipBob" },
  { key: "monthly_spend",           label: "Monthly Spend",            type: "text",   placeholder: "e.g. $20k" },
  { key: "services_needed",         label: "Services Needed",          type: "text",   placeholder: "e.g. fulfillment, returns" },
  {
    key: "timeline",
    label: "Timeline",
    type: "select",
    options: [
      { value: "",           label: "— select —" },
      { value: "immediate",  label: "Immediate" },
      { value: "30_days",    label: "30 Days" },
      { value: "60_days",    label: "60 Days" },
      { value: "exploring",  label: "Just Exploring" },
    ],
  },
  {
    key: "decision_maker_access",
    label: "Decision Maker Access",
    type: "select",
    options: [
      { value: "",          label: "— select —" },
      { value: "direct",    label: "Direct" },
      { value: "indirect",  label: "Indirect" },
      { value: "unknown",   label: "Unknown" },
    ],
  },
  {
    key: "is_decision_maker",
    label: "Is Decision Maker?",
    type: "select",
    options: [
      { value: "",        label: "— select —" },
      { value: "true",    label: "Yes" },
      { value: "false",   label: "No" },
      { value: "unknown", label: "Unknown" },
    ],
  },
  { key: "estimated_monthly_value", label: "Estimated Monthly Value",  type: "text",   placeholder: "e.g. $15k" },
  { key: "bad_fit_reason",          label: "Bad Fit Reason (if any)",  type: "text",   placeholder: "e.g. too small" },
];

export function LeadQualification({ lead, onRefresh }) {
  const initial = lead?.qualification || {};
  const [values, setValues] = useState(
    Object.fromEntries(QUESTIONS.map(q => [q.key, initial[q.key] ?? ""]))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleChange = (key, val) => {
    setValues(v => ({ ...v, [key]: val }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await supabase
        .from("leads")
        .update({ qualification: { ...(lead.qualification || {}), ...values } })
        .eq("id", lead.id);
      setSaved(true);
      onRefresh?.();
    } catch {}
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-1">
        <span className="label">Qualification</span>
        <button
          onClick={save}
          disabled={saving}
          className="px-2.5 py-1 rounded-lg text-[9px] font-medium bg-jarvis-primary/10 text-jarvis-primary border border-jarvis-primary/15 hover:bg-jarvis-primary/20 disabled:opacity-40 transition-all"
        >
          {saving ? "Saving…" : saved ? "Saved ✓" : "Save"}
        </button>
      </div>

      {QUESTIONS.map(({ key, label, type, placeholder, options }) => (
        <div key={key} className="surface p-2.5">
          <div className="text-[9px] text-jarvis-muted uppercase tracking-wider mb-1">{label}</div>
          {type === "select" ? (
            <select
              value={values[key]}
              onChange={e => handleChange(key, e.target.value)}
              className="w-full bg-transparent text-[10px] text-jarvis-ink border-0 outline-none"
            >
              {options.map(o => (
                <option key={o.value} value={o.value} className="bg-jarvis-bg">
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={values[key]}
              placeholder={placeholder}
              onChange={e => handleChange(key, e.target.value)}
              className="w-full bg-transparent text-[10px] text-jarvis-ink placeholder-jarvis-muted/40 border-0 outline-none"
            />
          )}
        </div>
      ))}
    </div>
  );
}
