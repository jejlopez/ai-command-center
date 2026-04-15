// WinLossForm — structured post-mortem when deal closes.

import { useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { X, Loader2 } from "lucide-react";

const REASONS_WON = ["Pricing competitive", "Fast response time", "Service fit", "Relationship", "No competition", "Other"];
const REASONS_LOST = ["Price too high", "Chose competitor", "Stayed in-house", "Timing not right", "Lost contact", "Requirements changed", "Other"];
const COMPETITORS = ["ShipBob", "Red Stag", "ShipStation", "Deliverr", "Stayed in-house", "Other"];

export function WinLossForm({ dealId, outcome, onClose, onSaved }) {
  const [form, setForm] = useState({
    primary_reason: "",
    what_worked: "",
    what_didnt: "",
    lost_to: "",
    would_change: "",
  });
  const [saving, setSaving] = useState(false);

  const reasons = outcome === "won" ? REASONS_WON : REASONS_LOST;

  const save = async () => {
    if (!supabase || !form.primary_reason) return;
    setSaving(true);
    try {
      await supabase.from("win_loss_reviews").insert({
        deal_id: dealId,
        outcome,
        ...form,
      });

      // Also create a learning_event
      await supabase.from("learning_events").insert({
        deal_id: dealId,
        event_type: outcome === "won" ? "deal_won" : "deal_lost",
        outcome: form,
      });

      onSaved?.();
      onClose?.();
    } catch (e) {
      console.error("Win/loss save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  const update = (key, value) => setForm(f => ({ ...f, [key]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-jarvis-surface border border-jarvis-border rounded-xl w-full max-w-md p-5 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <div>
            <div className={`text-sm font-bold ${outcome === "won" ? "text-jarvis-success" : "text-jarvis-danger"}`}>
              {outcome === "won" ? "🎉 Deal Won" : "Deal Lost"}
            </div>
            <div className="text-[10px] text-jarvis-muted">Quick debrief — helps Jarvis learn</div>
          </div>
          <button onClick={onClose} className="text-jarvis-ghost hover:text-jarvis-ink p-1"><X size={14} /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] text-jarvis-muted font-medium block mb-1">Primary reason?</label>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map(r => (
                <button
                  key={r}
                  onClick={() => update("primary_reason", r)}
                  className={`text-[10px] px-2.5 py-1 rounded-full transition ${
                    form.primary_reason === r
                      ? "bg-jarvis-primary/15 text-jarvis-primary"
                      : "bg-white/4 text-jarvis-muted hover:text-jarvis-ink"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-jarvis-muted font-medium block mb-1">What worked?</label>
            <textarea
              value={form.what_worked}
              onChange={e => update("what_worked", e.target.value)}
              placeholder="Fast proposal turnaround, addressed pain points..."
              className="w-full bg-jarvis-bg border border-jarvis-border rounded px-3 py-2 text-[11px] text-jarvis-ink placeholder:text-jarvis-ghost resize-none h-16"
            />
          </div>

          <div>
            <label className="text-[10px] text-jarvis-muted font-medium block mb-1">What didn't work?</label>
            <textarea
              value={form.what_didnt}
              onChange={e => update("what_didnt", e.target.value)}
              placeholder="Took too long to get pricing approved..."
              className="w-full bg-jarvis-bg border border-jarvis-border rounded px-3 py-2 text-[11px] text-jarvis-ink placeholder:text-jarvis-ghost resize-none h-16"
            />
          </div>

          {outcome === "lost" && (
            <div>
              <label className="text-[10px] text-jarvis-muted font-medium block mb-1">Lost to?</label>
              <div className="flex flex-wrap gap-1.5">
                {COMPETITORS.map(c => (
                  <button
                    key={c}
                    onClick={() => update("lost_to", c)}
                    className={`text-[10px] px-2.5 py-1 rounded-full transition ${
                      form.lost_to === c
                        ? "bg-jarvis-danger/15 text-jarvis-danger"
                        : "bg-white/4 text-jarvis-muted hover:text-jarvis-ink"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="text-[10px] text-jarvis-muted font-medium block mb-1">What would you change?</label>
            <textarea
              value={form.would_change}
              onChange={e => update("would_change", e.target.value)}
              placeholder="Lead with international pricing for whales..."
              className="w-full bg-jarvis-bg border border-jarvis-border rounded px-3 py-2 text-[11px] text-jarvis-ink placeholder:text-jarvis-ghost resize-none h-16"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button
            onClick={save}
            disabled={saving || !form.primary_reason}
            className={`flex-1 py-2 rounded-lg text-[11px] font-semibold disabled:opacity-50 ${
              outcome === "won"
                ? "bg-jarvis-success/15 text-jarvis-success"
                : "bg-jarvis-danger/15 text-jarvis-danger"
            }`}
          >
            {saving ? <Loader2 size={12} className="animate-spin mx-auto" /> : "Save Debrief"}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-[11px] text-jarvis-muted bg-white/5">
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
