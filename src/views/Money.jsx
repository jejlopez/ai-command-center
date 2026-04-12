import { useMoneySupa } from "../hooks/useMoneySupa.js";
import { CapitalVelocityHero } from "../components/money/CapitalVelocityHero.jsx";
import { ThreeEngines } from "../components/money/ThreeEngines.jsx";
import { MoneyLeaks } from "../components/money/MoneyLeaks.jsx";
import { DeployCapital } from "../components/money/DeployCapital.jsx";
import { TradingScorecard } from "../components/money/TradingScorecard.jsx";
import { ExpenseRadar } from "../components/money/ExpenseRadar.jsx";

export default function Money() {
  const { intelligence } = useMoneySupa();

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        <CapitalVelocityHero velocity={intelligence?.velocity} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ThreeEngines engines={intelligence?.engines} />
          <MoneyLeaks leaks={intelligence?.leaks} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DeployCapital deploy={intelligence?.deploy} />
          <TradingScorecard scorecard={intelligence?.scorecard} />
        </div>

        <ExpenseRadar expenseRadar={intelligence?.expense_radar} />
      </div>
    </div>
  );
}
