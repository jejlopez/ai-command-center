import { useEffect, useState, useRef } from "react";
import { Activity } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

export function LivePnL() {
  const [positions, setPositions] = useState([]);
  const channelRef = useRef(null);

  const load = async () => {
    if (!supabase) return;
    const { data } = await supabase.from("positions").select("id, ticker, pnl, size, entry_price").eq("status", "open");
    setPositions(data ?? []);
  };

  useEffect(() => {
    load();
    if (!supabase) return;
    const ch = supabase.channel("live-pnl")
      .on("postgres_changes", { event: "*", schema: "public", table: "positions" }, load)
      .subscribe();
    channelRef.current = ch;
    return () => { supabase?.removeChannel(ch); };
  }, []);

  const totalPnl = positions.reduce((s, p) => s + (p.pnl ?? 0), 0);
  const totalExposure = positions.reduce((s, p) => s + Math.abs((p.size ?? 0) * (p.entry_price ?? 0)), 0);
  const positive = totalPnl >= 0;

  if (!supabase) return null;

  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={14} className={positive ? "text-jarvis-green" : "text-jarvis-red"} />
        <span className="label">Live P&amp;L</span>
        <span className="ml-auto">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-jarvis-green animate-pulse" />
        </span>
      </div>
      {positions.length === 0 ? (
        <p className="text-sm text-jarvis-muted">No open positions.</p>
      ) : (
        <>
          <div
            className={`text-4xl font-bold tabular-nums mb-1 transition-all ${positive ? "text-jarvis-green drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]" : "text-jarvis-red drop-shadow-[0_0_12px_rgba(248,113,113,0.4)]"}`}
          >
            {positive ? "+" : ""}${totalPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
          <p className="text-xs text-jarvis-muted">
            {positions.length} open position{positions.length !== 1 ? "s" : ""} · ${totalExposure.toLocaleString(undefined, { maximumFractionDigits: 0 })} exposure
          </p>
        </>
      )}
    </div>
  );
}
