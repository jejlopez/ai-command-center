import { motion } from "framer-motion";
import { stagger } from "../../lib/motion.js";
import { ProjectList } from "./ProjectList.jsx";
import { TaskBoard } from "./TaskBoard.jsx";

// Build velocity header
function BuildHeader({ projects = [], tasks = [] }) {
  const activeProjects = projects.filter(p => p.status === "active").length;
  const pendingTasks = tasks.filter(t => !t.done).length;

  return (
    <div className="glass p-4 border border-cyan-400/15">
      <div className="flex items-center gap-6">
        <div>
          <div className="label">Active Projects</div>
          <div className="text-3xl font-bold text-cyan-400 tabular-nums mt-1">{activeProjects}</div>
        </div>
        <div className="border-l border-jarvis-border pl-6">
          <div className="label">Tasks Pending</div>
          <div className={`text-2xl font-bold mt-1 ${pendingTasks > 5 ? "text-jarvis-warning" : "text-jarvis-ink"}`}>
            {pendingTasks}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BuildDashboard({ ops, onRefresh }) {
  const { projects = [], tasks = [] } = ops;

  return (
    <motion.div
      className="flex flex-col gap-4 p-4 overflow-y-auto h-full"
      variants={stagger.container}
      initial="hidden"
      animate="show"
    >
      {/* Header */}
      <motion.div variants={stagger.item}>
        <BuildHeader projects={projects} tasks={tasks} />
      </motion.div>

      {/* Projects + Task Board */}
      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProjectList projects={projects} onRefresh={onRefresh} />
        <TaskBoard tasks={tasks} />
      </motion.div>

    </motion.div>
  );
}
