// DealDiscovery — discovery requirements grid for a deal.
// Fetches from supabase `discovery_requirements` table where deal_id matches.

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const STATUS_COLORS = {
  complete: "text-jarvis-success bg-jarvis-success/10",
  partial: "text-jarvis-warning bg-jarvis-warning/10",
  unknown: "text-jarvis-danger bg-jarvis-danger/10",
};

function statusLabel(s) {
  if (s === "complete") return "Complete";
  if (s === "partial") return "Partial";
  return "Unknown";
}

function deriveStatus(answer) {
  if (!answer || answer.trim() === "") return "unknown";
  if (answer.trim().length < 10) return "partial";
  return "complete";
}

export function DealDiscovery({ dealId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  useEffect(() => {
    if (!supabase || !dealId) { setLoading(false); return; }
    supabase
      .from("discovery_requirements")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { setItems(data ?? []); setLoading(false); });
  }, [dealId]);

  const complete = items.filter(i => i.status === "complete").length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((complete / total) * 100);

  const updateAnswer = async (item, answer) => {
    const newStatus = answer.trim() === "" ? "partial" : "complete";
    const patch = { answer, status: newStatus, answered_at: new Date().toISOString() };
    setSaving(prev => ({ ...prev, [item.id]: true }));
    if (supabase) {
      await supabase.from("discovery_requirements").update(patch).eq("id", item.id);
    }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i));
    setSaving(prev => ({ ...prev, [item.id]: false }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-jarvis-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="text-[11px] text-jarvis-muted py-4">No discovery requirements yet.</div>;
  }

  return (
    <div className="space-y-3">
      {/* Progress */}
      <div>
        <div className="flex justify-between text-[9px] text-jarvis-muted mb-1">
          <span>Discovery Progress</span>
          <span>{complete}/{total} complete ({pct}%)</span>
        </div>
        <div className="h-1.5 rounded-full bg-jarvis-ghost overflow-hidden">
          <div
            className="h-full rounded-full bg-jarvis-success transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Requirements */}
      {items.map(item => (
        <div key={item.id} className="surface p-2.5 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            {item.category && (
              <span className="text-[8px] text-jarvis-muted uppercase tracking-wider">{item.category}</span>
            )}
            <span className={`text-[8px] px-1.5 py-0.5 rounded-full ml-auto ${STATUS_COLORS[item.status] ?? STATUS_COLORS.unknown}`}>
              {statusLabel(item.status)}
            </span>
          </div>
          <div className="text-[11px] text-jarvis-ink leading-snug">{item.question}</div>
          <textarea
            defaultValue={item.answer ?? ""}
            rows={2}
            placeholder="Enter answer…"
            className="w-full px-2 py-1.5 rounded-lg bg-jarvis-ghost border border-jarvis-border text-[10px] text-jarvis-ink outline-none resize-none focus:border-jarvis-primary/40 transition"
            onBlur={e => {
              if (e.target.value !== (item.answer ?? "")) {
                updateAnswer(item, e.target.value);
              }
            }}
          />
          {saving[item.id] && (
            <div className="text-[8px] text-jarvis-muted flex items-center gap-1">
              <Loader2 size={9} className="animate-spin" /> Saving…
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
