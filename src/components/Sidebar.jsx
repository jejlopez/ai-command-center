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

function NavButton({ id, label, Icon, isActive, onSelect }) {
  return (
    <button
      onClick={() => onSelect?.(id)}
      className={[
        "group relative flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200",
        isActive
          ? "bg-jarvis-cyan/8 text-jarvis-cyan"
          : "text-jarvis-muted hover:text-jarvis-ink hover:bg-white/[0.04]",
      ].join(" ")}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-jarvis-cyan" />
      )}
      <Icon size={18} strokeWidth={isActive ? 2 : 1.6} className="transition-all duration-200" />
      <span className="hidden md:inline text-[13px] font-medium tracking-[-0.01em]">{label}</span>
    </button>
  );
}

export function Sidebar({ active = "home", onSelect }) {
  return (
    <aside className="flex flex-col items-stretch w-[72px] md:w-52 py-4 px-2.5 border-r border-jarvis-border/60 bg-jarvis-panel/30 backdrop-blur-2xl">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-3 pb-5 mb-1 border-b border-jarvis-border/40">
        <div className="relative w-8 h-8 rounded-full bg-jarvis-cyan/10 grid place-items-center">
          <div className="w-3.5 h-3.5 rounded-full bg-jarvis-cyan pulse-cyan" />
          <div className="absolute inset-0 rounded-full border border-jarvis-cyan/25" />
        </div>
        <div className="hidden md:block">
          <div className="text-[13px] font-semibold tracking-[0.04em] text-jarvis-ink">J.A.R.V.I.S</div>
          <div className="text-[10px] text-jarvis-muted font-medium">Operating System</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 mt-3">
        {ITEMS.map(({ id, label, Icon }) => (
          <NavButton key={id} id={id} label={label} Icon={Icon} isActive={id === active} onSelect={onSelect} />
        ))}
      </nav>

      {/* Settings — pinned bottom */}
      <div className="mt-auto pt-3 border-t border-jarvis-border/30">
        <NavButton id="settings" label="Settings" Icon={Settings} isActive={active === "settings"} onSelect={onSelect} />
      </div>
    </aside>
  );
}
