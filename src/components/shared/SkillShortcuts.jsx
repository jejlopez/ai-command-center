import { useState } from "react";
import { Loader2, Zap } from "lucide-react";

export default function SkillShortcuts({ skills = [], onRun }) {
  const [runningName, setRunningName] = useState(null);

  const handleClick = async (name) => {
    if (runningName) return;
    setRunningName(name);
    try {
      await Promise.resolve(onRun?.(name));
    } finally {
      setRunningName(null);
    }
  };

  if (!skills || skills.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {skills.map((name) => {
        const running = runningName === name;
        return (
          <button
            key={name}
            type="button"
            onClick={() => handleClick(name)}
            disabled={running}
            className={[
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition",
              running
                ? "bg-jarvis-cyan/5 text-jarvis-cyan/60 border-jarvis-cyan/20 cursor-not-allowed"
                : "bg-jarvis-cyan/10 text-jarvis-cyan border-jarvis-cyan/30 hover:bg-jarvis-cyan/20 shadow-glow-cyan",
            ].join(" ")}
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            {name}
          </button>
        );
      })}
    </div>
  );
}
