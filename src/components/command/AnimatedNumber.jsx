import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, animate, motion as Motion, useMotionValue } from 'framer-motion';
import { cn } from '../../utils/cn';

function formatDisplay(value, decimals, prefix, suffix) {
  const number = Number(value) || 0;
  return `${prefix}${number.toFixed(decimals)}${suffix}`;
}

export function AnimatedNumber({
  value = 0,
  prefix = '',
  suffix = '',
  decimals = 0,
  className,
}) {
  const motionValue = useMotionValue(Number(value) || 0);
  const [display, setDisplay] = useState(Number(value) || 0);

  useEffect(() => {
    const target = Number(value) || 0;
    const controls = animate(motionValue, target, {
      duration: 0.6,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplay(latest),
    });
    return () => controls.stop();
  }, [motionValue, value]);

  const formatted = useMemo(
    () => formatDisplay(display, decimals, prefix, suffix),
    [decimals, display, prefix, suffix]
  );

  return (
    <span className={cn('inline-flex items-center leading-none', className)}>
      {formatted.split('').map((char, index) => (
        <span key={`${index}-${char}`} className="relative inline-flex h-[1.18em] overflow-hidden align-baseline leading-none">
          <AnimatePresence mode="popLayout" initial={false}>
            <Motion.span
              key={`${index}-${char}-flip`}
              initial={{ y: '100%', opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: '-100%', opacity: 0 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
              className="inline-block leading-none"
            >
              {char}
            </Motion.span>
          </AnimatePresence>
        </span>
      ))}
    </span>
  );
}
