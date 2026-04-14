import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { stagger } from "../../lib/motion.js";
import { ProposalList } from "./ProposalList.jsx";
import { QuoteCalculator } from "./QuoteCalculator.jsx";
import { WinLossJournal } from "./WinLossJournal.jsx";
import { RevenueForecast } from "./RevenueForecast.jsx";
import { CommunicationLog } from "./CommunicationLog.jsx";
import { DocumentVault } from "./DocumentVault.jsx";
import { DealRoom } from "./DealRoom.jsx";
import { CommandBriefing } from "../sales/CommandBriefing.jsx";
import { PipelineBoard } from "../sales/PipelineBoard.jsx";
import { DealRoomPanel } from "../sales/DealRoomPanel.jsx";
import { LeadsSection } from "../sales/LeadsSection.jsx";
import { BriefingsPanel } from "./BriefingsPanel.jsx";
import { EmailInbox } from "./EmailInbox.jsx";
import { RevenueGoal } from "./RevenueGoal.jsx";
import { EmailTemplates } from "./EmailTemplates.jsx";
import { ActivityScoring } from "./ActivityScoring.jsx";
import { WeeklyReport } from "./WeeklyReport.jsx";

// Pipeline strip — compact horizontal funnel
function PipelineStrip({ stats, deals = [], onOpenDeal }) {
  if (!stats) return null;
  const stages = [
    { key: "prospect",    label: "Prospect",    color: "text-jarvis-muted"   },
    { key: "qualified",   label: "Qualified",   color: "text-blue-400"        },
    { key: "proposal",    label: "Proposal",    color: "text-jarvis-warning"  },
    { key: "negotiation", label: "Negotiation", color: "text-jarvis-primary"  },
    { key: "closed_won",  label: "Won",         color: "text-jarvis-success"  },
  ];
  return (
    <div className="glass p-3">
      <div className="flex items-center gap-4 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
        {stages.map((s, i) => {
          const count = stats[s.key + "_count"] ?? 0;
          const val   = stats[s.key + "_value"] ?? 0;
          const stageDeals = deals.filter(d => d.stage === s.key);
          return (
            <div key={s.key} className="flex items-center gap-3 shrink-0">
              <div className="flex flex-col">
                <span className="label">{s.label}</span>
                <div className="flex items-baseline gap-1 mt-1">
                  <button
                    className={`text-lg font-bold tabular-nums ${s.color} hover:underline`}
                    onClick={() => stageDeals[0] && onOpenDeal?.(stageDeals[0])}
                    title={stageDeals.length > 0 ? `Open first ${s.label} deal` : undefined}
                  >
                    {count}
                  </button>
                  <span className="text-[10px] text-jarvis-muted">${(val / 1000).toFixed(0)}k</span>
                </div>
                {stageDeals.length > 0 && (
                  <div className="flex flex-col gap-0.5 mt-1">
                    {stageDeals.slice(0, 2).map(d => (
                      <button key={d.id} onClick={() => onOpenDeal?.(d)}
                        className="text-[9px] text-jarvis-muted hover:text-jarvis-ink text-left truncate max-w-[80px] transition">
                        {d.company}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {i < stages.length - 1 && (
                <div className="text-jarvis-ghost/40 text-lg shrink-0">›</div>
              )}
            </div>
          );
        })}
        {stats.total_value > 0 && (
          <div className="ml-auto shrink-0 flex flex-col items-end">
            <span className="label">Total Pipeline</span>
            <span className="text-sm font-semibold text-jarvis-ink mt-1">${(stats.total_value / 1000).toFixed(0)}k</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Follow-up queue — compact list
function FollowUpStrip({ followUps = [], deals = [], onOpenDeal }) {
  if (followUps.length === 0) {
    return (
      <div className="glass p-3">
        <div className="label mb-2">Follow-ups Due</div>
        <p className="text-xs text-jarvis-ghost">No follow-ups due. You're clear.</p>
      </div>
    );
  }
  return (
    <div className="glass p-3">
      <div className="label mb-2">Follow-ups Due</div>
      <div className="flex flex-col gap-1">
        {followUps.slice(0, 5).map((f, i) => {
          const isOverdue = f.due_date && new Date(f.due_date) < new Date();
          const linkedDeal = f.deal_id ? deals.find(d => d.id === f.deal_id) : null;
          return (
            <div
              key={f.id ?? i}
              className={`flex items-center gap-2 py-1 border-b border-jarvis-border/50 last:border-0 ${linkedDeal ? "cursor-pointer hover:bg-jarvis-ghost/30 rounded px-1 -mx-1 transition" : ""}`}
              onClick={() => linkedDeal && onOpenDeal?.(linkedDeal)}
            >
              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isOverdue ? "bg-jarvis-danger" : "bg-blue-400"}`} />
              <span className="text-xs text-jarvis-ink flex-1 truncate">{f.contact_name || f.subject || "Follow-up"}</span>
              {f.due_date && (
                <span className={`text-[10px] shrink-0 ${isOverdue ? "text-jarvis-danger" : "text-jarvis-muted"}`}>
                  {new Date(f.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SalesDashboard({ ops, onRefresh }) {
  const { deals = [], followUps = [], proposals = [], comms = [], docs = [], intelligence, crm } = ops;
  const [openDeal, setOpenDeal] = useState(null);
  const [crmDealOpen, setCrmDealOpen] = useState(null);

  const hasCRM = crm?.connected && (crm.deals?.length > 0 || crm.leads?.length > 0 || Object.keys(crm.pipeline || {}).length > 0);

  return (
    <motion.div
      className="flex flex-col gap-4 p-4 overflow-y-auto h-full"
      variants={stagger.container}
      initial="hidden"
      animate="show"
    >
      {/* Command Briefing — today's actions (CRM-powered) */}
      {crm?.command && (
        <motion.div variants={stagger.item}>
          <CommandBriefing command={crm.command} onOpenDeal={(d) => setCrmDealOpen(d)} />
        </motion.div>
      )}

      {/* Pipeline Board — kanban (CRM) or strip (Supabase fallback) */}
      <motion.div variants={stagger.item}>
        {hasCRM ? (
          <PipelineBoard pipeline={crm.pipeline} onOpenDeal={(d) => setCrmDealOpen(d)} />
        ) : (
          <PipelineStrip stats={intelligence?.pipeline_stats} deals={deals} onOpenDeal={setOpenDeal} />
        )}
      </motion.div>

      {/* JARVIS Briefings — persistent intelligence panel */}
      <motion.div variants={stagger.item}>
        <BriefingsPanel />
      </motion.div>

      {/* Row 1: Follow-ups + Email Inbox */}
      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FollowUpStrip followUps={followUps} deals={deals} onOpenDeal={setOpenDeal} />
        <EmailInbox deals={deals} />
      </motion.div>

      {/* Row 2: Revenue Goal + Activity Scoring */}
      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RevenueGoal deals={deals} />
        <ActivityScoring deals={deals} />
      </motion.div>

      {/* Row 3: Email Templates + Weekly Report */}
      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <EmailTemplates />
        <WeeklyReport />
      </motion.div>

      {/* Row 4: Proposals + Forecast */}
      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProposalList proposals={proposals} onRefresh={onRefresh} />
        <RevenueForecast deals={deals} />
      </motion.div>

      {/* Row 5: Win/Loss Journal */}
      <motion.div variants={stagger.item}>
        <WinLossJournal deals={deals} />
      </motion.div>

      {/* Row 6: Comms + Docs */}
      <motion.div variants={stagger.item} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CommunicationLog comms={comms} onRefresh={onRefresh} />
        <DocumentVault docs={docs} onRefresh={onRefresh} />
      </motion.div>

      {/* Row 7: Quote Calculator */}
      <motion.div variants={stagger.item}>
        <QuoteCalculator onRefresh={onRefresh} />
      </motion.div>

      {/* Leads Section (CRM) */}
      {crm?.leads?.length > 0 && (
        <motion.div variants={stagger.item}>
          <LeadsSection leads={crm.leads} onRefresh={crm.refresh} />
        </motion.div>
      )}

      {/* Deal Room — old Supabase version */}
      {openDeal && (
        <DealRoom dealId={openDeal.id} deal={openDeal} onClose={() => setOpenDeal(null)} />
      )}

      {/* Deal Room Panel — new CRM version (slide-out) */}
      <AnimatePresence>
        {crmDealOpen && (
          <DealRoomPanel deal={crmDealOpen} onClose={() => setCrmDealOpen(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
