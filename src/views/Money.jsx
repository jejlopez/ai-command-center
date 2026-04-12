import { motion } from "framer-motion";
import { stagger } from "../lib/motion.js";
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
      <motion.div
        className="space-y-6 p-6 max-w-6xl mx-auto"
        variants={stagger.container}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={stagger.item}>
          <CapitalVelocityHero velocity={intelligence?.velocity} />
        </motion.div>

        <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ThreeEngines engines={intelligence?.engines} />
          <MoneyLeaks leaks={intelligence?.leaks} />
        </motion.div>

        <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DeployCapital deploy={intelligence?.deploy} />
          <TradingScorecard scorecard={intelligence?.scorecard} />
        </motion.div>

        <motion.div variants={stagger.item}>
          <ExpenseRadar expenseRadar={intelligence?.expense_radar} />
        </motion.div>
      </motion.div>
    </div>
  );
}
