import { motion } from "framer-motion";
import { stagger } from "../lib/motion.js";
import { useMoneySupa } from "../hooks/useMoneySupa.js";
import { CardSkeleton } from "../components/shared/LoadingSkeleton.jsx";
import { CapitalVelocityHero } from "../components/money/CapitalVelocityHero.jsx";
import { ThreeEngines } from "../components/money/ThreeEngines.jsx";
import { MoneyLeaks } from "../components/money/MoneyLeaks.jsx";
import { DeployCapital } from "../components/money/DeployCapital.jsx";
import { TradingScorecard } from "../components/money/TradingScorecard.jsx";
import { ExpenseRadar } from "../components/money/ExpenseRadar.jsx";
import { PositionSizer } from "../components/money/PositionSizer.jsx";
import { CashFlowRunway } from "../components/money/CashFlowRunway.jsx";
import { ToolROI } from "../components/money/ToolROI.jsx";
import { CostPerDeal } from "../components/money/CostPerDeal.jsx";
import { LivePnL } from "../components/money/LivePnL.jsx";
import { MarginOfSafety } from "../components/money/MarginOfSafety.jsx";
import { ReturnOnTime } from "../components/money/ReturnOnTime.jsx";
import { FeeDrag } from "../components/money/FeeDrag.jsx";
import { CashAllocation } from "../components/money/CashAllocation.jsx";
import { CompoundProjector } from "../components/money/CompoundProjector.jsx";

export default function Money() {
  const { intelligence, toolRoi, timeBlocks, refresh, loading } = useMoneySupa();

  const positions = intelligence?.positions ?? [];
  const deals = intelligence?.deals ?? [];

  // Derive ReturnOnTime data from timeBlocks
  const rotData = timeBlocks.length > 0 ? {
    sales_hours: timeBlocks.filter((b) => b.role === "sales").reduce((s, b) => s + (b.hours ?? 0), 0),
    trading_hours: timeBlocks.filter((b) => b.role === "trading").reduce((s, b) => s + (b.hours ?? 0), 0),
    coding_hours: timeBlocks.filter((b) => b.role === "coding").reduce((s, b) => s + (b.hours ?? 0), 0),
    sales_revenue: intelligence?.engines?.sales?.revenue ?? 0,
    trading_revenue: intelligence?.engines?.trading?.revenue ?? 0,
  } : null;

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <CardSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton /><CardSkeleton />
        </div>
      </div>
    );
  }

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

        {/* Row 1: Three Engines · Money Leaks · Live P&L */}
        <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ThreeEngines engines={intelligence?.engines} />
          <MoneyLeaks leaks={intelligence?.leaks} />
          <LivePnL />
        </motion.div>

        {/* Row 2: Deploy Capital · Trading Scorecard */}
        <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DeployCapital deploy={intelligence?.deploy} />
          <TradingScorecard scorecard={intelligence?.scorecard} />
        </motion.div>

        {/* Row 3: Position Sizer · Margin of Safety · Cash Allocation */}
        <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <PositionSizer />
          <MarginOfSafety positions={positions} deals={deals} />
          <CashAllocation data={intelligence?.cash_allocation} />
        </motion.div>

        {/* Row 4: Cash Flow Runway · Return on Time */}
        <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CashFlowRunway data={intelligence?.cash_flow} />
          <ReturnOnTime data={rotData} />
        </motion.div>

        {/* Row 5: Tool ROI · Fee Drag */}
        <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ToolROI tools={toolRoi} onRefresh={refresh} />
          <FeeDrag data={intelligence?.fee_drag} />
        </motion.div>

        {/* Row 6: Cost Per Deal · Compound Projector */}
        <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CostPerDeal data={intelligence?.cost_per_deal} />
          <CompoundProjector />
        </motion.div>

        <motion.div variants={stagger.item}>
          <ExpenseRadar expenseRadar={intelligence?.expense_radar} />
        </motion.div>
      </motion.div>
    </div>
  );
}
