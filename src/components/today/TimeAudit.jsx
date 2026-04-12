import { useState } from "react";
import { Plus, Clock } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

const ROLES = ["Sales", "Trading", "Build", "Admin", "Personal"];
const PLANNED = { Sales: 120, Trading: 90, Build: 180, Admin: 60, Personal: 30 }; // default plan mins

const ROLE_COLOR = {
  Sales:    "bg-jarvis-primary",
  Trading:  "bg-purple-500",
  Build:    "bg-jarvis-amber",
  Admin:    "bg-jarvis-body",
  Personal: "bg-jarvis-green",
};

function pct(val, max) { return Math.min(100, Math.round((val / Math.max(max, 1)) * 100)); }

export function TimeAudit({ timeBlocks = [] }) {
  const [blocks, setBlocks] = useState(timeBlocks);

  async function logTime(role) {
    if (!supabase) return;
    const { data, error } = await supabase.from("time_blocks_actual").insert({
      role: role.toLowerCase(),
      minutes: 30,
      date: new Date().toISOString().slice(0, 10),
    }).select().single();
    if (!error && data) setBlocks((b) => [...b, data]);
  }

  const actual = Object.fromEntries(
    ROLES.map((r) => [r, blocks.filter((b) => b.role === r.toLowerCase()).reduce((s, b) => s + (b.minutes ?? 0), 0)])
  );
  const totalActual = Object.values(actual).reduce((s, v) => s + v, 0);

  return (
    <div className="glass p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="label">Time Audit</div>
        <span className="text-xs text-jarvis-muted">{Math.round(totalActual / 60)}h logged today</span>
      </div>

      <div className="space-y-3">
        {ROLES.map((role) => {
          const plan = PLANNED[role];
          const done = actual[role] ?? 0;
          return (
            <div key={role}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-jarvis-body">{role}</span>
                <span className="text-jarvis-muted tabular-nums">{done}m / {plan}m planned</span>
              </div>
              <div className="relative h-2 rounded-full bg-jarvis-border overflow-hidden">
                <div className={`absolute inset-y-0 left-0 rounded-full opacity-40 ${ROLE_COLOR[role]}`} style={{ width: `${pct(plan, 480)}%` }} />
                <div className={`absolute inset-y-0 left-0 rounded-full ${ROLE_COLOR[role]}`} style={{ width: `${pct(done, 480)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-jarvis-border">
        {ROLES.map((role) => (
          <button key={role} onClick={() => logTime(role)} className="flex items-center gap-1 chip text-xs bg-jarvis-border hover:bg-jarvis-border/80 text-jarvis-body cursor-pointer">
            <Plus size={11} /> 30m {role}
          </button>
        ))}
      </div>
    </div>
  );
}
