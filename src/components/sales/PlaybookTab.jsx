// PlaybookTab — strategic intelligence panels, viewed weekly.

import { motion } from "framer-motion";
import { stagger } from "../../lib/motion.js";
import { RevenueGoal } from "../ops/RevenueGoal.jsx";
import { RevenueForecast } from "../ops/RevenueForecast.jsx";
import { ActivityScoring } from "../ops/ActivityScoring.jsx";
import { WinLossJournal } from "../ops/WinLossJournal.jsx";
import { WeeklyReport } from "../ops/WeeklyReport.jsx";
import { BriefingsPanel } from "../ops/BriefingsPanel.jsx";
import { EmailTemplates } from "../ops/EmailTemplates.jsx";
import { LearningDashboard } from "./LearningDashboard.jsx";

export function PlaybookTab({ deals = [] }) {
  return (
    <motion.div
      className="p-5 overflow-y-auto h-full space-y-4"
      variants={stagger.container}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueGoal deals={deals} />
        <RevenueForecast deals={deals} />
      </motion.div>

      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ActivityScoring deals={deals} />
        <WinLossJournal deals={deals} />
      </motion.div>

      <motion.div variants={stagger.item}>
        <WeeklyReport />
      </motion.div>

      <motion.div variants={stagger.item}>
        <BriefingsPanel />
      </motion.div>

      <motion.div variants={stagger.item}>
        <EmailTemplates />
      </motion.div>

      <motion.div variants={stagger.item}>
        <LearningDashboard />
      </motion.div>
    </motion.div>
  );
}
