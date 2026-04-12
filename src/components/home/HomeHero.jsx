import { Home, AlertTriangle, CheckCircle2, Calendar, DollarSign } from "lucide-react";

function Chip({ icon: Icon, label, value, color }) {
  return (
    <div className={`chip bg-jarvis-surface/40 border ${color} gap-2 px-3 py-1.5`}>
      <Icon size={12} className={color.replace("border-", "text-")} />
      <span className="text-jarvis-muted">{label}</span>
      <span className={`font-semibold ${color.replace("border-", "text-")}`}>{value}</span>
    </div>
  );
}

export function HomeHero({ taskCount, overdueExpenses, dueThisWeek, nextMaintenance }) {
  const totalAttention = taskCount + overdueExpenses;
  const allClear = totalAttention === 0;

  const statusLine = allClear
    ? "All clear at home."
    : `${totalAttention} thing${totalAttention !== 1 ? "s" : ""} need${totalAttention === 1 ? "s" : ""} attention.`;

  const statusColor = allClear ? "text-jarvis-green" : "text-amber-400";
  const borderColor = allClear ? "border-jarvis-purple/30" : "border-amber-400/30";

  return (
    <div className={`glass p-6 border-l-4 border-jarvis-purple/60 ${borderColor} animate-fadeIn`}
      style={{ borderLeftColor: "#a78bfa" }}>
      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-7 h-7 rounded-lg bg-jarvis-purple/10 border border-jarvis-purple/20 grid place-items-center">
              <Home size={13} className="text-jarvis-purple" />
            </div>
            <span className="label">Home Operations</span>
          </div>

          <div className={`text-lg font-semibold mt-3 ${statusColor}`}>
            {allClear ? (
              <span className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-jarvis-green" />
                {statusLine}
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-amber-400" />
                {statusLine}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <Chip
              icon={AlertTriangle}
              label="tasks overdue"
              value={taskCount}
              color={taskCount > 0 ? "border-red-500/40" : "border-jarvis-border"}
            />
            <Chip
              icon={DollarSign}
              label="expenses due this week"
              value={dueThisWeek}
              color={dueThisWeek > 0 ? "border-amber-400/40" : "border-jarvis-border"}
            />
            {nextMaintenance && (
              <Chip
                icon={Calendar}
                label="next maintenance"
                value={nextMaintenance}
                color="border-jarvis-purple/30"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
