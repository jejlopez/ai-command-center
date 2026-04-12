import { motion } from "framer-motion";
import { stagger } from "../lib/motion.js";
import { useHealthSupa } from "../hooks/useHealthSupa.js";
import { EnergyHero } from "../components/health/EnergyHero.jsx";
import { HabitTracker } from "../components/health/HabitTracker.jsx";
import { WeeklyTrends } from "../components/health/WeeklyTrends.jsx";
import { RiskAlerts } from "../components/health/RiskAlerts.jsx";
import { RecoveryScore } from "../components/health/RecoveryScore.jsx";
import { QuickLog } from "../components/health/QuickLog.jsx";

export default function Health() {
  const { intelligence, recompute } = useHealthSupa();

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <motion.div
          className="space-y-6 p-6 max-w-6xl mx-auto"
          variants={stagger.container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={stagger.item}>
            <EnergyHero energyHero={intelligence?.energy_hero} />
          </motion.div>

          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HabitTracker habitTracker={intelligence?.habit_tracker} onRefresh={recompute} />
            <RiskAlerts riskAlerts={intelligence?.risk_alerts} />
          </motion.div>

          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WeeklyTrends weeklyTrends={intelligence?.weekly_trends} />
            <RecoveryScore recoveryScore={intelligence?.recovery_score} />
          </motion.div>
        </motion.div>
      </div>

      <QuickLog onSaved={recompute} />
    </div>
  );
}
