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
        <div className="space-y-6 p-6 max-w-6xl mx-auto">
          <EnergyHero energyHero={intelligence?.energy_hero} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <HabitTracker habitTracker={intelligence?.habit_tracker} onRefresh={recompute} />
            <RiskAlerts riskAlerts={intelligence?.risk_alerts} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <WeeklyTrends weeklyTrends={intelligence?.weekly_trends} />
            <RecoveryScore recoveryScore={intelligence?.recovery_score} />
          </div>
        </div>
      </div>

      <QuickLog onSaved={recompute} />
    </div>
  );
}
