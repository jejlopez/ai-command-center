export function SegmentedControl({ value, onChange, options }) {
  return (
    <div className="inline-flex p-1 rounded-xl bg-jarvis-panel/60 border border-jarvis-border">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={[
              "px-4 py-1.5 text-[12px] font-medium rounded-lg transition",
              active
                ? "bg-jarvis-cyan/15 text-jarvis-cyan shadow-glow-cyan"
                : "text-jarvis-body hover:text-jarvis-ink",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
