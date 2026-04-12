import { useState } from "react";
import { Home, CalendarClock, Briefcase, Wallet, Heart, HeartPulse, Brain, Settings, Wand2 } from "lucide-react";

const ITEMS = [
  { id: "home",   label: "Home",      Icon: Home },
  { id: "today",  label: "Today",     Icon: CalendarClock },
  { id: "work",   label: "Work",      Icon: Briefcase },
  { id: "money",  label: "Money",     Icon: Wallet },
  { id: "life",   label: "Home Life", Icon: Heart },
  { id: "health", label: "Health",    Icon: HeartPulse },
  { id: "brain",  label: "Brain",     Icon: Brain },
  { id: "skills", label: "Skills",    Icon: Wand2 },
];

function NavBtn({ id, label, Icon, isActive, expanded, onSelect }) {
  return (
    <button
      onClick={() => onSelect?.(id)}
      title={expanded ? undefined : label}
      className={[
        "relative flex items-center gap-3 rounded-[10px] transition-all duration-200",
        expanded ? "px-3 py-2.5" : "px-0 py-2.5 justify-center",
        isActive
          ? "bg-jarvis-primary-muted text-jarvis-primary"
          : "text-jarvis-muted hover:text-jarvis-ink hover:bg-jarvis-surface-hover",
      ].join(" ")}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-jarvis-primary" />
      )}
      <Icon size={17} strokeWidth={isActive ? 2 : 1.5} />
      {expanded && (
        <span className="text-[12px] font-medium whitespace-nowrap overflow-hidden">{label}</span>
      )}
    </button>
  );
}

export function Sidebar({ active = "home", onSelect }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <aside
      className={[
        "flex flex-col py-3 border-r border-jarvis-border bg-jarvis-bg transition-all duration-200",
        expanded ? "w-[180px] px-2.5" : "w-[56px] px-[10px]",
      ].join(" ")}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      <div className={`flex items-center gap-2.5 mb-4 pb-4 border-b border-jarvis-border ${expanded ? "px-2" : "justify-center"}`}>
        <div className="relative w-7 h-7 rounded-full bg-jarvis-primary-muted grid place-items-center shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-jarvis-primary pulse-primary" />
        </div>
        {expanded && (
          <span className="text-[12px] font-semibold tracking-[0.06em] text-jarvis-ink">JARVIS</span>
        )}
      </div>

      <nav className="flex flex-col gap-0.5 flex-1">
        {ITEMS.map(({ id, label, Icon }) => (
          <NavBtn key={id} id={id} label={label} Icon={Icon} isActive={id === active} expanded={expanded} onSelect={onSelect} />
        ))}
      </nav>

      <div className="pt-3 border-t border-jarvis-border space-y-0.5">
        <NavBtn id="settings" label="Settings" Icon={Settings} isActive={active === "settings"} expanded={expanded} onSelect={onSelect} />
      </div>
    </aside>
  );
}
