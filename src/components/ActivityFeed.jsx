import { useRef, useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { activityLog, agents } from '../utils/mockData';
import { ArrowDown, Search, Copy, Pin, Minimize2, Maximize2, DollarSign, AlertCircle } from 'lucide-react';
import { WidgetActions } from './WidgetActions';

const tagStyles = {
  OK:  { color: '#00D9C8', label: 'OK' },
  ERR: { color: '#F43F5E', label: 'ERR' },
  NET: { color: '#60a5fa', label: 'NET' },
  SYS: { color: '#a1a1aa', label: 'SYS' },
};

function getAgentInfo(agentId) {
  if (!agentId) return { name: 'System', color: '#52525b' };
  return agents.find(x => x.id === agentId) || { name: 'Unknown', color: '#52525b' };
}

export function ActivityFeed({ agentFilter = null }) {
  const scrollRef = useRef(null);
  const [isUserScrolled, setIsUserScrolled] = useState(false);
  const [entries, setEntries] = useState(activityLog);
  const [isHovered, setIsHovered] = useState(false);
  const [pendingEntries, setPendingEntries] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTypes, setActiveTypes] = useState(new Set(['OK', 'ERR', 'NET', 'SYS']));
  const [expandedRow, setExpandedRow] = useState(null);

  const depthMap = useMemo(() => {
    const map = new Map();
    entries.forEach(e => {
      if (!e.parentLogId) map.set(e.id, 0);
      else {
        const pDepth = map.get(e.parentLogId) || 0;
        map.set(e.id, pDepth + 1);
      }
    });
    return map;
  }, [entries]);

  // Simulate incoming logs
  useEffect(() => {
    const messages = [
      'Background optimization pass completed',
      'Vector index compaction finished',
      'Health check — all systems nominal',
      'Token budget recalculated',
      'Cache invalidation sweep done',
    ];
    const interval = setInterval(() => {
      const typeOptions = ['OK', 'SYS', 'NET'];
      const agentIds = ['a1', 'a2', 'a3', 'a5'];
      const newEntry = {
        id: Date.now(),
        timestamp: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: typeOptions[Math.floor(Math.random() * typeOptions.length)],
        message: messages[Math.floor(Math.random() * messages.length)],
        agentId: agentIds[Math.floor(Math.random() * agentIds.length)],
        parentLogId: null,
        tokens: Math.floor(Math.random() * 50),
        durationMs: Math.floor(Math.random() * 300),
      };

      if (isHovered || isUserScrolled) {
        setPendingEntries(p => p + 1);
      }
      setEntries(prev => [...prev, newEntry]);
    }, 12000);
    return () => clearInterval(interval);
  }, [isHovered, isUserScrolled]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, clientHeight, scrollHeight } = scrollRef.current;
    if (scrollTop + clientHeight < scrollHeight - 20) {
      setIsUserScrolled(true);
    } else {
      setIsUserScrolled(false);
      setPendingEntries(0);
    }
  };

  useEffect(() => {
    if (!isUserScrolled && !isHovered && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setPendingEntries(0);
    }
  }, [entries, isUserScrolled, isHovered]);

  const toggleType = (t) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (agentFilter && e.agentId !== agentFilter && e.agentId !== null) return false;
      if (!activeTypes.has(e.type)) return false;
      if (searchTerm) {
        try {
          const regex = new RegExp(searchTerm, 'i');
          if (!regex.test(e.message)) return false;
        } catch {
          if (!e.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        }
      }
      return true;
    });
  }, [entries, agentFilter, activeTypes, searchTerm]);

  return (
    <div
      className="flex flex-col h-full relative overflow-hidden group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <WidgetActions onExpand={() => {}} onConfigure={() => {}} onRemove={() => {}} />
      {/* Sticky header: accumulator + filters */}
      <div className="shrink-0 z-20 border-b border-white/[0.05]">
        {/* Accumulator strip */}
        <div className="flex justify-between items-center px-4 py-2 bg-canvas/80 backdrop-blur-sm text-xs font-mono border-b border-white/[0.03]">
          <div className="flex gap-3">
            <span className="flex items-center gap-1.5 text-text-primary px-2 py-0.5 bg-white/[0.03] rounded border border-white/[0.05]">
              <DollarSign className="w-3 h-3 text-aurora-teal" /> $4.83
            </span>
            <span className="flex items-center gap-1.5 text-text-primary px-2 py-0.5 bg-white/[0.03] rounded border border-white/[0.05]">
              <AlertCircle className="w-3 h-3 text-aurora-rose" /> 0.2/min
            </span>
          </div>
          {pendingEntries > 0 && (
            <span className="text-aurora-amber font-bold animate-pulse px-2 py-0.5 bg-aurora-amber/10 rounded text-[10px]">
              {pendingEntries} new
            </span>
          )}
        </div>

        {/* Filter bar */}
        <div className="px-4 py-2 flex items-center gap-3 bg-surface/50">
          <div className="relative flex-1 max-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="Filter..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/[0.07] rounded-full pl-8 pr-3 py-1.5 text-[11px] text-text-primary focus:border-aurora-teal/40 outline-none transition-colors"
            />
          </div>
          <div className="flex gap-1">
            {Object.entries(tagStyles).map(([key, style]) => (
              <button
                key={key}
                onClick={() => toggleType(key)}
                className="px-2 py-1 text-[10px] font-bold font-mono rounded border transition-all"
                style={activeTypes.has(key) ? {
                  borderColor: style.color,
                  color: style.color,
                  backgroundColor: `${style.color}15`,
                } : {
                  borderColor: 'rgba(255,255,255,0.05)',
                  color: 'rgba(255,255,255,0.2)',
                }}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto no-scrollbar"
      >
        <div className="py-1">
          {filteredEntries.map(entry => {
            const depth = depthMap.get(entry.id) || 0;
            const agentInfo = getAgentInfo(entry.agentId);
            const isExpanded = expandedRow === entry.id;
            const tag = tagStyles[entry.type] || tagStyles.SYS;

            return (
              <div key={entry.id} className="group border-b border-white/[0.02]">
                <div
                  className="px-4 py-1.5 flex items-start gap-2 hover:bg-white/[0.02] cursor-pointer transition-colors"
                  onClick={() => setExpandedRow(isExpanded ? null : entry.id)}
                >
                  {/* Indent for causal chains */}
                  {depth > 0 && (
                    <div className="shrink-0 relative" style={{ width: depth * 12 }}>
                      <div className="absolute right-0 top-0 bottom-0 w-px bg-white/[0.06]" />
                      <div className="absolute right-0 top-1/2 w-2 h-px bg-white/[0.06]" />
                    </div>
                  )}

                  <span className="text-text-disabled shrink-0 font-mono text-[10px] mt-[2px] w-[52px]">
                    {entry.timestamp}
                  </span>

                  <span
                    className="shrink-0 text-[10px] font-bold font-mono mt-[2px] w-[36px] text-center"
                    style={{ color: tag.color }}
                  >
                    {tag.label}
                  </span>

                  <div className="flex-1 min-w-0 mt-[1px]">
                    <span className="inline-flex gap-1.5 items-baseline flex-wrap">
                      <span
                        className="inline-block px-1 rounded text-[9px] font-mono font-bold uppercase shrink-0"
                        style={{ backgroundColor: agentInfo.color + '18', color: agentInfo.color }}
                      >
                        {agentInfo.name}
                      </span>
                      <span className="text-[11px] text-text-body font-mono leading-tight break-all">
                        {entry.message}
                      </span>
                    </span>
                  </div>

                  <div className="shrink-0 flex items-center gap-2 text-[10px] font-mono opacity-0 group-hover:opacity-60 transition-opacity mt-[2px]">
                    {entry.tokens > 0 && <span className="text-text-muted">{entry.tokens}tk</span>}
                    {entry.durationMs > 0 && <span className="text-text-muted">{entry.durationMs}ms</span>}
                    {isExpanded ? <Minimize2 className="w-3 h-3 text-text-disabled" /> : <Maximize2 className="w-3 h-3 text-text-disabled" />}
                  </div>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mx-4 mb-2 p-3 bg-canvas/60 border border-white/[0.05] rounded-lg">
                        <div className="flex gap-2 mb-2">
                          <button className="flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-white px-2 py-1 bg-white/[0.04] rounded transition-colors">
                            <Copy className="w-3 h-3" /> Copy
                          </button>
                          <button className="flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-white px-2 py-1 bg-white/[0.04] rounded transition-colors">
                            <Pin className="w-3 h-3" /> Pin
                          </button>
                        </div>
                        <pre className="text-[10px] text-text-disabled font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
{JSON.stringify(entry, null, 2)}
                        </pre>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scroll-to-bottom button */}
      <AnimatePresence>
        {isUserScrolled && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30"
          >
            <button
              onClick={() => {
                setIsUserScrolled(false);
                setPendingEntries(0);
                if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-aurora-teal text-[#000] text-[10px] font-bold rounded-full shadow-lg shadow-aurora-teal/20"
            >
              <ArrowDown className="w-3 h-3" /> {pendingEntries > 0 ? `${pendingEntries} new` : 'Latest'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
