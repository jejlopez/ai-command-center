import { Loader2, Activity } from "lucide-react";

const STATIC_SYSTEMS = [
  { name: "HVAC Filter", lastService: 90, warningDays: 90, replaceDays: 90 },
  { name: "Smoke Detectors", lastService: 180, warningDays: 365, replaceDays: 365 },
  { name: "Water Heater", warrantyEnd: "2026-08-01", label: "warranty" },
  { name: "Roof Inspection", lastService: 400, warningDays: 365, replaceDays: 365 },
  { name: "HVAC Service", lastService: 200, warningDays: 180, replaceDays: 365 },
];

function statusFor(sys, assets = []) {
  // Check assets table for matching item
  const match = assets.find(a => a.name.toLowerCase().includes(sys.name.toLowerCase().split(" ")[0]));
  if (match?.warranty_end) {
    const daysLeft = Math.ceil((new Date(match.warranty_end) - new Date()) / 86_400_000);
    if (daysLeft < 0) return { color: "text-red-400", icon: "✗", note: "warranty expired" };
    if (daysLeft < 60) return { color: "text-amber-400", icon: "⚠", note: `warranty in ${daysLeft}d` };
    return { color: "text-green-400", icon: "✓", note: `warranty ok` };
  }
  if (sys.warrantyEnd) {
    const daysLeft = Math.ceil((new Date(sys.warrantyEnd) - new Date()) / 86_400_000);
    if (daysLeft < 0) return { color: "text-red-400", icon: "✗", note: "warranty expired" };
    if (daysLeft < 60) return { color: "text-amber-400", icon: "⚠", note: `warranty in ${daysLeft}d` };
    return { color: "text-green-400", icon: "✓", note: `warranty ok` };
  }
  const age = sys.lastService ?? 0;
  if (age > (sys.replaceDays ?? 365)) return { color: "text-red-400", icon: "✗", note: `${age}d ago — overdue` };
  if (age > (sys.warningDays ?? 180)) return { color: "text-amber-400", icon: "⚠", note: `${age}d ago` };
  return { color: "text-green-400", icon: "✓", note: `${age}d ago` };
}

export function HomeSystemsStatus({ assets = [], loading = false }) {
  return (
    <div className="glass p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity size={14} className="text-jarvis-purple" />
        <div className="label">Home Systems</div>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-[12px] text-jarvis-muted py-4"><Loader2 size={12} className="animate-spin" /> Loading…</div>
      ) : (
        <div className="space-y-1">
          {STATIC_SYSTEMS.map((sys) => {
            const st = statusFor(sys, assets);
            return (
              <div key={sys.name} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-transparent hover:border-jarvis-border transition">
                <span className={`text-sm font-mono ${st.color}`}>{st.icon}</span>
                <span className="text-sm text-jarvis-ink flex-1">{sys.name}</span>
                <span className={`text-[10px] ${st.color}`}>{st.note}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
