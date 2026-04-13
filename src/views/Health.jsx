import { motion } from "framer-motion";
import { stagger } from "../lib/motion.js";
import { useHealthSupa } from "../hooks/useHealthSupa.js";
import { EnergyHero } from "../components/health/EnergyHero.jsx";
import { HabitTracker } from "../components/health/HabitTracker.jsx";
import { WeeklyTrends } from "../components/health/WeeklyTrends.jsx";
import { RiskAlerts } from "../components/health/RiskAlerts.jsx";
import { RecoveryScore } from "../components/health/RecoveryScore.jsx";
import { QuickLog } from "../components/health/QuickLog.jsx";
import { BurnoutRiskScore } from "../components/health/BurnoutRiskScore.jsx";
import { SleepDebtCalculator } from "../components/health/SleepDebtCalculator.jsx";
import { ConsistencyScore } from "../components/health/ConsistencyScore.jsx";
import { NonNegotiables } from "../components/health/NonNegotiables.jsx";
import { PerformanceCorrelation } from "../components/health/PerformanceCorrelation.jsx";
import { HealthROI } from "../components/health/HealthROI.jsx";
import { PeakHoursMap } from "../components/health/PeakHoursMap.jsx";
import { RecoveryProtocol } from "../components/health/RecoveryProtocol.jsx";
import { TrajectoryView } from "../components/health/TrajectoryView.jsx";
import { MinimumEffectiveDose } from "../components/health/MinimumEffectiveDose.jsx";

export default function Health() {
  const { intelligence, recompute } = useHealthSupa();

  return (
    <div className="h-full w-full flex flex-col min-h-0" style={{ "--page-accent": "#F43F5E" }}>
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

          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <BurnoutRiskScore />
            <SleepDebtCalculator />
            <ConsistencyScore />
          </motion.div>

          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HabitTracker habitTracker={intelligence?.habit_tracker} onRefresh={recompute} />
            <NonNegotiables />
          </motion.div>

          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PerformanceCorrelation />
            <HealthROI />
          </motion.div>

          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PeakHoursMap />
            <RecoveryProtocol />
          </motion.div>

          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WeeklyTrends weeklyTrends={intelligence?.weekly_trends} />
            <TrajectoryView />
          </motion.div>

          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MinimumEffectiveDose />
            <RiskAlerts riskAlerts={intelligence?.risk_alerts} />
          </motion.div>

          <motion.div variants={stagger.item}>
            <RecoveryScore recoveryScore={intelligence?.recovery_score} />
          </motion.div>
        </motion.div>
      </div>

      <QuickLog onSaved={recompute} />
    </div>
  );
}
