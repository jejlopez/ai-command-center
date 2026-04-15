// DealObjections — objection tracker for a deal.
// Fetches from supabase `objections` table where deal_id matches.

import { useState, useEffect } from "react";
import { Plus, Check, X, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const STATUS_COLORS = {
  open: "text-jarvis-danger bg-jarvis-danger/10",
  addressed: "text-jarvis-warning bg-jarvis-warning/10",
  resolved: "text-jarvis-success bg-jarvis-success/10",
};

function statusLabel(s) {
  if (s === "resolved") return "Resolved";
  if (s === "addressed") return "Addressed";
  return "Open";
}

export function DealObjections({ dealId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [resolving, setResolving] = useState({});

  useEffect(() => {
    if (!supabase || !dealId) { setLoading(false); return; }
    supabase
      .from("objections")
      .select("*")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setItems(data ?? []); setLoading(false); });
  }, [dealId]);

  const openCount = items.filter(i => i.status === "open").length;

  const addObjection = async () => {
    if (!draft.trim()) return;
    setSaving(true);
    const row = {
      deal_id: dealId,
      objection: draft.trim(),
      status: "open",
      created_at: new Date().toISOString(),
    };
    if (supabase) {
      const { data } = await supabase.from("objections").insert(row).select().single();
      if (data) { setItems(prev => [data, ...prev]); }
      else { setItems(prev => [{ ...row, id: Date.now() }, ...prev]); }
    } else {
      setItems(prev => [{ ...row, id: Date.now() }, ...prev]);
    }
    setDraft("");
    setAdding(false);
    setSaving(false);
  };

  const resolve = async (item) => {
    const patch = { status: "resolved", resolved_at: new Date().toISOString() };
    setResolving(prev => ({ ...prev, [item.id]: true }));
    if (supabase) {
      await supabase.from("objections").update(patch).eq("id", item.id);
    }
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...patch } : i));
    setResolving(prev => ({ ...prev, [item.id]: false }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={18} className="animate-spin text-jarvis-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-jarvis-muted">
          {openCount > 0 ? (
            <span className="text-jarvis-danger font-medium">{openCount} open objection{openCount !== 1 ? "s" : ""}</span>
          ) : (
            <span className="text-jarvis-success">No open objections</span>
          )}
        </div>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-jarvis-ghost text-jarvis-muted text-[9px] hover:text-jarvis-ink transition"
          >
            <Plus size={10} /> Add
          </button>
        )}
      </div>

      {/* Inline add form */}
      {adding && (
        <div className="surface p-2.5 space-y-2">
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={2}
            placeholder="Describe the objection…"
            className="w-full px-2 py-1.5 rounded-lg bg-jarvis-ghost border border-jarvis-border text-[10px] text-jarvis-ink outline-none resize-none focus:border-jarvis-primary/40 transition"
          />
          <div className="flex gap-2">
            <button
              onClick={addObjection}
              disabled={saving || !draft.trim()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-jarvis-primary/15 text-jarvis-primary text-[9px] font-semibold disabled:opacity-40 transition"
            >
              {saving ? <Loader2 size={9} className="animate-spin" /> : <Check size={9} />} Save
            </button>
            <button
              onClick={() => { setAdding(false); setDraft(""); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-jarvis-ghost text-jarvis-muted text-[9px] transition hover:text-jarvis-ink"
            >
              <X size={9} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !adding && (
        <div className="text-[11px] text-jarvis-muted py-2">No objections logged. Good sign.</div>
      )}

      {/* Objection cards */}
      {items.map(item => (
        <div key={item.id} className="surface p-2.5 space-y-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[11px] text-jarvis-ink leading-snug flex-1">{item.objection}</div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${STATUS_COLORS[item.status] ?? STATUS_COLORS.open}`}>
                {statusLabel(item.status)}
              </span>
              {item.status !== "resolved" && (
                <button
                  onClick={() => resolve(item)}
                  disabled={resolving[item.id]}
                  className="p-1 rounded-lg text-jarvis-success/60 hover:bg-jarvis-success/10 hover:text-jarvis-success transition disabled:opacity-40"
                  title="Mark resolved"
                >
                  {resolving[item.id] ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                </button>
              )}
            </div>
          </div>
          {item.response && (
            <div className="rounded-lg bg-jarvis-ghost px-2 py-1.5 text-[10px] text-jarvis-body leading-relaxed">
              {item.response}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
