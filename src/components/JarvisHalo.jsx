export function JarvisHalo({ size = 44 }) {
  return (
    <div
      className="relative grid place-items-center rounded-full"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full bg-jarvis-cyan/10 pulse-cyan"
        style={{ boxShadow: "0 0 36px rgba(93,232,255,0.35), inset 0 0 18px rgba(93,232,255,0.25)" }}
      />
      <div className="absolute inset-[3px] rounded-full border border-jarvis-cyan/40" />
      <div className="absolute inset-[8px] rounded-full border border-jarvis-cyan/20" />
      <div className="relative w-[38%] h-[38%] rounded-full bg-jarvis-cyan shadow-glow-cyan" />
    </div>
  );
}
