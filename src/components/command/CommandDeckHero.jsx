import { motion as Motion } from 'framer-motion';
import { cn } from '../../utils/cn';

function ToneBadge({ children, tone = 'teal' }) {
  const tones = {
    teal: 'border-aurora-teal/25 bg-aurora-teal/10 text-aurora-teal',
    amber: 'border-aurora-amber/25 bg-aurora-amber/10 text-aurora-amber',
    rose: 'border-aurora-rose/25 bg-aurora-rose/10 text-aurora-rose',
    blue: 'border-aurora-blue/25 bg-aurora-blue/10 text-aurora-blue',
    violet: 'border-aurora-violet/25 bg-aurora-violet/10 text-aurora-violet',
  };

  return (
    <span className={cn('ui-chip rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.18em] shadow-sm', tones[tone])}>
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
    teal: 'bg-[radial-gradient(circle_at_top_left,var(--color-aurora-teal),transparent_35%)]',
    violet: 'bg-[radial-gradient(circle_at_top_left,var(--color-aurora-violet),transparent_35%)]',
    blue: 'bg-[radial-gradient(circle_at_top_left,var(--color-aurora-blue),transparent_35%)]',
  };
  
  const chromeClass = chrome === 'epic' 
    ? 'before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-aurora-teal/20 before:to-transparent'
    : '';

  return (
    <section
      className={cn(
        'ui-shell relative overflow-hidden',
        chromeClass,
        className
      )}
    >
      <div className={cn('pointer-events-none absolute inset-0 opacity-[0.08]', glowClass[glow] || glowClass.teal)} />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(var(--color-text)_1px,transparent_1px),linear-gradient(90deg,var(--color-text)_1px,transparent_1px)] [background-size:140px_140px]" />
      
      {chrome === 'epic' && (
        <Motion.div
          initial={{ opacity: 0.05, x: '-35%' }}
          animate={{ opacity: 0.15, x: '140%' }}
          transition={{ duration: 7.2, repeat: Infinity, ease: 'linear' }}
          className="pointer-events-none absolute top-0 h-full w-24 bg-[linear-gradient(90deg,transparent,var(--color-panel-soft),transparent)] blur-2xl"
        />
      )}

      <Motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative flex flex-col gap-6 px-8 py-8 xl:flex-row xl:items-end xl:justify-between"
      >
        <div className="max-w-3xl">
          <div className="ui-kicker inline-flex items-center gap-2 rounded-full border border-hairline bg-panel-soft px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.25em] text-text-dim">
            {EyebrowIcon ? <EyebrowIcon className="h-3.5 w-3.5 opacity-60" /> : null}
            {eyebrow}
          </div>
          <h1 className={cn('mt-6 max-w-4xl text-text font-black tracking-tight leading-[0.95]', titleClassName)}>
            {title}
          </h1>
          <p className={cn('mt-4 max-w-2xl text-[15px] leading-relaxed text-text-dim', descriptionClassName)}>{description}</p>
          
          {badges.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-3">
              {badges.map((badge) => (
                <ToneBadge key={`${badge.label}-${badge.value}`} tone={badge.tone}>
                  {badge.value} {badge.label}
                </ToneBadge>
              ))}
            </div>
          )}
          
          {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
        </div>

        <div className="flex w-full max-w-sm flex-col gap-6 xl:items-end">
          {orb && (
            <Motion.div
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, ease: 'easeOut' }}
              className="flex justify-center xl:justify-end"
            >
              {orb}
            </Motion.div>
          )}
          {sideContent && (
            <Motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut', delay: 0.08 }}
              className="w-full"
            >
              {sideContent}
            </Motion.div>
          )}
        </div>
      </Motion.div>
    </section>
  );
}
