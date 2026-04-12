import { motion } from "framer-motion";
import { stagger } from "../lib/motion.js";
import { useWorkSupa } from "../hooks/useWorkSupa.js";
import { PipelineHero } from "../components/work/PipelineHero.jsx";
import { DealBoard } from "../components/work/DealBoard.jsx";
import { FollowUpQueue } from "../components/work/FollowUpQueue.jsx";
import { ContactsPanel } from "../components/work/ContactsPanel.jsx";
import { DealVelocity } from "../components/work/DealVelocity.jsx";
import { QuickAddBar } from "../components/work/QuickAddBar.jsx";

export default function Work() {
  const { intelligence } = useWorkSupa();

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <motion.div
          className="space-y-6 p-6 max-w-7xl mx-auto"
          variants={stagger.container}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={stagger.item}>
            <PipelineHero pipelineStats={intelligence?.pipeline_stats} />
          </motion.div>

          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <DealBoard dealBoard={intelligence?.deal_board} />
            </div>
            <FollowUpQueue followUpQueue={intelligence?.follow_up_queue} />
          </motion.div>

          <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ContactsPanel contactsSummary={intelligence?.contacts_summary} />
            <DealVelocity dealVelocity={intelligence?.deal_velocity} />
          </motion.div>
        </motion.div>
      </div>

      <QuickAddBar />
    </div>
  );
}
