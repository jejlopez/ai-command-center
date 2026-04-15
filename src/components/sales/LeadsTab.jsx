// LeadsTab — full leads inbox table with filters, stats, and click-to-detail.

import { useState } from "react";
import { motion } from "framer-motion";
import { stagger } from "../../lib/motion.js";
import { useLeadsSupa } from "../../hooks/useLeadsSupa.js";
import { LeadRow } from "./LeadRow.jsx";
import { LeadDetailPanel } from "./LeadDetailPanel.jsx";
import { Plus, RefreshCcw } from "lucide-react";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "hot", label: "🔥 Hot", filter: l => l.attention === "hot" },
  { key: "whale", label: "Whale", filter: l => l.quality === "whale" },
  { key: "sequence", label: "Sequence Active", filter: l => l.status === "sequence_active" },
  { key: "stale", label: "Stale", filter: l => l.attention === "stale" || l.attention === "at_risk" },
];

export function LeadsTab({ crm }) {
  const { leads, loading, refresh, createLead } = useLeadsSupa();
  const [filter, setFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState(null);

  const activeFilter = FILTERS.find(f => f.key === filter);
  const filtered = activeFilter?.filter ? leads.filter(activeFilter.filter) : leads;

  if (loading) {
    return <div className="flex items-center justify-center h-full text-xs text-jarvis-muted animate-pulse">Loading leads…</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-jarvis-border/30 text-[10px]">
        <span className="text-jarvis-ghost">Filter:</span>
        {FILTERS.map(f => {
          const count = f.filter ? leads.filter(f.filter).length : leads.length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-full transition ${
                filter === f.key
                  ? "bg-jarvis-primary/15 text-jarvis-primary"
                  : "bg-white/4 text-jarvis-muted hover:text-jarvis-ink"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={() => createLead({ company: "New Lead", status: "new" })}
          className="px-2.5 py-1 rounded-full bg-jarvis-primary/10 text-jarvis-primary font-medium flex items-center gap-1"
        >
          <Plus size={10} /> New Lead
        </button>
        <button
          onClick={refresh}
          className="px-2.5 py-1 rounded-full bg-jarvis-success/10 text-jarvis-success flex items-center gap-1"
        >
          <RefreshCcw size={10} /> Refresh
        </button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[2fr_0.8fr_0.6fr_0.6fr_0.6fr_1fr_1.2fr] gap-1 px-5 py-2 border-b border-jarvis-border/40 text-[8px] text-jarvis-ghost uppercase tracking-[0.1em]">
        <div>Company / Contact</div>
        <div>Quality</div>
        <div>Attention</div>
        <div>Strike</div>
        <div>Score</div>
        <div>Status</div>
        <div>Next Best Action</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[11px] text-jarvis-ghost">No leads match this filter.</div>
        ) : (
          <motion.div variants={stagger.container} initial="hidden" animate="show">
            {filtered.map(lead => (
              <motion.div key={lead.id} variants={stagger.item}>
                <LeadRow lead={lead} onClick={setSelectedLead} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Detail panel */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
