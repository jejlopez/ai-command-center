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
 ? "bg-jarvis-primary/5 text-jarvis-primary/60 border-jarvis-primary/20 cursor-not-allowed"
 : "bg-jarvis-primary/10 text-jarvis-primary border-jarvis-primary/30 hover:bg-jarvis-primary/20",
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
