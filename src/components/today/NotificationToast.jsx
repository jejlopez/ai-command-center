import { useEffect, useState, useRef } from "react";
import { Zap, X } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

export function NotificationToast() {
  const [toasts, setToasts] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel("jarvis-suggestions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jarvis_suggestions" },
        (payload) => {
          const suggestion = payload.new;
          if (!suggestion?.suggestion) return;

          const id = suggestion.id ?? Date.now();
          setToasts((prev) => [...prev, { id, text: suggestion.suggestion, type: suggestion.type }]);

          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
          }, 8000);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const dismiss = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="glass border border-jarvis-cyan/30 shadow-glow-cyan p-4 rounded-2xl flex items-start gap-3 animate-slideUp"
        >
          <Zap size={16} className="text-jarvis-cyan shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-jarvis-cyan font-semibold uppercase tracking-wide">JARVIS</div>
            <div className="text-sm text-jarvis-ink mt-0.5">{t.text}</div>
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 p-1 rounded-lg text-jarvis-muted hover:text-jarvis-ink transition"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
