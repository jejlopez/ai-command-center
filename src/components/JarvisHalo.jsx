export function JarvisHalo({ size = 44 }) {
  const inner = Math.round(size * 0.36);
  return (
    <div
      className="relative grid place-items-center rounded-full"
      style={{ width: size, height: size }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 rounded-full bg-jarvis-primary/8 pulse-primary"
        style={{ boxShadow: "0 0 40px rgba(93,232,255,0.25), inset 0 0 20px rgba(93,232,255,0.15)" }}
      />
      {/* Outer ring */}
      <div className="absolute inset-[2px] rounded-full border border-jarvis-primary/30" />
      {/* Inner ring */}
      <div className="absolute inset-[7px] rounded-full border border-jarvis-primary/15" />
      {/* Core */}
      <div
        className="relative rounded-full bg-jarvis-primary"
        style={{
          width: inner,
          height: inner,
          boxShadow: "0 0 12px rgba(93,232,255,0.5), 0 0 4px rgba(93,232,255,0.8)",
        }}
      />
    </div>
  );
}
