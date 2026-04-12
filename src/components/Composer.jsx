import { useState } from "react";
import { Mic, SendHorizontal, Plus } from "lucide-react";

export function Composer({ onSend }) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const submit = () => {
    const v = value.trim();
    if (!v) return;
    onSend?.(v);
    setValue("");
  };
  return (
    <div
      className={[
        "glass flex items-center gap-2 px-2 py-2 transition",
        focused ? "shadow-glow-cyan ring-1 ring-jarvis-cyan/40" : "",
      ].join(" ")}
    >
      <button className="p-2 rounded-lg hover:bg-white/5 text-jarvis-muted transition">
        <Plus size={16} />
      </button>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Ask JARVIS anything…"
        className="flex-1 bg-transparent outline-none text-[14px] text-jarvis-ink placeholder:text-jarvis-muted px-2"
      />
      <button className="p-2 rounded-lg hover:bg-white/5 text-jarvis-cyan transition">
        <Mic size={16} />
      </button>
      <button
        onClick={submit}
        className="px-3 py-2 rounded-lg bg-jarvis-cyan/15 text-jarvis-cyan hover:bg-jarvis-cyan/25 transition flex items-center gap-1.5"
      >
        <SendHorizontal size={15} />
      </button>
    </div>
  );
}
