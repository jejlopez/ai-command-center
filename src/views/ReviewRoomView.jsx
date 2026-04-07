import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, AlertTriangle, Code2, FileText, MessageSquare, Database, CheckCircle2, XCircle, CornerDownLeft, Clock, BellRing, Archive, History, Filter, ArrowUpDown } from 'lucide-react';
import { cn } from '../utils/cn';
import { pendingReviews, completedOutputs, approvalAuditTrail } from '../utils/mockData';

const urgencyStyles = {
  critical: { bg: 'bg-aurora-rose/15', text: 'text-aurora-rose', border: 'border-aurora-rose/30', label: 'Critical' },
  high:     { bg: 'bg-aurora-amber/15', text: 'text-aurora-amber', border: 'border-aurora-amber/30', label: 'High' },
  normal:   { bg: 'bg-aurora-teal/15', text: 'text-aurora-teal', border: 'border-aurora-teal/30', label: 'Normal' },
};

const typeIcons = {
  code:    Code2,
  report:  FileText,
  error:   AlertTriangle,
  message: MessageSquare,
  data:    Database,
};

function formatWaiting(ms) {
  if (ms < 60000) return 'Just now';
  const mins = Math.floor(ms / 60000);
  return `${mins}m waiting`;
}

function OutputRenderer({ item }) {
  if (!item) return null;
  const isCode = item.outputType === 'code';
  const isData = item.outputType === 'data';
  const isError = item.outputType === 'error';

  return (
    <div className={cn(
      "p-5 rounded-lg text-sm font-mono leading-relaxed whitespace-pre-wrap overflow-x-auto border",
      isError
        ? "bg-aurora-rose/5 border-aurora-rose/20 text-aurora-rose/90"
        : isCode || isData
          ? "bg-black/40 border-white/5 text-text-primary shadow-inner"
          : "bg-white/[0.02] border-white/5 text-text-body"
    )}>
      {item.payload}
    </div>
  );
}

export function ReviewRoomView() {
  const [activeTab, setActiveTab] = useState('approvals');
  const [selectedId, setSelectedId] = useState(pendingReviews[0]?.id);
  const [feedback, setFeedback] = useState('');
  const [showReviseForm, setShowReviseForm] = useState(false);
  const [approvals, setApprovals] = useState(pendingReviews);
  const [outputs, setOutputs] = useState(completedOutputs);
  const [auditLog, setAuditLog] = useState(approvalAuditTrail);

  // Filters
  const [filterAgent, setFilterAgent] = useState('all');
  const [filterUrgency, setFilterUrgency] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortBy, setSortBy] = useState('waiting'); // 'waiting' | 'urgency' | 'agent'

  const urgencyOrder = { critical: 0, high: 1, normal: 2 };

  const rawItems = activeTab === 'approvals' ? approvals : activeTab === 'outputs' ? outputs : [];

  const items = useMemo(() => {
    let filtered = rawItems;
    if (filterAgent !== 'all') filtered = filtered.filter(i => i.agentName === filterAgent);
    if (filterUrgency !== 'all') filtered = filtered.filter(i => i.urgency === filterUrgency);
    if (filterType !== 'all') filtered = filtered.filter(i => i.outputType === filterType);

    if (sortBy === 'waiting') filtered = [...filtered].sort((a, b) => (b.waitingMs || 0) - (a.waitingMs || 0));
    else if (sortBy === 'urgency') filtered = [...filtered].sort((a, b) => (urgencyOrder[a.urgency] ?? 9) - (urgencyOrder[b.urgency] ?? 9));
    else if (sortBy === 'agent') filtered = [...filtered].sort((a, b) => a.agentName.localeCompare(b.agentName));

    return filtered;
  }, [rawItems, filterAgent, filterUrgency, filterType, sortBy]);

  const selected = items.find(i => i.id === selectedId) || items[0] || null;
  const TypeIcon = selected ? (typeIcons[selected.outputType] || FileText) : FileText;
  const urgency = selected?.urgency ? urgencyStyles[selected.urgency] : null;

  function handleSelect(id) {
    setSelectedId(id);
    setShowReviseForm(false);
    setFeedback('');
  }

  function handleApprove() {
    if (!selected) return;
    const now = new Date().toLocaleTimeString();
    setOutputs(prev => [{ ...selected, completedAt: now, urgency: undefined, waitingMs: undefined }, ...prev]);
    setAuditLog(prev => [{ id: `aud-${Date.now()}`, reviewId: selected.id, action: 'approved', decidedBy: 'user', decidedAt: now, feedback: null, agentId: selected.agentId, agentName: selected.agentName, title: selected.title }, ...prev]);
    const remaining = approvals.filter(i => i.id !== selected.id);
    setApprovals(remaining);
    setSelectedId(remaining[0]?.id ?? null);
  }

  function handleReject() {
    if (!selected || !feedback.trim()) return;
    const now = new Date().toLocaleTimeString();
    setAuditLog(prev => [{ id: `aud-${Date.now()}`, reviewId: selected.id, action: 'rejected', decidedBy: 'user', decidedAt: now, feedback: feedback.trim(), agentId: selected.agentId, agentName: selected.agentName, title: selected.title }, ...prev]);
    const remaining = approvals.filter(i => i.id !== selected.id);
    setApprovals(remaining);
    setSelectedId(remaining[0]?.id ?? null);
    setFeedback('');
    setShowReviseForm(false);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden pb-12">
      {/* Header */}
      <div className="mb-6 flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-1">Review Room</h2>
          <p className="text-sm text-text-muted">Review agent outputs and approve pending actions before they go live.</p>
        </div>
        <div className="flex items-center gap-3">
          {approvals.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 spatial-panel border-aurora-amber/30">
              <BellRing className="w-4 h-4 text-aurora-amber animate-pulse" />
              <span className="text-sm font-mono text-text-primary">{approvals.length} Pending</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between mb-5 shrink-0">
        <div className="flex gap-1">
          {[
            { id: 'approvals', label: 'Approvals', icon: ShieldCheck, count: approvals.length },
            { id: 'outputs', label: 'Outputs', icon: Archive, count: outputs.length },
            { id: 'history', label: 'History', icon: History, count: auditLog.length },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'history') {
                  const list = tab.id === 'approvals' ? approvals : outputs;
                  handleSelect(list[0]?.id ?? null);
                }
              }}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-white/[0.08] text-text-primary border border-white/10"
                  : "text-text-muted hover:text-text-primary hover:bg-white/[0.03]"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className={cn(
                "ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold",
                activeTab === tab.id ? "bg-white/10 text-text-primary" : "bg-white/5 text-text-disabled"
              )}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Sort toggle — approvals/outputs only */}
        {activeTab !== 'history' && (
          <button
            onClick={() => setSortBy(prev => prev === 'waiting' ? 'urgency' : prev === 'urgency' ? 'agent' : 'waiting')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono text-text-muted hover:text-text-primary hover:bg-white/[0.03] rounded-lg transition-colors"
          >
            <ArrowUpDown className="w-3 h-3" />
            {sortBy === 'waiting' ? 'Wait time' : sortBy === 'urgency' ? 'Urgency' : 'Agent'}
          </button>
        )}
      </div>

      {/* Filter bar — approvals/outputs only */}
      {activeTab !== 'history' && (
        <div className="flex items-center gap-2 mb-4 shrink-0">
          <Filter className="w-3.5 h-3.5 text-text-disabled" />
          <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)} className="bg-white/[0.03] border border-white/[0.07] rounded-lg px-2 py-1.5 text-xs text-text-primary font-mono outline-none focus:border-aurora-teal/40 transition-colors">
            <option value="all">All Agents</option>
            {[...new Set(rawItems.map(i => i.agentName))].map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select value={filterUrgency} onChange={e => setFilterUrgency(e.target.value)} className="bg-white/[0.03] border border-white/[0.07] rounded-lg px-2 py-1.5 text-xs text-text-primary font-mono outline-none focus:border-aurora-teal/40 transition-colors">
            <option value="all">All Urgency</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
          </select>
          <select value={filterType} onChange={e => setFilterType(e.target.value)} className="bg-white/[0.03] border border-white/[0.07] rounded-lg px-2 py-1.5 text-xs text-text-primary font-mono outline-none focus:border-aurora-teal/40 transition-colors">
            <option value="all">All Types</option>
            <option value="code">Code</option>
            <option value="error">Error</option>
            <option value="report">Report</option>
            <option value="message">Message</option>
            <option value="data">Data</option>
          </select>
          {(filterAgent !== 'all' || filterUrgency !== 'all' || filterType !== 'all') && (
            <button onClick={() => { setFilterAgent('all'); setFilterUrgency('all'); setFilterType('all'); }} className="text-[10px] text-aurora-rose font-bold hover:bg-aurora-rose/10 px-2 py-1 rounded transition-colors">
              Clear
            </button>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex gap-5 overflow-hidden">

        {/* History tab */}
        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
            {auditLog.map(entry => (
              <div key={entry.id} className={cn(
                "spatial-panel p-4 flex items-start gap-4 border",
                entry.action === 'approved' ? "border-aurora-green/10" : "border-aurora-rose/10"
              )}>
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                  entry.action === 'approved' ? "bg-aurora-green/10" : "bg-aurora-rose/10"
                )}>
                  {entry.action === 'approved'
                    ? <CheckCircle2 className="w-4 h-4 text-aurora-green" />
                    : <XCircle className="w-4 h-4 text-aurora-rose" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-text-primary truncate">{entry.title}</span>
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase",
                      entry.action === 'approved' ? "bg-aurora-green/10 text-aurora-green" : "bg-aurora-rose/10 text-aurora-rose"
                    )}>
                      {entry.action}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-text-disabled">
                    <span className="text-aurora-violet font-bold">{entry.agentName}</span>
                    <span>{entry.decidedAt}</span>
                    <span className="capitalize">{entry.decidedBy}</span>
                  </div>
                  {entry.feedback && (
                    <div className="mt-2 px-3 py-2 bg-aurora-rose/5 border border-aurora-rose/10 rounded-lg text-[11px] text-aurora-rose/80 font-mono">
                      {entry.feedback}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {auditLog.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-text-disabled text-sm">
                <History className="w-8 h-8 mb-2 opacity-30" />
                <span>No history yet</span>
              </div>
            )}
          </div>
        )}

        {/* Left: Queue — approvals/outputs only */}
        {activeTab !== 'history' && (
          <div className="w-80 flex flex-col gap-2 overflow-y-auto no-scrollbar pr-1 shrink-0">
            {items.map(item => {
              const isActive = selected?.id === item.id;
              const Icon = typeIcons[item.outputType] || FileText;
              const urg = item.urgency ? urgencyStyles[item.urgency] : null;

              return (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item.id)}
                  className={cn(
                    "spatial-panel p-4 flex flex-col gap-2 text-left transition-all border w-full",
                    isActive
                      ? "border-aurora-teal/40 bg-aurora-teal/5 shadow-[0_0_15px_rgba(0,217,200,0.1)]"
                      : "border-white/5 opacity-70 hover:opacity-100 hover:border-white/15"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span className="text-sm font-semibold text-text-primary truncate">{item.title}</span>
                    </div>
                    {urg && (
                      <span className={cn("shrink-0 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase", urg.bg, urg.text)}>
                        {urg.label}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-text-muted line-clamp-2 leading-relaxed">{item.summary}</p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-[10px] font-mono text-aurora-violet font-bold">{item.agentName}</span>
                    <span className="text-[10px] font-mono text-text-disabled">
                      {item.waitingMs ? formatWaiting(item.waitingMs) : item.completedAt}
                    </span>
                  </div>
                </button>
              );
            })}

            {items.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-text-disabled text-sm">
                <CheckCircle2 className="w-8 h-8 mb-2 opacity-30" />
                <span>All clear</span>
              </div>
            )}
          </div>
        )}

        {/* Right: Inspector — approvals/outputs only */}
        {activeTab !== 'history' && !selected && (
          <div className="flex-1 flex flex-col items-center justify-center spatial-panel bg-[#09090b] text-text-disabled">
            <CheckCircle2 className="w-12 h-12 mb-3 opacity-20" />
            <span className="text-sm">Nothing selected</span>
            <span className="text-xs mt-1 opacity-50">
              {activeTab === 'approvals' ? 'All approvals handled' : 'No outputs yet'}
            </span>
          </div>
        )}
        {activeTab !== 'history' && selected && (
          <div className="flex-1 flex flex-col min-w-0 spatial-panel overflow-hidden border-border/50 shadow-lg relative bg-[#09090b]">
            {/* Header bar */}
            <div className="h-14 flex items-center justify-between px-6 border-b border-white/5 bg-white/[0.03] shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <TypeIcon className={cn("w-5 h-5 shrink-0", urgency ? urgency.text : "text-aurora-teal")} />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-text-primary truncate">{selected.title}</h3>
                  <p className="text-[10px] text-text-muted font-mono uppercase tracking-widest">
                    {selected.outputType} — {selected.agentName}
                    {selected.waitingMs && <span className="ml-2 text-aurora-amber"><Clock className="w-2.5 h-2.5 inline -mt-0.5" /> {formatWaiting(selected.waitingMs)}</span>}
                  </p>
                </div>
              </div>
              {urgency && (
                <span className={cn("text-xs font-mono px-2 py-1 rounded", urgency.bg, urgency.text)}>
                  {urgency.label}
                </span>
              )}
            </div>

            {/* Summary */}
            <div className="px-6 py-3 border-b border-white/5 bg-white/[0.015]">
              <p className="text-xs text-text-body leading-relaxed">{selected.summary}</p>
            </div>

            {/* Output content */}
            <div className="flex-1 overflow-auto p-6">
              <OutputRenderer item={selected} />
            </div>

            {/* Action bar — only for approvals tab */}
            {activeTab === 'approvals' && (
              <div className="shrink-0 bg-black/60 border-t border-white/10 p-5 z-20 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                <AnimatePresence mode="wait">
                  {!showReviseForm ? (
                    <motion.div
                      key="buttons"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex gap-3"
                    >
                      <button
                        onClick={() => setShowReviseForm(true)}
                        className="flex-1 h-12 flex items-center justify-center gap-2 border border-aurora-rose/40 bg-aurora-rose/5 text-aurora-rose hover:bg-aurora-rose/10 hover:border-aurora-rose rounded-xl font-bold tracking-wider uppercase text-sm transition-all"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                      <button
                        onClick={handleApprove}
                        className="flex-[2] h-12 flex items-center justify-center gap-2 bg-aurora-teal text-black hover:bg-[#00ebd8] rounded-xl font-bold tracking-wider uppercase text-sm transition-all shadow-[0_0_20px_rgba(0,217,200,0.4)] hover:shadow-[0_0_30px_rgba(0,217,200,0.6)]"
                      >
                        <CheckCircle2 className="w-4 h-4" /> Approve
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="form"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="flex gap-2"
                    >
                      <input
                        autoFocus
                        type="text"
                        value={feedback}
                        onChange={e => setFeedback(e.target.value)}
                        placeholder="Revise with instruction (e.g. 'Extract styles to variables', 'Reduce batch size')..."
                        className="flex-1 h-12 bg-[#121212] border border-aurora-rose/50 rounded-xl px-4 text-sm font-mono text-text-primary focus:outline-none focus:shadow-[0_0_20px_rgba(251,113,133,0.15)] transition-all placeholder:text-text-disabled"
                      />
                      <button
                        onClick={() => setShowReviseForm(false)}
                        className="h-12 px-5 border border-white/10 hover:bg-white/5 rounded-xl text-text-muted font-semibold transition-all text-sm"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleReject}
                        className="h-12 px-6 bg-aurora-rose text-white hover:bg-[#fd3859] rounded-xl font-bold tracking-wider uppercase flex items-center gap-2 transition-all text-sm shadow-[0_0_15px_rgba(251,113,133,0.3)]"
                      >
                        <CornerDownLeft className="w-4 h-4" /> Send
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
