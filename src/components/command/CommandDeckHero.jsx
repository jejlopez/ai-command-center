import { motion as Motion } from 'framer-motion';
import { cn } from '../../utils/cn';

function ToneBadge({ children, tone = 'teal' }) {
  const tones = {
    teal: 'border-aurora-teal/18 bg-aurora-teal/[0.09] text-aurora-teal',
    amber: 'border-aurora-amber/18 bg-aurora-amber/[0.09] text-aurora-amber',
    rose: 'border-aurora-rose/18 bg-aurora-rose/[0.09] text-aurora-rose',
    blue: 'border-aurora-blue/18 bg-aurora-blue/[0.09] text-aurora-blue',
    violet: 'border-aurora-violet/18 bg-aurora-violet/[0.09] text-aurora-violet',
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
    teal: 'bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.12),transparent_28%),radial-gradient(circle_at_82%_0%,rgba(96,165,250,0.08),transparent_24%)]',
    violet: 'bg-[radial-gradient(circle_at_top_left,rgba(167,139,250,0.12),transparent_28%),radial-gradient(circle_at_82%_0%,rgba(45,212,191,0.08),transparent_24%)]',
    blue: 'bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.12),transparent_28%),radial-gradient(circle_at_82%_0%,rgba(167,139,250,0.08),transparent_24%)]',
  };
  const chromeClass = chrome === 'epic'
    ? 'before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/16 before:to-transparent'
    : '';

  return (
    <section
      className={cn(
        'deck-shell',
        chromeClass,
        className
      )}
    >
      <div className={cn('pointer-events-none absolute inset-0', glowClass[glow] || glowClass.teal)} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:140px_140px]" />
      {chrome === 'epic' && (
        <>
          <Motion.div
            initial={{ opacity: 0.12, x: '-35%' }}
            animate={{ opacity: 0.24, x: '140%' }}
            transition={{ duration: 7.2, repeat: Infinity, ease: 'linear' }}
            className="pointer-events-none absolute top-0 h-full w-24 bg-[linear-gradient(90deg,transparent,rgba(214,199,161,0.08),transparent)] blur-xl"
          />
        </>
      )}
      <Motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative flex flex-col gap-6 px-6 py-6 xl:flex-row xl:items-end xl:justify-between"
      >
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-text-muted">
            {EyebrowIcon ? <EyebrowIcon className="h-3.5 w-3.5 text-[#d6c7a1]" /> : null}
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
