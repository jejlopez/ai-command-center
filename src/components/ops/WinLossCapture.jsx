// WinLossCapture — modal to record win/loss reason when a deal closes.

import { useState } from "react";
import { Trophy, X, ThumbsDown } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const WON_REASONS = ["price", "service", "relationship", "timing", "product", "other"];
const LOST_REASONS = ["price", "competitor", "timing", "service", "went_silent", "no_budget", "other"];

export function WinLossCapture({ deal, onClose, onSaved }) {
  const won = deal?.stage === "closed_won";
  const [reason, setReason] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!reason) return;
    setSaving(true);
    if (supabase) {
      await supabase
        .from("deals")
        .update({
          loss_reason: won ? null : reason,
          win_reason: won ? reason : null,
          competitor_name: competitor || null,
          notes: notes || null,
        })
        .eq("id", deal.id);
    }
    setSaving(false);
    onSaved?.();
    onClose?.();
  }

  const reasons = won ? WON_REASONS : LOST_REASONS;
  const Icon = won ? Trophy : ThumbsDown;
  const accentColor = won ? "text-jarvis-success" : "text-jarvis-danger";
  const bgAccent = won ? "bg-jarvis-success/10" : "bg-jarvis-danger/10";
  const title = won ? `🎉 Won: ${deal?.company ?? "Deal"}` : `Lost: ${deal?.company ?? "Deal"}`;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass w-full max-w-md rounded-xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${bgAccent}`}>
              <Icon size={14} className={accentColor} />
            </div>
            <span className="font-semibold text-jarvis-ink">{title}</span>
          </div>
          <button onClick={onClose} className="text-jarvis-ghost hover:text-jarvis-ink transition">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label mb-2 block">
              {won ? "What was the deciding factor?" : "Why did we lose?"}
            </label>
            <div className="flex flex-wrap gap-1.5">
              {reasons.map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs border transition ${
                    reason === r
                      ? `border-jarvis-primary ${bgAccent} ${accentColor}`
                      : "border-jarvis-border text-jarvis-body hover:border-jarvis-primary/50"
                  }`}
                >
                  {r.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          {!won && (
            <div>
              <label className="label mb-1 block">Competitor (if lost to one)</label>
              <input
                className="input w-full text-xs"
                placeholder="e.g. FedEx, XPO, Coyote…"
                value={competitor}
                onChange={e => setCompetitor(e.target.value)}
              />
            </div>
          )}

          <div>
            <label className="label mb-1 block">Notes (optional)</label>
            <textarea
              className="input w-full text-xs h-20 resize-none"
              placeholder={won ? "What made this a win?" : "Any context that'll help next time?"}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="btn-ghost text-xs">Skip</button>
            <button
              onClick={handleSave}
              disabled={!reason || saving}
              className={`btn-primary text-xs disabled:opacity-40 ${won ? "" : "!bg-jarvis-danger/80 hover:!bg-jarvis-danger"}`}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
