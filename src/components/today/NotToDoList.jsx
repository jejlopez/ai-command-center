import { useState, useEffect } from "react";
import { Ban, Plus, X } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const MAX_ACTIVE = 5;

export function NotToDoList({ notToDo = [] }) {
  const [items, setItems] = useState(notToDo.filter((i) => i.active));
  const [itemText, setItemText] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => { setItems(notToDo.filter((i) => i.active)); }, [notToDo]);

  async function addItem(e) {
    e.preventDefault();
    if (!itemText.trim() || !supabase || items.length >= MAX_ACTIVE) return;
    const { data, error } = await supabase.from("not_to_do").insert({
      item: itemText.trim(),
      reason: reason.trim() || null,
    }).select().single();
    if (!error && data) { setItems((r) => [...r, data]); setItemText(""); setReason(""); }
  }

  async function removeItem(id) {
    if (!supabase) return;
    await supabase.from("not_to_do").update({ active: false }).eq("id", id);
    setItems((r) => r.filter((i) => i.id !== id));
  }

  return (
    <div className="glass p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Ban size={14} className="text-jarvis-red" />
        <div className="label">Not-To-Do List</div>
        <span className="text-xs text-jarvis-muted ml-auto">{items.length}/{MAX_ACTIVE}</span>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-jarvis-muted">Add time-wasters you want to eliminate.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-start gap-2 px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-jarvis-ink">{item.item}</div>
                {item.reason && <div className="text-[11px] text-jarvis-muted mt-0.5">{item.reason}</div>}
                <div className="text-[10px] text-jarvis-ghost mt-0.5">
                  Added {new Date(item.added_at).toLocaleDateString()}
                </div>
              </div>
              <button onClick={() => removeItem(item.id)} className="p-1 text-jarvis-muted hover:text-jarvis-red shrink-0">
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      {items.length < MAX_ACTIVE && (
        <form onSubmit={addItem} className="flex flex-col gap-2 pt-2 border-t border-jarvis-border">
          <input
            value={itemText}
            onChange={(e) => setItemText(e.target.value)}
            placeholder="Time-waster to eliminate..."
            className="input-field text-sm"
          />
          <div className="flex gap-2">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why? (optional)"
              className="input-field text-sm flex-1"
            />
            <button type="submit" className="btn-primary flex items-center gap-1 text-sm px-3">
              <Plus size={13} /> Add
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
