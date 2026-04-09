import { motion as Motion } from 'framer-motion';

export function CommandSectionHeader({ eyebrow, title, description, icon: Icon, tone = 'teal', action }) {
  const tones = {
    teal: 'text-aurora-teal',
    blue: 'text-aurora-blue',
    amber: 'text-aurora-amber',
    violet: 'text-aurora-violet',
    rose: 'text-aurora-rose',
  };

  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-text-muted">
          {Icon ? <Icon className={`h-3.5 w-3.5 ${tones[tone]}`} /> : null}
          {eyebrow}
        </div>
        <h2 className="mt-2 text-xl font-semibold text-text-primary">{title}</h2>
        {description ? <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{description}</p> : null}
      </div>
      {action ? (
        <Motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
          {action}
        </Motion.div>
      ) : null}
    </div>
  );
}
