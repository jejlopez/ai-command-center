import { CheckCircle2, Circle, Calendar, TrendingUp, Users, Clock, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { stagger } from "../lib/motion.js";

function StatPill({ Icon, label, value, tone = "primary" }) {
  const colors = {
    primary: "text-jarvis-primary border-jarvis-primary/20 bg-jarvis-primary/[0.05]",
    green: "text-jarvis-success border-jarvis-success/20 bg-jarvis-success/[0.05]",
    amber: "text-jarvis-warning border-jarvis-warning/20 bg-jarvis-warning/[0.05]",
    red: "text-jarvis-danger border-jarvis-danger/20 bg-jarvis-danger/[0.05]",
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${colors[tone]}`}>
      <Icon size={14} />
      <span className="text-[11px] text-jarvis-muted">{label}</span>
      <span className="text-sm font-semibold ml-auto">{value}</span>
    </div>
  );
}

function TaskItem({ title, detail, done, time }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-jarvis-border last:border-0">
      {done ? (
        <CheckCircle2 size={16} className="text-jarvis-success mt-0.5 shrink-0" />
      ) : (
        <Circle size={16} className="text-jarvis-muted mt-0.5 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className={`text-[13px] leading-snug ${done ? "line-through text-jarvis-muted" : "text-jarvis-ink font-medium"}`}>
          {title}
        </div>
        {detail && (
          <div className="text-[11px] text-jarvis-muted mt-0.5">{detail}</div>
        )}
      </div>
      {time && (
        <span className="text-[10px] text-jarvis-muted shrink-0">{time}</span>
      )}
    </div>
  );
}

export function HomeStatusBoard({ brief }) {
  if (!brief) return null;

  // Build task list from brief data
  const tasks = [];

  // Critical items as tasks
  for (const item of brief.criticalItems ?? []) {
    tasks.push({ title: item.title, detail: item.detail, done: false });
  }

  // Follow-ups as tasks
  for (const item of brief.followUps ?? []) {
    tasks.push({ title: item.title, detail: item.source, done: false });
  }

  // Waiting-on items (shown as completed/in-progress)
  for (const item of brief.waitingOn ?? []) {
    tasks.push({ title: `Waiting: ${item.title}`, detail: item.source, done: false });
  }

  // Schedule items as completed if in the past
  const now = new Date();
  for (const item of brief.schedule ?? []) {
    const start = new Date(item.start);
    const timeStr = start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    tasks.push({
      title: item.title,
      time: timeStr,
      done: start < now,
    });
  }

  // Sort: incomplete first, then completed
  tasks.sort((a, b) => (a.done === b.done ? 0 : a.done ? 1 : -1));

  const completedCount = tasks.filter((t) => t.done).length;
  const totalCount = tasks.length;

  return (
    <motion.div variants={stagger.container} initial="hidden" animate="show" className="space-y-4">
      {/* Greeting */}
      <motion.div variants={stagger.item} className="surface p-5">
        <div className="text-[22px] font-display font-semibold text-jarvis-ink">
          {now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening"}
        </div>
        <div className="text-sm text-jarvis-body mt-1">
          {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          {totalCount > 0 && (
            <span className="text-jarvis-primary ml-2 font-medium">
              · {completedCount}/{totalCount} done
            </span>
          )}
        </div>
      </motion.div>

      {/* Quick stats */}
      <motion.div variants={stagger.item} className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <StatPill
          Icon={Users}
          label="Pipeline"
          value={brief.criticalItems?.length ?? 0}
          tone={brief.criticalItems?.length > 0 ? "red" : "green"}
        />
        <StatPill
          Icon={Clock}
          label="Follow-ups"
          value={brief.followUps?.length ?? 0}
          tone={brief.followUps?.length > 0 ? "amber" : "green"}
        />
        <StatPill
          Icon={Calendar}
          label="Meetings"
          value={brief.schedule?.length ?? 0}
          tone="primary"
        />
        <StatPill
          Icon={TrendingUp}
          label="Budget"
          value={`$${brief.budget?.spentToday ?? 0}`}
          tone={brief.budget?.spentToday > brief.budget?.budgetToday ? "red" : "green"}
        />
      </motion.div>

      {/* Task checklist */}
      {tasks.length > 0 && (
        <motion.div variants={stagger.item} className="surface p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="label">Today's Checklist</div>
            {completedCount > 0 && (
              <span className="text-[11px] text-jarvis-success font-medium">
                {completedCount} completed
              </span>
            )}
          </div>
          <div>
            {tasks.map((task, i) => (
              <TaskItem key={i} {...task} />
            ))}
          </div>
        </motion.div>
      )}

      {/* Focus / next move */}
      {brief.focus && (
        <motion.div variants={stagger.item} className="surface p-4 flex items-start gap-3">
          <Zap size={14} className="text-jarvis-primary mt-0.5 shrink-0" />
          <div>
            <div className="label text-jarvis-primary mb-1">Focus</div>
            <div className="text-[13px] text-jarvis-ink leading-snug">{brief.focus}</div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
