import { motion as Motion } from 'framer-motion';
import { cn } from '../../utils/cn';

function ToneBadge({ children, tone = 'teal' }) {
  const tones = {
    teal: 'border-aurora-teal/20 bg-aurora-teal/10 text-aurora-teal',
    amber: 'border-aurora-amber/20 bg-aurora-amber/10 text-aurora-amber',
    rose: 'border-aurora-rose/20 bg-aurora-rose/10 text-aurora-rose',
    blue: 'border-aurora-blue/20 bg-aurora-blue/10 text-aurora-blue',
    violet: 'border-aurora-violet/20 bg-aurora-violet/10 text-aurora-violet',
  };

  return (
    <span className={cn('rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em]', tones[tone])}>
      {children}
    </span>
  );
}

export function CommandDeckHero({
  eyebrow,
  eyebrowIcon: EyebrowIcon,
  title,
  description,
  badges = [],
  actions,
  sideContent,
  orb,
  glow = 'teal',
  className,
  titleClassName,
  descriptionClassName,
  chrome = 'default',
}) {
  const glowClass = {
    teal: 'bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.16),transparent_28%),radial-gradient(circle_at_82%_0%,rgba(96,165,250,0.12),transparent_22%),linear-gradient(120deg,rgba(255,255,255,0.06),transparent_48%)]',
    violet: 'bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.16),transparent_28%),radial-gradient(circle_at_82%_0%,rgba(45,212,191,0.12),transparent_22%),linear-gradient(120deg,rgba(255,255,255,0.06),transparent_48%)]',
    blue: 'bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.16),transparent_28%),radial-gradient(circle_at_82%_0%,rgba(167,139,250,0.12),transparent_22%),linear-gradient(120deg,rgba(255,255,255,0.06),transparent_48%)]',
  };
  const chromeClass = chrome === 'epic'
    ? 'before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent'
    : '';

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[30px] border border-white/8 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] shadow-[0_30px_120px_rgba(0,0,0,0.35)]',
        chromeClass,
        className
      )}
    >
      <div className={cn('pointer-events-none absolute inset-0', glowClass[glow] || glowClass.teal)} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:120px_120px]" />
      {chrome === 'epic' && (
        <>
          <Motion.div
            initial={{ opacity: 0.16, x: '-35%' }}
            animate={{ opacity: 0.34, x: '140%' }}
            transition={{ duration: 4.8, repeat: Infinity, ease: 'linear' }}
            className="pointer-events-none absolute top-0 h-full w-24 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent)] blur-xl"
          />
          <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:repeating-linear-gradient(180deg,rgba(255,255,255,0.16)_0px,rgba(255,255,255,0.16)_1px,transparent_1px,transparent_10px)]" />
        </>
      )}
      <Motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative flex flex-col gap-6 px-6 py-6 xl:flex-row xl:items-end xl:justify-between"
      >
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">
            {EyebrowIcon ? <EyebrowIcon className="h-3.5 w-3.5 text-aurora-teal" /> : null}
            {eyebrow}
          </div>
          <h1 className={cn('mt-4 max-w-4xl text-4xl font-semibold tracking-tight text-text-primary', titleClassName)}>
            {title}
          </h1>
          <p className={cn('mt-3 max-w-2xl text-sm leading-6 text-text-muted', descriptionClassName)}>{description}</p>
          {badges.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-3">
              {badges.map((badge) => (
                <ToneBadge key={`${badge.label}-${badge.value}`} tone={badge.tone}>
                  {badge.value} {badge.label}
                </ToneBadge>
              ))}
            </div>
          )}
          {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        <div className="flex w-full max-w-sm flex-col gap-4 xl:items-end">
          {orb ? (
            <Motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              className="flex justify-center xl:justify-end"
            >
              {orb}
            </Motion.div>
          ) : null}
          {sideContent ? (
            <Motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
              className="w-full"
            >
              {sideContent}
            </Motion.div>
          ) : null}
        </div>
      </Motion.div>
    </section>
  );
}
