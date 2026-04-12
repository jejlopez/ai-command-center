import { Home, CalendarClock, Briefcase, Wallet, HouseHeart, HeartPulse, Brain, Settings, Wand2 } from "lucide-react";

const ITEMS = [
  { id: "home",   label: "Home",      Icon: Home },
  { id: "today",  label: "Today",     Icon: CalendarClock },
  { id: "work",   label: "Work",      Icon: Briefcase },
  { id: "money",  label: "Money",     Icon: Wallet },
  { id: "life",   label: "Home Life", Icon: HouseHeart },
  { id: "health", label: "Health",    Icon: HeartPulse },
  { id: "brain",  label: "Brain",     Icon: Brain },
  { id: "skills", label: "Skills",    Icon: Wand2 },
];

export function Sidebar({ active = "home", onSelect }) {
  return (
    <aside className="flex flex-col items-stretch gap-1 w-[72px] md:w-56 p-3 border-r border-jarvis-border bg-jarvis-panel/40 backdrop-blur-xl">
      <div className="flex items-center gap-2 px-2 py-3">
        <div className="relative w-7 h-7 rounded-full bg-jarvis-cyan/15 shadow-glow-cyan grid place-items-center">
          <div className="w-3 h-3 rounded-full bg-jarvis-cyan pulse-cyan" />
        </div>
        <div className="hidden md:block">
          <div className="text-[13px] font-semibold tracking-wide text-jarvis-ink">JARVIS</div>
          <div className="text-[10px] text-jarvis-muted">OS v0.0.1</div>
        </div>
      </div>

      <nav className="flex flex-col gap-1 mt-2">
        {ITEMS.map(({ id, label, Icon }) => {
          const isActive = id === active;
          return (
            <button
              key={id}
              onClick={() => onSelect?.(id)}
              className={[
                "group flex items-center gap-3 px-3 py-2 rounded-xl transition",
                isActive
                  ? "bg-jarvis-cyan/10 text-jarvis-cyan shadow-glow-cyan"
                  : "text-jarvis-body hover:text-jarvis-ink hover:bg-white/5",
              ].join(" ")}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span className="hidden md:inline text-sm font-medium">{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <button
          onClick={() => onSelect?.("settings")}
          className={[
            "flex items-center gap-3 px-3 py-2 rounded-xl w-full transition",
            active === "settings"
              ? "bg-jarvis-cyan/10 text-jarvis-cyan shadow-glow-cyan"
              : "text-jarvis-body hover:text-jarvis-ink hover:bg-white/5",
          ].join(" ")}
        >
          <Settings size={18} strokeWidth={1.8} />
          <span className="hidden md:inline text-sm">Settings</span>
        </button>
      </div>
    </aside>
  );
}
