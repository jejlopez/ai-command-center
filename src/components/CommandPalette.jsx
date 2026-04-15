// CommandPalette.jsx — ⌘K instant search and navigation
import { useState, useEffect, useRef, useCallback } from "react";
import { Search, ArrowRight, Hash, Zap, Navigation } from "lucide-react";

const COMMANDS = [
  // Navigation
  { id: "nav-home",     label: "Home",      category: "Navigate", action: "home",     keywords: "jarvis chat home"           },
  { id: "nav-today",    label: "Today",     category: "Navigate", action: "today",    keywords: "today schedule calendar"    },
  { id: "nav-work",     label: "Work",      category: "Navigate", action: "work",     keywords: "work sales crm deals"       },
  { id: "nav-money",    label: "Money",     category: "Navigate", action: "money",    keywords: "money budget trading"       },
  { id: "nav-health",   label: "Health",    category: "Navigate", action: "health",   keywords: "health energy sleep"        },
  { id: "nav-home-life",label: "Home Life", category: "Navigate", action: "life",     keywords: "home life house"            },
  { id: "nav-brain",    label: "Brain",     category: "Navigate", action: "brain",    keywords: "brain memory knowledge"     },
  { id: "nav-settings", label: "Settings",  category: "Navigate", action: "settings", keywords: "settings config"            },
  // Actions
  { id: "act-new-deal",      label: "New Deal",       category: "Action", action: null, keywords: "create add deal"               },
  { id: "act-new-followup",  label: "New Follow-up",  category: "Action", action: null, keywords: "create add follow up task"     },
  { id: "act-new-contact",   label: "New Contact",    category: "Action", action: null, keywords: "create add contact person"     },
  { id: "act-new-proposal",  label: "New Proposal",   category: "Action", action: null, keywords: "create proposal quote"         },
  { id: "act-draft-email",   label: "Draft Email",    category: "Action", action: null, keywords: "email draft compose write"     },
];

const CATEGORY_ICONS = {
  Navigate: Navigation,
  Action:   Zap,
  JARVIS:   Hash,
};

function fuzzyMatch(query, cmd) {
  const q = query.toLowerCase();
  const haystack = `${cmd.label} ${cmd.keywords} ${cmd.category}`.toLowerCase();
  return haystack.includes(q);
}

function groupByCategory(items) {
  return items.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {});
}

export function CommandPalette({ onClose, onNavigate }) {
  const [query, setQuery]     = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  // Always include a JARVIS query command when there's text
  const jarvisCmd = query.trim()
    ? [{ id: "ask-jarvis", label: `Ask JARVIS: "${query}"`, category: "JARVIS", action: null, keywords: "" }]
    : [];

  const filtered = query.trim()
    ? [...COMMANDS.filter(c => fuzzyMatch(query, c)), ...jarvisCmd]
    : [...COMMANDS, ...jarvisCmd];

  const flat = filtered; // used for keyboard nav

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setSelected(0); }, [query]);

  const handleSelect = useCallback((cmd) => {
    if (cmd.category === "Navigate" && cmd.action) {
      onNavigate(cmd.action);
    }
    // Action commands — close for now; future: open modals
    onClose();
  }, [onNavigate, onClose]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected(s => Math.min(s + 1, flat.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected(s => Math.max(s - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (flat[selected]) handleSelect(flat[selected]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flat, selected, handleSelect]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  const groups = groupByCategory(filtered);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-[500px] glass border border-jarvis-border rounded-2xl overflow-hidden shadow-2xl">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-jarvis-border">
          <Search size={16} className="text-jarvis-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, deals, actions…"
            className="flex-1 bg-transparent text-sm text-jarvis-ink placeholder:text-jarvis-muted outline-none"
          />
          <kbd className="text-[10px] text-jarvis-muted border border-jarvis-border rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-xs text-jarvis-muted">No results</div>
          )}
          {Object.entries(groups).map(([cat, cmds]) => {
            const Icon = CATEGORY_ICONS[cat] ?? Hash;
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 px-4 py-1.5">
                  <Icon size={10} className="text-jarvis-muted" />
                  <span className="text-[10px] text-jarvis-muted font-semibold uppercase tracking-wider">{cat}</span>
                </div>
                {cmds.map((cmd) => {
                  const globalIdx = flat.indexOf(cmd);
                  const isActive  = globalIdx === selected;
                  return (
                    <button
                      key={cmd.id}
                      data-idx={globalIdx}
                      onClick={() => handleSelect(cmd)}
                      onMouseEnter={() => setSelected(globalIdx)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition ${isActive ? "bg-jarvis-primary/10 text-jarvis-primary" : "text-jarvis-body hover:bg-jarvis-ghost"}`}
                    >
                      <span className="text-sm">{cmd.label}</span>
                      {isActive && <ArrowRight size={12} className="text-jarvis-primary" />}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="border-t border-jarvis-border px-4 py-2 flex items-center gap-4 text-[10px] text-jarvis-muted">
          <span><kbd className="border border-jarvis-border rounded px-1">↑↓</kbd> navigate</span>
          <span><kbd className="border border-jarvis-border rounded px-1">↵</kbd> select</span>
          <span><kbd className="border border-jarvis-border rounded px-1">ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
